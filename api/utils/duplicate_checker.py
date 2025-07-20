from sqlalchemy.orm import Session
from typing import Optional, Tuple
from models import AudioFile, AnnouncementTemplate, AudioSegment

def check_audio_file_duplicate(db: Session, english_text: str) -> Optional[AudioFile]:
    """
    Check if an audio file with the same English text already exists
    
    Args:
        db: Database session
        english_text: English text to check
        
    Returns:
        AudioFile object if duplicate exists, None otherwise
    """
    return db.query(AudioFile).filter(
        AudioFile.english_text == english_text.strip(),
        AudioFile.is_active == True
    ).first()

def check_template_duplicate(db: Session, english_text: str) -> Optional[AnnouncementTemplate]:
    """
    Check if a template with the same English text already exists
    
    Args:
        db: Database session
        english_text: English text to check
        
    Returns:
        AnnouncementTemplate object if duplicate exists, None otherwise
    """
    return db.query(AnnouncementTemplate).filter(
        AnnouncementTemplate.english_text == english_text.strip(),
        AnnouncementTemplate.is_active == True
    ).first()

def check_segment_duplicate(db: Session, template_id: int, selected_text: str) -> Optional[AudioSegment]:
    """
    Check if an audio segment with the same text already exists for a template
    
    Args:
        db: Database session
        template_id: Template ID
        selected_text: Selected text to check
        
    Returns:
        AudioSegment object if duplicate exists, None otherwise
    """
    return db.query(AudioSegment).filter(
        AudioSegment.template_id == template_id,
        AudioSegment.selected_text == selected_text.strip(),
        AudioSegment.is_active == True
    ).first()

def check_all_duplicates(db: Session, english_text: str) -> Tuple[Optional[AudioFile], Optional[AnnouncementTemplate]]:
    """
    Check for duplicates across all audio-related tables
    
    Args:
        db: Database session
        english_text: English text to check
        
    Returns:
        Tuple of (AudioFile, AnnouncementTemplate) - each can be None if no duplicate found
    """
    audio_file = check_audio_file_duplicate(db, english_text)
    template = check_template_duplicate(db, english_text)
    
    return audio_file, template

def get_duplicate_summary(db: Session, english_text: str) -> dict:
    """
    Get a summary of all duplicates for a given English text
    
    Args:
        db: Database session
        english_text: English text to check
        
    Returns:
        Dictionary with duplicate information
    """
    audio_file, template = check_all_duplicates(db, english_text)
    
    summary = {
        "has_duplicates": bool(audio_file or template),
        "duplicates": {}
    }
    
    if audio_file:
        summary["duplicates"]["audio_file"] = {
            "id": audio_file.id,
            "created_at": audio_file.created_at,
            "has_audio_files": bool(
                audio_file.english_audio_path or 
                audio_file.marathi_audio_path or 
                audio_file.hindi_audio_path or 
                audio_file.gujarati_audio_path
            )
        }
    
    if template:
        summary["duplicates"]["template"] = {
            "id": template.id,
            "title": template.title,
            "category": template.category,
            "created_at": template.created_at
        }
    
    return summary 