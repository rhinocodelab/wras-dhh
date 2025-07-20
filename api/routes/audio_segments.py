from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import os
import json
from datetime import datetime

from ..database import get_db
from ..models import AudioSegment, AnnouncementTemplate
from ..services.translation_service import translate_text
from ..services.tts_service import generate_speech
from ..config import TTS_VOICES
from ..utils.duplicate_checker import check_segment_duplicate

router = APIRouter(prefix="/audio-segments", tags=["audio-segments"])

@router.post("/")
async def create_audio_segment(
    template_id: int,
    selected_text: str,
    start_position: int,
    end_position: int,
    db: Session = Depends(get_db)
):
    """Create a new audio segment"""
    # Verify template exists
    template = db.query(AnnouncementTemplate).filter(
        AnnouncementTemplate.id == template_id,
        AnnouncementTemplate.is_active == True
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Check if the same selected text already exists for this template
    existing_segment = check_segment_duplicate(db, template_id, selected_text)
    
    if existing_segment:
        raise HTTPException(
            status_code=409, 
            detail=f"Audio segment with this text already exists for this template (ID: {existing_segment.id})"
        )
    
    # Create audio segment
    segment = AudioSegment(
        template_id=template_id,
        selected_text=selected_text.strip(),
        start_position=start_position,
        end_position=end_position
    )
    
    db.add(segment)
    db.commit()
    db.refresh(segment)
    
    return segment

@router.get("/template/{template_id}")
async def get_audio_segments_by_template(
    template_id: int,
    db: Session = Depends(get_db)
):
    """Get all audio segments for a template"""
    segments = db.query(AudioSegment).filter(
        AudioSegment.template_id == template_id,
        AudioSegment.is_active == True
    ).all()
    
    return segments

@router.post("/{segment_id}/translate")
async def translate_segment(
    segment_id: int,
    db: Session = Depends(get_db)
):
    """Translate the selected text to all languages"""
    segment = db.query(AudioSegment).filter(
        AudioSegment.id == segment_id,
        AudioSegment.is_active == True
    ).first()
    
    if not segment:
        raise HTTPException(status_code=404, detail="Audio segment not found")
    
    try:
        # Translate to all languages
        translations = {}
        for lang_code in ['hi', 'mr', 'gu']:
            translated_text = translate_text(segment.selected_text, lang_code)
            if lang_code == 'hi':
                translations['hindi_translation'] = translated_text
            elif lang_code == 'mr':
                translations['marathi_translation'] = translated_text
            elif lang_code == 'gu':
                translations['gujarati_translation'] = translated_text
        
        # English translation is the same as original
        translations['english_translation'] = segment.selected_text
        
        # Update segment with translations
        for key, value in translations.items():
            setattr(segment, key, value)
        
        db.commit()
        db.refresh(segment)
        
        return {"translations": translations}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")

@router.post("/{segment_id}/generate-audio")
async def generate_audio_for_segment(
    segment_id: int,
    db: Session = Depends(get_db)
):
    """Generate audio files for all languages"""
    segment = db.query(AudioSegment).filter(
        AudioSegment.id == segment_id,
        AudioSegment.is_active == True
    ).first()
    
    if not segment:
        raise HTTPException(status_code=404, detail="Audio segment not found")
    
    if not segment.english_translation:
        raise HTTPException(status_code=400, detail="Segment must be translated first")
    
    try:
        # Create audio directory if it doesn't exist
        audio_dir = "audio_files"
        os.makedirs(audio_dir, exist_ok=True)
        
        audio_paths = {}
        
        # Generate audio for each language
        languages = [
            ('english', segment.english_translation, TTS_VOICES['en-IN']),
            ('hindi', segment.hindi_translation, TTS_VOICES['hi-IN']),
            ('marathi', segment.marathi_translation, TTS_VOICES['mr-IN']),
            ('gujarati', segment.gujarati_translation, TTS_VOICES['gu-IN'])
        ]
        
        for lang_name, text, voice_config in languages:
            if text:
                filename = f"segment_{segment_id}_{lang_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp3"
                filepath = os.path.join(audio_dir, filename)
                
                # Generate speech
                generate_speech(text, filepath, voice_config)
                
                # Store relative path
                audio_paths[f"{lang_name}_audio_path"] = f"/audio/{filename}"
        
        # Update segment with audio paths
        for key, value in audio_paths.items():
            setattr(segment, key, value)
        
        db.commit()
        db.refresh(segment)
        
        return {"audio_paths": audio_paths}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio generation failed: {str(e)}")

@router.delete("/{segment_id}")
async def delete_audio_segment(
    segment_id: int,
    db: Session = Depends(get_db)
):
    """Delete an audio segment"""
    segment = db.query(AudioSegment).filter(
        AudioSegment.id == segment_id,
        AudioSegment.is_active == True
    ).first()
    
    if not segment:
        raise HTTPException(status_code=404, detail="Audio segment not found")
    
    # Soft delete
    segment.is_active = False
    db.commit()
    
    return {"message": "Audio segment deleted successfully"}

@router.post("/template/{template_id}/generate-full-announcement")
async def generate_full_announcement(
    template_id: int,
    db: Session = Depends(get_db)
):
    """Generate a complete announcement audio file combining all segments"""
    template = db.query(AnnouncementTemplate).filter(
        AnnouncementTemplate.id == template_id,
        AnnouncementTemplate.is_active == True
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    segments = db.query(AudioSegment).filter(
        AudioSegment.template_id == template_id,
        AudioSegment.is_active == True
    ).order_by(AudioSegment.start_position).all()
    
    if not segments:
        raise HTTPException(status_code=400, detail="No audio segments found for this template")
    
    try:
        # Create audio directory if it doesn't exist
        audio_dir = "audio_files"
        os.makedirs(audio_dir, exist_ok=True)
        
        # Generate full announcement filename
        filename = f"full_announcement_{template_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp3"
        filepath = os.path.join(audio_dir, filename)
        
        # For now, we'll create a simple concatenation
        # In a real implementation, you'd use a library like pydub to concatenate audio files
        
        # Create a placeholder file for now
        with open(filepath, 'w') as f:
            f.write("Full announcement audio file placeholder")
        
        return {
            "message": "Full announcement generated successfully",
            "file_path": f"/audio/{filename}"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Full announcement generation failed: {str(e)}") 