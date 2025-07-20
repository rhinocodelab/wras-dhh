from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from pydantic import BaseModel
import os
import io
from google.cloud import translate_v2 as translate
from google.cloud import texttospeech
from google.oauth2 import service_account
from config import Config
from database import create_tables
from routes import templates
from routes import audio_files

# Initialize FastAPI app
app = FastAPI(
    title=Config.API_TITLE,
    description=Config.API_DESCRIPTION,
    version=Config.API_VERSION
)

# Configure CORS to allow requests from frontend and backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=False,  # Set to False when using allow_origins=["*"]
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)

# Initialize database
create_tables()

# Load GCP credentials
credentials_path = Config.get_gcp_credentials_path()
if not os.path.exists(credentials_path):
    raise FileNotFoundError(f"GCP credentials file not found at {credentials_path}")

credentials = service_account.Credentials.from_service_account_file(credentials_path)
translate_client = translate.Client(credentials=credentials)
tts_client = texttospeech.TextToSpeechClient(credentials=credentials)

# Pydantic models
class TranslationRequest(BaseModel):
    text: str
    source_language: str = Config.DEFAULT_SOURCE_LANGUAGE

class TranslationResponse(BaseModel):
    original_text: str
    translations: dict
    success: bool
    message: str = "Translation completed successfully"

class TTSRequest(BaseModel):
    text: str
    language: str = "English"  # Default to English

class TTSResponse(BaseModel):
    original_text: str
    language: str
    voice_name: str
    success: bool
    message: str = "Text-to-speech completed successfully"

@app.get("/")
async def root():
    return {"message": "WRAS-DHH Translation API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "translation-api"}

@app.post("/translate", response_model=TranslationResponse)
async def translate_text(request: TranslationRequest):
    """
    Translate Indian English text to Marathi, Hindi, and Gujarati
    """
    try:
        if not request.text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        # Target languages
        target_languages = Config.TARGET_LANGUAGES
        
        translations = {}
        
        # Translate to each target language
        for lang_code, lang_name in target_languages.items():
            try:
                result = translate_client.translate(
                    request.text,
                    target_language=lang_code,
                    source_language=request.source_language
                )
                translations[lang_name] = result['translatedText']
            except Exception as e:
                print(f"Error translating to {lang_name}: {str(e)}")
                translations[lang_name] = f"Translation error: {str(e)}"
        
        return TranslationResponse(
            original_text=request.text,
            translations=translations,
            success=True
        )
        
    except Exception as e:
        print(f"Translation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")

@app.get("/supported-languages")
async def get_supported_languages():
    """
    Get list of supported languages for translation
    """
    try:
        languages = translate_client.get_languages()
        return {
            "supported_languages": languages,
            "count": len(languages)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch languages: {str(e)}")

@app.post("/text-to-speech")
async def convert_text_to_speech(request: TTSRequest):
    """
    Convert text to speech using GCP Text-to-Speech API
    """
    try:
        if not request.text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        # Get voice name for the specified language
        voice_name = Config.TTS_VOICES.get(request.language)
        if not voice_name:
            raise HTTPException(status_code=400, detail=f"Unsupported language: {request.language}")
        
        # Configure the text-to-speech request
        synthesis_input = texttospeech.SynthesisInput(text=request.text)
        
        # Configure the voice
        voice = texttospeech.VoiceSelectionParams(
            language_code=voice_name.split('-')[0] + '-' + voice_name.split('-')[1],  # e.g., "en-IN"
            name=voice_name,
            ssml_gender=texttospeech.SsmlVoiceGender.NEUTRAL
        )
        
        # Configure the audio output
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=0.9,  # Slightly slower for clarity
            pitch=0.0,  # Normal pitch
            volume_gain_db=0.0  # Normal volume
        )
        
        # Perform the text-to-speech request
        response = tts_client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config
        )
        
        # Return the audio as a streaming response
        audio_stream = io.BytesIO(response.audio_content)
        audio_stream.seek(0)
        
        return StreamingResponse(
            audio_stream,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": f"attachment; filename=speech_{request.language.lower()}.mp3"
            }
        )
        
    except Exception as e:
        print(f"Text-to-speech error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Text-to-speech failed: {str(e)}")

@app.post("/text-to-speech-all-languages")
async def convert_text_to_speech_all_languages(request: TTSRequest):
    """
    Convert text to speech in all supported Indian languages
    """
    try:
        if not request.text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        audio_files = {}
        
        # Generate speech for each language
        for language, voice_name in Config.TTS_VOICES.items():
            try:
                # Configure the text-to-speech request
                synthesis_input = texttospeech.SynthesisInput(text=request.text)
                
                # Configure the voice
                voice = texttospeech.VoiceSelectionParams(
                    language_code=voice_name.split('-')[0] + '-' + voice_name.split('-')[1],
                    name=voice_name,
                    ssml_gender=texttospeech.SsmlVoiceGender.NEUTRAL
                )
                
                # Configure the audio output
                audio_config = texttospeech.AudioConfig(
                    audio_encoding=texttospeech.AudioEncoding.MP3,
                    speaking_rate=0.9,
                    pitch=0.0,
                    volume_gain_db=0.0
                )
                
                # Perform the text-to-speech request
                response = tts_client.synthesize_speech(
                    input=synthesis_input,
                    voice=voice,
                    audio_config=audio_config
                )
                
                # Convert audio content to base64 for JSON response
                import base64
                audio_base64 = base64.b64encode(response.audio_content).decode('utf-8')
                audio_files[language] = {
                    "voice_name": voice_name,
                    "audio_base64": audio_base64,
                    "file_name": f"speech_{language.lower()}.mp3"
                }
                
            except Exception as e:
                print(f"Error generating speech for {language}: {str(e)}")
                audio_files[language] = {
                    "error": f"Failed to generate speech: {str(e)}"
                }
        
        return {
            "original_text": request.text,
            "audio_files": audio_files,
            "success": True,
            "message": "Text-to-speech completed for all languages"
        }
        
    except Exception as e:
        print(f"Text-to-speech error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Text-to-speech failed: {str(e)}")

# Include template routes
app.include_router(templates.router, prefix="/api", tags=["templates"])

# Include audio files routes
app.include_router(audio_files.router, prefix="/api", tags=["audio-files"])

# Audio files are now served by Apache2 from /var/www/audio_files/
# No need to mount static files in FastAPI

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app", 
        host=Config.HOST, 
        port=Config.PORT, 
        reload=Config.RELOAD
    ) 