# WRAS-DHH System

Western Railway Announcement System for Deaf and Hard of Hearing

## Project Overview

The WRAS-DHH system is a comprehensive railway announcement management platform designed to provide accessible audio announcements for deaf and hard of hearing passengers. The system consists of multiple components working together to create, manage, and deliver audio announcements across railway stations.

## System Architecture

The project is organized into three main components:

- **`frontend/`** - React TypeScript application with Vite (User Interface)
- **`backend/`** - Node.js Express TypeScript server (API Gateway)
- **`api/`** - Python FastAPI server (Audio Processing & Database Management)

### Component Responsibilities

#### Frontend (React + TypeScript)
- **User Interface**: Modern, responsive web application built with React 18 and TypeScript
- **Station Management**: CRUD operations for railway stations with Excel import functionality
- **Train Route Management**: Manage train routes between stations with scheduling capabilities
- **Audio Announcement Management**: Interface for creating and managing audio announcement templates
- **Authentication**: JWT-based user authentication with role-based access control

#### Backend (Node.js + Express)
- **API Gateway**: Acts as a proxy and authentication layer
- **User Management**: Handles user authentication, authorization, and session management
- **Data Validation**: Input validation and sanitization for all API requests
- **Error Handling**: Centralized error handling and logging

#### API Server (Python + FastAPI)
- **Database Management**: SQLite database with SQLAlchemy ORM
- **Audio Processing**: Text-to-speech conversion and audio file management
- **Template Management**: Audio announcement template creation and storage
- **File Storage**: Audio file storage and retrieval system
- **Audio Segmentation**: Automatic audio file segmentation for different announcement types

## Quick Start

### Prerequisites

- Node.js (v18 or higher)
- Python 3.8 or higher
- npm
- pip

### Installation

#### Option 1: Using Shell Scripts (Recommended)

1. Make scripts executable (if not already):
```bash
chmod +x setup.sh start.sh stop.sh
```

2. Run the setup script:
```bash
./setup.sh
```

3. Start the application:
```bash
./start.sh
```

4. To stop the application:
```bash
./stop.sh
```

#### Option 2: Manual Setup

1. Install all dependencies:
```bash
npm run install:all
```

2. Set up Python environment:
```bash
cd api
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. Start all services:
```bash
npm run dev
```

This will start:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- API Server: http://localhost:5001

### Individual Commands

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

#### Backend
```bash
cd backend
npm install
npm run dev
```

#### API Server
```bash
cd api
source venv/bin/activate  # On Windows: venv\Scripts\activate
python main.py
```

## Default Login

- Username: `administrator`
- Password: `admin@123`

## Core Features

### Station Management
- **CRUD Operations**: Create, read, update, delete railway stations
- **Excel Import**: Bulk import stations from Excel files with validation
- **Station Details**: Store station codes, names, and geographical information
- **Search & Filter**: Advanced search and filtering capabilities

### Train Route Management
- **Route Planning**: Define train routes between multiple stations
- **Schedule Management**: Set departure and arrival times
- **Route Validation**: Automatic validation of route consistency
- **Excel Import**: Bulk import routes from Excel files

### Audio Announcement System
- **Template Management**: Create and manage audio announcement templates
- **Text-to-Speech**: Automatic conversion of text to speech
- **Audio Segmentation**: Automatic segmentation of audio files for different announcement types
- **File Management**: Upload, store, and retrieve audio files
- **Multi-language Support**: Support for multiple languages and accents
- **Duplicate Prevention**: Automatic detection and prevention of duplicate English text entries

### User Authentication & Authorization
- **JWT Authentication**: Secure token-based authentication
- **Role-based Access**: Different access levels for administrators and operators
- **Session Management**: Secure session handling with automatic token refresh
- **Password Security**: bcrypt hashing for password storage

## Technology Stack

### Frontend
- **React 18** with TypeScript for type safety
- **Vite** for fast development and building
- **Tailwind CSS** for utility-first styling
- **Lucide React** for modern iconography
- **XLSX** for Excel file parsing and generation
- **React Router** for client-side routing
- **Axios** for HTTP client requests

### Backend (Node.js)
- **Express.js** with TypeScript for API development
- **JWT** for authentication and authorization
- **bcryptjs** for password hashing
- **CORS** for cross-origin resource sharing
- **Helmet** for security headers
- **Morgan** for HTTP request logging

### API Server (Python)
- **FastAPI** for high-performance API development
- **SQLAlchemy** for database ORM
- **SQLite** for lightweight database storage
- **Pydantic** for data validation
- **Uvicorn** for ASGI server
- **Text-to-Speech Libraries** for audio generation
- **Audio Processing Libraries** for file manipulation

## Database Schema

### Stations Table
- `id`: Primary key
- `station_code`: Unique station identifier
- `station_name`: Human-readable station name
- `created_at`: Timestamp of creation
- `updated_at`: Timestamp of last update

### Train Routes Table
- `id`: Primary key
- `route_name`: Name of the train route
- `source_station_id`: Foreign key to source station
- `destination_station_id`: Foreign key to destination station
- `departure_time`: Scheduled departure time
- `arrival_time`: Scheduled arrival time
- `created_at`: Timestamp of creation
- `updated_at`: Timestamp of last update

### Audio Templates Table
- `id`: Primary key
- `template_name`: Name of the announcement template
- `template_text`: Text content for the announcement
- `audio_file_path`: Path to the generated audio file
- `created_at`: Timestamp of creation
- `updated_at`: Timestamp of last update

### Audio Segments Table
- `id`: Primary key
- `template_id`: Foreign key to audio template
- `segment_type`: Type of audio segment (intro, content, outro)
- `audio_file_path`: Path to the segment audio file
- `duration`: Duration of the audio segment
- `created_at`: Timestamp of creation

## API Endpoints

### Authentication (Backend)
- `POST /api/auth/login` - User authentication
- `POST /api/auth/logout` - User logout
- `GET /api/auth/verify` - Verify authentication token

### Station Management (Backend)
- `GET /api/stations` - Get all stations
- `POST /api/stations` - Create new station
- `PUT /api/stations/:id` - Update station
- `DELETE /api/stations/:id` - Delete station
- `POST /api/stations/import` - Import stations from Excel

### Train Route Management (Backend)
- `GET /api/train-routes` - Get all train routes
- `POST /api/train-routes` - Create new train route
- `PUT /api/train-routes/:id` - Update train route
- `DELETE /api/train-routes/:id` - Delete train route
- `POST /api/train-routes/import` - Import routes from Excel

### Audio Management (API Server)
- `GET /api/templates` - Get all audio templates
- `POST /api/templates` - Create new audio template
- `POST /api/templates/check-duplicate` - Check for duplicate English text
- `PUT /api/templates/:id` - Update audio template
- `DELETE /api/templates/:id` - Delete audio template
- `POST /api/templates/:id/generate-audio` - Generate audio from template
- `GET /api/audio-files` - Get all audio files
- `POST /api/audio-files` - Create new audio file
- `POST /api/audio-files/check-duplicate` - Check for duplicate English text
- `GET /api/audio-segments` - Get audio segments

### Health Checks
- `GET /api/health` - Backend health check
- `GET /health` - API server health check

## Environment Variables

### Backend (.env in backend/ directory)
```env
PORT=3001
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=development
API_BASE_URL=http://localhost:5001
```

### API Server (.env in api/ directory)
```env
DATABASE_URL=sqlite:///./wras_dhh.db
SECRET_KEY=your-super-secret-key-change-this-in-production
DEBUG=True
HOST=0.0.0.0
PORT=5001
```

## Audio System Configuration

The audio announcement system includes:

### Text-to-Speech Engine
- **Google Cloud Text-to-Speech**: High-quality voice synthesis
- **Multiple Voices**: Support for different languages and accents
- **Audio Formats**: MP3, WAV, and other common formats
- **Speed Control**: Adjustable speech rate and pitch

### Audio Processing
- **Segmentation**: Automatic splitting of long announcements
- **Noise Reduction**: Audio quality enhancement
- **Format Conversion**: Automatic format conversion for compatibility
- **File Compression**: Optimized file sizes for storage and transmission

### Storage Management
- **Local Storage**: Audio files stored locally for quick access
- **File Organization**: Structured directory organization
- **Backup System**: Automatic backup of audio files
- **Cleanup**: Automatic cleanup of temporary files

## Development Workflow

### Code Structure
```
project/
├── frontend/          # React TypeScript application
├── backend/           # Node.js Express server
├── api/              # Python FastAPI server
├── sample_docs/      # Sample Excel files for testing
└── scripts/          # Utility scripts
```

### Development Commands
```bash
# Install all dependencies
npm run install:all

# Start development servers
npm run dev

# Run tests
npm run test

# Build for production
npm run build

# Lint code
npm run lint

# Format code
npm run format
```

## Deployment

### Production Build
```bash
npm run build
```

### Docker Deployment
```bash
# Build Docker images
docker-compose build

# Start services
docker-compose up -d
```

### Environment Setup
1. Set production environment variables
2. Configure database connections
3. Set up SSL certificates
4. Configure reverse proxy (nginx)
5. Set up monitoring and logging

## Security Considerations

- **JWT Tokens**: Secure token-based authentication
- **Password Hashing**: bcrypt for password security
- **Input Validation**: Comprehensive input validation and sanitization
- **CORS Configuration**: Proper cross-origin resource sharing setup
- **Rate Limiting**: API rate limiting to prevent abuse
- **File Upload Security**: Secure file upload handling
- **Environment Variables**: Sensitive data stored in environment variables
- **Data Integrity**: Duplicate prevention to maintain data consistency

## Monitoring and Logging

- **Application Logs**: Comprehensive logging for debugging
- **Error Tracking**: Centralized error handling and reporting
- **Performance Monitoring**: API response time monitoring
- **Health Checks**: Regular health check endpoints
- **Audit Logs**: User action tracking for security

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions, please contact the development team or create an issue in the repository. 