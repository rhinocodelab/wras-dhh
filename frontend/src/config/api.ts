// API Configuration for different services

// Main backend API (Node.js)
export const MAIN_API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api';

// Translation API (FastAPI)
export const TRANSLATION_API_BASE_URL = 'http://localhost:5001';

// API Endpoints
export const API_ENDPOINTS = {
  // Main API endpoints
  auth: {
    login: `${MAIN_API_BASE_URL}/auth/login`,
  },
  stations: {
    list: `${MAIN_API_BASE_URL}/stations`,
    create: `${MAIN_API_BASE_URL}/stations`,
    update: (id: number) => `${MAIN_API_BASE_URL}/stations/${id}`,
    delete: (id: number) => `${MAIN_API_BASE_URL}/stations/${id}`,
    clearAll: `${MAIN_API_BASE_URL}/stations`,
  },
  trainRoutes: {
    list: `${MAIN_API_BASE_URL}/train-routes`,
    create: `${MAIN_API_BASE_URL}/train-routes`,
    update: (id: number) => `${MAIN_API_BASE_URL}/train-routes/${id}`,
    delete: (id: number) => `${MAIN_API_BASE_URL}/train-routes/${id}`,
    clearAll: `${MAIN_API_BASE_URL}/train-routes`,
  },
  
  // Translation API endpoints
  translation: {
    translate: `${TRANSLATION_API_BASE_URL}/translate`,
    health: `${TRANSLATION_API_BASE_URL}/health`,
    supportedLanguages: `${TRANSLATION_API_BASE_URL}/supported-languages`,
  },
  
  // Template API endpoints
  templates: {
    list: `${TRANSLATION_API_BASE_URL}/api/templates`,
    create: `${TRANSLATION_API_BASE_URL}/api/templates`,
    update: (id: number) => `${TRANSLATION_API_BASE_URL}/api/templates/${id}`,
    delete: (id: number) => `${TRANSLATION_API_BASE_URL}/api/templates/${id}`,
    getById: (id: number) => `${TRANSLATION_API_BASE_URL}/api/templates/${id}`,
    categories: `${TRANSLATION_API_BASE_URL}/api/templates/categories/list`,
  },
  
  // Audio Files API endpoints
  audioFiles: {
    list: `${TRANSLATION_API_BASE_URL}/api/audio-files`,
    create: `${TRANSLATION_API_BASE_URL}/api/audio-files`,
    delete: (id: number) => `${TRANSLATION_API_BASE_URL}/api/audio-files/${id}`,
    getById: (id: number) => `${TRANSLATION_API_BASE_URL}/api/audio-files/${id}`,
  },
  
  // Audio Segments API endpoints
  audioSegments: {
    list: (templateId: number) => `${TRANSLATION_API_BASE_URL}/api/audio-segments/template/${templateId}`,
    create: `${TRANSLATION_API_BASE_URL}/api/audio-segments`,
    translate: (segmentId: number) => `${TRANSLATION_API_BASE_URL}/api/audio-segments/${segmentId}/translate`,
    generateAudio: (segmentId: number) => `${TRANSLATION_API_BASE_URL}/api/audio-segments/${segmentId}/generate-audio`,
    delete: (segmentId: number) => `${TRANSLATION_API_BASE_URL}/api/audio-segments/${segmentId}`,
    generateFullAnnouncement: (templateId: number) => `${TRANSLATION_API_BASE_URL}/api/audio-segments/template/${templateId}/generate-full-announcement`,
  },
}; 