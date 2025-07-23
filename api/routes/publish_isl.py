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
            position: relative;
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
            font-size: 3em;
            font-weight: bold;
            color: rgba(255, 255, 255, 0.08);
            transform: rotate(-45deg);
            white-space: nowrap;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
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
            animation: scroll-left 60s linear infinite;
            margin: 10px 0;
            line-height: 1.2;
            display: inline-block;
            min-width: 100%;
            animation-play-state: running;
            animation-delay: 0s;
        }}
        
        .marquee.paused {{
            animation-play-state: paused;
        }}
        
        .marquee .separator {{
            color: #ff0000;
            font-weight: bold;
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
    <div class="watermark">
        <div class="watermark-text" style="top: 10%; left: 5%;">POC DEMO</div>
        <div class="watermark-text" style="top: 30%; left: 25%;">POC DEMO</div>
        <div class="watermark-text" style="top: 50%; left: 45%;">POC DEMO</div>
        <div class="watermark-text" style="top: 70%; left: 65%;">POC DEMO</div>
        <div class="watermark-text" style="top: 90%; left: 85%;">POC DEMO</div>
        <div class="watermark-text" style="top: 20%; left: 15%;">POC DEMO</div>
        <div class="watermark-text" style="top: 40%; left: 35%;">POC DEMO</div>
        <div class="watermark-text" style="top: 60%; left: 55%;">POC DEMO</div>
        <div class="watermark-text" style="top: 80%; left: 75%;">POC DEMO</div>
        <div class="watermark-text" style="top: 10%; left: 95%;">POC DEMO</div>
        <div class="watermark-text" style="top: 30%; left: 85%;">POC DEMO</div>
        <div class="watermark-text" style="top: 50%; left: 75%;">POC DEMO</div>
        <div class="watermark-text" style="top: 70%; left: 65%;">POC DEMO</div>
        <div class="watermark-text" style="top: 90%; left: 55%;">POC DEMO</div>
    </div>
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
            <div class="marquee">
                {request.announcement_texts.get('english', '')} <span class="separator">|</span> {request.announcement_texts.get('hindi', '')} <span class="separator">|</span> {request.announcement_texts.get('marathi', '')} <span class="separator">|</span> {request.announcement_texts.get('gujarati', '')} <span class="separator">|</span> {request.announcement_texts.get('english', '')} <span class="separator">|</span> {request.announcement_texts.get('hindi', '')} <span class="separator">|</span> {request.announcement_texts.get('marathi', '')} <span class="separator">|</span> {request.announcement_texts.get('gujarati', '')}
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
        
        // Force marquee to start immediately
        document.addEventListener('DOMContentLoaded', function() {{
            const marquee = document.querySelector('.marquee');
            if (marquee) {{
                // Force animation restart
                marquee.style.animation = 'none';
                marquee.offsetHeight; // Trigger reflow
                marquee.style.animation = 'scroll-left 60s linear infinite';
                console.log('Marquee animation started immediately');
            }}
        }});
        
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