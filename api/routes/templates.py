from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from database import get_db
from models import AnnouncementTemplate
from utils.duplicate_checker import check_template_duplicate, get_duplicate_summary

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