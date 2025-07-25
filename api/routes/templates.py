from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import asyncio

from database import get_db, create_tables
from models import AnnouncementTemplate
from utils.duplicate_checker import check_template_duplicate, get_duplicate_summary
from google.cloud import translate_v2 as translate
from google.oauth2 import service_account
import os
from config import Config

router = APIRouter()

# Pydantic models for API requests/responses
class TemplateCreate(BaseModel):
    category: str
    title: str
    english_text: str
    marathi_text: Optional[str] = None
    hindi_text: Optional[str] = None
    gujarati_text: Optional[str] = None

class TemplateUpdate(BaseModel):
    category: Optional[str] = None
    title: Optional[str] = None
    english_text: Optional[str] = None
    marathi_text: Optional[str] = None
    hindi_text: Optional[str] = None
    gujarati_text: Optional[str] = None
    is_active: Optional[bool] = None

class TemplateResponse(BaseModel):
    id: int
    category: str
    title: str
    english_text: str
    marathi_text: Optional[str]
    hindi_text: Optional[str]
    gujarati_text: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

@router.get("/templates", response_model=List[TemplateResponse])
async def get_templates(
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """Get all templates with optional filtering"""
    query = db.query(AnnouncementTemplate)
    
    if category:
        query = query.filter(AnnouncementTemplate.category == category)
    
    if is_active is not None:
        query = query.filter(AnnouncementTemplate.is_active == is_active)
    
    templates = query.order_by(AnnouncementTemplate.created_at.desc()).all()
    return templates

@router.get("/templates/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: int, db: Session = Depends(get_db)):
    """Get a specific template by ID"""
    template = db.query(AnnouncementTemplate).filter(AnnouncementTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@router.post("/templates", response_model=TemplateResponse)
async def create_template(template: TemplateCreate, db: Session = Depends(get_db)):
    """Create a new template"""
    # Check if the same English text already exists
    existing_template = check_template_duplicate(db, template.english_text)
    
    if existing_template:
        raise HTTPException(
            status_code=409, 
            detail=f"Template with this English text already exists (ID: {existing_template.id}, Title: '{existing_template.title}')"
        )
    
    db_template = AnnouncementTemplate(
        category=template.category,
        title=template.title,
        english_text=template.english_text.strip(),
        marathi_text=template.marathi_text,
        hindi_text=template.hindi_text,
        gujarati_text=template.gujarati_text
    )
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template

@router.post("/templates/check-duplicate")
async def check_duplicate_template(
    template: TemplateCreate,
    db: Session = Depends(get_db)
):
    """Check if a template with the same English text already exists"""
    if not template.english_text.strip():
        raise HTTPException(status_code=400, detail="English text is required")
    
    duplicate_summary = get_duplicate_summary(db, template.english_text)
    
    return {
        "text": template.english_text.strip(),
        "has_duplicates": duplicate_summary["has_duplicates"],
        "duplicates": duplicate_summary["duplicates"]
    }

@router.put("/templates/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: int, 
    template: TemplateUpdate, 
    db: Session = Depends(get_db)
):
    """Update an existing template"""
    db_template = db.query(AnnouncementTemplate).filter(AnnouncementTemplate.id == template_id).first()
    if not db_template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    update_data = template.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_template, field, value)
    
    db.commit()
    db.refresh(db_template)
    return db_template

@router.delete("/templates/{template_id}")
async def delete_template(template_id: int, db: Session = Depends(get_db)):
    """Delete a template (soft delete by setting is_active to False)"""
    db_template = db.query(AnnouncementTemplate).filter(AnnouncementTemplate.id == template_id).first()
    if not db_template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    db_template.is_active = False
    db.commit()
    return {"message": "Template deleted successfully"}

@router.get("/templates/categories/list")
async def get_categories(db: Session = Depends(get_db)):
    """Get list of all available categories"""
    categories = db.query(AnnouncementTemplate.category).distinct().all()
    return [category[0] for category in categories]

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

@router.post("/templates/seed")
async def seed_templates(db: Session = Depends(get_db)):
    """Seed the database with sample announcement templates"""
    try:
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
        
        # Clear existing templates
        existing_count = db.query(AnnouncementTemplate).count()
        if existing_count > 0:
            db.query(AnnouncementTemplate).delete()
            db.commit()
        
        created_templates = []
        
        for template_data in sample_templates:
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
            db.commit()
            db.refresh(template)
            
            created_templates.append({
                "id": template.id,
                "title": template.title,
                "category": template.category,
                "english_text": template.english_text,
                "marathi_text": template.marathi_text,
                "hindi_text": template.hindi_text,
                "gujarati_text": template.gujarati_text
            })
        
        return {
            "success": True,
            "message": f"Successfully created {len(created_templates)} new templates",
            "templates_created": len(created_templates),
            "templates_cleared": existing_count,
            "templates": created_templates
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error seeding database: {str(e)}") 