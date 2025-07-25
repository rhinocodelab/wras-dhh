"""
Utility functions for ISL video and audio generation
Shared between main.py and text_to_isl.py to avoid circular imports
"""

import os
import hashlib
import time
import subprocess
import shutil
from datetime import datetime
from google.cloud import texttospeech

def convert_digits_to_words(text: str) -> str:
    """
    Convert digits in text to their word representations
    """
    import re
    
    def replace_digit(match):
        digit = match.group(0)
        digit_words = {
            '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
            '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine'
        }
        return digit_words.get(digit, digit)
    
    # Replace digits with words
    text = re.sub(r'\d', replace_digit, text)
    return text

async def generate_isl_video_from_text(text: str, output_dir: str = "/var/www/final_text_isl_vid") -> str:
    """
    Generate ISL video from text and save to specified output directory
    """
    try:
        print(f"Generating ISL video for text: {text}")
        
        # Ensure we're in the correct working directory (where the API is running)
        api_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        os.chdir(api_dir)
        print(f"Changed working directory to: {os.getcwd()}")
        
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
                        # Convert to absolute path for ffmpeg
                        absolute_video_path = os.path.abspath(video_path)
                        available_videos.append(absolute_video_path)
                        print(f"Found video: {absolute_video_path}")
                        break  # Use first mp4 file found
            else:
                print(f"Word '{word}' not found in ISL dataset, skipping...")
        
        print(f"Total available videos found: {len(available_videos)}")
        print(f"Available videos: {available_videos}")
        
        # Verify all video files exist
        for video_path in available_videos:
            if not os.path.exists(video_path):
                print(f"❌ Video file does not exist: {video_path}")
                raise Exception(f"Video file not found: {video_path}")
            else:
                print(f"✅ Video file exists: {video_path}")
        
        if not available_videos:
            raise Exception(f"No matching ISL videos found for the given text. Available words in dataset: {', '.join(os.listdir(isl_dataset_path))}")
        
        # Step 4: Generate unique output filename
        timestamp = int(time.time())
        text_hash = hashlib.md5(text.encode()).hexdigest()[:8]
        output_filename = f"text_isl_{text_hash}_{timestamp}.mp4"
        
        # Step 5: Create output directory
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, output_filename)
        
        print(f"Output path: {output_path}")
        
        # Step 6: Concatenate videos using ffmpeg
        if len(available_videos) == 1:
            # Single video, just copy it
            shutil.copy2(available_videos[0], output_path)
            print(f"Single video copied: {output_path}")
        else:
            # Multiple videos, concatenate them
            # Create a temporary file list for ffmpeg
            temp_list_file = f"/tmp/video_list_{timestamp}.txt"
            
            with open(temp_list_file, 'w') as f:
                for video_path in available_videos:
                    # Use absolute path and ensure proper escaping
                    f.write(f"file '{video_path}'\n")
            
            print(f"Created temp list file: {temp_list_file}")
            print(f"Available videos for concatenation: {available_videos}")
            
            # Use ffmpeg to concatenate videos
            cmd = [
                'ffmpeg', '-y',  # Overwrite output file
                '-f', 'concat',  # Use concat demuxer
                '-safe', '0',    # Allow unsafe file paths
                '-i', temp_list_file,  # Input file list
                '-c', 'copy',    # Copy streams without re-encoding
                output_path      # Output file
            ]
            
            print(f"Running ffmpeg command: {' '.join(cmd)}")
            print(f"Current working directory: {os.getcwd()}")
            print(f"Temp list file contents:")
            with open(temp_list_file, 'r') as f:
                print(f.read())
            
            result = subprocess.run(cmd, capture_output=True, text=True, cwd=os.getcwd())
            
            # Clean up temporary file
            os.remove(temp_list_file)
            
            if result.returncode != 0:
                print(f"FFmpeg error: {result.stderr}")
                print(f"FFmpeg stdout: {result.stdout}")
                raise Exception(f"Failed to concatenate videos: {result.stderr}")
            
            print(f"Videos concatenated successfully: {output_path}")
        
        return output_filename
        
    except Exception as e:
        print(f"❌ Error generating ISL video: {str(e)}")
        raise e

async def generate_audio_file(text: str, language: str) -> str:
    """
    Generate audio file from text using Google Text-to-Speech
    """
    try:
        print(f"Generating audio for text: {text} in language: {language}")
        
        # Initialize the TTS client
        tts_client = texttospeech.TextToSpeechClient()
        
        # Language and voice mapping
        voice_mapping = {
            "English": "en-IN-Standard-A",
            "Hindi": "hi-IN-Standard-A", 
            "Marathi": "mr-IN-Standard-A",
            "Gujarati": "gu-IN-Standard-A"
        }
        
        voice_name = voice_mapping.get(language, "en-IN-Standard-A")
        
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
        
        # Save the audio to a temporary file
        timestamp = int(time.time())
        text_hash = hashlib.md5(text.encode()).hexdigest()[:8]
        temp_filename = f"temp_audio_{text_hash}_{timestamp}.mp3"
        temp_path = os.path.join("/tmp", temp_filename)
        
        with open(temp_path, 'wb') as f:
            f.write(response.audio_content)
        
        print(f"Audio file generated: {temp_path}")
        return temp_path
        
    except Exception as e:
        print(f"❌ Error generating audio file: {str(e)}")
        raise e

async def find_complete_audio_file(english_text: str) -> str:
    """
    Find complete audio file from Audio Files database that matches the English text
    """
    try:
        from database import SessionLocal
        from models import AudioFile
        
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
        from models import AudioFile
        
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
        
        db_field = language_mapping.get(language)
        if not db_field:
            print(f"Unsupported language: {language}")
            return None
        
        db = SessionLocal()
        try:
            # Search for audio files that contain the word
            audio_files = db.query(AudioFile).filter(
                AudioFile.english_text.ilike(f"%{word_lower}%"),
                AudioFile.is_active == True,
                AudioFile.template_id.is_(None)
            ).all()
            
            if audio_files:
                # Find the best match based on word position and length
                best_match = None
                best_score = 0
                
                for af in audio_files:
                    # Convert digits to words in database text for comparison
                    af_text = convert_digits_to_words(af.english_text.lower())
                    
                    # Check if the word appears in the text
                    if word_lower in af_text:
                        # Calculate score based on word length and position
                        word_index = af_text.find(word_lower)
                        score = len(word_lower) / len(af_text)  # Longer words get higher scores
                        
                        if score > best_score:
                            best_score = score
                            best_match = af
                
                if best_match:
                    print(f"Found best match ID: {best_match.id}, text: '{best_match.english_text}'")
                    
                    # Get the audio path for the specified language
                    audio_path = getattr(best_match, f"{db_field}_audio_path")
                    if audio_path:
                        full_path = f"/var/www{audio_path}"
                        if os.path.exists(full_path):
                            print(f"Found audio file: {full_path}")
                            return full_path
                        else:
                            print(f"Audio file not found on disk: {full_path}")
                    else:
                        print(f"No audio path found for language: {language}")
            
            print(f"No audio file found for word '{word}' in language '{language}'")
            return None
            
        finally:
            db.close()
            
    except Exception as e:
        print(f"Error finding existing audio file: {str(e)}")
        return None

async def merge_audio_files(audio_paths: list, output_dir: str = "/var/www/audio_files/merged_speech_to_isl") -> str:
    """
    Merge multiple audio files into one
    """
    try:
        if not audio_paths:
            raise Exception("No audio files to merge")
        
        if len(audio_paths) == 1:
            return audio_paths[0]
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        
        # Generate unique filename based on output directory
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        if "text_isl" in output_dir:
            output_filename = f"merged_text_isl_{timestamp}.mp3"
        else:
            output_filename = f"merged_speech_to_isl_{timestamp}.mp3"
        output_path = os.path.join(output_dir, output_filename)
        
        # Create a temporary file list for ffmpeg
        temp_list_file = f"/tmp/audio_list_{timestamp}.txt"
        
        with open(temp_list_file, 'w') as f:
            for audio_path in audio_paths:
                f.write(f"file '{audio_path}'\n")
        
        # Use ffmpeg to concatenate audio files
        cmd = [
            'ffmpeg', '-y',
            '-f', 'concat',
            '-safe', '0',
            '-i', temp_list_file,
            '-c', 'copy',
            output_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        # Clean up temporary file
        os.remove(temp_list_file)
        
        if result.returncode != 0:
            raise Exception(f"Failed to merge audio files: {result.stderr}")
        
        print(f"Audio files merged successfully: {output_path}")
        return output_path
        
    except Exception as e:
        print(f"❌ Error merging audio files: {str(e)}")
        raise e

async def generate_merged_audio(spoken_text: str, english_text: str, language: str, output_dir: str = "/var/www/audio_files/merged_speech_to_isl") -> str:
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
                merged_path = await merge_audio_files(all_language_audio_files, output_dir)
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
            merged_path = await merge_audio_files(fallback_audio_files, output_dir)
            return merged_path
        elif len(fallback_audio_files) == 1:
            return fallback_audio_files[0]
        else:
            raise Exception("No audio files found or generated")
            
    except Exception as e:
        print(f"Error generating merged audio: {str(e)}")
        raise e 