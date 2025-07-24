# CORS Configuration for WRAS-DHH Application

This document explains the Cross-Origin Resource Sharing (CORS) configuration for the WRAS-DHH application, which consists of three main components:

1. **Frontend** (React + Vite) - Port 5173 (dev) / 3000 (prod)
2. **Backend** (Node.js + Express) - Port 3001
3. **API** (FastAPI) - Port 5001

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │      API        │
│   (Port 5173)   │◄──►│   (Port 3001)   │◄──►│   (Port 5001)   │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## CORS Configuration Details

### 1. Frontend (React + Vite)

**File**: `frontend/vite.config.ts`

The frontend uses Vite's proxy configuration to handle CORS in development:

```typescript
server: {
  proxy: {
    // Proxy API requests to the backend server
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true,
      secure: false,
    },
    // Proxy translation API requests
    '/translation-api': {
      target: 'http://localhost:5001',
      changeOrigin: true,
      secure: false,
    },
  },
}
```

**Benefits**:
- Eliminates CORS issues in development
- All requests appear to come from the same origin
- No need to configure CORS headers in frontend code

### 2. Backend (Node.js + Express)

**File**: `backend/index.ts`

Uses the `cors` middleware with specific configuration:

```typescript
const corsOptions = {
  origin: [
    'http://localhost:5173',  // Frontend development server
    'http://localhost:3000',  // Frontend production server
    'http://localhost:5001',  // API server
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5001',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'Origin',
    'X-Requested-With',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['Content-Disposition', 'Content-Length'],
  maxAge: 3600, // Cache preflight requests for 1 hour
};
```

### 3. API (FastAPI)

**File**: `api/main.py`

Uses FastAPI's `CORSMiddleware`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Frontend development server
        "http://localhost:3000",  # Frontend production server
        "http://localhost:3001",  # Backend server
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=[
        "Content-Type", 
        "Authorization", 
        "Accept", 
        "Origin", 
        "X-Requested-With",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers"
    ],
    expose_headers=["Content-Disposition", "Content-Length"],
    max_age=3600,
)
```

## API Configuration

**File**: `frontend/src/config/api.ts`

The frontend API configuration automatically adapts based on the environment:

```typescript
// In development: Uses Vite proxy
export const MAIN_API_BASE_URL = import.meta.env.DEV ? '/api' : '/api';
export const TRANSLATION_API_BASE_URL = import.meta.env.DEV ? '/translation-api' : 'http://localhost:5001';

// In production: Uses direct URLs
// export const MAIN_API_BASE_URL = '/api';
// export const TRANSLATION_API_BASE_URL = 'https://your-api-domain.com';
```

## Security Considerations

### Development Environment
- Allows all localhost origins
- Permits credentials for authentication
- Caches preflight requests for 1 hour

### Production Environment
- Restrict origins to specific domains
- Use HTTPS only
- Consider implementing rate limiting
- Validate all incoming requests

## Troubleshooting

### Common CORS Issues

1. **"No 'Access-Control-Allow-Origin' header"**
   - Check if the origin is in the allowed origins list
   - Verify the server is running and CORS middleware is loaded

2. **"Request header field Authorization is not allowed"**
   - Ensure 'Authorization' is in the allowed headers list
   - Check if credentials are enabled

3. **"Method not allowed"**
   - Verify the HTTP method is in the allowed methods list
   - Check if OPTIONS is included for preflight requests

### Debugging Steps

1. Check browser console for CORS errors
2. Verify server logs for CORS-related messages
3. Test with curl to isolate frontend vs backend issues:

```bash
# Test backend CORS
curl -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://localhost:3001/api/health

# Test API CORS
curl -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://localhost:5001/health
```

## Environment Variables

Consider using environment variables for CORS configuration:

```bash
# .env file
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:3001
CORS_ALLOW_CREDENTIALS=true
NODE_ENV=development
```

## Production Deployment

For production deployment:

1. Update allowed origins to your production domains
2. Enable HTTPS
3. Consider using a reverse proxy (nginx) for additional security
4. Implement proper authentication and authorization
5. Monitor CORS-related errors in logs

## Files Modified

- `api/main.py` - Updated CORS middleware configuration
- `backend/index.ts` - Enhanced CORS options
- `frontend/vite.config.ts` - Added proxy configuration
- `frontend/src/config/api.ts` - Updated API URLs for development
- `cors-config.js` - Centralized CORS configuration
- `CORS_SETUP.md` - This documentation file 