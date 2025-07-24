# Audio API Troubleshooting Guide

This guide helps resolve the "Failed to fetch" error when loading audio files in the WRAS-DHH application.

## Problem Description

**Error**: `Failed to load resource: net::ERR_FAILED`
**Location**: `AudioAnnouncementFiles.tsx:55`
**Message**: `Error loading audio files: TypeError: Failed to fetch`

## Root Cause

The issue was caused by FastAPI's automatic URL redirection. When the frontend requested `/api/audio-files`, FastAPI automatically redirected to `/api/audio-files/` (with trailing slash), but the frontend fetch request wasn't following the redirect properly.

## Solution Applied

### 1. Updated API Endpoints Configuration

**File**: `frontend/src/config/api.ts`

Updated all API endpoints to include trailing slashes:

```typescript
// Before
audioFiles: {
  list: `${TRANSLATION_API_BASE_URL}/api/audio-files`,
  create: `${TRANSLATION_API_BASE_URL}/api/audio-files`,
  // ...
}

// After
audioFiles: {
  list: `${TRANSLATION_API_BASE_URL}/api/audio-files/`,
  create: `${TRANSLATION_API_BASE_URL}/api/audio-files/`,
  // ...
}
```

### 2. Enhanced Error Handling

**File**: `frontend/src/components/AudioAnnouncementFiles.tsx`

Added detailed logging and error handling:

```typescript
const loadAudioFiles = async () => {
  try {
    console.log('Loading audio files from:', API_ENDPOINTS.audioFiles.list);
    const response = await fetch(API_ENDPOINTS.audioFiles.list);
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const files = await response.json();
      console.log('Loaded audio files:', files.length);
      setAudioFiles(files);
    } else {
      console.error('HTTP error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      // Show detailed error message to user
    }
  } catch (error) {
    console.error('Error loading audio files:', error);
    // Show detailed error message to user
  }
};
```

## Verification Steps

### 1. Test API Server Directly

```bash
# Test API health
curl http://localhost:5001/health

# Test audio files endpoint
curl http://localhost:5001/api/audio-files/

# Test through Vite proxy
curl http://localhost:5173/translation-api/api/audio-files/
```

### 2. Check Browser Console

1. Open browser developer tools (F12)
2. Go to Console tab
3. Navigate to Audio Files page
4. Look for detailed error messages and logs

### 3. Use Test Page

Access the test page at `http://localhost:5173/test-audio-api.html` to verify API connectivity.

## Common Issues and Solutions

### Issue 1: API Server Not Running

**Symptoms**: Connection refused errors
**Solution**: Start the API server

```bash
cd api
python main.py
```

### Issue 2: CORS Errors

**Symptoms**: CORS policy errors in browser console
**Solution**: Verify CORS configuration in `api/main.py`

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
    # ...
)
```

### Issue 3: Vite Proxy Not Working

**Symptoms**: Network errors when accessing `/translation-api/*`
**Solution**: Verify Vite configuration in `frontend/vite.config.ts`

```typescript
server: {
  proxy: {
    '/translation-api': {
      target: 'http://localhost:5001',
      changeOrigin: true,
      secure: false,
      rewrite: (path) => path.replace(/^\/translation-api/, ''),
    },
  },
}
```

### Issue 4: Port Conflicts

**Symptoms**: "Address already in use" errors
**Solution**: Check and kill processes using the ports

```bash
# Check what's using port 5001
lsof -i :5001

# Kill process if needed
kill -9 <PID>
```

## Debugging Commands

### Check Service Status

```bash
# Check if API server is running
ps aux | grep python

# Check if frontend server is running
ps aux | grep vite

# Check if backend server is running
ps aux | grep node
```

### Test Network Connectivity

```bash
# Test API server directly
curl -v http://localhost:5001/health

# Test through proxy
curl -v http://localhost:5173/translation-api/health

# Test with specific headers
curl -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     http://localhost:5001/api/audio-files/
```

### Check Logs

```bash
# API server logs
tail -f api/logs/app.log

# Frontend build logs
cd frontend && npm run dev

# Backend logs
cd backend && npm run dev
```

## Prevention

1. **Always use trailing slashes** in API endpoint URLs when working with FastAPI
2. **Test API endpoints** before implementing frontend features
3. **Use proper error handling** with detailed logging
4. **Verify CORS configuration** when adding new endpoints
5. **Test through proxy** to ensure Vite configuration is correct

## Files Modified

- `frontend/src/config/api.ts` - Updated API endpoints with trailing slashes
- `frontend/src/components/AudioAnnouncementFiles.tsx` - Enhanced error handling
- `test-audio-api.html` - Created test page for API verification
- `AUDIO_API_TROUBLESHOOTING.md` - This troubleshooting guide

## Related Documentation

- [CORS Setup Guide](./CORS_SETUP.md)
- [API Documentation](./api/README.md)
- [Frontend Development Guide](./frontend/README.md) 