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
