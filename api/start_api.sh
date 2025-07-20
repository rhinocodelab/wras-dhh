#!/bin/bash

# WRAS-DHH Translation API Startup Script
# This script starts the FastAPI translation service

echo "Starting WRAS-DHH Translation API..."

# Check if virtual environment exists
if [ ! -d "env" ]; then
    echo "Error: Virtual environment 'env' not found!"
    echo "Please create the virtual environment first."
    exit 1
fi

# Activate virtual environment
echo "Activating virtual environment..."
source env/bin/activate

echo "Installing required packages..."
pip install -r requirements.txt


# Check if GCP credentials exist
if [ ! -f "gcp_cred/isl.json" ]; then
    echo "Error: GCP credentials file 'gcp_cred/isl.json' not found!"
    echo "Please ensure the credentials file is in the correct location."
    exit 1
fi

# Set environment variables
export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/gcp_cred/isl.json"

# Start the FastAPI server
echo "Starting FastAPI server..."
echo "🌐 Server will be available at:"
echo "   - Local: http://localhost:5001"
echo "   - Network: http://0.0.0.0:5001"
echo "📚 API Documentation: http://localhost:5001/docs"
echo "🔍 Health Check: http://localhost:5001/health"
echo ""
echo "🎯 Available endpoints:"
echo "   - GET  /                    - Root endpoint"
echo "   - GET  /health              - Health check"
echo "   - POST /translate           - Translate text"
echo "   - GET  /supported-languages - List supported languages"
echo "   - GET  /api/templates       - Get all templates"
echo "   - POST /api/templates       - Create new template"
echo "   - PUT  /api/templates/{id}  - Update template"
echo "   - DEL  /api/templates/{id}  - Delete template"
echo ""
echo "🌱 To seed sample templates, run: python seed_templates.py"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Run the FastAPI application
python main.py 