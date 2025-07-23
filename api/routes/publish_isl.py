from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import json
from datetime import datetime
from pathlib import Path

router = APIRouter()

class PublishISLRequest(BaseModel):
    train_number: str
    train_name: str
    start_station_name: str
    end_station_name: str
    platform_number: int
    announcement_texts: dict  # {"english": "...", "hindi": "...", "marathi": "...", "gujarati": "..."}
    isl_video_path: str
    merged_audio_path: str
    category: str

@router.post("/publish-isl-announcement")
async def publish_isl_announcement(request: PublishISLRequest):
    """
    Create an HTML page with ISL video, scrolling announcement text, and background audio
    """
    try:
        # Try to create the publish directory with fallback options
        publish_dir = None
        possible_dirs = [
            Path("/var/www/publish_isl"),
            Path("./publish_isl"),
            Path("/tmp/publish_isl")
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
            raise Exception("No writable directory found for publishing ISL announcements")
        
        # Generate a unique filename based on timestamp and train info
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_train_number = request.train_number.replace(" ", "_")
        filename = f"isl_announcement_{safe_train_number}_{timestamp}.html"
        file_path = publish_dir / filename
        
        print(f"📝 Generating HTML file: {file_path}")
        
        # Create the HTML content
        html_content = generate_isl_html_page(request)
        
        # Write the HTML file
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        print(f"✅ HTML file created successfully: {file_path}")
        
        return {
            "success": True,
            "message": "ISL announcement published successfully",
            "file_path": str(file_path),
            "filename": filename,
            "url": f"/publish_isl/{filename}"
        }
        
    except Exception as e:
        print(f"❌ Error in publish_isl_announcement: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to publish ISL announcement: {str(e)}")

def generate_isl_html_page(request: PublishISLRequest) -> str:
    """
    Generate the HTML content for the ISL announcement page
    """
    
    # Base URL for serving files
    base_url = "http://localhost:5001"
    
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ISL Announcement - {request.train_name} ({request.train_number})</title>
    <style>
        body {{
            margin: 0;
            padding: 0;
            font-family: 'Arial', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: white;
        }}
        
        .container {{
            max-width: 1200px;
            width: 100%;
            padding: 20px;
            text-align: center;
        }}
        
        .header {{
            margin-bottom: 30px;
        }}
        
        .train-info {{
            font-size: 2.5em;
            font-weight: bold;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
        }}
        
        .route-info {{
            font-size: 1.5em;
            margin-bottom: 20px;
            opacity: 0.9;
        }}
        
        .platform-info {{
            font-size: 1.2em;
            margin-bottom: 30px;
            background: rgba(255,255,255,0.1);
            padding: 10px 20px;
            border-radius: 25px;
            display: inline-block;
        }}
        
        .video-container {{
            margin: 30px 0;
            background: rgba(0,0,0,0.3);
            padding: 20px;
            border-radius: 15px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }}
        
        .video-player {{
            max-width: 800px;
            width: 100%;
            height: auto;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }}
        
        .marquee-container {{
            margin: 15px 0;
            background: rgba(0,0,0,0.4);
            padding: 15px;
            border-radius: 15px;
            overflow: hidden;
            position: relative;
            width: 100%;
        }}
        
        .marquee {{
            font-size: 2.5em;
            font-weight: bold;
            white-space: nowrap;
            animation: scroll-left 40s linear infinite;
            margin: 10px 0;
            line-height: 1.2;
            display: inline-block;
            min-width: 100%;
            animation-play-state: running;
        }}
        
        .marquee.paused {{
            animation-play-state: paused;
        }}
        
        .language-label {{
            font-size: 1.2em;
            font-weight: bold;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
            opacity: 0.9;
        }}
        
        @keyframes scroll-left {{
            0% {{ transform: translateX(100%); }}
            100% {{ transform: translateX(-100%); }}
        }}
        
        .footer {{
            margin-top: 30px;
            font-size: 0.9em;
            opacity: 0.7;
        }}
        
        @media (max-width: 768px) {{
            .train-info {{
                font-size: 2em;
            }}
            
            .route-info {{
                font-size: 1.2em;
            }}
            
            .marquee {{
                font-size: 1.1em;
            }}
            
            .video-player {{
                max-width: 100%;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="train-info">
                {request.train_name} ({request.train_number})
            </div>
            <div class="route-info">
                {request.start_station_name} → {request.end_station_name}
            </div>
            <div class="platform-info">
                Platform {request.platform_number}
            </div>
        </div>
        
        <div class="video-container">
            <video class="video-player" controls muted>
                <source src="{base_url}{request.isl_video_path}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        </div>
        
        <div class="marquee-container">
            <div class="language-label">English</div>
            <div class="marquee">
                {request.announcement_texts.get('english', '')} | {request.announcement_texts.get('english', '')}
            </div>
        </div>
        
        <div class="marquee-container">
            <div class="language-label">हिंदी</div>
            <div class="marquee">
                {request.announcement_texts.get('hindi', '')} | {request.announcement_texts.get('hindi', '')}
            </div>
        </div>
        
        <div class="marquee-container">
            <div class="language-label">मराठी</div>
            <div class="marquee">
                {request.announcement_texts.get('marathi', '')} | {request.announcement_texts.get('marathi', '')}
            </div>
        </div>
        
        <div class="marquee-container">
            <div class="language-label">ગુજરાતી</div>
            <div class="marquee">
                {request.announcement_texts.get('gujarati', '')} | {request.announcement_texts.get('gujarati', '')}
            </div>
        </div>
        
        <div class="footer">
            <p>Western Railway Announcement System for Deaf and Hard of Hearing</p>
            <p>Generated on {datetime.now().strftime("%B %d, %Y at %I:%M %p")}</p>
        </div>
    </div>
    
    <audio id="announcementAudio" preload="auto">
        <source src="{base_url}{request.merged_audio_path}" type="audio/mpeg">
        Your browser does not support the audio element.
    </audio>
    
    <script>
        const audio = document.getElementById('announcementAudio');
        
        // Start marquee immediately when page loads
        window.addEventListener('load', function() {{
            const video = document.querySelector('video');
            if (video) {{
                video.play().catch(e => console.log('Video auto-play failed:', e));
            }}
            
            // Auto-play audio in loop
            if (audio) {{
                audio.loop = true;
                audio.play().catch(e => console.log('Audio auto-play failed:', e));
            }}
        }});
        
        // Loop video when it ends
        document.querySelector('video').addEventListener('ended', function() {{
            this.currentTime = 0;
            this.play().catch(e => console.log('Video loop failed:', e));
        }});
    </script>
</body>
</html>"""
    
    return html 