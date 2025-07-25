from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from pydantic import BaseModel
import os
import io
import subprocess
from datetime import datetime
from google.cloud import translate_v2 as translate
from google.cloud import texttospeech
from google.cloud import speech_v1p1beta1 as speech
from google.protobuf import wrappers_pb2
from google.oauth2 import service_account
from config import Config
from database import create_tables
from models import AudioFile
from routes import templates
from routes import audio_files
from routes import announcement_audio
from routes import final_announcement
from routes import publish_isl

# Initialize FastAPI app
app = FastAPI(
    title=Config.API_TITLE,
    description=Config.API_DESCRIPTION,
    version=Config.API_VERSION
)

# Configure CORS to allow requests from frontend and backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Frontend development server
        "http://localhost:3000",  # Frontend production server
        "http://localhost:3001",  # Backend server
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://192.168.1.92:5173",  # Network IP for development
        "http://192.168.1.92:3000",  # Network IP for production
        "http://192.168.1.92:3001",  # Network IP for backend
    ],
    allow_credentials=True,  # Allow credentials for authenticated requests
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=[
        "Content-Type", 
        "Authorization", 
        "Accept", 
        "Origin", 
        "X-Requested-With",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers"
    ],
    expose_headers=["Content-Disposition", "Content-Length"],
    max_age=3600,  # Cache preflight requests for 1 hour
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
speech_client = speech.SpeechClient(credentials=credentials)

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

class CleanupFileRequest(BaseModel):
    file_path: str

# Note: SpeechToTextRequest will be handled with Form data for file upload

class SpeechToTextResponse(BaseModel):
    spoken_text: str
    english_text: str
    language: str
    success: bool
    message: str = "Speech-to-text completed successfully"

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

        # Function to convert digits to words for better pronunciation
        def convert_digits_to_words(text: str) -> str:
            import re
            # Replace individual digits with their word equivalents
            digit_mapping = {
                '0': 'zero',
                '1': 'one',
                '2': 'two',
                '3': 'three',
                '4': 'four',
                '5': 'five',
                '6': 'six',
                '7': 'seven',
                '8': 'eight',
                '9': 'nine'
            }
            
            # Use regex to find and replace digits while preserving other characters
            def replace_digit(match):
                digit = match.group(0)
                return digit_mapping.get(digit, digit)
            
            # Replace digits with words
            processed_text = re.sub(r'\d', replace_digit, text)
            return processed_text

        # Process the text to convert digits to words
        processed_text = convert_digits_to_words(request.text)
        
        # Configure the text-to-speech request
        synthesis_input = texttospeech.SynthesisInput(text=processed_text)

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
app.include_router(publish_isl.router, prefix="/api", tags=["publish-isl"])

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
        
        print(f"Looking for videos in: {os.path.abspath(isl_dataset_path)}")
        print(f"Words to find: {words}")
        
        for word in words:
            # Check if word folder exists in isl_dataset
            word_folder = os.path.join(isl_dataset_path, word)
            print(f"Checking folder: {word_folder}")
            
            if os.path.exists(word_folder):
                # Look for mp4 files in the folder
                for file in os.listdir(word_folder):
                    if file.endswith('.mp4'):
                        video_path = os.path.join(word_folder, file)
                        available_videos.append(video_path)
                        print(f"Found video: {video_path}")
                        break  # Use first mp4 file found
            else:
                print(f"Word '{word}' not found in ISL dataset, skipping...")
        
        print(f"Total available videos found: {len(available_videos)}")
        print(f"Available videos: {available_videos}")
        
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
            
            print(f"Running FFmpeg command: {' '.join(ffmpeg_cmd)}")
            print(f"Temp list file content:")
            with open(temp_list_file, 'r') as f:
                print(f.read())
            
            result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
            
            print(f"FFmpeg return code: {result.returncode}")
            if result.stdout:
                print(f"FFmpeg stdout: {result.stdout}")
            if result.stderr:
                print(f"FFmpeg stderr: {result.stderr}")
            
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

@app.get("/api/scan-isl-dataset")
async def scan_isl_dataset():
    """
    Scan the ISL dataset folder and return the list of available videos
    """
    try:
        isl_dataset_dir = "isl_dataset"
        videos = []
        
        if not os.path.exists(isl_dataset_dir):
            return {
                "success": False,
                "message": "ISL dataset directory not found",
                "videos": []
            }
        
        # Scan the directory structure
        for category_folder in os.listdir(isl_dataset_dir):
            category_path = os.path.join(isl_dataset_dir, category_folder)
            
            if os.path.isdir(category_path):
                # Look for video files in the category folder
                for video_file in os.listdir(category_path):
                    if video_file.lower().endswith(('.mp4', '.avi', '.mov', '.webm')):
                        video_path = os.path.join(category_path, video_file)
                        file_size = os.path.getsize(video_path)
                        
                        # Convert file size to human readable format
                        if file_size < 1024:
                            size_str = f"{file_size}B"
                        elif file_size < 1024 * 1024:
                            size_str = f"{file_size // 1024}KB"
                        else:
                            size_str = f"{file_size // (1024 * 1024):.1f}MB"
                        
                        videos.append({
                            "id": f"{category_folder}_{video_file.split('.')[0]}",
                            "name": video_file.split('.')[0].replace('_', ' ').title(),
                            "category": category_folder,
                            "path": f"/isl_videos/{category_folder}/{video_file}",
                            "size": size_str
                        })
        
        # Sort videos by category and name
        videos.sort(key=lambda x: (x["category"], x["name"]))
        
        return {
            "success": True,
            "message": f"Found {len(videos)} videos in ISL dataset",
            "videos": videos
        }
        
    except Exception as e:
        print(f"Error scanning ISL dataset: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to scan ISL dataset: {str(e)}")

@app.post("/api/speech-to-text", response_model=SpeechToTextResponse)
async def speech_to_text(
    audio: UploadFile = File(...),
    language: str = Form(...)
):
    """
    Convert speech to text using Google Cloud Speech-to-Text API with Indian language models
    """
    try:
        
        # Map language to Google Cloud Speech-to-Text language codes
        language_mapping = {
            "english": "en-IN",
            "hindi": "hi-IN", 
            "marathi": "mr-IN",
            "gujarati": "gu-IN"
        }
        
        if language not in language_mapping:
            raise HTTPException(status_code=400, detail=f"Unsupported language: {language}")
        
        # Read audio file
        audio_content = await audio.read()
        
        # Determine encoding based on file type
        encoding = speech.RecognitionConfig.AudioEncoding.WEBM_OPUS
        if audio.filename and audio.filename.endswith('.wav'):
            encoding = speech.RecognitionConfig.AudioEncoding.LINEAR16
        elif audio.filename and audio.filename.endswith('.mp3'):
            encoding = speech.RecognitionConfig.AudioEncoding.MP3
        elif audio.filename and audio.filename.endswith('.webm'):
            encoding = speech.RecognitionConfig.AudioEncoding.WEBM_OPUS
        elif audio.filename and audio.filename.endswith('.mp4'):
            encoding = speech.RecognitionConfig.AudioEncoding.MP3
        
        print(f"Audio filename: {audio.filename}")
        print(f"Using encoding: {encoding}")
        print(f"Audio content size: {len(audio_content)} bytes")
        
        # Configure the speech recognition request
        recognition_audio = speech.RecognitionAudio(content=audio_content)
        
        config = speech.RecognitionConfig(
            encoding=encoding,
            sample_rate_hertz=48000,  # Match the frontend sample rate
            language_code=language_mapping[language],
            enable_automatic_punctuation=True,
            enable_spoken_punctuation=wrappers_pb2.BoolValue(value=True),
            model="latest_long",
            use_enhanced=True
        )
        
        # Perform speech recognition
        try:
            response = speech_client.recognize(config=config, audio=recognition_audio)
            
            print(f"Speech recognition response: {response}")
            print(f"Number of results: {len(response.results)}")
            
            if not response.results:
                return SpeechToTextResponse(
                    spoken_text="",
                    english_text="",
                    language=language,
                    success=False,
                    message="No speech detected in the audio"
                )
        except Exception as e:
            print(f"Speech recognition error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Speech recognition failed: {str(e)}")
        
        # Extract the transcribed text
        spoken_text = ""
        for result in response.results:
            if result.alternatives:
                spoken_text += result.alternatives[0].transcript + " "
        
        spoken_text = spoken_text.strip()
        
        # Translate to English if the spoken language is not English
        english_text = spoken_text
        if language != "english":
            try:
                # Use Google Translate to convert to English
                translation_result = translate_client.translate(
                    spoken_text,
                    target_language="en",
                    source_language=language_mapping[language].split("-")[0]
                )
                english_text = translation_result["translatedText"]
            except Exception as e:
                print(f"Translation error: {e}")
                # If translation fails, use the spoken text as English text
                english_text = spoken_text
        
        return SpeechToTextResponse(
            spoken_text=spoken_text,
            english_text=english_text,
            language=language,
            success=True,
            message="Speech-to-text completed successfully"
        )
        
    except Exception as e:
        print(f"❌ Error in speech-to-text: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Speech-to-text failed: {str(e)}")

class SpeechToISLRequest(BaseModel):
    spoken_text: str
    english_text: str
    language: str

class SpeechToISLResponse(BaseModel):
    success: bool
    message: str
    video_url: str = ""
    audio_url: str = ""

@app.post("/api/speech-to-isl", response_model=SpeechToISLResponse)
async def speech_to_isl(request: SpeechToISLRequest):
    """
    Generate ISL video from speech-to-text results with merged audio
    """
    try:
        print(f"Speech-to-ISL request: {request}")
        
        # Validate input
        if not request.spoken_text and not request.english_text:
            raise HTTPException(status_code=400, detail="No text provided for ISL generation")
        
        # Use English text for ISL generation
        if not request.english_text:
            raise HTTPException(status_code=400, detail="English text is required for ISL video generation")
        
        isl_text = request.english_text
        
        # Language mapping for audio generation
        language_mapping = {
            "english": "English",
            "hindi": "Hindi", 
            "marathi": "Marathi",
            "gujarati": "Gujarati"
        }
        
        spoken_language = language_mapping.get(request.language, "English")
        
        # Generate announcement text for both languages
        announcement_text = f"Announcement in {spoken_language}: {request.spoken_text}"
        if request.english_text and request.english_text != request.spoken_text:
            announcement_text += f" English: {request.english_text}"
        
        print(f"Generated announcement text: {announcement_text}")
        
        # Generate ISL video
        isl_video_path = await generate_isl_video_from_text(isl_text)
        
        # Generate merged audio
        audio_path = await generate_merged_audio(request.spoken_text, request.english_text, spoken_language)
        
        # Create response URLs (relative paths that will be proxied)
        video_url = f"/translation-api/api/speech-isl-video/{isl_video_path}" if isl_video_path else ""
        audio_url = f"/translation-api/api/speech-isl-audio/{os.path.basename(audio_path)}" if audio_path else ""
        
        return SpeechToISLResponse(
            success=True,
            message="Speech-to-ISL completed successfully",
            video_url=video_url,
            audio_url=audio_url
        )
        
    except Exception as e:
        print(f"❌ Error in speech-to-isl: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Speech-to-ISL failed: {str(e)}")

async def generate_isl_video_from_text(text: str) -> str:
    """
    Generate ISL video from text and save to /var/www/final_speech_isl_vid/
    """
    try:
        print(f"Generating ISL video for text: {text}")
        
        # Step 1: Convert text to lowercase
        text = text.lower().strip()
        
        # Step 2: Split text into words
        words = text.split()
        
        # Step 3: Find matching videos in isl_dataset
        isl_dataset_path = "isl_dataset"
        available_videos = []
        
        print(f"Looking for videos in: {os.path.abspath(isl_dataset_path)}")
        print(f"Words to find: {words}")
        
        for word in words:
            # Check if word folder exists in isl_dataset
            word_folder = os.path.join(isl_dataset_path, word)
            print(f"Checking folder: {word_folder}")
            
            if os.path.exists(word_folder):
                # Look for mp4 files in the folder
                for file in os.listdir(word_folder):
                    if file.endswith('.mp4'):
                        video_path = os.path.join(word_folder, file)
                        available_videos.append(video_path)
                        print(f"Found video: {video_path}")
                        break  # Use first mp4 file found
            else:
                print(f"Word '{word}' not found in ISL dataset, skipping...")
        
        print(f"Total available videos found: {len(available_videos)}")
        print(f"Available videos: {available_videos}")
        
        if not available_videos:
            raise Exception(f"No matching ISL videos found for the given text. Available words in dataset: {', '.join(os.listdir(isl_dataset_path))}")
        
        # Step 4: Generate unique output filename
        import hashlib
        import time
        text_hash = hashlib.md5(text.encode()).hexdigest()[:8]
        timestamp = int(time.time())
        output_filename = f"speech_isl_{text_hash}_{timestamp}.mp4"
        
        # Create final_speech_isl_vid directory if it doesn't exist
        final_speech_isl_vid_dir = "/var/www/final_speech_isl_vid"
        try:
            os.makedirs(final_speech_isl_vid_dir, exist_ok=True)
            # Test write permissions
            test_file = os.path.join(final_speech_isl_vid_dir, "test_write.tmp")
            with open(test_file, 'w') as f:
                f.write("test")
            os.remove(test_file)
        except PermissionError:
            raise Exception(f"Permission denied: Cannot write to {final_speech_isl_vid_dir}. Please check directory permissions.")
        except Exception as e:
            raise Exception(f"Error creating directory {final_speech_isl_vid_dir}: {str(e)}")
        
        output_path = os.path.join(final_speech_isl_vid_dir, output_filename)
        
        # Step 5: Use ffmpeg to concatenate videos
        try:
            import subprocess
            
            # Create a temporary file list for ffmpeg
            temp_list_file = f"temp_speech_isl_list_{timestamp}.txt"
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
            
            print(f"Running FFmpeg command: {' '.join(ffmpeg_cmd)}")
            print(f"Temp list file content:")
            with open(temp_list_file, 'r') as f:
                print(f.read())
            
            result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
            
            print(f"FFmpeg return code: {result.returncode}")
            if result.stdout:
                print(f"FFmpeg stdout: {result.stdout}")
            if result.stderr:
                print(f"FFmpeg stderr: {result.stderr}")
            
            # Clean up temporary file
            os.remove(temp_list_file)
            
            if result.returncode != 0:
                print(f"FFmpeg error: {result.stderr}")
                error_msg = f"FFmpeg failed with return code {result.returncode}"
                if "Permission denied" in result.stderr:
                    error_msg = f"Permission denied: Cannot write to output directory. Please check permissions for {final_speech_isl_vid_dir}"
                elif "No such file or directory" in result.stderr:
                    error_msg = "Some input video files not found in ISL dataset"
                else:
                    error_msg = f"FFmpeg error: {result.stderr[:200]}..."  # Truncate long error messages
                raise Exception(error_msg)
            
            # Return the video filename
            if os.path.exists(output_path):
                print(f"ISL video generated successfully: {output_path}")
                return output_filename
            else:
                raise Exception("Generated video file not found")
                
        except subprocess.SubprocessError as e:
            raise Exception(f"FFmpeg processing error: {str(e)}")
        except Exception as e:
            raise Exception(f"Video generation error: {str(e)}")
            
    except Exception as e:
        print(f"Error generating ISL video: {str(e)}")
        raise e

async def generate_audio_file(text: str, language: str) -> str:
    """
    Generate audio file from text and save to disk
    """
    try:
        print(f"Generating audio file for text: {text}, language: {language}")
        
        # Get voice name for the specified language
        voice_name = Config.TTS_VOICES.get(language)
        if not voice_name:
            raise Exception(f"Unsupported language: {language}")
        
        # Configure the text-to-speech request
        synthesis_input = texttospeech.SynthesisInput(text=text)
        
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
            volume_gain_db=0.0,
            sample_rate_hertz=48000  # Consistent sample rate
        )
        
        # Perform the text-to-speech request
        response = tts_client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config
        )
        
        # Save audio to file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"speech_to_isl_{language.lower()}_{timestamp}.mp3"
        
        # Create merged_speech_to_isl directory if it doesn't exist
        merged_dir = "/var/www/audio_files/merged_speech_to_isl"
        os.makedirs(merged_dir, exist_ok=True)
        file_path = f"{merged_dir}/{filename}"
        
        # Write audio content to file
        with open(file_path, "wb") as f:
            f.write(response.audio_content)
        
        # Verify the file was created and has content
        if not os.path.exists(file_path):
            raise Exception("Failed to create audio file")
        
        file_size = os.path.getsize(file_path)
        if file_size < 1000:
            raise Exception(f"Generated audio file is too small: {file_size} bytes")
        
        print(f"Audio file saved: {file_path} ({file_size} bytes)")
        return file_path
        
    except Exception as e:
        print(f"Error generating audio file: {str(e)}")
        raise e

async def generate_merged_audio(spoken_text: str, english_text: str, language: str) -> str:
    """
    Generate merged audio file using existing audio files from Audio Files page
    """
    try:
        print(f"Generating merged audio - Spoken: {spoken_text}, English: {english_text}, Language: {language}")
        
        # Create merged audio using existing audio files from Audio Files page
        audio_files = []
        
        # Split English text into words to find matching audio files
        english_words = english_text.lower().split()
        
        # Language mapping for audio file search
        language_mapping = {
            "english": "English",
            "hindi": "Hindi", 
            "marathi": "Marathi",
            "gujarati": "Gujarati"
        }
        
        spoken_language = language_mapping.get(language, "English")
        
        print(f"Looking for audio files for words: {english_words}")
        print(f"Spoken language: {spoken_language}")
        
        # First, try to find complete audio files from Audio Files page
        complete_audio_file = await find_complete_audio_file(english_text)
        if complete_audio_file:
            print(f"Found complete audio file for text: {complete_audio_file}")
            return complete_audio_file
        
        # If no complete audio file found, try word-by-word matching
        print("No complete audio file found, searching word by word...")
        
        # Find existing audio files organized by language first
        all_language_audio_files = []
        languages_to_search = ["English", "Hindi", "Marathi", "Gujarati"]
        
        # Organize audio files by language first, then by word
        for lang in languages_to_search:
            language_audio_files = []
            
            for word in english_words:
                # Clean the word (remove punctuation, etc.)
                clean_word = word.strip('.,!?;:()[]{}"\'').lower()
                if clean_word:
                    # Search for audio file for this word in this language
                    audio_file_path = await find_existing_audio_file(clean_word, lang)
                    if audio_file_path:
                        print(f"Found existing audio for '{clean_word}' in {lang}: {audio_file_path}")
                        language_audio_files.append(audio_file_path)
                    else:
                        print(f"No existing audio found for '{clean_word}' in {lang}")
            
            # Add all audio files for this language to the main list
            all_language_audio_files.extend(language_audio_files)
        
        # If we found some audio files, merge them
        if all_language_audio_files:
            print(f"Found {len(all_language_audio_files)} audio files organized by language, merging...")
            if len(all_language_audio_files) > 1:
                merged_path = await merge_audio_files(all_language_audio_files)
                return merged_path
            else:
                return all_language_audio_files[0]
        
        # If no existing audio files found, generate new audio for the complete phrase in all four languages
        print("No existing audio files found, generating new audio for the complete phrase in all four languages...")
        fallback_audio_files = []
        
        # Generate audio in all four languages in sequence: English, Hindi, Marathi, Gujarati
        languages_to_generate = ["English", "Hindi", "Marathi", "Gujarati"]
        
        for lang in languages_to_generate:
            try:
                if english_text:
                    # Generate audio for the complete phrase in each language
                    audio_path = await generate_audio_file(english_text, lang)
                    fallback_audio_files.append(audio_path)
                    print(f"Generated {lang} audio: {audio_path}")
                else:
                    print(f"Skipping {lang} audio generation - no English text available")
            except Exception as e:
                print(f"Failed to generate {lang} audio: {e}")
                # Continue with other languages even if one fails
        
        # Ensure we have at least one audio file
        if not fallback_audio_files:
            # Generate a default audio if nothing else works
            default_text = english_text if english_text else "No text available"
            default_audio_path = await generate_audio_file(default_text, "English")
            fallback_audio_files.append(default_audio_path)
            print(f"Generated default audio: {default_audio_path}")
        
        # Merge all language audio files in sequence
        if len(fallback_audio_files) > 1:
            merged_path = await merge_audio_files(fallback_audio_files)
            return merged_path
        elif len(fallback_audio_files) == 1:
            return fallback_audio_files[0]
        else:
            raise Exception("No audio files found or generated")
            
    except Exception as e:
        print(f"Error generating merged audio: {str(e)}")
        raise e

def convert_digits_to_words(text: str) -> str:
    """
    Convert digits in text to their word equivalents for better audio file matching
    """
    import re
    # Replace individual digits with their word equivalents
    digit_mapping = {
        '0': 'zero',
        '1': 'one',
        '2': 'two',
        '3': 'three',
        '4': 'four',
        '5': 'five',
        '6': 'six',
        '7': 'seven',
        '8': 'eight',
        '9': 'nine'
    }
    
    # Use regex to find and replace digits while preserving other characters
    def replace_digit(match):
        digit = match.group(0)
        return digit_mapping.get(digit, digit)
    
    # Replace digits with words
    processed_text = re.sub(r'\d', replace_digit, text)
    return processed_text

async def find_complete_audio_file(english_text: str) -> str:
    """
    Find complete audio file from Audio Files database that matches the English text
    """
    try:
        from database import SessionLocal
        
        print(f"Searching for complete audio file for text: '{english_text}'")
        
        db = SessionLocal()
        try:
            # Clean the search text and convert digits to words
            search_text = convert_digits_to_words(english_text.strip().lower())
            print(f"Processed search text (digits converted to words): '{search_text}'")
            
            # Search for exact match first
            audio_file = db.query(AudioFile).filter(
                AudioFile.english_text.ilike(f"%{search_text}%"),
                AudioFile.is_active == True,
                AudioFile.template_id.is_(None)  # Only from Audio Files page, not from templates
            ).first()
            
            if audio_file:
                print(f"Found matching audio file ID: {audio_file.id}")
                print(f"Matched text: '{audio_file.english_text}'")
                
                # Return the English audio path if available
                if audio_file.english_audio_path:
                    full_path = f"/var/www{audio_file.english_audio_path}"
                    if os.path.exists(full_path):
                        print(f"Found complete audio file: {full_path}")
                        return full_path
                    else:
                        print(f"Audio file not found on disk: {full_path}")
                
                # If English audio not available, try other languages
                for lang_path in [audio_file.marathi_audio_path, audio_file.hindi_audio_path, audio_file.gujarati_audio_path]:
                    if lang_path:
                        full_path = f"/var/www{lang_path}"
                        if os.path.exists(full_path):
                            print(f"Found complete audio file in other language: {full_path}")
                            return full_path
            
            # If no exact match, try searching for individual words
            print("No exact match found, trying word-based search...")
            words = search_text.split()
            
            # Look for audio files that contain most of the words
            best_match = None
            best_score = 0
            
            audio_files = db.query(AudioFile).filter(
                AudioFile.is_active == True,
                AudioFile.template_id.is_(None)
            ).all()
            
            for af in audio_files:
                # Convert digits to words in database text for comparison
                af_text = convert_digits_to_words(af.english_text.lower())
                matching_words = sum(1 for word in words if word in af_text)
                score = matching_words / len(words) if words else 0
                
                if score > best_score and score >= 0.5:  # At least 50% match
                    best_score = score
                    best_match = af
                    print(f"Found partial match (score: {score:.2f}): '{af.english_text}'")
            
            if best_match:
                print(f"Using best partial match ID: {best_match.id}")
                if best_match.english_audio_path:
                    full_path = f"/var/www{best_match.english_audio_path}"
                    if os.path.exists(full_path):
                        print(f"Found partial match audio file: {full_path}")
                        return full_path
            
            print("No complete or partial audio file found in database")
            return None
            
        finally:
            db.close()
            
    except Exception as e:
        print(f"Error finding complete audio file: {str(e)}")
        return None

async def find_existing_audio_file(word: str, language: str) -> str:
    """
    Find existing audio file for a word in a specific language from the Audio Files database
    """
    try:
        from database import SessionLocal
        
        # Convert digits to words in the search term
        word_lower = convert_digits_to_words(word.lower().strip())
        
        print(f"Searching for word '{word}' (processed as '{word_lower}') in language '{language}'")
        
        # Language mapping for database search
        language_mapping = {
            "English": "english",
            "Hindi": "hindi", 
            "Marathi": "marathi",
            "Gujarati": "gujarati"
        }
        
        # Get the language field name for the database
        language_field = language_mapping.get(language)
        if not language_field:
            print(f"Unsupported language: {language}")
            return None
        
        db = SessionLocal()
        try:
            # Search for exact word match in the Audio Files database
            audio_file = db.query(AudioFile).filter(
                AudioFile.english_text.ilike(f"%{word_lower}%"),
                AudioFile.is_active == True,
                AudioFile.template_id.is_(None)  # Only from Audio Files page, not from templates
            ).first()
            
            if audio_file:
                print(f"Found matching audio file ID: {audio_file.id}")
                print(f"Matched text: '{audio_file.english_text}'")
                
                # Get the audio path for the requested language
                audio_path_field = f"{language_field}_audio_path"
                audio_path = getattr(audio_file, audio_path_field, None)
                
                if audio_path:
                    # Convert database path to full file system path
                    full_path = f"/var/www{audio_path}"
                    if os.path.exists(full_path):
                        file_size = os.path.getsize(full_path)
                        if file_size > 1000:  # Ensure file is not empty
                            print(f"Found existing audio file: {full_path} ({file_size} bytes)")
                            print(f"  - Word match: '{word_lower}' found in database text: '{audio_file.english_text}'")
                            print(f"  - Language: {language} audio path: {audio_path}")
                            return full_path
                        else:
                            print(f"Found audio file but it's too small: {full_path} ({file_size} bytes)")
                    else:
                        print(f"Audio file not found on disk: {full_path}")
                else:
                    print(f"No {language} audio path found for audio file ID: {audio_file.id}")
            
            # If no exact match, try partial word matching
            print(f"No exact match found for '{word_lower}', trying partial matching...")
            
            # Search for audio files that contain the word
            audio_files = db.query(AudioFile).filter(
                AudioFile.is_active == True,
                AudioFile.template_id.is_(None)
            ).all()
            
            best_match = None
            best_score = 0
            
            for af in audio_files:
                af_text = af.english_text.lower()
                # Check if the word is contained in the audio file text
                if word_lower in af_text:
                    # Calculate a simple score based on text length (shorter = better match)
                    score = 1.0 / len(af_text)
                    if score > best_score:
                        best_score = score
                        best_match = af
                        print(f"Found partial match (score: {score:.3f}): '{af.english_text}'")
            
            if best_match:
                print(f"Using best partial match ID: {best_match.id}")
                audio_path_field = f"{language_field}_audio_path"
                audio_path = getattr(best_match, audio_path_field, None)
                
                if audio_path:
                    full_path = f"/var/www{audio_path}"
                    if os.path.exists(full_path):
                        file_size = os.path.getsize(full_path)
                        if file_size > 1000:
                            print(f"Found partial match audio file: {full_path} ({file_size} bytes)")
                            return full_path
            
            print(f"No existing audio file found for '{word}' in {language}")
            return None
            
        finally:
            db.close()
        
    except Exception as e:
        print(f"Error finding existing audio file for '{word}' in {language}: {str(e)}")
        return None

async def merge_audio_files(audio_paths: list) -> str:
    """
    Merge multiple audio files into one with proper format handling
    """
    try:
        # Create merged_speech_to_isl directory if it doesn't exist
        merged_dir = "/var/www/audio_files/merged_speech_to_isl"
        os.makedirs(merged_dir, exist_ok=True)
        
        # Create output filename (use MP3 instead of WAV for better compatibility)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_filename = f"merged_speech_to_isl_{timestamp}.mp3"
        output_path = f"{merged_dir}/{output_filename}"
        
        # Validate all input files exist and have content
        valid_paths = []
        for path in audio_paths:
            if os.path.exists(path):
                file_size = os.path.getsize(path)
                if file_size > 1000:  # Ensure file has meaningful content
                    valid_paths.append(path)
                    print(f"Valid audio file: {path} ({file_size} bytes)")
                else:
                    print(f"Warning: Audio file too small: {path} ({file_size} bytes)")
            else:
                print(f"Warning: Audio file not found: {path}")
        
        if not valid_paths:
            raise Exception("No valid audio files found for merging")
        
        if len(valid_paths) == 1:
            # If only one file, convert it to MP3
            convert_cmd = [
                "ffmpeg", "-y",
                "-i", valid_paths[0],
                "-acodec", "mp3",
                "-ab", "128k",
                "-ar", "44100",
                "-ac", "1",
                output_path
            ]
            
            print(f"Converting single file to MP3: {valid_paths[0]}")
            result = subprocess.run(convert_cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                print(f"FFmpeg conversion error: {result.stderr}")
                raise Exception(f"FFmpeg conversion failed: {result.stderr}")
            
            # Verify the converted file has content
            if os.path.getsize(output_path) < 1000:
                raise Exception("Converted audio file is too small, may be empty")
            
            print(f"Single audio file converted to MP3: {output_path}")
            return output_path
        
        # For multiple files, use filter_complex to merge and convert to MP3
        inputs = []
        filter_parts = []
        
        for i, path in enumerate(valid_paths):
            inputs.extend(["-i", path])
            filter_parts.append(f"[{i}:0]")
        
        # Create filter to concatenate and convert to MP3
        filter_complex = "".join(filter_parts) + f"concat=n={len(valid_paths)}:v=0:a=1[out]"
        
        merge_cmd = [
            "ffmpeg", "-y"
        ] + inputs + [
            "-filter_complex", filter_complex,
            "-map", "[out]",
            "-acodec", "mp3",
            "-ab", "128k",
            "-ar", "44100",
            "-ac", "1",
            output_path
        ]
        
        print(f"Running merge command: {' '.join(merge_cmd)}")
        result = subprocess.run(merge_cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"FFmpeg merge error: {result.stderr}")
            raise Exception(f"FFmpeg merge failed: {result.stderr}")
        
        # Verify the output file has content
        if not os.path.exists(output_path) or os.path.getsize(output_path) < 1000:
            raise Exception("Merged audio file is too small or empty")
        
        print(f"Audio merged successfully: {output_path} ({os.path.getsize(output_path)} bytes)")
        return output_path
        
    except Exception as e:
        print(f"Error merging audio files: {str(e)}")
        raise e

@app.delete("/api/cleanup-file")
async def cleanup_file(request: CleanupFileRequest):
    """
    Delete a generated file (audio or video) from the server
    """
    try:
        # Determine the file type and construct the full path
        file_path = request.file_path
        print(f"🗑️ Cleanup request for file: {file_path}")
        
        # Handle different file types
        if file_path.startswith('/audio_files/'):
            # Audio file in /var/www/audio_files/
            full_path = f"/var/www{file_path}"
            print(f"🎵 Audio file detected, full path: {full_path}")
        elif file_path.startswith('/final_isl_vid/'):
            # ISL video file in /var/www/final_isl_vid/
            full_path = f"/var/www{file_path}"
            print(f"🎬 ISL video file detected, full path: {full_path}")
        elif file_path.startswith('/publish_isl/'):
            # Published HTML file in /var/www/publish_isl/
            full_path = f"/var/www{file_path}"
            print(f"📄 Published HTML file detected, full path: {full_path}")
        else:
            # Assume it's a relative path or direct path
            full_path = file_path
            print(f"📁 Direct path assumed: {full_path}")
        
        # Check if file exists
        print(f"🔍 Checking if file exists: {full_path}")
        if not os.path.exists(full_path):
            print(f"❌ File not found: {full_path}")
            return {
                "success": False,
                "message": f"File not found: {file_path}"
            }
        
        print(f"✅ File exists, attempting to delete: {full_path}")
        # Delete the file
        os.remove(full_path)
        print(f"🗑️ File deleted successfully: {full_path}")
        
        return {
            "success": True,
            "message": f"File deleted successfully: {file_path}"
        }
        
    except PermissionError:
        raise HTTPException(status_code=403, detail=f"Permission denied: Cannot delete file {request.file_path}")
    except Exception as e:
        print(f"Error deleting file {request.file_path}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")

@app.delete("/api/cleanup-publish-isl")
async def cleanup_publish_isl_directory():
    """
    Clean up all files in the /var/www/publish_isl directory
    """
    try:
        publish_isl_dir = "/var/www/publish_isl"
        print(f"🧹 Starting cleanup of publish_isl directory: {publish_isl_dir}")
        
        # Check if directory exists
        if not os.path.exists(publish_isl_dir):
            print(f"⚠️ Directory does not exist: {publish_isl_dir}")
            return {
                "success": True,
                "message": "Directory does not exist, nothing to clean up",
                "files_deleted": 0
            }
        
        # Get all files in the directory
        files_to_delete = []
        for filename in os.listdir(publish_isl_dir):
            file_path = os.path.join(publish_isl_dir, filename)
            if os.path.isfile(file_path):
                files_to_delete.append(file_path)
        
        if not files_to_delete:
            print(f"📁 No files found in {publish_isl_dir}")
            return {
                "success": True,
                "message": "No files found to clean up",
                "files_deleted": 0
            }
        
        # Delete all files
        deleted_count = 0
        for file_path in files_to_delete:
            try:
                os.remove(file_path)
                deleted_count += 1
                print(f"🗑️ Deleted file: {os.path.basename(file_path)}")
            except PermissionError as e:
                print(f"❌ Permission error deleting {os.path.basename(file_path)}: {e}")
                # Try to fix permissions and retry
                try:
                    import stat
                    os.chmod(file_path, stat.S_IWRITE)
                    os.remove(file_path)
                    deleted_count += 1
                    print(f"🗑️ Deleted file after fixing permissions: {os.path.basename(file_path)}")
                except Exception as retry_e:
                    print(f"❌ Failed to delete {os.path.basename(file_path)} even after fixing permissions: {retry_e}")
            except Exception as e:
                print(f"❌ Error deleting {os.path.basename(file_path)}: {e}")
        
        print(f"✅ Cleanup completed. Deleted {deleted_count} files from {publish_isl_dir}")
        
        return {
            "success": True,
            "message": f"Successfully cleaned up {deleted_count} files from publish_isl directory",
            "files_deleted": deleted_count
        }
        
    except Exception as e:
        print(f"❌ Error during publish_isl cleanup: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clean up publish_isl directory: {str(e)}")

@app.delete("/api/cleanup-merged-speech-isl")
async def cleanup_merged_speech_isl_directory():
    """
    Clean up old files in the merged_speech_to_isl directory to prevent disk space issues
    """
    try:
        import glob
        from datetime import datetime, timedelta
        
        # Get current time
        now = datetime.now()
        
        # Calculate cutoff time (24 hours ago)
        cutoff_time = now - timedelta(hours=24)
        
        # Clean up merged_speech_to_isl directory
        merged_dir = "/var/www/audio_files/merged_speech_to_isl"
        
        if not os.path.exists(merged_dir):
            return {
                "success": True,
                "message": "Merged speech-to-ISL directory does not exist.",
                "files_deleted": 0
            }
        
        print(f"🧹 Cleaning up merged speech-to-ISL directory: {merged_dir}")
        
        # Find all files in the directory
        files = glob.glob(os.path.join(merged_dir, "*"))
        
        total_deleted = 0
        
        for file_path in files:
            try:
                # Get file modification time
                file_mtime = datetime.fromtimestamp(os.path.getmtime(file_path))
                
                # Delete files older than 24 hours
                if file_mtime < cutoff_time:
                    if os.path.isfile(file_path):
                        os.remove(file_path)
                        print(f"🗑️ Deleted old merged audio file: {os.path.basename(file_path)}")
                        total_deleted += 1
            except Exception as e:
                print(f"❌ Error deleting file {os.path.basename(file_path)}: {e}")
                continue
        
        print(f"✅ Merged speech-to-ISL cleanup completed. Deleted {total_deleted} old audio files.")
        
        return {
            "success": True,
            "message": f"Merged speech-to-ISL cleanup completed. Deleted {total_deleted} old audio files.",
            "files_deleted": total_deleted
        }
        
    except Exception as e:
        print(f"❌ Error during merged speech-to-ISL cleanup: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Merged speech-to-ISL cleanup failed: {str(e)}")



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

# Mount static files for published ISL announcements
publish_isl_mounted = False
possible_publish_dirs = ["/var/www/publish_isl", "./publish_isl", "/tmp/publish_isl"]

for publish_dir in possible_publish_dirs:
    try:
        if os.path.exists(publish_dir):
            app.mount("/publish_isl", StaticFiles(directory=publish_dir), name="publish_isl")
            print(f"✅ Published ISL announcements mounted at /publish_isl from {publish_dir}")
            publish_isl_mounted = True
            break
    except Exception as e:
        print(f"⚠️ Could not mount published ISL announcements from {publish_dir}: {e}")
        continue

if not publish_isl_mounted:
    print("❌ No publish directory could be mounted. Published ISL announcements will not be available")

# ISL Video serving endpoint
@app.get("/api/isl-video/{filename}")
async def serve_isl_video(filename: str):
    """
    Serve ISL video files from the /var/www/final_isl_vid directory
    """
    try:
        file_path = f"/var/www/final_isl_vid/{filename}"
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"ISL video file not found: {filename}")
        
        return FileResponse(
            path=file_path,
            media_type="video/mp4",
            filename=filename
        )
        
    except Exception as e:
        print(f"Error serving ISL video file {filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to serve ISL video file: {str(e)}")

# Speech-to-ISL Video serving endpoint
@app.get("/api/speech-isl-video/{filename}")
async def serve_speech_isl_video(filename: str):
    """
    Serve Speech-to-ISL video files from the /var/www/final_speech_isl_vid directory
    """
    try:
        file_path = f"/var/www/final_speech_isl_vid/{filename}"
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"Speech-to-ISL video file not found: {filename}")
        
        return FileResponse(
            path=file_path,
            media_type="video/mp4",
            filename=filename
        )
        
    except Exception as e:
        print(f"Error serving Speech-to-ISL video file {filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to serve Speech-to-ISL video file: {str(e)}")

# Audio serving endpoint
@app.get("/api/audio/{filename}")
async def serve_audio_file_api(filename: str):
    """
    Serve audio files from the /var/www/audio_files directory
    """
    try:
        file_path = f"/var/www/audio_files/{filename}"
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"Audio file not found: {filename}")
        
        return FileResponse(
            path=file_path,
            media_type="audio/wav",
            filename=filename
        )
        
    except Exception as e:
        print(f"Error serving audio file {filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to serve audio file: {str(e)}")

# Speech-to-ISL merged audio file serving endpoint
@app.get("/api/speech-isl-audio/{filename}")
async def serve_speech_isl_audio(filename: str):
    """
    Serve Speech-to-ISL merged audio files from the /var/www/audio_files/merged_speech_to_isl directory
    """
    try:
        file_path = f"/var/www/audio_files/merged_speech_to_isl/{filename}"
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"Speech-to-ISL audio file not found: {filename}")
        
        # Check file size and provide debug info
        file_size = os.path.getsize(file_path)
        print(f"Serving audio file: {filename}, size: {file_size} bytes")
        
        if file_size < 1000:
            print(f"Warning: Audio file is very small: {filename} ({file_size} bytes)")
        
        # Determine MIME type based on file extension
        if filename.lower().endswith('.mp3'):
            media_type = "audio/mpeg"
        elif filename.lower().endswith('.wav'):
            media_type = "audio/wav"
        else:
            media_type = "audio/mpeg"  # Default to MP3
        
        return FileResponse(
            path=file_path,
            media_type=media_type,
            filename=filename
        )
        
    except Exception as e:
        print(f"Error serving Speech-to-ISL audio file {filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to serve Speech-to-ISL audio file: {str(e)}")

@app.get("/api/debug-audio/{filename}")
async def debug_audio_file(filename: str):
    """
    Debug endpoint to check audio file information
    """
    try:
        file_path = f"/var/www/audio_files/merged_speech_to_isl/{filename}"
        
        if not os.path.exists(file_path):
            return {
                "error": "File not found",
                "filename": filename,
                "path": file_path
            }
        
        file_size = os.path.getsize(file_path)
        
        # Try to get audio file info using ffprobe
        try:
            probe_cmd = [
                "ffprobe", "-v", "quiet", "-print_format", "json",
                "-show_format", "-show_streams", file_path
            ]
            result = subprocess.run(probe_cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                import json
                audio_info = json.loads(result.stdout)
                return {
                    "filename": filename,
                    "file_size": file_size,
                    "file_size_mb": round(file_size / (1024 * 1024), 2),
                    "audio_info": audio_info,
                    "is_valid": file_size > 1000
                }
            else:
                return {
                    "filename": filename,
                    "file_size": file_size,
                    "file_size_mb": round(file_size / (1024 * 1024), 2),
                    "ffprobe_error": result.stderr,
                    "is_valid": file_size > 1000
                }
        except Exception as e:
            return {
                "filename": filename,
                "file_size": file_size,
                "file_size_mb": round(file_size / (1024 * 1024), 2),
                "ffprobe_error": str(e),
                "is_valid": file_size > 1000
            }
        
    except Exception as e:
        return {
            "error": str(e),
            "filename": filename
        }

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

@app.get("/api/test-audio-generation")
async def test_audio_generation():
    """
    Test endpoint to generate a simple audio file to verify audio generation is working
    """
    try:
        # Create merged_speech_to_isl directory if it doesn't exist
        merged_dir = "/var/www/audio_files/merged_speech_to_isl"
        os.makedirs(merged_dir, exist_ok=True)
        
        # Generate a simple test audio file
        test_text = "This is a test audio file for speech to ISL"
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        test_filename = f"test_audio_{timestamp}.mp3"
        test_path = f"{merged_dir}/{test_filename}"
        
        # Use ffmpeg to generate a simple test audio using text-to-speech
        test_cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi",
            "-i", f"aevalsrc='sin(440*2*PI*t)':s=44100:d=3",
            "-acodec", "mp3",
            "-ab", "128k",
            "-ar", "44100",
            "-ac", "1",
            test_path
        ]
        
        print(f"Generating test audio: {' '.join(test_cmd)}")
        result = subprocess.run(test_cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"Test audio generation error: {result.stderr}")
            return {
                "success": False,
                "error": f"Failed to generate test audio: {result.stderr}"
            }
        
        # Check if file was created and has content
        if not os.path.exists(test_path):
            return {
                "success": False,
                "error": "Test audio file was not created"
            }
        
        file_size = os.path.getsize(test_path)
        if file_size < 1000:
            return {
                "success": False,
                "error": f"Test audio file is too small: {file_size} bytes"
            }
        
        # Return the test audio URL
        test_url = f"/translation-api/api/speech-isl-audio/{test_filename}"
        
        return {
            "success": True,
            "message": "Test audio generated successfully",
            "filename": test_filename,
            "file_size": file_size,
            "file_size_mb": round(file_size / (1024 * 1024), 2),
            "audio_url": test_url,
            "full_path": test_path
        }
        
    except Exception as e:
        print(f"Error in test audio generation: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app", 
        host=Config.HOST, 
        port=Config.PORT, 
        reload=Config.RELOAD
    ) 