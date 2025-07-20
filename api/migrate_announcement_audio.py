#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import engine, Base
from models import AnnouncementAudioSegment

def migrate_announcement_audio():
    """Create the announcement_audio_segments table"""
    try:
        print("🔄 Creating announcement_audio_segments table...")
        AnnouncementAudioSegment.__table__.create(engine, checkfirst=True)
        print("✅ announcement_audio_segments table created successfully!")
    except Exception as e:
        print(f"❌ Error creating announcement_audio_segments table: {e}")
        raise

if __name__ == "__main__":
    migrate_announcement_audio() 