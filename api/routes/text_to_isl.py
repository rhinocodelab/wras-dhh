from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
import json
from datetime import datetime
from pathlib import Path
import sys

# Import the same functions used in Speech-to-ISL from utils
from utils.isl_utils import generate_isl_video_from_text, generate_merged_audio, convert_digits_to_words

router = APIRouter()

class TextToISLRequest(BaseModel):
    text: str
    language: str

class TextToISLResponse(BaseModel):
    success: bool
    message: str
    video_url: str = ""
    audio_url: str = ""

class PublishTextISLRequest(BaseModel):
    video_url: str
    audio_url: str
    text: str

@router.post("/text-to-isl", response_model=TextToISLResponse)
async def text_to_isl(request: TextToISLRequest):
    """
    Generate ISL video from text input with merged audio - using the same logic as Speech-to-ISL
    """
    try:
        print(f"Text-to-ISL request: {request}")
        
        # Validate input
        if not request.text:
            raise HTTPException(status_code=400, detail="No text provided for ISL generation")
        
        # Process the text (same as Speech-to-ISL)
        processed_text = convert_digits_to_words(request.text.strip())
        
        # Language mapping for audio generation (same as Speech-to-ISL)
        language_mapping = {
            "english": "English",
            "hindi": "Hindi", 
            "marathi": "Marathi",
            "gujarati": "Gujarati"
        }
        
        spoken_language = language_mapping.get(request.language.lower(), "English")
        
        print(f"Processed text: {processed_text}")
        print(f"Language: {spoken_language}")
        
        # Generate ISL video using the same function as Speech-to-ISL
        isl_video_path = await generate_isl_video_from_text(processed_text)
        
        # Generate merged audio using the same function as Speech-to-ISL
        # For Text-to-ISL, we use the same text for both spoken and English
        # Use Text-to-ISL specific output directory
        audio_path = await generate_merged_audio(processed_text, processed_text, spoken_language, "/var/www/audio_files/merged_text_isl")
        
        # Create response URLs (same format as Speech-to-ISL)
        video_url = f"/api/text-isl-video/{os.path.basename(isl_video_path)}" if isl_video_path else ""
        audio_url = f"/api/text-isl-audio/{os.path.basename(audio_path)}" if audio_path else ""
        
        return TextToISLResponse(
            success=True,
            message="Text-to-ISL completed successfully",
            video_url=video_url,
            audio_url=audio_url
        )
        
    except Exception as e:
        print(f"❌ Error in text-to-isl: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Text-to-ISL failed: {str(e)}")

@router.get("/text-isl-video/{filename}")
async def serve_text_isl_video(filename: str):
    """
    Serve Text-to-ISL video files from /var/www/final_text_isl_vid/
    """
    try:
        file_path = f"/var/www/final_text_isl_vid/{filename}"
        print(f"Serving Text-to-ISL video: {file_path}")
        
        if not os.path.exists(file_path):
            print(f"❌ File not found: {file_path}")
            raise HTTPException(status_code=404, detail="Video file not found")
        
        return FileResponse(file_path, media_type="video/mp4")
        
    except Exception as e:
        print(f"❌ Error serving Text-to-ISL video: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error serving video: {str(e)}")

@router.get("/text-isl-audio/{filename}")
async def serve_text_isl_audio(filename: str):
    """
    Serve Text-to-ISL audio files from /var/www/audio_files/merged_text_isl/
    """
    try:
        file_path = f"/var/www/audio_files/merged_text_isl/{filename}"
        print(f"Serving Text-to-ISL audio: {file_path}")
        
        if not os.path.exists(file_path):
            print(f"❌ File not found: {file_path}")
            raise HTTPException(status_code=404, detail="Audio file not found")
        
        return FileResponse(file_path, media_type="audio/mpeg")
        
    except Exception as e:
        print(f"❌ Error serving Text-to-ISL audio: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error serving audio: {str(e)}")

@router.post("/publish-text-isl")
async def publish_text_isl(request: PublishTextISLRequest):
    """
    Create an HTML page with Text to ISL video, text display, and background audio
    Uses the same HTML generation logic as Speech-to-ISL
    """
    try:
        # Try to create the publish directory with fallback options
        publish_dir = None
        possible_dirs = [
            Path("/var/www/publish_text_isl"),
            Path("./publish_text_isl"),
            Path("/tmp/publish_text_isl")
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
            raise Exception("No writable directory found for publishing Text to ISL videos")
        
        # Generate a unique filename based on timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"text_isl_{timestamp}.html"
        file_path = publish_dir / filename
        
        print(f"📝 Generating HTML file: {file_path}")
        print(f"📝 Video URL: {request.video_url}")
        print(f"📝 Audio URL: {request.audio_url}")
        print(f"📝 Text: {request.text}")
        
        # Use the original API endpoint URLs and convert them to full URLs
        video_url = request.video_url
        audio_url = request.audio_url
        
        # Convert to full URLs with the translation API base
        # This ensures the browser can access the files through the API endpoints
        base_url = "http://localhost:5001"  # This should match the TRANSLATION_API_BASE_URL
        
        if not video_url.startswith('http'):
            video_url = f"{base_url}{video_url}"
        if not audio_url.startswith('http'):
            audio_url = f"{base_url}{audio_url}"
        
        print(f"📝 Full URLs - Video: {video_url}")
        print(f"📝 Full URLs - Audio: {audio_url}")
        
        # Create the HTML content with converted URLs (same as Speech-to-ISL)
        html_content = generate_text_isl_html_page_with_urls(request.text, video_url, audio_url)
        
        # Debug: Print a snippet of the HTML to see the URLs
        print(f"📝 HTML snippet - Video source: <source src=\"{video_url}\"")
        print(f"📝 HTML snippet - Audio source: <source src=\"{audio_url}\"")
        
        # Write the HTML file
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        print(f"✅ HTML file created successfully: {file_path}")
        
        return {
            "success": True,
            "message": "Text to ISL video published successfully",
            "file_path": str(file_path),
            "filename": filename,
            "html_url": f"/publish_text_isl/{filename}"
        }
        
    except Exception as e:
        print(f"❌ Error in publish_text_isl: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to publish Text to ISL video: {str(e)}")

def generate_text_isl_html_page_with_urls(text: str, video_url: str, audio_url: str) -> str:
    """
    Generate HTML page for Text to ISL video with the same styling as Speech-to-ISL
    """
    html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Text to ISL - {text[:50]}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body {{
            background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 25%, #3b82f6 50%, #1e40af 75%, #1e3a8a 100%);
            min-height: 100vh;
            margin: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }}
        
        .watermark {{
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 15vw;
            color: rgba(255, 255, 255, 0.03);
            z-index: -1;
            pointer-events: none;
            font-weight: bold;
            white-space: nowrap;
        }}
        
        .header {{
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 1rem;
            text-align: center;
            border-bottom: 3px solid #fbbf24;
        }}
        
        .video-container {{
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 60vh;
            padding: 2rem;
        }}
        
        .video-player {{
            max-width: 80%;
            max-height: 80vh;
            border: 4px solid #fbbf24;
            border-radius: 8px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
        }}
        
        .text-display {{
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 1.5rem;
            margin: 1rem 2rem;
            border-radius: 8px;
            border-left: 4px solid #fbbf24;
            font-size: 1.2rem;
            line-height: 1.6;
            text-align: center;
        }}
        
        .footer {{
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 1rem;
            text-align: center;
            border-top: 3px solid #fbbf24;
            position: fixed;
            bottom: 0;
            width: 100%;
        }}
        
        /* TV Optimizations */
        @media (min-width: 1920px) {{
            .video-player {{
                max-width: 70%;
            }}
            .text-display {{
                font-size: 1.5rem;
                margin: 2rem 4rem;
            }}
        }}
        
        /* Auto-play and loop optimizations */
        video {{
            width: 100%;
            height: auto;
        }}
        
        audio {{
            display: none;
        }}
    </style>
</head>
<body>
    <div class="watermark">DEMO ISL</div>
    
    <div class="header">
        <h1 class="text-3xl font-bold">DEMO ISL Announcement</h1>
    </div>
    
    <div class="video-container">
        <video class="video-player" autoplay loop muted>
            <source src="{video_url}" type="video/mp4">
            Your browser does not support the video tag.
        </video>
    </div>
    

    
    <div class="footer">
        <p class="text-sm">Generated on {datetime.now().strftime("%B %d, %Y at %I:%M %p")}</p>
    </div>
    
    <!-- Background Audio -->
    <audio autoplay loop>
        <source src="{audio_url}" type="audio/mpeg">
        Your browser does not support the audio element.
    </audio>
    
    <script>
        // Auto-play video and audio when page loads
        document.addEventListener('DOMContentLoaded', function() {{
            const video = document.querySelector('video');
            const audio = document.querySelector('audio');
            
            // Ensure video plays
            video.play().catch(function(error) {{
                console.log('Video autoplay failed:', error);
            }});
            
            // Ensure audio plays
            audio.play().catch(function(error) {{
                console.log('Audio autoplay failed:', error);
            }});
            
            // Loop video and audio
            video.addEventListener('ended', function() {{
                video.currentTime = 0;
                video.play();
            }});
            
            audio.addEventListener('ended', function() {{
                audio.currentTime = 0;
                audio.play();
            }});
        }});
        
        // Handle visibility change to resume playback
        document.addEventListener('visibilitychange', function() {{
            const video = document.querySelector('video');
            const audio = document.querySelector('audio');
            
            if (!document.hidden) {{
                video.play().catch(function(error) {{
                    console.log('Video resume failed:', error);
                }});
                audio.play().catch(function(error) {{
                    console.log('Audio resume failed:', error);
                }});
            }}
        }});
    </script>
</body>
</html>
"""
    return html_content

@router.get("/publish-text-isl/{filename}")
async def serve_published_text_isl(filename: str):
    """
    Serve published Text to ISL HTML files
    """
    try:
        # Try to find the file in possible directories
        possible_dirs = [
            Path("/var/www/publish_text_isl"),
            Path("./publish_text_isl"),
            Path("/tmp/publish_text_isl")
        ]
        
        file_path = None
        for dir_path in possible_dirs:
            test_path = dir_path / filename
            if test_path.exists():
                file_path = test_path
                break
        
        if file_path is None:
            raise HTTPException(status_code=404, detail="HTML file not found")
        
        print(f"Serving published Text to ISL HTML: {file_path}")
        return FileResponse(file_path, media_type="text/html")
        
    except Exception as e:
        print(f"❌ Error serving published Text to ISL HTML: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error serving HTML: {str(e)}")

@router.delete("/cleanup-text-isl-videos")
async def cleanup_text_isl_videos():
    """
    Clean up Text to ISL video files
    """
    try:
        video_dir = "/var/www/final_text_isl_vid"
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
            "message": f"Cleaned up {len(cleaned_files)} Text to ISL video files",
            "deleted_files": cleaned_files
        }
        
    except Exception as e:
        print(f"❌ Error cleaning up Text to ISL videos: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error cleaning up videos: {str(e)}")

@router.delete("/cleanup-text-isl-audio")
async def cleanup_text_isl_audio():
    """
    Clean up Text to ISL audio files
    """
    try:
        audio_dir = "/var/www/audio_files/merged_text_isl"
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
            "message": f"Cleaned up {len(cleaned_files)} Text to ISL audio files",
            "deleted_files": cleaned_files
        }
        
    except Exception as e:
        print(f"❌ Error cleaning up Text to ISL audio files: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error cleaning up audio files: {str(e)}")

@router.delete("/cleanup-publish-text-isl")
async def cleanup_publish_text_isl_directory():
    """
    Clean up published Text to ISL HTML files
    """
    try:
        # Try to find the publish directory
        possible_dirs = [
            Path("/var/www/publish_text_isl"),
            Path("./publish_text_isl"),
            Path("/tmp/publish_text_isl")
        ]
        
        cleaned_files = []
        for dir_path in possible_dirs:
            if dir_path.exists():
                for file in dir_path.glob("*.html"):
                    try:
                        os.remove(file)
                        cleaned_files.append(str(file))
                        print(f"Deleted: {file}")
                    except Exception as e:
                        print(f"Failed to delete {file}: {e}")
        
        return {
            "success": True,
            "message": f"Cleaned up {len(cleaned_files)} published Text to ISL HTML files",
            "deleted_files": cleaned_files
        }
        
    except Exception as e:
        print(f"❌ Error cleaning up published Text to ISL HTML files: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error cleaning up files: {str(e)}") 