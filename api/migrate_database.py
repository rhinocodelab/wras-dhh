#!/usr/bin/env python3
"""
Database migration script to add new tables
"""

from database import SessionLocal, create_tables
from models import AudioFile, AudioSegment, AnnouncementTemplate
from sqlalchemy import inspect

def migrate_database():
    """Run database migrations"""
    print("🔄 Starting database migration...")
    
    # Create tables
    create_tables()
    
    db = SessionLocal()
    
    try:
        # Check if tables exist
        inspector = inspect(db.bind)
        existing_tables = inspector.get_table_names()
        
        print(f"📊 Existing tables: {existing_tables}")
        
        # Check if new tables were created
        if 'audio_files' in existing_tables:
            print("✅ AudioFile table exists")
        else:
            print("❌ AudioFile table not found")
            
        if 'audio_segments' in existing_tables:
            print("✅ AudioSegment table exists")
        else:
            print("❌ AudioSegment table not found")
            
        if 'announcement_templates' in existing_tables:
            print("✅ AnnouncementTemplate table exists")
        else:
            print("❌ AnnouncementTemplate table not found")
        
        # Count records in each table
        template_count = db.query(AnnouncementTemplate).count()
        print(f"📝 AnnouncementTemplate records: {template_count}")
        
        audio_file_count = db.query(AudioFile).count()
        print(f"🎵 AudioFile records: {audio_file_count}")
        
        audio_segment_count = db.query(AudioSegment).count()
        print(f"🎧 AudioSegment records: {audio_segment_count}")
        
        print("🎉 Database migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    migrate_database() 