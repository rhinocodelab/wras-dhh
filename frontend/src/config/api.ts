// API Configuration for different services

// Main backend API (Node.js)
export const MAIN_API_BASE_URL = import.meta.env.DEV ? '/api' : '/api';

// Translation API (FastAPI)
export const TRANSLATION_API_BASE_URL = import.meta.env.DEV ? '/translation-api' : 'http://localhost:5001';

// API Endpoints
export const API_ENDPOINTS = {
  // Main API endpoints
  auth: {
    login: `${MAIN_API_BASE_URL}/auth/login`,
  },
  stations: {
    list: `${MAIN_API_BASE_URL}/stations`,
    all: `${MAIN_API_BASE_URL}/stations/all`,
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
    list: `${TRANSLATION_API_BASE_URL}/api/templates/`,
    create: `${TRANSLATION_API_BASE_URL}/api/templates/`,
    checkDuplicate: `${TRANSLATION_API_BASE_URL}/api/templates/check-duplicate/`,
    update: (id: number) => `${TRANSLATION_API_BASE_URL}/api/templates/${id}/`,
    delete: (id: number) => `${TRANSLATION_API_BASE_URL}/api/templates/${id}/`,
    getById: (id: number) => `${TRANSLATION_API_BASE_URL}/api/templates/${id}/`,
    categories: `${TRANSLATION_API_BASE_URL}/api/templates/categories/list/`,
    seed: `${TRANSLATION_API_BASE_URL}/api/templates/seed`,
  },
  
  // Audio Files API endpoints
  audioFiles: {
    list: `${TRANSLATION_API_BASE_URL}/api/audio-files/`,
    create: `${TRANSLATION_API_BASE_URL}/api/audio-files/`,
    checkDuplicate: `${TRANSLATION_API_BASE_URL}/api/audio-files/check-duplicate`,
    delete: (id: number) => `${TRANSLATION_API_BASE_URL}/api/audio-files/${id}/`,
    deleteByText: `${TRANSLATION_API_BASE_URL}/api/audio-files/by-text/`,
    deleteByTexts: `${TRANSLATION_API_BASE_URL}/api/audio-files/by-texts/`,
    deleteAll: `${TRANSLATION_API_BASE_URL}/api/audio-files/all/`,
    cleanupStations: `${TRANSLATION_API_BASE_URL}/api/audio-files/cleanup-stations/`,
    getById: (id: number) => `${TRANSLATION_API_BASE_URL}/api/audio-files/${id}/`,
  },
  
  // Audio Segments API endpoints
  audioSegments: {
    list: (templateId: number) => `${TRANSLATION_API_BASE_URL}/api/audio-segments/template/${templateId}/`,
    create: `${TRANSLATION_API_BASE_URL}/api/audio-segments/`,
    translate: (segmentId: number) => `${TRANSLATION_API_BASE_URL}/api/audio-segments/${segmentId}/translate/`,
    generateAudio: (segmentId: number) => `${TRANSLATION_API_BASE_URL}/api/audio-segments/${segmentId}/generate-audio/`,
    delete: (segmentId: number) => `${TRANSLATION_API_BASE_URL}/api/audio-segments/${segmentId}/`,
    generateFullAnnouncement: (templateId: number) => `${TRANSLATION_API_BASE_URL}/api/audio-segments/template/${templateId}/generate-full-announcement/`,
  },
  
  // Final Announcement API endpoints
  finalAnnouncement: {
    list: `${TRANSLATION_API_BASE_URL}/api/final-announcement/list`,
    availableTemplates: `${TRANSLATION_API_BASE_URL}/api/final-announcement/available-templates`,
    generate: `${TRANSLATION_API_BASE_URL}/api/final-announcement/generate`,
    progress: (generationKey: string) => `${TRANSLATION_API_BASE_URL}/api/final-announcement/progress/${generationKey}`,
    clearAll: `${TRANSLATION_API_BASE_URL}/api/final-announcement/clear-all`,
    clearDynamicContent: `${TRANSLATION_API_BASE_URL}/api/final-announcement/clear-dynamic-content`,
  },
  
  // Announcement Audio API endpoints
  announcementAudio: {
    allSegments: `${TRANSLATION_API_BASE_URL}/api/announcement-audio/all-segments`,
    generate: `${TRANSLATION_API_BASE_URL}/api/announcement-audio/generate`,
    deleteSegment: (segmentId: number) => `${TRANSLATION_API_BASE_URL}/api/announcement-audio/segments/${segmentId}`,
    clearAllSegments: `${TRANSLATION_API_BASE_URL}/api/announcement-audio/clear-all-segments`,
  },
}; 