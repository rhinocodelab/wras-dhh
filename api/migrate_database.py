#!/usr/bin/env python3
"""
Database migration script to add new tables and columns
"""

from database import SessionLocal, create_tables
from models import AudioFile, AudioSegment, AnnouncementTemplate
from sqlalchemy import inspect, text

def migrate_database():
    """Run database migrations"""
    print("🔄 Starting database migration...")
    
    db = SessionLocal()
    
    try:
        # First, add template_id column to audio_files table if it doesn't exist
        try:
            # Check if template_id column exists
            result = db.execute(text("PRAGMA table_info(audio_files)"))
            columns = [row[1] for row in result.fetchall()]
            
            if 'template_id' not in columns:
                print("🔄 Adding template_id column to audio_files table...")
                db.execute(text("""
                    ALTER TABLE audio_files 
                    ADD COLUMN template_id INTEGER 
                    REFERENCES announcement_templates(id)
                """))
                db.commit()
                print("✅ template_id column added successfully")
            else:
                print("✅ template_id column already exists")
        except Exception as e:
            print(f"⚠️ Error adding template_id column: {e}")
            db.rollback()
        
        # Now create tables (this will update the model definitions)
        create_tables()
        
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