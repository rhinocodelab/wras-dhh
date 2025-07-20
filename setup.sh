#!/bin/bash

# WRAS-DHH Project Setup Script
# This script sets up the project by checking prerequisites and installing dependencies

set -e  # Exit on any error

echo "🚀 WRAS-DHH Project Setup"
echo "=========================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
print_status "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed!"
    echo "Please install Node.js first:"
    echo "  Ubuntu/Debian: sudo apt update && sudo apt install nodejs npm"
    echo "  macOS: brew install node"
    echo "  Windows: Download from https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_warning "Node.js version $(node --version) detected. Version 18 or higher is recommended."
else
    print_success "Node.js $(node --version) is installed"
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed!"
    exit 1
fi

print_success "npm $(npm --version) is installed"

# Check if the project structure exists
print_status "Checking project structure..."
if [ ! -d "frontend" ] || [ ! -d "backend" ]; then
    print_error "Project structure is incomplete. Please ensure frontend/ and backend/ directories exist."
    exit 1
fi

print_success "Project structure is valid"

# Install root dependencies
print_status "Installing root dependencies..."
npm install
print_success "Root dependencies installed"

# Install frontend dependencies
print_status "Installing frontend dependencies..."
cd frontend
npm install
cd ..
print_success "Frontend dependencies installed"

# Install backend dependencies
print_status "Installing backend dependencies..."
cd backend
npm install
cd ..
print_success "Backend dependencies installed"

# Check if .env file exists in backend
print_status "Checking backend environment configuration..."
if [ ! -f "backend/.env" ]; then
    print_warning "backend/.env file not found. Creating default .env file..."
    cat > backend/.env << EOF
PORT=3001
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=development
EOF
    print_success "Default .env file created in backend/"
    print_warning "Please update the JWT_SECRET in backend/.env for production use"
else
    print_success "backend/.env file exists"
fi

# Check if database exists
print_status "Checking database..."
if [ ! -f "backend/wras_dhh.db" ]; then
    print_warning "Database file not found. It will be created when you first run the backend."
else
    print_success "Database file exists"
fi

echo ""
print_success "🎉 Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Run './start.sh' to start both frontend and backend"
echo "2. Or run 'npm run dev' to start both servers"
echo "3. Frontend will be available at: http://localhost:5173"
echo "4. Backend will be available at: http://localhost:3001"
echo ""
echo "Default login credentials:"
echo "  Username: administrator"
echo "  Password: admin@123"
echo "" 