from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import os
import json
from datetime import datetime
import asyncio
from google.cloud import translate_v2 as translate
from google.cloud import texttospeech
from google.oauth2 import service_account

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db
from models import AudioFile
from config import Config
from utils.duplicate_checker import check_audio_file_duplicate, get_duplicate_summary

router = APIRouter(prefix="/audio-files", tags=["audio-files"])

# Initialize GCP clients
credentials_path = Config.get_gcp_credentials_path()
credentials = service_account.Credentials.from_service_account_file(credentials_path)
translate_client = translate.Client(credentials=credentials)
tts_client = texttospeech.TextToSpeechClient(credentials=credentials)

def translate_text(text: str, target_language: str):
    """Translate text to target language"""
    try:
        result = translate_client.translate(
            text,
            target_language=target_language,
            source_language='en'
        )
        return result['translatedText']
    except Exception as e:
        print(f"Translation error for {target_language}: {e}")
        return text

def generate_speech(text: str, filepath: str, voice_name: str):
    """Generate speech and save to file"""
    try:
        print(f"   TTS: Starting speech generation for voice: {voice_name}")
        print(f"   TTS: Input text length: {len(text)} characters")
        
        # Configure the text-to-speech request
        synthesis_input = texttospeech.SynthesisInput(text=text)
        
        # Configure the voice
        language_code = voice_name.split('-')[0] + '-' + voice_name.split('-')[1]
        voice = texttospeech.VoiceSelectionParams(
            language_code=language_code,
            name=voice_name,
            ssml_gender=texttospeech.SsmlVoiceGender.NEUTRAL
        )
        
        print(f"   TTS: Language code: {language_code}")
        print(f"   TTS: Voice name: {voice_name}")
        
        # Configure the audio output
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=0.9,
            pitch=0.0,
            volume_gain_db=0.0
        )
        
        print(f"   TTS: Audio config set, making API request...")
        
        # Perform the text-to-speech request
        response = tts_client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config
        )
        
        print(f"   TTS: API response received, audio content size: {len(response.audio_content)} bytes")
        
        # Save to file
        with open(filepath, 'wb') as f:
            f.write(response.audio_content)
        
        print(f"   TTS: Audio file saved to: {filepath}")
            
    except Exception as e:
        print(f"   TTS: Error generating speech: {e}")
        print(f"   TTS: Voice: {voice_name}")
        print(f"   TTS: Text: {text[:100]}...")
        import traceback
        traceback.print_exc()
        raise e

def generate_audio_files_background(audio_file_id: int, english_text: str, db: Session):
    """Background task to generate audio files"""
    try:
        print(f"🎵 Starting audio generation for file ID: {audio_file_id}")
        
        # Get the audio file
        audio_file = db.query(AudioFile).filter(AudioFile.id == audio_file_id).first()
        if not audio_file:
            print(f"❌ Audio file with ID {audio_file_id} not found")
            return
        
        # Create audio directory if it doesn't exist
        audio_dir = "/var/www/audio_files"
        os.makedirs(audio_dir, exist_ok=True)
        
        # Generate timestamp for unique naming
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Translate and generate audio for each language
        languages = [
            ('english', english_text, Config.TTS_VOICES['English']),
            ('marathi', translate_text(english_text, 'mr'), Config.TTS_VOICES['Marathi']),
            ('hindi', translate_text(english_text, 'hi'), Config.TTS_VOICES['Hindi']),
            ('gujarati', translate_text(english_text, 'gu'), Config.TTS_VOICES['Gujarati'])
        ]
        
        audio_paths = {}
        translations = {}
        
        for lang_name, text, voice_config in languages:
            try:
                print(f"🔄 Processing {lang_name}...")
                print(f"   Original text: {english_text}")
                print(f"   Translated text: {text}")
                print(f"   Voice config: {voice_config}")
                
                if text and text.strip():
                    # Create filename with proper naming convention
                    filename = f"audio_{lang_name}_{timestamp}_{audio_file_id}.mp3"
                    filepath = os.path.join(audio_dir, filename)
                    
                    print(f"   Generating speech for: {text[:100]}...")
                    print(f"   Output file: {filepath}")
                    
                    # Generate speech
                    generate_speech(text, filepath, voice_config)
                    
                    # Verify file was created and has content
                    if os.path.exists(filepath):
                        file_size = os.path.getsize(filepath)
                        print(f"   File created: {filepath} ({file_size} bytes)")
                        
                        if file_size > 1000:  # Minimum size for valid audio
                            # Store paths and translations
                            audio_paths[f"{lang_name}_audio_path"] = f"/audio_files/{filename}"
                            translations[f"{lang_name}_translation"] = text
                            print(f"✅ {lang_name} audio generated successfully: {filename}")
                        else:
                            print(f"⚠️ {lang_name} audio file too small ({file_size} bytes), may be corrupted")
                    else:
                        print(f"❌ {lang_name} audio file not created")
                        
                else:
                    print(f"⚠️ No text for {lang_name} (text: '{text}')")
                    
            except Exception as e:
                print(f"❌ Error processing {lang_name}: {e}")
                import traceback
                traceback.print_exc()
        
        # Update the audio file with paths and translations
        print("💾 Updating database...")
        for key, value in audio_paths.items():
            setattr(audio_file, key, value)
        
        for key, value in translations.items():
            setattr(audio_file, key, value)
        
        db.commit()
        print(f"🎉 Audio generation completed for file ID: {audio_file_id}")
        
    except Exception as e:
        print(f"❌ Error generating audio files: {e}")
        import traceback
        traceback.print_exc()

from pydantic import BaseModel

class AudioFileRequest(BaseModel):
    english_text: str

@router.post("/")
async def create_audio_file(
    request: AudioFileRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Create a new audio file with translations and audio generation"""
    if not request.english_text.strip():
        raise HTTPException(status_code=400, detail="English text is required")
    
    # Check if the same English text already exists
    existing_audio_file = check_audio_file_duplicate(db, request.english_text)
    
    if existing_audio_file:
        raise HTTPException(
            status_code=409, 
            detail=f"Audio file with this English text already exists (ID: {existing_audio_file.id})"
        )
    
    # Create audio file record
    audio_file = AudioFile(
        english_text=request.english_text.strip(),
        english_translation=request.english_text.strip()  # English translation is same as original
    )
    
    db.add(audio_file)
    db.commit()
    db.refresh(audio_file)
    
    # Start background task for audio generation
    background_tasks.add_task(
        generate_audio_files_background,
        audio_file.id,
        request.english_text.strip(),
        db
    )
    
    return audio_file

@router.post("/check-duplicate")
async def check_duplicate_audio_file(
    request: AudioFileRequest,
    db: Session = Depends(get_db)
):
    """Check if an audio file with the same English text already exists"""
    if not request.english_text.strip():
        raise HTTPException(status_code=400, detail="English text is required")
    
    duplicate_summary = get_duplicate_summary(db, request.english_text)
    
    return {
        "text": request.english_text.strip(),
        "has_duplicates": duplicate_summary["has_duplicates"],
        "duplicates": duplicate_summary["duplicates"]
    }

@router.get("/")
async def list_audio_files(db: Session = Depends(get_db)):
    """Get all audio files"""
    audio_files = db.query(AudioFile).filter(
        AudioFile.is_active == True
    ).order_by(AudioFile.created_at.desc()).all()
    
    return audio_files

@router.get("/{audio_file_id}")
async def get_audio_file(audio_file_id: int, db: Session = Depends(get_db)):
    """Get a specific audio file"""
    audio_file = db.query(AudioFile).filter(
        AudioFile.id == audio_file_id,
        AudioFile.is_active == True
    ).first()
    
    if not audio_file:
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    return audio_file

@router.delete("/{audio_file_id}")
async def delete_audio_file(audio_file_id: int, db: Session = Depends(get_db)):
    """Delete an audio file and its physical files"""
    audio_file = db.query(AudioFile).filter(
        AudioFile.id == audio_file_id,
        AudioFile.is_active == True
    ).first()
    
    if not audio_file:
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    try:
        # Get all audio file paths
        audio_paths = [
            audio_file.english_audio_path,
            audio_file.marathi_audio_path,
            audio_file.hindi_audio_path,
            audio_file.gujarati_audio_path
        ]
        
        # Delete physical audio files
        audio_dir = "/var/www/audio_files"
        deleted_files = []
        
        for audio_path in audio_paths:
            if audio_path:
                # Extract filename from path (remove /audio_files/ prefix)
                filename = audio_path.replace('/audio_files/', '')
                filepath = os.path.join(audio_dir, filename)
                
                if os.path.exists(filepath):
                    try:
                        os.remove(filepath)
                        deleted_files.append(filename)
                        print(f"🗑️ Deleted audio file: {filename}")
                    except PermissionError as e:
                        print(f"❌ Permission error deleting file {filename}: {e}")
                        # Try to fix permissions and retry
                        try:
                            import stat
                            os.chmod(filepath, stat.S_IWRITE)
                            os.remove(filepath)
                            deleted_files.append(filename)
                            print(f"🗑️ Deleted audio file after fixing permissions: {filename}")
                        except Exception as retry_e:
                            print(f"❌ Failed to delete file {filename} even after fixing permissions: {retry_e}")
                    except Exception as e:
                        print(f"❌ Error deleting file {filename}: {e}")
                else:
                    print(f"⚠️ Audio file not found: {filepath}")
        
        # Soft delete from database
        audio_file.is_active = False
        db.commit()
        
        # Log deletion summary
        print(f"🗑️ Deletion summary for audio file ID {audio_file_id}:")
        print(f"   • Database record: Soft deleted")
        print(f"   • Physical files deleted: {len(deleted_files)}")
        print(f"   • Files: {', '.join(deleted_files) if deleted_files else 'None'}")
        
        return {
            "message": "Audio file deleted successfully",
            "total_files_deleted": len(deleted_files),
            "audio_file_id": audio_file_id
        }
        
    except Exception as e:
        print(f"❌ Error during deletion: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete audio file: {str(e)}")

@router.get("/{audio_file_id}/status")
async def get_audio_file_status(audio_file_id: int, db: Session = Depends(get_db)):
    """Get the processing status of an audio file"""
    audio_file = db.query(AudioFile).filter(
        AudioFile.id == audio_file_id,
        AudioFile.is_active == True
    ).first()
    
    if not audio_file:
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    # Check if all audio files are generated
    audio_paths = [
        audio_file.english_audio_path,
        audio_file.marathi_audio_path,
        audio_file.hindi_audio_path,
        audio_file.gujarati_audio_path
    ]
    
    completed = all(path is not None for path in audio_paths)
    in_progress = any(path is not None for path in audio_paths) and not completed
    
    return {
        "id": audio_file.id,
        "completed": completed,
        "in_progress": in_progress,
        "audio_paths": {
            "english": audio_file.english_audio_path,
            "marathi": audio_file.marathi_audio_path,
            "hindi": audio_file.hindi_audio_path,
            "gujarati": audio_file.gujarati_audio_path
        },
        "translations": {
            "english": audio_file.english_translation,
            "marathi": audio_file.marathi_translation,
            "hindi": audio_file.hindi_translation,
            "gujarati": audio_file.gujarati_translation
        }
    } 