from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import os
import re
from datetime import datetime
import subprocess
import tempfile
from pydub import AudioSegment
import json

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db
from models import AnnouncementTemplate, AnnouncementAudioSegment, AudioFile
from config import Config

# Global progress tracking
generation_progress = {}

router = APIRouter(prefix="/final-announcement", tags=["final-announcement"])

def get_audio_segments_for_template(template_id: int, db: Session) -> Dict[str, List[Dict]]:
    """Get all audio segments for a template organized by language"""
    segments = db.query(AnnouncementAudioSegment).filter(
        AnnouncementAudioSegment.template_id == template_id,
        AnnouncementAudioSegment.is_active == True
    ).order_by(AnnouncementAudioSegment.language, AnnouncementAudioSegment.segment_order).all()
    
    segments_by_language = {}
    for segment in segments:
        if segment.language not in segments_by_language:
            segments_by_language[segment.language] = []
        segments_by_language[segment.language].append({
            "id": segment.id,
            "segment_text": segment.segment_text,
            "segment_order": segment.segment_order,
            "audio_path": segment.audio_path,
            "file_size": segment.file_size
        })
    
    return segments_by_language

def get_existing_audio_for_text(text: str, language: str, template_id: int, db: Session) -> str:
    """Get existing audio file for static text from audio segments"""
    try:
        if not text.strip():
            return None
            
        print(f"   Looking for existing audio for text: '{text}' in {language}")
        
        # Map language to the correct audio column
        language_audio_map = {
            'english': 'english_audio_path',
            'marathi': 'marathi_audio_path', 
            'hindi': 'hindi_audio_path',
            'gujarati': 'gujarati_audio_path'
        }
        
        audio_column = language_audio_map.get(language.lower())
        if not audio_column:
            print(f"⚠️ Unknown language: {language}")
            return None
        
        # First, try to find in announcement audio segments for this template
        audio_segment = db.query(AnnouncementAudioSegment).filter(
            AnnouncementAudioSegment.template_id == template_id,
            AnnouncementAudioSegment.segment_text == text.strip(),
            AnnouncementAudioSegment.language == language,
            AnnouncementAudioSegment.audio_path.isnot(None),
            AnnouncementAudioSegment.is_active == True
        ).first()
        
        if audio_segment:
            print(f"   Found in announcement audio segments: {audio_segment.audio_path}")
            return audio_segment.audio_path
        
        # If not found in segments, try partial match in segments
        audio_segment = db.query(AnnouncementAudioSegment).filter(
            AnnouncementAudioSegment.template_id == template_id,
            AnnouncementAudioSegment.segment_text.contains(text.strip()),
            AnnouncementAudioSegment.language == language,
            AnnouncementAudioSegment.audio_path.isnot(None),
            AnnouncementAudioSegment.is_active == True
        ).first()
        
        if audio_segment:
            print(f"   Found partial match in announcement segments: {audio_segment.audio_path}")
            return audio_segment.audio_path
        
        # If still not found, try in AudioFile table as fallback
        language_column_map = {
            'english': ('english_text', 'english_audio_path'),
            'marathi': ('marathi_translation', 'marathi_audio_path'), 
            'hindi': ('hindi_translation', 'hindi_audio_path'),
            'gujarati': ('gujarati_translation', 'gujarati_audio_path')
        }
        
        text_column, audio_column = language_column_map.get(language.lower(), ('english_text', 'english_audio_path'))
        
        # Search for exact match in AudioFile
        audio_file = db.query(AudioFile).filter(
            getattr(AudioFile, text_column) == text.strip(),
            getattr(AudioFile, audio_column).isnot(None),
            AudioFile.is_active == True
        ).first()
        
        if audio_file:
            audio_path = getattr(audio_file, audio_column)
            print(f"   Found fallback in AudioFile: {audio_path}")
            return audio_path
        
        print(f"⚠️ No existing audio found for text: '{text}' in {language}")
        return None
            
    except Exception as e:
        print(f"❌ Error finding existing audio for text: {e}")
        import traceback
        traceback.print_exc()
        return None

def get_existing_audio_for_placeholder(placeholder: str, value: str, language: str, db: Session) -> list:
    """Get existing audio files for dynamic content from the database"""
    try:
        # Remove curly braces
        placeholder_clean = placeholder.strip('{}')
        
        print(f"   Looking for existing audio for {placeholder_clean}: '{value}' in {language}")
        
        # Map language to the correct column
        language_column_map = {
            'english': 'english_audio_path',
            'marathi': 'marathi_audio_path', 
            'hindi': 'hindi_audio_path',
            'gujarati': 'gujarati_audio_path'
        }
        
        audio_column = language_column_map.get(language.lower())
        if not audio_column:
            print(f"⚠️ Unknown language: {language}")
            return []
        
        # For train numbers, convert digits to words and find audio files
        if 'train_number' in placeholder_clean.lower() and value.isdigit():
            print(f"   Processing train number: {value}")
            audio_paths = []
            
            # Convert digits to words
            digit_to_word = {
                '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
                '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine'
            }
            
            # For each digit in the train number, convert to word and find audio
            for digit in value:
                word = digit_to_word.get(digit, digit)
                # Find audio file for this word
                audio_file = db.query(AudioFile).filter(
                    AudioFile.english_text == word,
                    getattr(AudioFile, audio_column).isnot(None),
                    AudioFile.is_active == True
                ).first()
                
                if audio_file:
                    audio_path = getattr(audio_file, audio_column)
                    audio_paths.append(audio_path)
                    print(f"     Found digit '{digit}' as '{word}': {audio_path}")
                else:
                    print(f"     ⚠️ No audio found for digit '{digit}' as '{word}'")
            
            if audio_paths:
                print(f"   Train number audio sequence: {len(audio_paths)} files")
                return audio_paths
            else:
                print(f"   ⚠️ No audio files found for train number {value}")
                return []
        
        # For platform numbers, also convert digits to words
        elif 'platform_number' in placeholder_clean.lower() and value.isdigit():
            print(f"   Processing platform number: {value}")
            audio_paths = []
            
            # Convert digits to words
            digit_to_word = {
                '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
                '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine'
            }
            
            # For each digit in the platform number, convert to word and find audio
            for digit in value:
                word = digit_to_word.get(digit, digit)
                # Find audio file for this word
                audio_file = db.query(AudioFile).filter(
                    AudioFile.english_text == word,
                    getattr(AudioFile, audio_column).isnot(None),
                    AudioFile.is_active == True
                ).first()
                
                if audio_file:
                    audio_path = getattr(audio_file, audio_column)
                    audio_paths.append(audio_path)
                    print(f"     Found digit '{digit}' as '{word}': {audio_path}")
                else:
                    print(f"     ⚠️ No audio found for digit '{digit}' as '{word}'")
            
            if audio_paths:
                print(f"   Platform number audio sequence: {len(audio_paths)} files")
                return audio_paths
            else:
                print(f"   ⚠️ No audio files found for platform number {value}")
                return []
        
        # For other placeholders (train names, station names), try exact match first
        else:
            # Search for exact match first
            audio_file = db.query(AudioFile).filter(
                AudioFile.english_text == value,
                getattr(AudioFile, audio_column).isnot(None),
                AudioFile.is_active == True
            ).first()
            
            if audio_file:
                audio_path = getattr(audio_file, audio_column)
                print(f"   Found exact match: {audio_path}")
                return [audio_path]
            
            # If no exact match, try partial matches for station names
            if 'station' in placeholder_clean.lower():
                # For station names, try partial matches
                audio_file = db.query(AudioFile).filter(
                    AudioFile.english_text.contains(value),
                    getattr(AudioFile, audio_column).isnot(None),
                    AudioFile.is_active == True
                ).first()
                
                if audio_file:
                    audio_path = getattr(audio_file, audio_column)
                    print(f"   Found partial match for station: {audio_path}")
                    return [audio_path]
            
            # For train names, try word-by-word matching or exact match
            elif 'train_name' in placeholder_clean.lower():
                print(f"   Processing train name: {value}")
                audio_paths = []
                
                # First try exact match for the full train name
                audio_file = db.query(AudioFile).filter(
                    AudioFile.english_text == value,
                    getattr(AudioFile, audio_column).isnot(None),
                    AudioFile.is_active == True
                ).first()
                
                if audio_file:
                    audio_path = getattr(audio_file, audio_column)
                    audio_paths.append(audio_path)
                    print(f"     Found exact match for '{value}': {audio_path}")
                else:
                    # If no exact match, try word-by-word matching
                    words = value.split()
                    print(f"     No exact match, trying word-by-word: {words}")
                    
                    for word in words:
                        # Find audio file for this word
                        audio_file = db.query(AudioFile).filter(
                            AudioFile.english_text == word,
                            getattr(AudioFile, audio_column).isnot(None),
                            AudioFile.is_active == True
                        ).first()
                        
                        if audio_file:
                            audio_path = getattr(audio_file, audio_column)
                            audio_paths.append(audio_path)
                            print(f"       Found word '{word}': {audio_path}")
                        else:
                            print(f"       ⚠️ No audio found for word '{word}'")
                
                if audio_paths:
                    print(f"   Train name audio sequence: {len(audio_paths)} files")
                    return audio_paths
                else:
                    print(f"   ⚠️ No audio files found for train name {value}")
                    return []
        
        print(f"⚠️ No existing audio found for {placeholder_clean}: '{value}' in {language}")
        return []
            
    except Exception as e:
        print(f"❌ Error finding existing audio for {placeholder}: {e}")
        import traceback
        traceback.print_exc()
        return []

def concatenate_audio_files(audio_paths: List[str], output_path: str) -> bool:
    """Concatenate multiple audio files into a single file"""
    try:
        print(f"🔧 Starting audio concatenation...")
        print(f"   Input paths: {audio_paths}")
        print(f"   Output path: {output_path}")
        
        if not audio_paths:
            print("⚠️ No audio paths provided for concatenation")
            return False
            
        # Filter out None values
        valid_paths = [path for path in audio_paths if path]
        if not valid_paths:
            print("⚠️ No valid audio paths found")
            return False
        
        print(f"   Valid paths: {valid_paths}")
        
        # Load the first audio file
        audio_dir = "/var/www/audio_files"
        first_file_path = os.path.join(audio_dir, valid_paths[0].replace('/audio_files/', ''))
        
        print(f"   First file path: {first_file_path}")
        print(f"   First file exists: {os.path.exists(first_file_path)}")
        
        if not os.path.exists(first_file_path):
            print(f"❌ First audio file not found: {first_file_path}")
            return False
            
        print(f"   Loading first audio file...")
        combined_audio = AudioSegment.from_mp3(first_file_path)
        print(f"   First audio loaded successfully")
        
        # Concatenate remaining audio files
        for i, audio_path in enumerate(valid_paths[1:], 1):
            file_path = os.path.join(audio_dir, audio_path.replace('/audio_files/', ''))
            print(f"   Processing file {i+1}: {file_path}")
            print(f"   File exists: {os.path.exists(file_path)}")
            
            if os.path.exists(file_path):
                print(f"   Loading audio segment...")
                audio_segment = AudioSegment.from_mp3(file_path)
                print(f"   Concatenating...")
                combined_audio += audio_segment
                print(f"   ✅ File {i+1} concatenated successfully")
            else:
                print(f"⚠️ Audio file not found: {file_path}")
        
        # Export the combined audio
        print(f"   Exporting combined audio...")
        combined_audio.export(output_path, format="mp3")
        print(f"✅ Combined audio saved to: {output_path}")
        print(f"   Output file exists: {os.path.exists(output_path)}")
        print(f"   Output file size: {os.path.getsize(output_path) if os.path.exists(output_path) else 'N/A'} bytes")
        return True
        
    except Exception as e:
        print(f"❌ Error concatenating audio files: {e}")
        import traceback
        traceback.print_exc()
        return False

def generate_final_announcement_audio_background(
    template_id: int,
    train_data: Dict[str, Any],
    db: Session
):
    """Background task to generate final announcement audio using template text directly"""
    global generation_progress
    
    # Initialize progress for this generation
    generation_key = f"{template_id}_{train_data.get('train_number', 'unknown')}"
    generation_progress[generation_key] = {
        "status": "starting",
        "current_language": "",
        "total_languages": 4,
        "completed_languages": 0,
        "final_audio_files": {},
        "merged_audio_path": None,
        "error": None
    }
    
    try:
        print(f"🎵 Starting final announcement generation for template ID: {template_id}")
        generation_progress[generation_key]["status"] = "processing"
        
        # Get the template
        template = db.query(AnnouncementTemplate).filter(
            AnnouncementTemplate.id == template_id,
            AnnouncementTemplate.is_active == True
        ).first()
        
        if not template:
            print(f"❌ Template with ID {template_id} not found")
            generation_progress[generation_key]["error"] = "Template not found"
            generation_progress[generation_key]["status"] = "error"
            return
        
        # Create output directories
        output_dir = "/var/www/audio_files/final_announcements"
        merged_dir = "/var/www/audio_files/merged"
        os.makedirs(output_dir, exist_ok=True)
        os.makedirs(merged_dir, exist_ok=True)
        
        # Generate timestamp for unique naming
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Process each language
        final_audio_files = {}
        languages = ['english', 'marathi', 'hindi', 'gujarati']
        
        for i, language in enumerate(languages):
            try:
                print(f"🔄 Processing {language} final announcement...")
                generation_progress[generation_key]["current_language"] = language
                generation_progress[generation_key]["completed_languages"] = i
                
                # Get the template text for this language
                template_text = getattr(template, f"{language}_text", template.english_text)
                if not template_text:
                    print(f"⚠️ No template text found for {language}")
                    continue
                
                print(f"📝 Template text: {template_text}")
                
                # Find all placeholders in the template text
                import re
                placeholder_pattern = r'\{([^}]+)\}'
                placeholders = re.findall(placeholder_pattern, template_text)
                print(f"🔍 Placeholders found: {placeholders}")
                
                # Create a mapping of placeholder positions
                placeholder_positions = []
                for match in re.finditer(placeholder_pattern, template_text):
                    placeholder_positions.append({
                        'placeholder': match.group(1).strip(),
                        'start': match.start(),
                        'end': match.end()
                    })
                
                # Sort placeholders by position
                placeholder_positions.sort(key=lambda x: x['start'])
                
                # Build the audio sequence by processing the template text
                audio_paths = []
                current_pos = 0
                
                for placeholder_info in placeholder_positions:
                    # Get the text before this placeholder
                    text_before = template_text[current_pos:placeholder_info['start']].strip()
                    if text_before:
                        print(f"   📝 Text before placeholder: '{text_before}'")
                        # Get audio for the text before placeholder
                        text_audio_path = get_existing_audio_for_text(text_before, language, template_id, db)
                        if text_audio_path:
                            audio_paths.append(text_audio_path)
                            print(f"   ✅ Added text audio: {text_audio_path}")
                        else:
                            print(f"   ⚠️ No audio found for text: '{text_before}'")
                    
                    # Process the placeholder
                    placeholder_key = placeholder_info['placeholder']
                    if placeholder_key in train_data:
                        dynamic_value = str(train_data[placeholder_key])
                        
                        print(f"   🔍 Looking for existing audio for {placeholder_key}: '{dynamic_value}' in {language}")
                        
                        # Get existing audio for this placeholder (returns list of audio paths)
                        existing_audio_paths = get_existing_audio_for_placeholder(
                            f"{{{placeholder_key}}}", dynamic_value, language, db
                        )
                        
                        if existing_audio_paths:
                            # Add all audio paths to the sequence
                            audio_paths.extend(existing_audio_paths)
                            print(f"   ✅ Added {len(existing_audio_paths)} audio files for {placeholder_key} = '{dynamic_value}'")
                        else:
                            print(f"   ⚠️ No existing audio found for {placeholder_key} = '{dynamic_value}'")
                    else:
                        print(f"   ⚠️ Placeholder {placeholder_key} not found in train data")
                    
                    # Update position
                    current_pos = placeholder_info['end']
                
                # Get any remaining text after the last placeholder
                text_after = template_text[current_pos:].strip()
                if text_after:
                    print(f"   📝 Text after placeholders: '{text_after}'")
                    # Get audio for the text after placeholders
                    text_audio_path = get_existing_audio_for_text(text_after, language, template_id, db)
                    if text_audio_path:
                        audio_paths.append(text_audio_path)
                        print(f"   ✅ Added text audio: {text_audio_path}")
                    else:
                        print(f"   ⚠️ No audio found for text: '{text_after}'")
                
                if audio_paths:
                    # Create output filename
                    output_filename = f"final_announcement_{template.category}_{language}_{timestamp}_{template_id}.mp3"
                    output_path = os.path.join(output_dir, output_filename)
                    
                    # Concatenate audio files
                    if concatenate_audio_files(audio_paths, output_path):
                        final_audio_files[language] = {
                            "audio_path": f"/audio_files/final_announcements/{output_filename}",
                            "file_size": os.path.getsize(output_path),
                            "segments_used": len(audio_paths)
                        }
                        print(f"✅ {language} final announcement generated: {output_filename}")
                    else:
                        print(f"❌ Failed to generate {language} final announcement")
                else:
                    print(f"⚠️ No audio paths for {language}")
                    
            except Exception as e:
                print(f"❌ Error processing {language}: {e}")
                import traceback
                traceback.print_exc()
        
        # Update progress
        generation_progress[generation_key]["completed_languages"] = len(languages)
        generation_progress[generation_key]["final_audio_files"] = final_audio_files
        
        # Merge all language audio files in sequence: English, Hindi, Marathi, Gujarati
        if len(final_audio_files) == 4:
            print(f"🔄 Merging all language audio files...")
            print(f"   Final audio files: {final_audio_files}")
            generation_progress[generation_key]["status"] = "merging"
            
            # Create merged audio filename
            merged_filename = f"merged_announcement_{train_data.get('train_number', 'unknown')}_{template.category}_{timestamp}.mp3"
            merged_path = os.path.join(merged_dir, merged_filename)
            print(f"   Merged output path: {merged_path}")
            
            # Prepare audio files in correct sequence
            sequence_languages = ['english', 'hindi', 'marathi', 'gujarati']
            audio_files_to_merge = []
            
            for lang in sequence_languages:
                if lang in final_audio_files:
                    # Use the relative path as expected by concatenate_audio_files
                    audio_path = final_audio_files[lang]['audio_path']
                    audio_files_to_merge.append(audio_path)
                    print(f"   📁 Added {lang} audio: {audio_path}")
                else:
                    print(f"   ⚠️ Missing {lang} audio file")
            
            print(f"   Audio files to merge: {audio_files_to_merge}")
            print(f"   Number of files to merge: {len(audio_files_to_merge)}")
            
            # Merge audio files
            if concatenate_audio_files(audio_files_to_merge, merged_path):
                merged_audio_path = f"/audio_files/merged/{merged_filename}"
                generation_progress[generation_key]["merged_audio_path"] = merged_audio_path
                generation_progress[generation_key]["status"] = "completed"
                print(f"✅ Merged audio generated: {merged_audio_path}")
            else:
                generation_progress[generation_key]["error"] = "Failed to merge audio files"
                generation_progress[generation_key]["status"] = "error"
                print(f"❌ Failed to merge audio files")
        else:
            generation_progress[generation_key]["error"] = f"Only {len(final_audio_files)} out of 4 language files generated"
            generation_progress[generation_key]["status"] = "error"
            print(f"⚠️ Only {len(final_audio_files)} out of 4 language files generated")
        
        # Save final announcement data to database or return results
        print(f"🎉 Final announcement generation completed for template ID: {template_id}")
        print(f"Generated files: {list(final_audio_files.keys())}")
        
        return final_audio_files
        
    except Exception as e:
        print(f"❌ Error generating final announcement: {e}")
        import traceback
        traceback.print_exc()
        generation_progress[generation_key]["error"] = str(e)
        generation_progress[generation_key]["status"] = "error"

from pydantic import BaseModel

class FinalAnnouncementRequest(BaseModel):
    template_id: int
    train_data: Dict[str, Any]  # train_number, train_name, start_station, end_station, platform_number

@router.post("/generate")
async def generate_final_announcement(
    request: FinalAnnouncementRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Generate final announcement audio by combining template segments with train data"""
    try:
        # Check if template exists
        template = db.query(AnnouncementTemplate).filter(
            AnnouncementTemplate.id == request.template_id,
            AnnouncementTemplate.is_active == True
        ).first()
        
        if not template:
            raise HTTPException(status_code=404, detail="Announcement template not found")
        
        # Check if audio segments exist for this template
        segments_count = db.query(AnnouncementAudioSegment).filter(
            AnnouncementAudioSegment.template_id == request.template_id,
            AnnouncementAudioSegment.is_active == True
        ).count()
        
        if segments_count == 0:
            raise HTTPException(
                status_code=400, 
                detail=f"No audio segments found for template ID {request.template_id}. Please generate audio segments first."
            )
        
        # Validate train data
        required_fields = ['train_number', 'train_name', 'start_station_name', 'end_station_name', 'platform_number']
        missing_fields = [field for field in required_fields if field not in request.train_data]
        
        if missing_fields:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required train data fields: {', '.join(missing_fields)}"
            )
        
        # Start background task for audio generation
        background_tasks.add_task(
            generate_final_announcement_audio_background,
            request.template_id,
            request.train_data,
            db
        )
        
        return {
            "message": "Final announcement generation started",
            "template_id": request.template_id,
            "category": template.category,
            "title": template.title,
            "train_data": request.train_data,
            "generation_key": f"{request.template_id}_{request.train_data.get('train_number', 'unknown')}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error starting final announcement generation: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start final announcement generation: {str(e)}")

@router.get("/progress/{generation_key}")
async def check_generation_progress(generation_key: str):
    """Check the progress of final announcement generation"""
    global generation_progress
    
    if generation_key not in generation_progress:
        raise HTTPException(status_code=404, detail="Generation not found")
    
    progress = generation_progress[generation_key]
    
    return {
        "generation_key": generation_key,
        "status": progress["status"],
        "current_language": progress["current_language"],
        "total_languages": progress["total_languages"],
        "completed_languages": progress["completed_languages"],
        "final_audio_files": progress["final_audio_files"],
        "merged_audio_path": progress["merged_audio_path"],
        "error": progress["error"]
    }

@router.get("/templates/{template_id}/segments")
async def get_template_segments(template_id: int, db: Session = Depends(get_db)):
    """Get audio segments for a specific template"""
    try:
        # Check if template exists
        template = db.query(AnnouncementTemplate).filter(
            AnnouncementTemplate.id == template_id,
            AnnouncementTemplate.is_active == True
        ).first()
        
        if not template:
            raise HTTPException(status_code=404, detail="Announcement template not found")
        
        # Get audio segments
        segments_by_language = get_audio_segments_for_template(template_id, db)
        
        return {
            "template_id": template_id,
            "category": template.category,
            "title": template.title,
            "segments": segments_by_language
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching template segments: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch template segments: {str(e)}")

@router.get("/available-templates")
async def get_available_templates(db: Session = Depends(get_db)):
    """Get all templates that have audio segments available"""
    try:
        # Get templates that have audio segments
        templates_with_segments = db.query(AnnouncementTemplate).join(
            AnnouncementAudioSegment,
            AnnouncementTemplate.id == AnnouncementAudioSegment.template_id
        ).filter(
            AnnouncementTemplate.is_active == True,
            AnnouncementAudioSegment.is_active == True
        ).distinct().all()
        
        result = []
        for template in templates_with_segments:
            # Count segments for each language
            segments_count = db.query(AnnouncementAudioSegment).filter(
                AnnouncementAudioSegment.template_id == template.id,
                AnnouncementAudioSegment.is_active == True
            ).count()
            
            result.append({
                "id": template.id,
                "category": template.category,
                "title": template.title,
                "segments_count": segments_count
            })
        
        return {
            "templates": result,
            "count": len(result)
        }
        
    except Exception as e:
        print(f"❌ Error fetching available templates: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch available templates: {str(e)}")

@router.get("/list")
async def list_final_announcements():
    """List all final announcement audio files"""
    try:
        final_announcements_dir = "/var/www/audio_files/final_announcements"
        
        if not os.path.exists(final_announcements_dir):
            return {
                "announcements": [],
                "count": 0
            }
        
        announcements = []
        for filename in os.listdir(final_announcements_dir):
            if filename.endswith('.mp3'):
                file_path = os.path.join(final_announcements_dir, filename)
                file_stats = os.stat(file_path)
                
                # Parse filename: final_announcement_{category}_{language}_{timestamp}_{template_id}.mp3
                parts = filename.replace('.mp3', '').split('_')
                if len(parts) >= 6:
                    # Handle platform_change category specially
                    if parts[2] == 'platform' and parts[3] == 'change':
                        category = 'platform_change'
                        language = parts[4]
                        timestamp = parts[5]
                        template_id = parts[6] if len(parts) > 6 else parts[5]
                    else:
                        # Standard parsing for other categories
                        category = parts[2]
                        language = parts[3]
                        timestamp = parts[4]
                        template_id = parts[5]
                    
                    announcements.append({
                        "filename": filename,
                        "category": category,
                        "language": language,
                        "template_id": template_id,
                        "timestamp": timestamp,
                        "file_size": file_stats.st_size,
                        "created_at": datetime.fromtimestamp(file_stats.st_mtime).isoformat(),
                        "audio_path": f"/audio_files/final_announcements/{filename}"
                    })
        
        # Sort by creation time (newest first)
        announcements.sort(key=lambda x: x['created_at'], reverse=True)
        
        return {
            "announcements": announcements,
            "count": len(announcements)
        }
        
    except Exception as e:
        print(f"❌ Error listing final announcements: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list final announcements: {str(e)}")

@router.post("/test-dynamic")
async def test_dynamic_audio_generation(
    request: FinalAnnouncementRequest,
    db: Session = Depends(get_db)
):
    """Test finding existing audio for placeholders"""
    try:
        # Test finding existing audio for each placeholder
        results = {}
        debug_info = {}
        
        # First, let's see what audio files are available in the database
        all_audio_files = db.query(AudioFile).filter(AudioFile.is_active == True).all()
        debug_info["total_audio_files"] = len(all_audio_files)
        debug_info["sample_audio_files"] = [
            {
                "id": af.id,
                "english_text": af.english_text,
                "english_audio_path": af.english_audio_path,
                "marathi_audio_path": af.marathi_audio_path,
                "hindi_audio_path": af.hindi_audio_path,
                "gujarati_audio_path": af.gujarati_audio_path
            }
            for af in all_audio_files[:10]  # Show first 10 files
        ]
        
        for placeholder_key, value in request.train_data.items():
            print(f"Testing existing audio for {placeholder_key}: {value}")
            
            # Test in English
            english_audio_paths = get_existing_audio_for_placeholder(
                f"{{{placeholder_key}}}", str(value), "english", db
            )
            
            if english_audio_paths:
                results[f"{placeholder_key}_english"] = {
                    "success": True,
                    "audio_paths": english_audio_paths,
                    "audio_count": len(english_audio_paths),
                    "value": value
                }
            else:
                results[f"{placeholder_key}_english"] = {
                    "success": False,
                    "error": "No existing audio found"
                }
        
        return {
            "message": "Existing audio lookup test completed",
            "debug_info": debug_info,
            "results": results
        }
        
    except Exception as e:
        print(f"❌ Error testing existing audio lookup: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to test existing audio lookup: {str(e)}")

@router.post("/test-final-announcement-generation")
async def test_final_announcement_generation(
    request: FinalAnnouncementRequest,
    db: Session = Depends(get_db)
):
    """Test the complete final announcement generation process using template text directly"""
    try:
        print(f"🧪 Testing final announcement generation for template ID: {request.template_id}")
        
        # Get the template
        template = db.query(AnnouncementTemplate).filter(
            AnnouncementTemplate.id == request.template_id,
            AnnouncementTemplate.is_active == True
        ).first()
        
        if not template:
            return {
                "error": f"Template with ID {request.template_id} not found"
            }
        
        print(f"📋 Template found: {template.category}")
        print(f"📝 English text: {template.english_text}")
        
        # Test each language
        test_results = {}
        languages = ['english', 'marathi', 'hindi', 'gujarati']
        
        for language in languages:
            print(f"\n🔄 Testing {language}...")
            
            # Get the template text for this language
            template_text = getattr(template, f"{language}_text", template.english_text)
            if not template_text:
                print(f"⚠️ No template text found for {language}")
                continue
                
            print(f"📝 {language.capitalize()} template text: {template_text}")
            
            # Find all placeholders in the template text
            import re
            placeholder_pattern = r'\{([^}]+)\}'
            placeholders = re.findall(placeholder_pattern, template_text)
            print(f"🔍 Found placeholders: {placeholders}")
            
            # Create a mapping of placeholder positions
            placeholder_positions = []
            for match in re.finditer(placeholder_pattern, template_text):
                placeholder_positions.append({
                    'placeholder': match.group(1).strip(),
                    'start': match.start(),
                    'end': match.end()
                })
            
            # Sort placeholders by position
            placeholder_positions.sort(key=lambda x: x['start'])
            print(f"📍 Placeholder positions: {placeholder_positions}")
            
            # Build the audio sequence by processing the template text
            audio_paths = []
            current_pos = 0
            
            for placeholder_info in placeholder_positions:
                # Get the text before this placeholder
                text_before = template_text[current_pos:placeholder_info['start']].strip()
                if text_before:
                    print(f"   📝 Text before placeholder: '{text_before}'")
                    # Get audio for the text before placeholder
                    text_audio_path = get_existing_audio_for_text(text_before, language, request.template_id, db)
                    if text_audio_path:
                        audio_paths.append(text_audio_path)
                        print(f"   ✅ Added text audio: {text_audio_path}")
                    else:
                        print(f"   ⚠️ No audio found for text: '{text_before}'")
                
                # Process the placeholder
                placeholder_key = placeholder_info['placeholder']
                if placeholder_key in request.train_data:
                    dynamic_value = str(request.train_data[placeholder_key])
                    
                    print(f"   🔍 Looking for audio for {placeholder_key} = '{dynamic_value}'")
                    
                    # Get existing audio for this placeholder (returns list of audio paths)
                    existing_audio_paths = get_existing_audio_for_placeholder(
                        f"{{{placeholder_key}}}", dynamic_value, language, db
                    )
                    
                    if existing_audio_paths:
                        # Add all audio paths to the sequence
                        audio_paths.extend(existing_audio_paths)
                        print(f"   ✅ Added {len(existing_audio_paths)} audio files for {placeholder_key} = '{dynamic_value}'")
                        print(f"   📁 Audio files: {existing_audio_paths}")
                    else:
                        print(f"   ⚠️ No existing audio found for {placeholder_key} = '{dynamic_value}'")
                else:
                    print(f"   ⚠️ Placeholder {placeholder_key} not found in train data")
                
                # Update position
                current_pos = placeholder_info['end']
            
            # Get any remaining text after the last placeholder
            text_after = template_text[current_pos:].strip()
            if text_after:
                print(f"   📝 Text after placeholders: '{text_after}'")
                # Get audio for the text after placeholders
                text_audio_path = get_existing_audio_for_text(text_after, language, request.template_id, db)
                if text_audio_path:
                    audio_paths.append(text_audio_path)
                    print(f"   ✅ Added text audio: {text_audio_path}")
                else:
                    print(f"   ⚠️ No audio found for text: '{text_after}'")
            
            test_results[language] = {
                "template_text": template_text,
                "placeholders_found": placeholders,
                "total_audio_paths": len(audio_paths),
                "audio_paths": audio_paths
            }
        
        return {
            "message": "Final announcement generation test completed",
            "template_info": {
                "id": template.id,
                "category": template.category,
                "english_text": template.english_text
            },
            "train_data": request.train_data,
            "test_results": test_results
        }
        
    except Exception as e:
        print(f"❌ Error testing final announcement generation: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to test final announcement generation: {str(e)}")

@router.delete("/clear-all")
async def clear_all_final_announcements(db: Session = Depends(get_db)):
    """Clear all final announcement audio files and database records"""
    try:
        print("🗑️ Starting to clear all final announcements...")
        
        # Clear final announcement audio files
        final_announcements_dir = "/var/www/audio_files/final_announcements"
        dynamic_content_dir = "/var/www/audio_files/dynamic_content"
        
        deleted_files = []
        
        # Delete final announcement files
        if os.path.exists(final_announcements_dir):
            for filename in os.listdir(final_announcements_dir):
                if filename.endswith('.mp3'):
                    file_path = os.path.join(final_announcements_dir, filename)
                    try:
                        os.remove(file_path)
                        deleted_files.append(f"final_announcements/{filename}")
                        print(f"   Deleted: {filename}")
                    except Exception as e:
                        print(f"⚠️ Failed to delete {filename}: {e}")
        
        # Delete dynamic content files
        if os.path.exists(dynamic_content_dir):
            for filename in os.listdir(dynamic_content_dir):
                if filename.endswith('.mp3'):
                    file_path = os.path.join(dynamic_content_dir, filename)
                    try:
                        os.remove(file_path)
                        deleted_files.append(f"dynamic_content/{filename}")
                        print(f"   Deleted: {filename}")
                    except Exception as e:
                        print(f"⚠️ Failed to delete {filename}: {e}")
        
        # Clear database records (if you have a table for final announcements)
        # For now, we'll just clear the files since we don't have a specific table
        # If you add a FinalAnnouncement model later, you can uncomment this:
        # db.query(FinalAnnouncement).delete()
        # db.commit()
        
        print(f"✅ Cleared {len(deleted_files)} audio files")
        
        return {
            "message": "All final announcements cleared successfully",
            "deleted_files_count": len(deleted_files),
            "deleted_files": deleted_files
        }
        
    except Exception as e:
        print(f"❌ Error clearing final announcements: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear final announcements: {str(e)}")

@router.delete("/clear-dynamic-content")
async def clear_dynamic_content(db: Session = Depends(get_db)):
    """Clear only dynamic content audio files (legacy files)"""
    try:
        print("🗑️ Starting to clear legacy dynamic content...")
        
        dynamic_content_dir = "/var/www/audio_files/dynamic_content"
        deleted_files = []
        
        if os.path.exists(dynamic_content_dir):
            for filename in os.listdir(dynamic_content_dir):
                if filename.endswith('.mp3'):
                    file_path = os.path.join(dynamic_content_dir, filename)
                    try:
                        os.remove(file_path)
                        deleted_files.append(filename)
                        print(f"   Deleted: {filename}")
                    except Exception as e:
                        print(f"⚠️ Failed to delete {filename}: {e}")
        
        print(f"✅ Cleared {len(deleted_files)} legacy dynamic content files")
        
        return {
            "message": "Legacy dynamic content cleared successfully",
            "deleted_files_count": len(deleted_files),
            "deleted_files": deleted_files
        }
        
    except Exception as e:
        print(f"❌ Error clearing dynamic content: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear dynamic content: {str(e)}") 