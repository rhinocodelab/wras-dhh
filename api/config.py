import os
from typing import List

class Config:
    """Configuration class for the FastAPI application"""
    
    # API Configuration
    API_TITLE = "WRAS-DHH Translation API"
    API_DESCRIPTION = "Translation API for Western Railway Announcement System for Deaf and Hard of Hearing"
    API_VERSION = "1.0.0"
    
    # Server Configuration
    HOST = "0.0.0.0"  # Bind to all interfaces
    PORT = 5001
    RELOAD = True  # Enable auto-reload for development
    
    # CORS Configuration
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",  # React frontend
        "http://localhost:3001",  # Alternative frontend port
        "http://127.0.0.1:3000",  # React frontend (IP)
        "http://127.0.0.1:3001",  # Alternative frontend port (IP)
        "http://localhost:5000",  # Backend API
        "http://127.0.0.1:5000",  # Backend API (IP)
        "http://localhost:5001",  # FastAPI itself
        "http://127.0.0.1:5001",  # FastAPI itself (IP)
    ]
    
    # CORS Headers
    ALLOWED_HEADERS: List[str] = [
        "Accept",
        "Accept-Language",
        "Content-Language",
        "Content-Type",
        "Authorization",
        "X-Requested-With",
    ]
    
    # GCP Configuration
    GCP_CREDENTIALS_PATH = "gcp_cred/isl.json"
    
    # Target languages for translation
    TARGET_LANGUAGES = {
        "mr": "Marathi",
        "hi": "Hindi", 
        "gu": "Gujarati"
    }
    
    # Default source language
    DEFAULT_SOURCE_LANGUAGE = "en"
    
    # Text-to-Speech Configuration
    TTS_VOICES = {
        "English": "en-IN-Chirp3-HD-Achernar",
        "Marathi": "mr-IN-Chirp3-HD-Achernar", 
        "Hindi": "hi-IN-Chirp3-HD-Achernar",
        "Gujarati": "gu-IN-Chirp3-HD-Achernar"
    }
    
    @classmethod
    def get_gcp_credentials_path(cls) -> str:
        """Get the absolute path to GCP credentials"""
        return os.path.join(os.path.dirname(__file__), cls.GCP_CREDENTIALS_PATH) 