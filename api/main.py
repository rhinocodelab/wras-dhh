from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles

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
from routes import announcement_audio
from routes import final_announcement

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

class MultiLanguageTTSRequest(BaseModel):
    text: str
    source_language: str  # "en", "hi", "mr", "gu"

class ISLVideoRequest(BaseModel):
    announcement_text: str

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

@app.post("/text-to-speech-multi-language")
async def convert_text_to_speech_multi_language(request: MultiLanguageTTSRequest):
    """
    Convert text to speech in the source language only.
    Accepts text in English, Hindi, Marathi, or Gujarati and generates audio in that language.
    """
    try:
        if not request.text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")

        # Validate source language
        supported_languages = {
            "en": "English",
            "hi": "Hindi",
            "mr": "Marathi",
            "gu": "Gujarati"
        }

        if request.source_language not in supported_languages:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported source language. Supported languages: {list(supported_languages.keys())}"
            )

        # Map source language to voice name
        voice_mapping = {
            "en": "en-IN-Chirp3-HD-Achernar",
            "hi": "hi-IN-Chirp3-HD-Achernar",
            "mr": "mr-IN-Chirp3-HD-Achernar",
            "gu": "gu-IN-Chirp3-HD-Achernar"
        }

        voice_name = voice_mapping[request.source_language]
        language_name = supported_languages[request.source_language]

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

        return {
            "original_text": request.text,
            "source_language": request.source_language,
            "language_name": language_name,
            "voice_name": voice_name,
            "audio_base64": audio_base64,
            "file_name": f"speech_{request.source_language}.mp3",
            "success": True,
            "message": f"Text-to-speech completed for {language_name}"
        }

    except Exception as e:
        print(f"Multi-language text-to-speech error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Text-to-speech failed: {str(e)}")

# Include template routes
app.include_router(templates.router, prefix="/api", tags=["templates"])

# Include audio files routes
app.include_router(audio_files.router, prefix="/api", tags=["audio-files"])

# Include announcement audio routes
app.include_router(announcement_audio.router, prefix="/api", tags=["announcement-audio"])

# Include final announcement routes
app.include_router(final_announcement.router, prefix="/api", tags=["final-announcement"])

@app.post("/generate-isl-video")
async def generate_isl_video(request: ISLVideoRequest):
    """
    Generate ISL video from announcement text by combining individual word videos
    """
    try:
        if not request.announcement_text.strip():
            raise HTTPException(status_code=400, detail="Announcement text cannot be empty")
        
        # Step 1: Convert text to lowercase
        text = request.announcement_text.lower().strip()
        
        # Step 2: Split text into words
        words = text.split()
        
        # Step 3: Find matching videos in isl_dataset
        isl_dataset_path = "isl_dataset"
        available_videos = []
        
        for word in words:
            # Check if word folder exists in isl_dataset
            word_folder = os.path.join(isl_dataset_path, word)
            if os.path.exists(word_folder):
                # Look for mp4 files in the folder
                for file in os.listdir(word_folder):
                    if file.endswith('.mp4'):
                        video_path = os.path.join(word_folder, file)
                        available_videos.append(video_path)
                        break  # Use first mp4 file found
            else:
                print(f"Word '{word}' not found in ISL dataset, skipping...")
        
        if not available_videos:
            raise HTTPException(
                status_code=404, 
                detail=f"No matching ISL videos found for the given text. Available words in dataset: {', '.join(os.listdir(isl_dataset_path))}"
            )
        
        # Step 4: Generate unique output filename
        import hashlib
        import time
        text_hash = hashlib.md5(text.encode()).hexdigest()[:8]
        timestamp = int(time.time())
        output_filename = f"isl_announcement_{text_hash}_{timestamp}.mp4"
        
        # Create final_isl_vid directory if it doesn't exist
        final_isl_vid_dir = "/var/www/final_isl_vid"
        try:
            os.makedirs(final_isl_vid_dir, exist_ok=True)
            # Test write permissions
            test_file = os.path.join(final_isl_vid_dir, "test_write.tmp")
            with open(test_file, 'w') as f:
                f.write("test")
            os.remove(test_file)
        except PermissionError:
            raise HTTPException(status_code=500, detail=f"Permission denied: Cannot write to {final_isl_vid_dir}. Please check directory permissions.")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error creating directory {final_isl_vid_dir}: {str(e)}")
        
        output_path = os.path.join(final_isl_vid_dir, output_filename)
        
        # Step 5: Use ffmpeg to concatenate videos
        try:
            import subprocess
            
            # Create a temporary file list for ffmpeg
            temp_list_file = f"temp_video_list_{timestamp}.txt"
            with open(temp_list_file, 'w') as f:
                for video_path in available_videos:
                    f.write(f"file '{video_path}'\n")
            
            # Run ffmpeg command to concatenate videos
            ffmpeg_cmd = [
                'ffmpeg',
                '-f', 'concat',
                '-safe', '0',
                '-i', temp_list_file,
                '-c', 'copy',
                output_path,
                '-y'  # Overwrite output file if it exists
            ]
            
            result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
            
            # Clean up temporary file
            os.remove(temp_list_file)
            
            if result.returncode != 0:
                print(f"FFmpeg error: {result.stderr}")
                error_msg = f"FFmpeg failed with return code {result.returncode}"
                if "Permission denied" in result.stderr:
                    error_msg = f"Permission denied: Cannot write to output directory. Please check permissions for {final_isl_vid_dir}"
                elif "No such file or directory" in result.stderr:
                    error_msg = "Some input video files not found in ISL dataset"
                else:
                    error_msg = f"FFmpeg error: {result.stderr[:200]}..."  # Truncate long error messages
                raise HTTPException(status_code=500, detail=error_msg)
            
            # Return the video file
            if os.path.exists(output_path):
                return {
                    "success": True,
                    "message": f"ISL video generated successfully with {len(available_videos)} words",
                    "video_filename": output_filename,
                    "video_url": f"/final_isl_vid/{output_filename}",
                    "words_processed": len(available_videos),
                    "total_words": len(words),
                    "skipped_words": len(words) - len(available_videos)
                }
            else:
                raise HTTPException(status_code=500, detail="Generated video file not found")
                
        except subprocess.SubprocessError as e:
            raise HTTPException(status_code=500, detail=f"FFmpeg processing error: {str(e)}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Video generation error: {str(e)}")
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error in ISL video generation: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during ISL video generation")

# Mount static files for audio serving
try:
    app.mount("/audio_files", StaticFiles(directory="/var/www/audio_files"), name="audio_files")
    print("✅ Audio files mounted at /audio_files")
except Exception as e:
    print(f"⚠️ Could not mount audio files: {e}")
    print("Audio files will be served via individual endpoints")

# Mount static files for ISL videos
try:
    app.mount("/isl_videos", StaticFiles(directory="isl_dataset"), name="isl_videos")
    print("✅ ISL videos mounted at /isl_videos")
except Exception as e:
    print(f"⚠️ Could not mount ISL videos: {e}")
    print("ISL videos will not be available")

# Mount static files for final ISL videos
try:
    app.mount("/final_isl_vid", StaticFiles(directory="/var/www/final_isl_vid"), name="final_isl_vid")
    print("✅ Final ISL videos mounted at /final_isl_vid")
except Exception as e:
    print(f"⚠️ Could not mount final ISL videos: {e}")
    print("Final ISL videos will not be available")

# Fallback audio file serving endpoint
@app.get("/audio_files/{filename}")
async def serve_audio_file(filename: str):
    """Serve audio files from /var/www/audio_files/"""
    import os
    file_path = f"/var/www/audio_files/{filename}"
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    return FileResponse(
        path=file_path,
        media_type="audio/mpeg",
        filename=filename
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app", 
        host=Config.HOST, 
        port=Config.PORT, 
        reload=Config.RELOAD
    ) 