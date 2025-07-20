#!/bin/bash

# Database Seeding Script for WRAS-DDH
# This script populates the database with sample announcement templates

echo "🌱 WRAS-DDH Database Seeding Script"
echo "=================================="

# Check if virtual environment exists
if [ ! -d "env" ]; then
    echo "Error: Virtual environment 'env' not found!"
    echo "Please create the virtual environment first."
    exit 1
fi

# Activate virtual environment
echo "Activating virtual environment..."
source env/bin/activate

# Check if required packages are installed
echo "Checking dependencies..."
python -c "import fastapi, uvicorn, google.cloud.translate, sqlalchemy" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "Installing required packages..."
    pip install -r requirements.txt
fi

# Check if GCP credentials exist
if [ ! -f "gcp_cred/isl.json" ]; then
    echo "Error: GCP credentials file 'gcp_cred/isl.json' not found!"
    echo "Please ensure the credentials file is in the correct location."
    exit 1
fi

# Set environment variables
export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/gcp_cred/isl.json"

# Run the seeding script
echo "Starting database seeding..."
python seed_templates.py

echo ""
echo "🎉 Seeding completed!"
echo "You can now start the API server with: ./start_api.sh" 