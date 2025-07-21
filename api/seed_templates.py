#!/usr/bin/env python3
"""
Database seeder for sample announcement templates
"""

import asyncio
from database import SessionLocal, create_tables
from models import AnnouncementTemplate
from google.cloud import translate_v2 as translate
from google.oauth2 import service_account
import os
from config import Config

def get_translate_client():
    """Initialize Google Translate client"""
    credentials_path = Config.get_gcp_credentials_path()
    if not os.path.exists(credentials_path):
        raise FileNotFoundError(f"GCP credentials file not found at {credentials_path}")
    
    credentials = service_account.Credentials.from_service_account_file(credentials_path)
    return translate.Client(credentials=credentials)

def translate_text(client, text, target_language):
    """Translate text to target language"""
    try:
        result = client.translate(text, target_language=target_language, source_language='en')
        return result['translatedText']
    except Exception as e:
        print(f"Translation error for {target_language}: {e}")
        return ""

def seed_templates():
    """Seed the database with sample announcement templates"""
    print("🌱 Starting database seeding...")
    
    # Create tables if they don't exist
    create_tables()
    
    # Initialize translation client
    translate_client = get_translate_client()
    
    # Sample templates
    sample_templates = [
        {
            "category": "arrival",
            "title": "Train Arrival Announcement",
            "english_text": "Attention please! Train number {train_number} {train_name} from {start_station_name} to {end_station_name} will arrive at platform number {platform_number}"
        },
        {
            "category": "delay",
            "title": "Train Delay Announcement", 
            "english_text": "Attention please! Train number {train_number} {train_name} from {start_station_name} to {end_station_name} is running late."
        },
        {
            "category": "cancellation",
            "title": "Train Cancellation Announcement",
            "english_text": "Attention please! Train number {train_number} {train_name} from {start_station_name} to {end_station_name} has been cancelled. We regret the inconvenience caused."
        },
        {
            "category": "platform_change",
            "title": "Platform Change Announcement",
            "english_text": "Attention please! Train number {train_number} {train_name} from {start_station_name} to {end_station_name} will depart from platform number {platform_number}. Please proceed to the new platform immediately."
        }
    ]
    
    db = SessionLocal()
    
    try:
        # Clear existing templates
        existing_count = db.query(AnnouncementTemplate).count()
        if existing_count > 0:
            print(f"🗑️  Clearing {existing_count} existing templates...")
            db.query(AnnouncementTemplate).delete()
            db.commit()
            print(f"✅ Cleared {existing_count} existing templates")
        
        print("📝 Creating new sample templates...")
        
        for template_data in sample_templates:
            print(f"🔄 Processing: {template_data['title']}")
            
            # Translate the English text
            english_text = template_data['english_text']
            marathi_text = translate_text(translate_client, english_text, 'mr')
            hindi_text = translate_text(translate_client, english_text, 'hi')
            gujarati_text = translate_text(translate_client, english_text, 'gu')
            
            # Create template object
            template = AnnouncementTemplate(
                category=template_data['category'],
                title=template_data['title'],
                english_text=english_text,
                marathi_text=marathi_text,
                hindi_text=hindi_text,
                gujarati_text=gujarati_text,
                is_active=True
            )
            
            # Add to database
            db.add(template)
            print(f"✅ Created: {template_data['title']}")
            print(f"   English: {english_text[:50]}...")
            print(f"   Marathi: {marathi_text[:50]}...")
            print(f"   Hindi: {hindi_text[:50]}...")
            print(f"   Gujarati: {gujarati_text[:50]}...")
            print()
        
        # Commit all changes
        db.commit()
        print(f"🎉 Successfully created {len(sample_templates)} new templates!")
        
        # Display summary
        print("\n📊 Database Summary:")
        for category in ['arrival', 'delay', 'cancellation', 'platform_change']:
            count = db.query(AnnouncementTemplate).filter(
                AnnouncementTemplate.category == category
            ).count()
            print(f"   {category.capitalize()}: {count} templates")
        
    except Exception as e:
        print(f"❌ Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_templates() 