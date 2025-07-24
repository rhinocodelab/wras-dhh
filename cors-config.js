// CORS Configuration for WRAS-DHH Application
// This file contains centralized CORS settings for all services

const CORS_CONFIG = {
  // Allowed origins for development and production
  allowedOrigins: [
    // Frontend development server
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://192.168.1.92:5173',  // Network IP for development
    
    // Frontend production server
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://192.168.1.92:3000',  // Network IP for production
    
    // Backend server
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://192.168.1.92:3001',  // Network IP for backend
    
    // API server
    'http://localhost:5001',
    'http://127.0.0.1:5001',
    'http://192.168.1.92:5001',  // Network IP for API
  ],

  // Allowed methods
  allowedMethods: [
    'GET',
    'POST',
    'PUT',
    'DELETE',
    'OPTIONS',
    'PATCH'
  ],

  // Allowed headers
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'Origin',
    'X-Requested-With',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],

  // Exposed headers
  exposedHeaders: [
    'Content-Disposition',
    'Content-Length'
  ],

  // CORS options
  credentials: true,
  maxAge: 3600, // Cache preflight requests for 1 hour
};

// Environment-specific configurations
const ENV_CONFIG = {
  development: {
    ...CORS_CONFIG,
    // In development, you might want to be more permissive
    allowedOrigins: [...CORS_CONFIG.allowedOrigins, 'http://localhost:*', 'http://127.0.0.1:*']
  },
  production: {
    ...CORS_CONFIG,
    // In production, restrict to specific domains
    allowedOrigins: [
      // Add your production domains here
      'https://your-production-domain.com',
      'https://www.your-production-domain.com'
    ]
  }
};

// Export configurations
module.exports = {
  CORS_CONFIG,
  ENV_CONFIG,
  
  // Helper function to get CORS config based on environment
  getCorsConfig: (env = process.env.NODE_ENV || 'development') => {
    return ENV_CONFIG[env] || CORS_CONFIG;
  },
  
  // Helper function to check if origin is allowed
  isOriginAllowed: (origin, env = process.env.NODE_ENV || 'development') => {
    const config = ENV_CONFIG[env] || CORS_CONFIG;
    return config.allowedOrigins.includes(origin);
  }
}; 