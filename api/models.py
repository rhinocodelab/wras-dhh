from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class AnnouncementTemplate(Base):
    __tablename__ = "announcement_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(50), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    english_text = Column(Text, nullable=False)
    marathi_text = Column(Text, nullable=True)
    hindi_text = Column(Text, nullable=True)
    gujarati_text = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class AudioSegment(Base):
    __tablename__ = "audio_segments"
    
    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("announcement_templates.id"), nullable=False)
    selected_text = Column(Text, nullable=False)
    start_position = Column(Integer, nullable=False)
    end_position = Column(Integer, nullable=False)
    english_audio_path = Column(String(500), nullable=True)
    marathi_audio_path = Column(String(500), nullable=True)
    hindi_audio_path = Column(String(500), nullable=True)
    gujarati_audio_path = Column(String(500), nullable=True)
    english_translation = Column(Text, nullable=True)
    marathi_translation = Column(Text, nullable=True)
    hindi_translation = Column(Text, nullable=True)
    gujarati_translation = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationship
    template = relationship("AnnouncementTemplate", back_populates="selected_audio_segments")

# Add back reference to AnnouncementTemplate
AnnouncementTemplate.selected_audio_segments = relationship("AudioSegment", back_populates="template")

class AudioFile(Base):
    __tablename__ = "audio_files"
    
    id = Column(Integer, primary_key=True, index=True)
    english_text = Column(Text, nullable=False)
    english_audio_path = Column(String(500), nullable=True)
    marathi_audio_path = Column(String(500), nullable=True)
    hindi_audio_path = Column(String(500), nullable=True)
    gujarati_audio_path = Column(String(500), nullable=True)
    english_translation = Column(Text, nullable=True)
    marathi_translation = Column(Text, nullable=True)
    hindi_translation = Column(Text, nullable=True)
    gujarati_translation = Column(Text, nullable=True)
    template_id = Column(Integer, ForeignKey("announcement_templates.id"), nullable=True)  # To identify announcement template audio
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class AnnouncementAudioSegment(Base):
    __tablename__ = "announcement_audio_segments"
    
    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("announcement_templates.id"), nullable=False)
    category = Column(String(50), nullable=False, index=True)
    segment_text = Column(Text, nullable=False)
    language = Column(String(20), nullable=False)  # 'english', 'marathi', 'hindi', 'gujarati'
    segment_order = Column(Integer, nullable=False)  # Order in the announcement
    audio_path = Column(String(500), nullable=True)
    file_size = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationship
    template = relationship("AnnouncementTemplate", back_populates="announcement_audio_segments")

# Add back reference to AnnouncementTemplate
AnnouncementTemplate.announcement_audio_segments = relationship("AnnouncementAudioSegment", back_populates="template") 