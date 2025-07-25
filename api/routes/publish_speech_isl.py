from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
import json
from datetime import datetime
from pathlib import Path

router = APIRouter()

class PublishSpeechISLRequest(BaseModel):
    video_url: str
    audio_url: str
    english_text: str

@router.post("/publish-speech-isl")
async def publish_speech_isl(request: PublishSpeechISLRequest):
    """
    Create an HTML page with Speech to ISL video, text display, and background audio
    """
    try:
        # Try to create the publish directory with fallback options
        publish_dir = None
        possible_dirs = [
            Path("/var/www/publish_speech_isl"),
            Path("./publish_speech_isl"),
            Path("/tmp/publish_speech_isl")
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
            raise Exception("No writable directory found for publishing Speech to ISL videos")
        
        # Generate a unique filename based on timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"speech_isl_{timestamp}.html"
        file_path = publish_dir / filename
        
        print(f"📝 Generating HTML file: {file_path}")
        print(f"📝 Video URL: {request.video_url}")
        print(f"📝 Audio URL: {request.audio_url}")
        print(f"📝 English text: {request.english_text}")
        
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
        
        # Create the HTML content with converted URLs
        html_content = generate_speech_isl_html_page_with_urls(request.english_text, video_url, audio_url)
        
        # Debug: Print a snippet of the HTML to see the URLs
        print(f"📝 HTML snippet - Video source: <source src=\"{video_url}\"")
        print(f"📝 HTML snippet - Audio source: <source src=\"{audio_url}\"")
        
        # Write the HTML file
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        print(f"✅ HTML file created successfully: {file_path}")
        
        return {
            "success": True,
            "message": "Speech to ISL video published successfully",
            "file_path": str(file_path),
            "filename": filename,
            "html_url": f"/publish_speech_isl/{filename}"
        }
        
    except Exception as e:
        print(f"❌ Error in publish_speech_isl: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to publish Speech to ISL video: {str(e)}")

def generate_speech_isl_html_page(request: PublishSpeechISLRequest) -> str:
    """
    Generate the HTML content for the Speech to ISL page with modern design (legacy function)
    """
    return generate_speech_isl_html_page_with_urls(request.english_text, request.video_url, request.audio_url)

def generate_speech_isl_html_page_with_urls(english_text: str, video_url: str, audio_url: str) -> str:
    """
    Generate the HTML content for the Speech to ISL page with modern design using provided URLs
    """
    
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="google" content="notranslate">
    <meta name="googlebot" content="notranslate">
    <title>Speech to ISL - {english_text}</title>
    <style>
        * {{
            box-sizing: border-box;
        }}
        
        body {{
            margin: 0;
            padding: 0;
            font-family: 'Arial Unicode MS', 'Arial', sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            height: 100vh;
            color: white;
            position: relative;
            overflow: hidden;
        }}
        
        .watermark {{
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
            pointer-events: none;
            overflow: hidden;
        }}
        
        .watermark-text {{
            position: absolute;
            font-size: 8vw;
            font-weight: 900;
            color: rgba(255, 255, 255, 0.03);
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            white-space: nowrap;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
            letter-spacing: 0.1em;
        }}
        
        .main-container {{
            position: relative;
            z-index: 10;
            height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }}
        
        .header-section {{
            padding: 1.5vh 4vw;
            text-align: center;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(10px);
            border-bottom: 3px solid rgba(255, 255, 255, 0.1);
        }}
        
        .title {{
            font-size: 3.2vw;
            font-weight: 900;
            margin-bottom: 1vh;
            text-shadow: 3px 3px 6px rgba(0,0,0,0.8);
            color: #ffffff;
            letter-spacing: 0.05em;
        }}
        
        .subtitle {{
            font-size: 2.2vw;
            margin-bottom: 1vh;
            color: #e0e0e0;
            font-weight: 600;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.7);
        }}
        
        .content-section {{
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1vh 4vw;
        }}
        
        .video-container {{
            background: rgba(0,0,0,0.6);
            padding: 2vh 4vw;
            border-radius: 20px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            border: 2px solid rgba(255,255,255,0.1);
            max-width: 60vw;
            width: 100%;
        }}
        
        .video-player {{
            width: 100%;
            height: auto;
            border-radius: 15px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.6);
            border: 3px solid rgba(255,255,255,0.2);
        }}
        
        .text-display {{
            background: linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.1));
            color: white;
            padding: 2vh 4vw;
            border-radius: 15px;
            font-size: 2vw;
            font-weight: 700;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.7);
            margin-top: 2vh;
            border: 2px solid rgba(255,255,255,0.3);
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        }}
        
        .footer-section {{
            padding: 1vh 4vw;
            text-align: center;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(10px);
            border-top: 3px solid rgba(255, 255, 255, 0.1);
        }}
        
        .footer-text {{
            font-size: 1.8vw;
            color: #cccccc;
            margin: 0.5vh 0;
            font-weight: 500;
        }}
        
        /* Large Monitor Optimizations */
        @media (min-width: 1920px) {{
            .title {{
                font-size: 3.5vw;
            }}
            .subtitle {{
                font-size: 2.5vw;
            }}
            .text-display {{
                font-size: 2.2vw;
            }}
        }}
        
        @media (min-width: 2560px) {{
            .title {{
                font-size: 3vw;
            }}
            .subtitle {{
                font-size: 2.2vw;
            }}
            .text-display {{
                font-size: 1.8vw;
            }}
        }}
        
        /* Auto-refresh for TV displays */
        @media (min-width: 1920px) {{
            body::after {{
                content: '';
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 9999;
            }}
        }}
    </style>
</head>
<body>
    <div class="watermark">
        <div class="watermark-text">POC DEMO</div>
    </div>
    
    <div class="main-container">
        <div class="header-section">
            <div class="title">
                DEMO ISL Announcement
            </div>
        </div>
        
        <div class="content-section">
            <div class="video-container">
                <video class="video-player" muted autoplay loop>
                    <source src="{video_url}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
            </div>
        </div>
        
        <div class="footer-section">
            <div class="footer-text">Generated on {datetime.now().strftime("%B %d, %Y at %I:%M %p")}</div>
        </div>
    </div>
    
    <audio id="announcementAudio" preload="auto">
        <source src="{audio_url}" type="audio/mpeg">
        Your browser does not support the audio element.
    </audio>
    
    <script>
        // TV Display Optimizations
        const audio = document.getElementById('announcementAudio');
        const video = document.querySelector('video');
        
        // Auto-refresh for TV displays (every 30 minutes)
        function setupAutoRefresh() {{
            if (window.innerWidth >= 1920) {{
                setInterval(() => {{
                    window.location.reload();
                }}, 30 * 60 * 1000); // 30 minutes
            }}
        }}
        
        // Initialize everything
        function initializePage() {{
            // Start media playback
            if (video) {{
                video.playbackRate = 2.0; // Set video speed to 2x
                video.play().catch(e => console.log('Video auto-play failed:', e));
            }}
            
            if (audio) {{
                audio.loop = true;
                audio.play().catch(e => console.log('Audio auto-play failed:', e));
            }}
            
            // Setup auto-refresh for TV displays
            setupAutoRefresh();
        }}
        
        // Start as soon as possible
        if (document.readyState === 'loading') {{
            document.addEventListener('DOMContentLoaded', initializePage);
        }} else {{
            initializePage();
        }}
        
        // Also start on window load
        window.addEventListener('load', initializePage);
        
        // Loop video when it ends
        if (video) {{
            video.addEventListener('ended', function() {{
                this.currentTime = 0;
                this.play().catch(e => console.log('Video loop failed:', e));
            }});
            
            // Set playback rate when video loads
            video.addEventListener('loadedmetadata', function() {{
                this.playbackRate = 2.0;
            }});
        }}
        
        // Prevent context menu on TV displays
        document.addEventListener('contextmenu', function(e) {{
            e.preventDefault();
        }});
        
        // Prevent text selection on TV displays
        document.addEventListener('selectstart', function(e) {{
            e.preventDefault();
        }});
    </script>
</body>
</html>"""
    
    return html

@router.get("/publish-speech-isl/{filename}")
async def serve_published_speech_isl(filename: str):
    """Serve published Speech to ISL HTML files"""
    try:
        # Try multiple possible directories
        possible_dirs = [
            Path("/var/www/publish_speech_isl"),
            Path("./publish_speech_isl"),
            Path("/tmp/publish_speech_isl")
        ]
        
        file_path = None
        for dir_path in possible_dirs:
            test_path = dir_path / filename
            if test_path.exists():
                file_path = test_path
                break
        
        if file_path is None:
            raise HTTPException(status_code=404, detail="Published Speech to ISL file not found")
        
        return FileResponse(
            path=str(file_path),
            media_type="text/html"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to serve published Speech to ISL file: {str(e)}")

@router.delete("/cleanup-publish-speech-isl")
async def cleanup_publish_speech_isl_directory():
    """
    Clean up all files in the publish_speech_isl directory
    """
    try:
        import time
        from datetime import datetime, timedelta
        
        # Try multiple possible directories
        possible_dirs = [
            "/var/www/publish_speech_isl",
            "./publish_speech_isl",
            "/tmp/publish_speech_isl"
        ]
        
        deleted_count = 0
        cleaned_dirs = []
        
        for publish_dir in possible_dirs:
            if os.path.exists(publish_dir):
                print(f"🧹 Starting cleanup of publish_speech_isl directory: {publish_dir}")
                
                # Get current time for age calculation
                current_time = time.time()
                cutoff_time = current_time - (24 * 60 * 60)  # 24 hours ago
                
                try:
                    files = os.listdir(publish_dir)
                    if not files:
                        print(f"📁 No files found in {publish_dir}")
                        continue
                    
                    for filename in files:
                        file_path = os.path.join(publish_dir, filename)
                        
                        # Check if it's a file and get its modification time
                        if os.path.isfile(file_path):
                            file_mtime = os.path.getmtime(file_path)
                            
                            # Delete files older than 24 hours
                            if file_mtime < cutoff_time:
                                try:
                                    os.remove(file_path)
                                    deleted_count += 1
                                    print(f"🗑️ Deleted old file: {filename}")
                                except Exception as e:
                                    print(f"❌ Error deleting {filename}: {e}")
                            else:
                                file_age = current_time - file_mtime
                                age_hours = file_age / 3600
                                print(f"📄 Keeping recent file: {filename} (age: {age_hours:.1f} hours)")
                
                except Exception as e:
                    print(f"❌ Error processing directory {publish_dir}: {e}")
                    continue
                
                cleaned_dirs.append(publish_dir)
        
        if not cleaned_dirs:
            return {
                "success": True,
                "message": "No publish_speech_isl directories found to clean",
                "deleted_count": 0
            }
        
        print(f"✅ Cleanup completed. Deleted {deleted_count} files from publish_speech_isl directories")
        
        return {
            "success": True,
            "message": f"Successfully cleaned up {deleted_count} files from publish_speech_isl directories",
            "deleted_count": deleted_count,
            "cleaned_directories": cleaned_dirs
        }
        
    except Exception as e:
        print(f"❌ Error during publish_speech_isl cleanup: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clean up publish_speech_isl directories: {str(e)}") 