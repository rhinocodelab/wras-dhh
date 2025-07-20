from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import os
import re
from datetime import datetime
import asyncio
from google.cloud import translate_v2 as translate
from google.cloud import texttospeech
from google.oauth2 import service_account

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db
from models import AnnouncementTemplate, AnnouncementAudioSegment
from config import Config

router = APIRouter(prefix="/announcement-audio", tags=["announcement-audio"])

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
        return len(response.audio_content)
            
    except Exception as e:
        print(f"   TTS: Error generating speech: {e}")
        print(f"   TTS: Voice: {voice_name}")
        print(f"   TTS: Text: {text[:100]}...")
        import traceback
        traceback.print_exc()
        raise e

def split_text_into_segments(text: str):
    """Split text into segments, ignoring placeholders"""
    # Pattern to match placeholders like {train_number}, {platform_number}, etc.
    placeholder_pattern = r'\{[^}]+\}'
    
    # Split by placeholders and keep the text segments
    segments = re.split(placeholder_pattern, text)
    
    # Filter out empty segments and strip whitespace
    segments = [segment.strip() for segment in segments if segment.strip()]
    
    return segments

def generate_announcement_audio_segments_background(template_id: int, db: Session):
    """Background task to generate audio segments for announcement template"""
    try:
        print(f"🎵 Starting audio segment generation for template ID: {template_id}")
        
        # Get the template
        template = db.query(AnnouncementTemplate).filter(AnnouncementTemplate.id == template_id).first()
        if not template:
            print(f"❌ Template with ID {template_id} not found")
            return
        
        # Create audio directory if it doesn't exist
        audio_dir = "/var/www/audio_files"
        os.makedirs(audio_dir, exist_ok=True)
        
        # Generate timestamp for unique naming
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Process each language
        languages = [
            ('english', template.english_text, Config.TTS_VOICES['English']),
            ('marathi', template.marathi_text, Config.TTS_VOICES['Marathi']),
            ('hindi', template.hindi_text, Config.TTS_VOICES['Hindi']),
            ('gujarati', template.gujarati_text, Config.TTS_VOICES['Gujarati'])
        ]
        
        for lang_name, text, voice_config in languages:
            if not text or not text.strip():
                print(f"⚠️ No text for {lang_name}")
                continue
                
            print(f"🔄 Processing {lang_name} segments...")
            print(f"   Original text: {text}")
            
            # Split text into segments
            segments = split_text_into_segments(text)
            print(f"   Segments found: {len(segments)}")
            
            for i, segment in enumerate(segments):
                try:
                    print(f"   Processing segment {i+1}: '{segment}'")
                    
                    if segment and segment.strip():
                        # Create filename with proper naming convention
                        filename = f"announcement_{template.category}_{lang_name}_segment_{i+1}_{timestamp}_{template_id}.mp3"
                        filepath = os.path.join(audio_dir, filename)
                        
                        print(f"   Generating speech for: {segment[:100]}...")
                        print(f"   Output file: {filepath}")
                        
                        # Generate speech
                        file_size = generate_speech(segment.strip(), filepath, voice_config)
                        
                        # Verify file was created and has content
                        if os.path.exists(filepath):
                            actual_file_size = os.path.getsize(filepath)
                            print(f"   File created: {filepath} ({actual_file_size} bytes)")
                            
                            if actual_file_size > 1000:  # Minimum size for valid audio
                                # Save to database
                                audio_segment = AnnouncementAudioSegment(
                                    template_id=template_id,
                                    category=template.category,
                                    segment_text=segment.strip(),
                                    language=lang_name,
                                    segment_order=i+1,
                                    audio_path=f"/audio_files/{filename}",
                                    file_size=actual_file_size
                                )
                                
                                db.add(audio_segment)
                                print(f"✅ {lang_name} segment {i+1} audio generated successfully: {filename}")
                            else:
                                print(f"⚠️ {lang_name} segment {i+1} audio file too small ({actual_file_size} bytes), may be corrupted")
                        else:
                            print(f"❌ {lang_name} segment {i+1} audio file not created")
                            
                except Exception as e:
                    print(f"❌ Error processing {lang_name} segment {i+1}: {e}")
                    import traceback
                    traceback.print_exc()
        
        # Commit all changes
        db.commit()
        print(f"🎉 Audio segment generation completed for template ID: {template_id}")
        
    except Exception as e:
        print(f"❌ Error generating audio segments: {e}")
        import traceback
        traceback.print_exc()

from pydantic import BaseModel

class GenerateAudioRequest(BaseModel):
    template_id: int

@router.post("/generate")
async def generate_announcement_audio(
    request: GenerateAudioRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Generate audio segments for an announcement template"""
    try:
        # Check if template exists
        template = db.query(AnnouncementTemplate).filter(
            AnnouncementTemplate.id == request.template_id,
            AnnouncementTemplate.is_active == True
        ).first()
        
        if not template:
            raise HTTPException(status_code=404, detail="Announcement template not found")
        
        # Check if audio segments already exist for this template
        existing_segments = db.query(AnnouncementAudioSegment).filter(
            AnnouncementAudioSegment.template_id == request.template_id,
            AnnouncementAudioSegment.is_active == True
        ).count()
        
        if existing_segments > 0:
            raise HTTPException(
                status_code=409, 
                detail=f"Audio segments already exist for this template (ID: {request.template_id})"
            )
        
        # Start background task for audio generation
        background_tasks.add_task(
            generate_announcement_audio_segments_background,
            request.template_id,
            db
        )
        
        return {
            "message": "Audio segment generation started",
            "template_id": request.template_id,
            "category": template.category,
            "title": template.title
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error starting audio generation: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start audio generation: {str(e)}")

@router.get("/segments/{template_id}")
async def get_announcement_audio_segments(template_id: int, db: Session = Depends(get_db)):
    """Get audio segments for an announcement template"""
    try:
        # Check if template exists
        template = db.query(AnnouncementTemplate).filter(
            AnnouncementTemplate.id == template_id,
            AnnouncementTemplate.is_active == True
        ).first()
        
        if not template:
            raise HTTPException(status_code=404, detail="Announcement template not found")
        
        # Get audio segments
        segments = db.query(AnnouncementAudioSegment).filter(
            AnnouncementAudioSegment.template_id == template_id,
            AnnouncementAudioSegment.is_active == True
        ).order_by(AnnouncementAudioSegment.language, AnnouncementAudioSegment.segment_order).all()
        
        # Group segments by language
        segments_by_language = {}
        for segment in segments:
            if segment.language not in segments_by_language:
                segments_by_language[segment.language] = []
            segments_by_language[segment.language].append({
                "id": segment.id,
                "segment_text": segment.segment_text,
                "segment_order": segment.segment_order,
                "audio_path": segment.audio_path,
                "file_size": segment.file_size,
                "created_at": segment.created_at
            })
        
        return {
            "template_id": template_id,
            "category": template.category,
            "title": template.title,
            "segments": segments_by_language
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching audio segments: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch audio segments: {str(e)}")

@router.get("/all-segments")
async def get_all_announcement_audio_segments(db: Session = Depends(get_db)):
    """Get all announcement audio segments"""
    try:
        segments = db.query(AnnouncementAudioSegment).filter(
            AnnouncementAudioSegment.is_active == True
        ).order_by(AnnouncementAudioSegment.category, AnnouncementAudioSegment.language, AnnouncementAudioSegment.segment_order).all()
        
        # Group by template and language
        result = {}
        for segment in segments:
            template_key = f"{segment.template_id}_{segment.category}"
            if template_key not in result:
                result[template_key] = {
                    "template_id": segment.template_id,
                    "category": segment.category,
                    "languages": {}
                }
            
            if segment.language not in result[template_key]["languages"]:
                result[template_key]["languages"][segment.language] = []
            
            result[template_key]["languages"][segment.language].append({
                "id": segment.id,
                "segment_text": segment.segment_text,
                "segment_order": segment.segment_order,
                "audio_path": segment.audio_path,
                "file_size": segment.file_size,
                "created_at": segment.created_at
            })
        
        return {
            "segments": list(result.values())
        }
        
    except Exception as e:
        print(f"❌ Error fetching all audio segments: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch audio segments: {str(e)}")

@router.delete("/segments/{segment_id}")
async def delete_announcement_audio_segment(segment_id: int, db: Session = Depends(get_db)):
    """Delete an announcement audio segment"""
    try:
        segment = db.query(AnnouncementAudioSegment).filter(
            AnnouncementAudioSegment.id == segment_id,
            AnnouncementAudioSegment.is_active == True
        ).first()
        
        if not segment:
            raise HTTPException(status_code=404, detail="Audio segment not found")
        
        # Delete physical file
        if segment.audio_path:
            audio_dir = "/var/www/audio_files"
            filename = segment.audio_path.replace('/audio_files/', '')
            filepath = os.path.join(audio_dir, filename)
            
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                    print(f"🗑️ Deleted audio file: {filename}")
                except Exception as e:
                    print(f"❌ Error deleting file {filename}: {e}")
        
        # Soft delete from database
        segment.is_active = False
        db.commit()
        
        return {
            "message": "Audio segment deleted successfully",
            "segment_id": segment_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting audio segment: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete audio segment: {str(e)}") 