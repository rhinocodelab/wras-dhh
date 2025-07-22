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
from pydantic import BaseModel

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
        processed_text = convert_digits_to_words(text)
        print(f"   TTS: Processed text: {processed_text[:100]}...")
        
        # Configure the text-to-speech request
        synthesis_input = texttospeech.SynthesisInput(text=processed_text)
        
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
from typing import List

class AudioFileRequest(BaseModel):
    english_text: str
    template_id: int = None  # Optional template_id to identify announcement template audio

class AudioFileBulkDeleteRequest(BaseModel):
    english_texts: List[str]

class SingleLanguageAudioRequest(BaseModel):
    text: str
    language: str  # 'english', 'marathi', 'hindi', 'gujarati'

class MergeAudioRequest(BaseModel):
    audio_files: List[str]
    output_filename: str

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
        english_translation=request.english_text.strip(),  # English translation is same as original
        template_id=request.template_id  # Set template_id if provided
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
    """Get all audio files, excluding those generated from announcement templates"""
    audio_files = db.query(AudioFile).filter(
        AudioFile.is_active == True,
        AudioFile.template_id.is_(None)  # Exclude audio files generated from announcement templates
    ).order_by(AudioFile.created_at.desc()).all()
    
    return audio_files

@router.delete("/all")
async def delete_all_audio_files(db: Session = Depends(get_db)):
    """Delete all audio files and their physical files"""
    try:
        # Get all active audio files
        audio_files = db.query(AudioFile).filter(AudioFile.is_active == True).all()
        
        if not audio_files:
            return {
                "message": "No audio files found to delete",
                "total_records_deleted": 0,
                "total_files_deleted": 0
            }
        
        total_records_deleted = 0
        total_files_deleted = 0
        audio_dir = "/var/www/audio_files"
        
        for audio_file in audio_files:
            try:
                # Get all audio file paths for this record
                audio_paths = [
                    audio_file.english_audio_path,
                    audio_file.marathi_audio_path,
                    audio_file.hindi_audio_path,
                    audio_file.gujarati_audio_path
                ]
                
                # Delete physical audio files
                for audio_path in audio_paths:
                    if audio_path:
                        # Extract filename from path (remove /audio_files/ prefix)
                        filename = audio_path.replace('/audio_files/', '')
                        filepath = os.path.join(audio_dir, filename)
                        
                        if os.path.exists(filepath):
                            try:
                                os.remove(filepath)
                                total_files_deleted += 1
                                print(f"🗑️ Deleted audio file: {filename}")
                            except PermissionError as e:
                                print(f"❌ Permission error deleting file {filename}: {e}")
                                # Try to fix permissions and retry
                                try:
                                    import stat
                                    os.chmod(filepath, stat.S_IWRITE)
                                    os.remove(filepath)
                                    total_files_deleted += 1
                                    print(f"🗑️ Deleted audio file after fixing permissions: {filename}")
                                except Exception as retry_e:
                                    print(f"❌ Failed to delete file {filename} even after fixing permissions: {retry_e}")
                            except Exception as e:
                                print(f"❌ Error deleting file {filename}: {e}")
                        else:
                            print(f"⚠️ Audio file not found: {filepath}")
                
                # Soft delete from database
                audio_file.is_active = False
                total_records_deleted += 1
                
            except Exception as e:
                print(f"❌ Error processing audio file ID {audio_file.id}: {e}")
                # Continue with other files even if one fails
        
        # Commit all changes
        db.commit()
        
        # Log deletion summary
        print(f"🗑️ Bulk deletion summary:")
        print(f"   • Database records soft deleted: {total_records_deleted}")
        print(f"   • Physical files deleted: {total_files_deleted}")
        
        return {
            "message": "All audio files deleted successfully",
            "total_records_deleted": total_records_deleted,
            "total_files_deleted": total_files_deleted
        }
        
    except Exception as e:
        print(f"❌ Error during bulk deletion: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete all audio files: {str(e)}")

@router.delete("/by-text")
async def delete_audio_file_by_text(request: AudioFileRequest, db: Session = Depends(get_db)):
    """Delete an audio file by its English text and its physical files"""
    if not request.english_text.strip():
        raise HTTPException(status_code=400, detail="English text is required")
    
    audio_file = db.query(AudioFile).filter(
        AudioFile.english_text == request.english_text.strip(),
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
        print(f"🗑️ Deletion summary for audio file with text '{request.english_text}':")
        print(f"   • Database record: Soft deleted")
        print(f"   • Physical files deleted: {len(deleted_files)}")
        print(f"   • Files: {', '.join(deleted_files) if deleted_files else 'None'}")
        
        return {
            "message": "Audio file deleted successfully",
            "total_files_deleted": len(deleted_files),
            "english_text": request.english_text.strip()
        }
        
    except Exception as e:
        print(f"❌ Error during deletion: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete audio file: {str(e)}")

@router.delete("/by-texts")
async def delete_audio_files_by_texts(request: AudioFileBulkDeleteRequest, db: Session = Depends(get_db)):
    """Delete multiple audio files by their English texts and their physical files"""
    if not request.english_texts:
        raise HTTPException(status_code=400, detail="English texts list is required")
    
    # Clean and validate texts
    cleaned_texts = [text.strip() for text in request.english_texts if text.strip()]
    if not cleaned_texts:
        raise HTTPException(status_code=400, detail="No valid English texts provided")
    
    # Debug: Log the texts we're looking for
    print(f"🔍 Looking for audio files with texts: {cleaned_texts}")
    
    try:
        # Find all audio files that match any of the provided texts
        audio_files = db.query(AudioFile).filter(
            AudioFile.english_text.in_(cleaned_texts),
            AudioFile.is_active == True
        ).all()
        
        # Debug: Log what we found
        print(f"🔍 Found {len(audio_files)} matching audio files")
        for audio_file in audio_files:
            print(f"   • ID {audio_file.id}: '{audio_file.english_text}'")
        
        # Debug: Also check all active audio files to see what exists
        all_active_files = db.query(AudioFile).filter(AudioFile.is_active == True).all()
        print(f"🔍 Total active audio files in database: {len(all_active_files)}")
        for file in all_active_files:
            print(f"   • ID {file.id}: '{file.english_text}'")
        
        if not audio_files:
            # If no exact matches found, try partial matching
            print(f"🔍 No exact matches found, trying partial matching...")
            partial_matches = []
            for text in cleaned_texts:
                # Find files that contain the text (case-insensitive)
                partial_files = db.query(AudioFile).filter(
                    AudioFile.english_text.ilike(f"%{text}%"),
                    AudioFile.is_active == True
                ).all()
                partial_matches.extend(partial_files)
            
            # Remove duplicates
            audio_files = list({file.id: file for file in partial_matches}.values())
            print(f"🔍 Found {len(audio_files)} partial matches")
            for audio_file in audio_files:
                print(f"   • ID {audio_file.id}: '{audio_file.english_text}'")
            
            if not audio_files:
                return {
                    "message": "No audio files found matching the provided texts (exact or partial)",
                    "total_records_deleted": 0,
                    "total_files_deleted": 0,
                    "matched_texts": []
                }
        
        total_records_deleted = 0
        total_files_deleted = 0
        matched_texts = []
        audio_dir = "/var/www/audio_files"
        
        for audio_file in audio_files:
            try:
                matched_texts.append(audio_file.english_text)
                
                # Get all audio file paths for this record
                audio_paths = [
                    audio_file.english_audio_path,
                    audio_file.marathi_audio_path,
                    audio_file.hindi_audio_path,
                    audio_file.gujarati_audio_path
                ]
                
                # Delete physical audio files
                for audio_path in audio_paths:
                    if audio_path:
                        # Extract filename from path (remove /audio_files/ prefix)
                        filename = audio_path.replace('/audio_files/', '')
                        filepath = os.path.join(audio_dir, filename)
                        
                        if os.path.exists(filepath):
                            try:
                                os.remove(filepath)
                                total_files_deleted += 1
                                print(f"🗑️ Deleted audio file: {filename}")
                            except PermissionError as e:
                                print(f"❌ Permission error deleting file {filename}: {e}")
                                # Try to fix permissions and retry
                                try:
                                    import stat
                                    os.chmod(filepath, stat.S_IWRITE)
                                    os.remove(filepath)
                                    total_files_deleted += 1
                                    print(f"🗑️ Deleted audio file after fixing permissions: {filename}")
                                except Exception as retry_e:
                                    print(f"❌ Failed to delete file {filename} even after fixing permissions: {retry_e}")
                            except Exception as e:
                                print(f"❌ Error deleting file {filename}: {e}")
                        else:
                            print(f"⚠️ Audio file not found: {filepath}")
                
                # Soft delete from database
                audio_file.is_active = False
                total_records_deleted += 1
                
            except Exception as e:
                print(f"❌ Error processing audio file ID {audio_file.id}: {e}")
                # Continue with other files even if one fails
        
        # Commit all changes
        db.commit()
        
        # Log deletion summary
        print(f"🗑️ Bulk text deletion summary:")
        print(f"   • Database records soft deleted: {total_records_deleted}")
        print(f"   • Physical files deleted: {total_files_deleted}")
        print(f"   • Matched texts: {', '.join(matched_texts)}")
        
        return {
            "message": "Audio files deleted successfully",
            "total_records_deleted": total_records_deleted,
            "total_files_deleted": total_files_deleted,
            "matched_texts": matched_texts
        }
        
    except Exception as e:
        print(f"❌ Error during bulk text deletion: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete audio files: {str(e)}")

@router.delete("/cleanup-stations")
async def cleanup_station_audio_files(db: Session = Depends(get_db)):
    """Delete all audio files that might be related to stations (more aggressive cleanup)"""
    try:
        # Get all active audio files
        all_audio_files = db.query(AudioFile).filter(AudioFile.is_active == True).all()
        
        if not all_audio_files:
            return {
                "message": "No audio files found to clean up",
                "total_records_deleted": 0,
                "total_files_deleted": 0
            }
        
        total_records_deleted = 0
        total_files_deleted = 0
        audio_dir = "/var/www/audio_files"
        
        print(f"🧹 Starting aggressive cleanup of {len(all_audio_files)} audio files")
        
        for audio_file in all_audio_files:
            try:
                print(f"🧹 Processing audio file ID {audio_file.id}: '{audio_file.english_text}'")
                
                # Get all audio file paths for this record
                audio_paths = [
                    audio_file.english_audio_path,
                    audio_file.marathi_audio_path,
                    audio_file.hindi_audio_path,
                    audio_file.gujarati_audio_path
                ]
                
                # Delete physical audio files
                for audio_path in audio_paths:
                    if audio_path:
                        # Extract filename from path (remove /audio_files/ prefix)
                        filename = audio_path.replace('/audio_files/', '')
                        filepath = os.path.join(audio_dir, filename)
                        
                        if os.path.exists(filepath):
                            try:
                                os.remove(filepath)
                                total_files_deleted += 1
                                print(f"🗑️ Deleted audio file: {filename}")
                            except PermissionError as e:
                                print(f"❌ Permission error deleting file {filename}: {e}")
                                # Try to fix permissions and retry
                                try:
                                    import stat
                                    os.chmod(filepath, stat.S_IWRITE)
                                    os.remove(filepath)
                                    total_files_deleted += 1
                                    print(f"🗑️ Deleted audio file after fixing permissions: {filename}")
                                except Exception as retry_e:
                                    print(f"❌ Failed to delete file {filename} even after fixing permissions: {retry_e}")
                            except Exception as e:
                                print(f"❌ Error deleting file {filename}: {e}")
                        else:
                            print(f"⚠️ Audio file not found: {filepath}")
                
                # Soft delete from database
                audio_file.is_active = False
                total_records_deleted += 1
                
            except Exception as e:
                print(f"❌ Error processing audio file ID {audio_file.id}: {e}")
                # Continue with other files even if one fails
        
        # Commit all changes
        db.commit()
        
        # Log deletion summary
        print(f"🧹 Aggressive cleanup summary:")
        print(f"   • Database records soft deleted: {total_records_deleted}")
        print(f"   • Physical files deleted: {total_files_deleted}")
        
        return {
            "message": "All audio files cleaned up successfully",
            "total_records_deleted": total_records_deleted,
            "total_files_deleted": total_files_deleted
        }
        
    except Exception as e:
        print(f"❌ Error during aggressive cleanup: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clean up audio files: {str(e)}")

def find_existing_audio_for_text(text: str, language: str, db: Session):
    """Find existing audio file for a given text and language"""
    try:
        print(f"🔍 Looking for audio for text: '{text}' in language: {language}")
        
        # Look for exact match first
        audio_file = db.query(AudioFile).filter(
            AudioFile.english_text == text,
            AudioFile.is_active == True
        ).first()
        
        if audio_file:
            audio_path = getattr(audio_file, f"{language}_audio_path")
            if audio_path:
                print(f"✅ Found exact match: {audio_path}")
                return audio_path
        
        # If no exact match, try to find individual words
        words = text.lower().split()
        word_audio_paths = []
        
        for word in words:
            # Clean the word (remove punctuation)
            clean_word = ''.join(c for c in word if c.isalnum())
            if clean_word:
                # Check if this is a number (0-9)
                number_words = {
                    'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
                    'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9'
                }
                
                # Check if this is a digit (0-9)
                if clean_word.isdigit() and len(clean_word) == 1:
                    digit = clean_word
                    print(f"   Found digit '{digit}', looking for digit '{digit}' in {language}")
                    
                    # Debug: Let's see what's actually in the database for numbers
                    all_number_files = db.query(AudioFile).filter(
                        AudioFile.english_text.in_(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']),
                        AudioFile.is_active == True
                    ).all()
                    print(f"   Available number files in database:")
                    for num_file in all_number_files:
                        print(f"     - '{num_file.english_text}': {getattr(num_file, f'{language}_audio_path', 'None')}")
                    
                    # Look for the digit in the specified language
                    digit_audio = db.query(AudioFile).filter(
                        AudioFile.english_text == digit,
                        AudioFile.is_active == True
                    ).first()
                    
                    if digit_audio:
                        digit_path = getattr(digit_audio, f"{language}_audio_path")
                        if digit_path:
                            word_audio_paths.append(digit_path)
                            print(f"   Found {language} audio for digit '{digit}': {digit_path}")
                        else:
                            print(f"   No {language} audio path found for digit '{digit}'")
                            return None
                    else:
                        print(f"   No audio file found for digit '{digit}'")
                        return None
                else:
                    # For non-number words, look for the word in the specified language
                    word_audio = db.query(AudioFile).filter(
                        AudioFile.english_text == clean_word,
                        AudioFile.is_active == True
                    ).first()
                    
                    if word_audio:
                        word_path = getattr(word_audio, f"{language}_audio_path")
                        if word_path:
                            word_audio_paths.append(word_path)
                            print(f"   Found {language} audio for word '{clean_word}': {word_path}")
                        else:
                            print(f"   No {language} audio path found for word '{clean_word}'")
                            return None
                    else:
                        print(f"   No audio file found for word '{clean_word}'")
                        return None
        
        # If we have all words, we can concatenate them
        if len(word_audio_paths) == len(words):
            print(f"   Successfully found all {len(word_audio_paths)} audio files for {language}")
            return word_audio_paths
        
        return None
        
    except Exception as e:
        print(f"Error finding existing audio for text '{text}': {e}")
        return None

@router.post("/single-language")
async def generate_single_language_audio(
    request: SingleLanguageAudioRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Generate audio for text in a specific language"""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")
    
    if request.language not in ['english', 'marathi', 'hindi', 'gujarati']:
        raise HTTPException(status_code=400, detail="Language must be one of: english, marathi, hindi, gujarati")
    
    try:
        # Create audio directory if it doesn't exist
        audio_dir = "/var/www/audio_files"
        os.makedirs(audio_dir, exist_ok=True)
        
        # Generate timestamp for unique naming
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Get voice configuration for the specified language
        voice_config = Config.TTS_VOICES.get(request.language.capitalize())
        if not voice_config:
            raise HTTPException(status_code=400, detail=f"Voice configuration not found for language: {request.language}")
        
        # Create filename
        filename = f"audio_{request.language}_{timestamp}_{hash(request.text) % 10000}.mp3"
        filepath = os.path.join(audio_dir, filename)
        
        print(f"🎵 Generating {request.language} audio for text: {request.text[:100]}...")
        print(f"   Output file: {filepath}")
        
        # First try to find existing audio files
        existing_audio = find_existing_audio_for_text(request.text.strip(), request.language, db)
        
        if existing_audio:
            if isinstance(existing_audio, str):
                # Single audio file found
                print(f"   Found existing audio file: {existing_audio}")
                # Copy the existing file to the new location
                import shutil
                source_path = f"/var/www{existing_audio}"
                if os.path.exists(source_path):
                    shutil.copy2(source_path, filepath)
                    print(f"   Copied existing audio file to: {filepath}")
                else:
                    print(f"   Existing audio file not found at: {source_path}")
                    # Fall back to TTS generation
                    generate_speech(request.text.strip(), filepath, voice_config)
            elif isinstance(existing_audio, list):
                # Multiple word audio files found, need to concatenate
                print(f"   Found {len(existing_audio)} word audio files, concatenating...")
                # Create a temporary file list for FFmpeg
                import tempfile
                with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
                    for audio_path in existing_audio:
                        full_path = f"/var/www{audio_path}"
                        if os.path.exists(full_path):
                            f.write(f"file '{full_path}'\n")
                        else:
                            print(f"   Warning: Audio file not found: {full_path}")
                    temp_file = f.name
                
                # Use FFmpeg to concatenate audio files
                import subprocess
                try:
                    cmd = [
                        'ffmpeg', '-f', 'concat', '-safe', '0', 
                        '-i', temp_file, '-c', 'copy', filepath, '-y'
                    ]
                    result = subprocess.run(cmd, capture_output=True, text=True)
                    
                    if result.returncode == 0:
                        print(f"   Successfully concatenated audio files to: {filepath}")
                    else:
                        print(f"   FFmpeg concatenation failed: {result.stderr}")
                        # Fall back to TTS generation
                        generate_speech(request.text.strip(), filepath, voice_config)
                    
                    # Clean up temporary file
                    os.unlink(temp_file)
                    
                except Exception as e:
                    print(f"   Error concatenating audio files: {e}")
                    # Fall back to TTS generation
                    generate_speech(request.text.strip(), filepath, voice_config)
        else:
            # No existing audio found, generate new speech
            print(f"   No existing audio found, generating new speech...")
            generate_speech(request.text.strip(), filepath, voice_config)
        
        # Verify file was created and has content
        if os.path.exists(filepath):
            file_size = os.path.getsize(filepath)
            print(f"   File created: {filepath} ({file_size} bytes)")
            
            if file_size > 1000:  # Minimum size for valid audio
                print(f"✅ {request.language} audio generated successfully: {filename}")
                
                return {
                    "message": f"{request.language.capitalize()} audio generated successfully",
                    "language": request.language,
                    "text": request.text.strip(),
                    "audio_path": f"/audio_files/{filename}",
                    "file_size": file_size,
                    "filename": filename
                }
            else:
                print(f"⚠️ Audio file too small ({file_size} bytes), may be corrupted")
                raise HTTPException(status_code=500, detail="Generated audio file is too small, may be corrupted")
        else:
            print(f"❌ Audio file not created")
            raise HTTPException(status_code=500, detail="Failed to create audio file")
            
    except Exception as e:
        print(f"❌ Error generating {request.language} audio: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate {request.language} audio: {str(e)}")

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

@router.post("/merge")
async def merge_audio_files(request: MergeAudioRequest):
    """Merge multiple audio files into a single file"""
    try:
        import subprocess
        from pydub import AudioSegment
        
        # Create output directory if it doesn't exist
        output_dir = "/var/www/audio_files/merged"
        os.makedirs(output_dir, exist_ok=True)
        
        # Full path for output file
        output_path = os.path.join(output_dir, request.output_filename)
        
        # Load and concatenate audio files
        combined = AudioSegment.empty()
        
        for audio_file in request.audio_files:
            if audio_file and os.path.exists(audio_file):
                # Load audio file
                audio = AudioSegment.from_file(audio_file)
                # Add to combined audio
                combined += audio
                # Add a small silence between segments
                combined += AudioSegment.silent(duration=500)  # 0.5 second silence
            else:
                print(f"Warning: Audio file not found: {audio_file}")
        
        # Export the combined audio
        combined.export(output_path, format="wav")
        
        # Return the relative path for the frontend
        relative_path = f"/audio_files/merged/{request.output_filename}"
        
        return {
            "message": "Audio files merged successfully",
            "audio_path": relative_path,
            "output_filename": request.output_filename
        }
        
    except Exception as e:
        print(f"Error merging audio files: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to merge audio files: {str(e)}")