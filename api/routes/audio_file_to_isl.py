from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
import os
import tempfile
from datetime import datetime
from google.cloud import speech
import asyncio
from utils.isl_utils import generate_isl_video_from_text, generate_merged_audio
from pathlib import Path
from starlette.responses import FileResponse

router = APIRouter()

class AudioFileToISLRequest(BaseModel):
    audio_file_path: str
    language: str = "en-IN"

class AudioFileToISLResponse(BaseModel):
    success: bool
    message: str
    transcribed_text: str = ""
    video_url: str = ""
    audio_url: str = ""

class PublishAudioFileISLRequest(BaseModel):
    video_url: str
    audio_url: str
    text: str

def transcribe_audio_file(audio_file_path: str, language_code: str = "en-IN") -> str:
    """
    Perform synchronous speech recognition on a local audio file using GCP Speech-to-Text API
    """
    try:
        print(f"Transcribing audio file: {audio_file_path}")
        print(f"Language code: {language_code}")
        
        # Check if file exists and get file size
        if not os.path.exists(audio_file_path):
            raise Exception(f"Audio file not found: {audio_file_path}")
        
        file_size = os.path.getsize(audio_file_path)
        print(f"File size: {file_size} bytes ({file_size / 1024:.2f} KB)")
        
        if file_size == 0:
            raise Exception("Audio file is empty")
        
        client = speech.SpeechClient()

        # Read the audio file
        with open(audio_file_path, "rb") as f:
            audio_content = f.read()

        print(f"Read {len(audio_content)} bytes from audio file")

        # Create recognition audio object
        audio = speech.RecognitionAudio(content=audio_content)
        
        # Determine encoding based on file extension
        file_extension = os.path.splitext(audio_file_path)[1].lower()
        
        if file_extension == '.mp3':
            encoding = speech.RecognitionConfig.AudioEncoding.MP3
            sample_rate_hertz = None  # MP3 files have embedded sample rate
        elif file_extension == '.wav':
            encoding = speech.RecognitionConfig.AudioEncoding.LINEAR16
            # Get the actual sample rate from the WAV file header
            try:
                import wave
                with wave.open(audio_file_path, 'rb') as wav_file:
                    sample_rate_hertz = wav_file.getframerate()
                    print(f"WAV file sample rate: {sample_rate_hertz} Hz")
            except Exception as e:
                print(f"Warning: Could not read WAV file sample rate, using default 16000 Hz: {e}")
                sample_rate_hertz = 16000
        else:
            # Default to LINEAR16 for other formats
            encoding = speech.RecognitionConfig.AudioEncoding.LINEAR16
            sample_rate_hertz = 16000
        
        print(f"Detected file type: {file_extension}")
        print(f"Using encoding: {encoding}")
        print(f"Sample rate: {sample_rate_hertz}")
        
        # Configure recognition settings with more options for better detection
        config = speech.RecognitionConfig(
            encoding=encoding,
            sample_rate_hertz=sample_rate_hertz,
            language_code=language_code,
            enable_automatic_punctuation=True,
            enable_word_time_offsets=False,
            enable_word_confidence=True,
            # Add these options for better speech detection
            use_enhanced=True,  # Use enhanced models for better accuracy
            model="latest_long"  # Use the latest long-form model
        )

        print("Starting speech recognition...")
        
        # Perform the recognition
        response = client.recognize(config=config, audio=audio)

        print(f"Recognition completed. Number of results: {len(response.results)}")

        # Extract transcript from results
        transcript = ""
        for i, result in enumerate(response.results):
            print(f"Result {i + 1}: {result}")
            if result.alternatives:
                transcript += result.alternatives[0].transcript + " "
                print(f"Alternative transcript: {result.alternatives[0].transcript}")
        
        transcript = transcript.strip()
        print(f"Final transcript: '{transcript}'")
        
        if not transcript:
            print("⚠️ No transcript generated. This could be due to:")
            print("   - Audio file contains no speech")
            print("   - Audio quality is too poor")
            print("   - Language code doesn't match the speech")
            print("   - Audio format issues")
            print("   - File corruption")
            
            # Try with different language codes if original failed
            # if language_code == "en-IN":
            #     print("🔄 Trying with en-US language code...")
            #     config.language_code = "en-US"
            #     config.alternative_language_codes = []
                
            #     response = client.recognize(config=config, audio=audio)
                
            #     for result in response.results:
            #         if result.alternatives:
            #             transcript += result.alternatives[0].transcript + " "
                
            #     transcript = transcript.strip()
            #     print(f"Retry transcript: '{transcript}'")
        
        return transcript
        
    except Exception as e:
        print(f"❌ Error transcribing audio file: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        raise Exception(f"Speech recognition failed: {str(e)}")

@router.post("/audio-file-to-isl", response_model=AudioFileToISLResponse)
async def audio_file_to_isl(
    audio_file: UploadFile = File(...),
    language: str = Form("en-IN")
):
    """
    Transcribe uploaded audio file to text using GCP Speech-to-Text
    """
    try:
        print(f"Audio File to ISL transcription request - Language: {language}")
        print(f"Uploaded file: {audio_file.filename}")
        print(f"File size: {audio_file.size} bytes")
        print(f"Content type: {audio_file.content_type}")
        
        # Validate file type
        if not audio_file.filename.lower().endswith(('.mp3', '.wav')):
            raise HTTPException(status_code=400, detail="Only MP3 and WAV files are supported")
        
        # Validate file size (max 50MB)
        if audio_file.size > 50 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size must be less than 50MB")
        
        if audio_file.size == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        
        # Create temporary file for processing
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio_file.filename)[1]) as temp_file:
            # Write uploaded file to temporary location
            content = await audio_file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
            
            print(f"Temporary file created: {temp_file_path}")
            print(f"Temporary file size: {os.path.getsize(temp_file_path)} bytes")
        
        try:
            # Transcribe audio file using GCP Speech-to-Text
            print("Starting audio transcription...")
            transcribed_text = transcribe_audio_file(temp_file_path, language)
            
            if not transcribed_text:
                raise HTTPException(
                    status_code=400, 
                    detail="No speech detected in the audio file. Please ensure the file contains clear speech and try again."
                )
            
            print(f"Transcribed text: {transcribed_text}")
            
            return AudioFileToISLResponse(
                success=True,
                message="Audio file transcribed successfully",
                transcribed_text=transcribed_text,
                video_url="",
                audio_url=""
            )
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
                print(f"Temporary file cleaned up: {temp_file_path}")
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        print(f"❌ Error in audio-file-to-isl transcription: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        raise HTTPException(status_code=500, detail=f"Audio transcription failed: {str(e)}")

@router.get("/audio-file-isl-video/{filename}")
async def serve_audio_file_isl_video(filename: str):
    """
    Serve Audio File to ISL video files from /var/www/final_audio_file_isl_vid/
    """
    try:
        file_path = f"/var/www/final_audio_file_isl_vid/{filename}"
        print(f"Serving Audio File to ISL video: {file_path}")
        
        if not os.path.exists(file_path):
            print(f"❌ File not found: {file_path}")
            raise HTTPException(status_code=404, detail="Video file not found")
        
        return FileResponse(file_path, media_type="video/mp4")
        
    except Exception as e:
        print(f"❌ Error serving Audio File to ISL video: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error serving video: {str(e)}")

@router.get("/audio-file-isl-audio/{filename}")
async def serve_audio_file_isl_audio(filename: str):
    """
    Serve Audio File to ISL audio files from /var/www/audio_files/merged_audio_file_isl/
    """
    try:
        file_path = f"/var/www/audio_files/merged_audio_file_isl/{filename}"
        print(f"Serving Audio File to ISL audio: {file_path}")
        
        if not os.path.exists(file_path):
            print(f"❌ File not found: {file_path}")
            raise HTTPException(status_code=404, detail="Audio file not found")
        
        return FileResponse(file_path, media_type="audio/mpeg")
        
    except Exception as e:
        print(f"❌ Error serving Audio File to ISL audio: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error serving audio: {str(e)}")

@router.post("/publish-audio-file-isl")
async def publish_audio_file_isl(request: PublishAudioFileISLRequest):
    """
    Create an HTML page with Audio File to ISL video and audio
    """
    try:
        # Try to create the publish directory with fallback options
        publish_dir = None
        possible_dirs = [
            Path("/var/www/publish_audio_file_isl"),
            Path("./publish_audio_file_isl"),
            Path("/tmp/publish_audio_file_isl")
        ]
        
        for dir_path in possible_dirs:
            try:
                dir_path.mkdir(parents=True, exist_ok=True)
                # Test write permissions
                test_file = dir_path / "test_write.tmp"
                with open(test_file, 'w') as f:
                    f.write("test")
                os.remove(test_file)
                publish_dir = dir_path
                print(f"✅ Using publish directory: {publish_dir}")
                break
            except (PermissionError, OSError) as e:
                print(f"❌ Cannot use directory {dir_path}: {e}")
                continue
        
        if publish_dir is None:
            raise Exception("No writable directory found for publishing Audio File to ISL videos")
        
        # Generate a unique filename based on timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"audio_file_isl_{timestamp}.html"
        file_path = publish_dir / filename
        
        print(f"📝 Generating HTML file: {file_path}")
        print(f"📝 Video URL: {request.video_url}")
        print(f"📝 Audio URL: {request.audio_url}")
        print(f"📝 Text: {request.text}")
        
        # Convert relative URLs to full URLs for the HTML page
        base_url = "http://localhost:5001"
        full_video_url = f"{base_url}{request.video_url}" if request.video_url else ""
        full_audio_url = f"{base_url}{request.audio_url}" if request.audio_url else ""
        
        # Generate HTML content
        html_content = generate_audio_file_isl_html_page_with_urls(request.text, full_video_url, full_audio_url)
        
        # Write HTML file
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        print(f"✅ HTML file generated successfully: {file_path}")
        
        # Return the URL for the published HTML page
        html_url = f"/publish_audio_file_isl/{filename}"
        
        return {
            "success": True,
            "message": "Audio File to ISL HTML page published successfully",
            "html_url": html_url
        }
        
    except Exception as e:
        print(f"❌ Error publishing Audio File to ISL: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to publish Audio File to ISL: {str(e)}")

def generate_audio_file_isl_html_page_with_urls(text: str, video_url: str, audio_url: str) -> str:
    """
    Generate HTML page for published Audio File to ISL video
    """
    html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DEMO ISL Announcement - Audio File</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: 'Arial', sans-serif;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: white;
            position: relative;
            overflow: hidden;
        }}
        
        /* Watermark */
        body::before {{
            content: 'DEMO';
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 15vw;
            font-weight: bold;
            color: rgba(255, 255, 255, 0.05);
            z-index: 1;
            pointer-events: none;
        }}
        
        .container {{
            position: relative;
            z-index: 2;
            text-align: center;
            max-width: 90vw;
            width: 100%;
        }}
        
        .header {{
            margin-bottom: 2rem;
        }}
        
        .header h1 {{
            font-size: 3rem;
            font-weight: bold;
            margin-bottom: 0.5rem;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
        }}
        
        .video-container {{
            background: rgba(0, 0, 0, 0.3);
            border-radius: 15px;
            padding: 2rem;
            margin: 2rem 0;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }}
        
        video {{
            max-width: 100%;
            height: auto;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }}
        
        .audio-container {{
            background: rgba(0, 0, 0, 0.3);
            border-radius: 15px;
            padding: 1.5rem;
            margin: 1rem 0;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }}
        
        audio {{
            width: 100%;
            max-width: 400px;
            border-radius: 10px;
        }}
        
        .footer {{
            margin-top: 2rem;
            font-size: 0.9rem;
            opacity: 0.8;
        }}
        
        /* TV Optimizations */
        @media (min-width: 1920px) {{
            .header h1 {{
                font-size: 4rem;
            }}
            
            .video-container {{
                padding: 3rem;
            }}
        }}
        
        /* Auto-play and loop optimizations */
        video {{
            autoplay: true;
            muted: true;
            loop: true;
            playsinline: true;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>DEMO ISL Announcement</h1>
        </div>
        
        <div class="video-container">
            <video autoplay muted loop playsinline>
                <source src="{video_url}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        </div>
        
        {audio_url and f'''
        <div class="audio-container" style="display: none;">
            <audio autoplay loop>
                <source src="{audio_url}" type="audio/mpeg">
                <source src="{audio_url}" type="audio/wav">
                Your browser does not support the audio tag.
            </audio>
        </div>
        ''' or ''}
        
        <div class="footer">
            <p>Generated from Audio File | WRAS-DHH System</p>
        </div>
    </div>
    
    <script>
        // Auto-refresh page every 30 seconds for continuous display
        setTimeout(function() {{
            window.location.reload();
        }}, 30000);
        
        // Ensure video plays on load
        document.addEventListener('DOMContentLoaded', function() {{
            const video = document.querySelector('video');
            if (video) {{
                video.play().catch(function(error) {{
                    console.log('Video autoplay failed:', error);
                }});
            }}
        }});
    </script>
</body>
</html>
"""
    return html_content

@router.get("/publish-audio-file-isl/{filename}")
async def serve_published_audio_file_isl(filename: str):
    """
    Serve published Audio File to ISL HTML files
    """
    try:
        # Try multiple possible directories
        possible_paths = [
            f"/var/www/publish_audio_file_isl/{filename}",
            f"./publish_audio_file_isl/{filename}",
            f"/tmp/publish_audio_file_isl/{filename}"
        ]
        
        for file_path in possible_paths:
            if os.path.exists(file_path):
                print(f"Serving published Audio File to ISL HTML: {file_path}")
                return FileResponse(file_path, media_type="text/html")
        
        print(f"❌ File not found in any directory: {filename}")
        raise HTTPException(status_code=404, detail="HTML file not found")
        
    except Exception as e:
        print(f"❌ Error serving published Audio File to ISL HTML: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error serving HTML: {str(e)}")

@router.delete("/cleanup-audio-file-isl-videos")
async def cleanup_audio_file_isl_videos():
    """
    Clean up Audio File to ISL video files
    """
    try:
        video_dir = "/var/www/final_audio_file_isl_vid"
        cleaned_files = []
        
        if os.path.exists(video_dir):
            for file in os.listdir(video_dir):
                if file.endswith('.mp4'):
                    try:
                        file_path = os.path.join(video_dir, file)
                        os.remove(file_path)
                        cleaned_files.append(file)
                        print(f"Deleted video: {file}")
                    except Exception as e:
                        print(f"Failed to delete video {file}: {e}")
        
        return {
            "success": True,
            "message": f"Cleaned up {len(cleaned_files)} Audio File to ISL video files",
            "deleted_files": cleaned_files
        }
        
    except Exception as e:
        print(f"❌ Error cleaning up Audio File to ISL videos: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error cleaning up videos: {str(e)}")

@router.delete("/cleanup-audio-file-isl-audio")
async def cleanup_audio_file_isl_audio():
    """
    Clean up Audio File to ISL audio files
    """
    try:
        audio_dir = "/var/www/audio_files/merged_audio_file_isl"
        cleaned_files = []
        
        if os.path.exists(audio_dir):
            for file in os.listdir(audio_dir):
                if file.endswith('.mp3'):
                    try:
                        file_path = os.path.join(audio_dir, file)
                        os.remove(file_path)
                        cleaned_files.append(file)
                        print(f"Deleted audio: {file}")
                    except Exception as e:
                        print(f"Failed to delete audio {file}: {e}")
        
        return {
            "success": True,
            "message": f"Cleaned up {len(cleaned_files)} Audio File to ISL audio files",
            "deleted_files": cleaned_files
        }
        
    except Exception as e:
        print(f"❌ Error cleaning up Audio File to ISL audio files: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error cleaning up audio files: {str(e)}")

@router.delete("/cleanup-publish-audio-file-isl")
async def cleanup_publish_audio_file_isl_directory():
    """
    Clean up published Audio File to ISL HTML files
    """
    try:
        deleted_count = 0
        possible_dirs = [
            "/var/www/publish_audio_file_isl",
            "./publish_audio_file_isl",
            "/tmp/publish_audio_file_isl"
        ]
        
        for publish_dir in possible_dirs:
            if os.path.exists(publish_dir):
                print(f"🧹 Cleaning up directory: {publish_dir}")
                for file in os.listdir(publish_dir):
                    if file.endswith('.html'):
                        try:
                            file_path = os.path.join(publish_dir, file)
                            os.remove(file_path)
                            deleted_count += 1
                            print(f"Deleted HTML file: {file}")
                        except Exception as e:
                            print(f"Failed to delete {file}: {e}")
        
        print(f"✅ Cleanup completed. Deleted {deleted_count} files from publish_audio_file_isl directories")
        
        return {
            "success": True,
            "message": f"Cleaned up {deleted_count} published Audio File to ISL HTML files",
            "deleted_files_count": deleted_count
        }
        
    except Exception as e:
        print(f"❌ Error cleaning up published Audio File to ISL HTML files: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error cleaning up published HTML files: {str(e)}") 

@router.post("/test-audio-file")
async def test_audio_file(audio_file: UploadFile = File(...)):
    """
    Test endpoint to analyze uploaded audio file without transcription
    """
    try:
        print(f"Testing audio file: {audio_file.filename}")
        print(f"File size: {audio_file.size} bytes")
        print(f"Content type: {audio_file.content_type}")
        
        # Validate file type
        if not audio_file.filename.lower().endswith(('.mp3', '.wav')):
            raise HTTPException(status_code=400, detail="Only MP3 and WAV files are supported")
        
        # Create temporary file for analysis
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio_file.filename)[1]) as temp_file:
            content = await audio_file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
            
            print(f"Temporary file created: {temp_file_path}")
            
            try:
                # Get file information
                file_size = os.path.getsize(temp_file_path)
                file_extension = os.path.splitext(temp_file_path)[1].lower()
                
                # Try to get audio file information using ffprobe if available
                audio_info = {}
                try:
                    import subprocess
                    result = subprocess.run([
                        'ffprobe', '-v', 'quiet', '-print_format', 'json', 
                        '-show_format', '-show_streams', temp_file_path
                    ], capture_output=True, text=True)
                    
                    if result.returncode == 0:
                        import json
                        audio_info = json.loads(result.stdout)
                        print(f"FFprobe info: {audio_info}")
                except Exception as e:
                    print(f"FFprobe not available or failed: {e}")
                
                return {
                    "success": True,
                    "file_info": {
                        "filename": audio_file.filename,
                        "size_bytes": file_size,
                        "size_kb": file_size / 1024,
                        "size_mb": file_size / (1024 * 1024),
                        "extension": file_extension,
                        "content_type": audio_file.content_type,
                        "ffprobe_info": audio_info
                    },
                    "message": "Audio file analysis completed"
                }
                
            finally:
                # Clean up temporary file
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                    print(f"Temporary file cleaned up: {temp_file_path}")
        
    except Exception as e:
        print(f"❌ Error testing audio file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Audio file test failed: {str(e)}") 