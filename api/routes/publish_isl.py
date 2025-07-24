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
        
        # Debug: Log the announcement texts being used
        print(f"📝 Announcement texts for ISL page:")
        print(f"   English: {request.announcement_texts.get('english', 'NOT_FOUND')[:100]}...")
        print(f"   Hindi: {request.announcement_texts.get('hindi', 'NOT_FOUND')[:100]}...")
        print(f"   Marathi: {request.announcement_texts.get('marathi', 'NOT_FOUND')[:100]}...")
        print(f"   Gujarati: {request.announcement_texts.get('gujarati', 'NOT_FOUND')[:100]}...")
        
        # Ensure all languages have content
        if not request.announcement_texts.get('english'):
            request.announcement_texts['english'] = f"Attention please! Train number {request.train_number} {request.train_name} from {request.start_station_name} to {request.end_station_name} will arrive at platform number {request.platform_number}"
        if not request.announcement_texts.get('hindi'):
            request.announcement_texts['hindi'] = f"कृपया ध्यान दें! ट्रेन नंबर {request.train_number} {request.train_name} {request.start_station_name} से {request.end_station_name} तक प्लेटफॉर्म नंबर {request.platform_number} पर आएगी"
        if not request.announcement_texts.get('marathi'):
            request.announcement_texts['marathi'] = f"कृपया लक्ष द्या! ट्रेन क्रमांक {request.train_number} {request.train_name} {request.start_station_name} ते {request.end_station_name} पर्यंत प्लॅटफॉर्म क्रमांक {request.platform_number} वर येईल"
        if not request.announcement_texts.get('gujarati'):
            request.announcement_texts['gujarati'] = f"કૃપા કરીને ધ્યાન આપો! ટ્રેન નંબર {request.train_number} {request.train_name} {request.start_station_name} થી {request.end_station_name} સુધી પ્લેટફોર્મ નંબર {request.platform_number} પર પહોંચશે"
        
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
    Generate the HTML content for the ISL announcement page optimized for TV displays
    """
    
    # Base URL for serving files
    base_url = "http://localhost:5001"
    
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="google" content="notranslate">
    <meta name="googlebot" content="notranslate">
    <title>ISL Announcement - {request.train_name} ({request.train_number})</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Sans+Gujarati:wght@400;700&display=swap" rel="stylesheet">
    <style>
        * {{
            box-sizing: border-box;
        }}
        
        body {{
            margin: 0;
            padding: 0;
            font-family: 'Arial Unicode MS', 'Noto Sans Devanagari', 'Noto Sans Gujarati', 'Arial', sans-serif;
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
        
        .train-info {{
            font-size: 3.2vw;
            font-weight: 900;
            margin-bottom: 1vh;
            text-shadow: 3px 3px 6px rgba(0,0,0,0.8);
            color: #ffffff;
            letter-spacing: 0.05em;
        }}
        
        .route-info {{
            font-size: 2.2vw;
            margin-bottom: 1vh;
            color: #e0e0e0;
            font-weight: 600;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.7);
        }}
        
        .platform-info {{
            font-size: 1.8vw;
            background: linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.1));
            padding: 1vh 3vw;
            border-radius: 50px;
            display: inline-block;
            font-weight: 700;
            border: 2px solid rgba(255,255,255,0.3);
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
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
        
        .ticker-container {{
            width: 100%;
            overflow: hidden;
            white-space: nowrap;
            background-color: #000;
            color: #fff;
            font-family: 'Arial Unicode MS', 'Noto Sans Devanagari', 'Noto Sans Gujarati', 'Arial', sans-serif;
            font-size: 24px;
            padding: 10px 0;
            position: fixed;
            bottom: 0;
            left: 0;
            z-index: 1000;
        }}
        
        .ticker {{
            display: inline-block;
            animation: ticker 40s linear infinite;
        }}
        
        .separator {{
            color: red;
            padding: 0 10px;
        }}
        
        @keyframes ticker {{
            0% {{ transform: translateX(0); }}
            100% {{ transform: translateX(-100%); }}
        }}
        
        /* Large Monitor Optimizations */
        @media (min-width: 1920px) {{
            .train-info {{
                font-size: 3.5vw;
            }}
            .route-info {{
                font-size: 2.5vw;
            }}
            .platform-info {{
                font-size: 2vw;
            }}
            .ticker-container {{
                font-size: 2.5vw;
                padding: 15px 0;
            }}
        }}
        
        @media (min-width: 2560px) {{
            .train-info {{
                font-size: 3vw;
            }}
            .route-info {{
                font-size: 2.2vw;
            }}
            .platform-info {{
                font-size: 1.6vw;
            }}
            .ticker-container {{
                font-size: 2.2vw;
                padding: 12px 0;
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
        
        <div class="content-section">
            <div class="video-container">
                <video class="video-player" muted autoplay loop>
                    <source src="{base_url}{request.isl_video_path}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
            </div>
        </div>
        
        <div class="footer-section">
            <div class="footer-text">Generated on {datetime.now().strftime("%B %d, %Y at %I:%M %p")}</div>
        </div>
    </div>
    
    <div class="ticker-container">
        <div class="ticker">
            {request.announcement_texts.get('english', 'ENGLISH_TEXT')}
            <span class="separator">|</span>
            {request.announcement_texts.get('hindi', 'HINDI_TEXT')}
            <span class="separator">|</span>
            {request.announcement_texts.get('marathi', 'MARATHI_TEXT')}
            <span class="separator">|</span>
            {request.announcement_texts.get('gujarati', 'GUJARATI_TEXT')}
        </div>
    </div>
    
    <audio id="announcementAudio" preload="auto">
        <source src="{base_url}{request.merged_audio_path}" type="audio/mpeg">
        Your browser does not support the audio element.
    </audio>
    
    <script>
        // TV Display Optimizations
        const audio = document.getElementById('announcementAudio');
        const video = document.querySelector('video');
        
        // Function to start ticker immediately
        function startTicker() {{
            const ticker = document.querySelector('.ticker');
            if (ticker) {{
                ticker.style.animation = 'none';
                ticker.offsetHeight; // Trigger reflow
                ticker.style.animation = 'ticker 30s linear infinite';
                console.log('Ticker animation started immediately');
            }}
        }}
        
        // Function to ensure fonts are loaded
        function ensureFontsLoaded() {{
            // Debug: Check ticker content
            const ticker = document.querySelector('.ticker');
            console.log('Ticker content:', ticker ? ticker.textContent.trim() : 'Not found');
            
            if ('fonts' in document) {{
                Promise.all([
                    document.fonts.load('400 1em "Noto Sans Devanagari"'),
                    document.fonts.load('400 1em "Noto Sans Gujarati"'),
                    document.fonts.load('700 1em "Noto Sans Devanagari"'),
                    document.fonts.load('700 1em "Noto Sans Gujarati"')
                ]).then(() => {{
                    console.log('All fonts loaded successfully');
                    startTicker();
                }}).catch(() => {{
                    console.log('Font loading failed, starting ticker anyway');
                    startTicker();
                }});
            }} else {{
                startTicker();
            }}
        }}
        
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
            
            // Start ticker
            ensureFontsLoaded();
            
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