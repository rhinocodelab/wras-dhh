#!/bin/bash

# WRAS-DHH Project Start Script
# This script starts both frontend and backend servers

set -e  # Exit on any error

echo "🚀 Starting WRAS-DHH Application"
echo "================================"

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

# Function to cleanup on exit
cleanup() {
    print_status "Shutting down servers..."
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    print_success "Servers stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed! Please run './setup.sh' first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed! Please run './setup.sh' first."
    exit 1
fi

# Check if the project structure exists
if [ ! -d "frontend" ] || [ ! -d "backend" ]; then
    print_error "Project structure is incomplete. Please run './setup.sh' first."
    exit 1
fi

# Check if node_modules exist
if [ ! -d "frontend/node_modules" ] || [ ! -d "backend/node_modules" ]; then
    print_warning "Dependencies not installed. Running setup..."
    ./setup.sh
fi

# Check if .env file exists in backend
if [ ! -f "backend/.env" ]; then
    print_warning "backend/.env file not found. Creating default .env file..."
    cat > backend/.env << EOF
PORT=3001
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=development
EOF
fi

print_status "Starting backend server..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 2

print_status "Starting frontend server..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# Wait a moment for frontend to start
sleep 3

print_success "🎉 Both servers are starting up!"
echo ""
echo "📱 Frontend: http://localhost:5173"
echo "🔧 Backend:  http://localhost:3001"
echo "🏥 Health:   http://localhost:3001/api/health"
echo ""
echo "Default login credentials:"
echo "  Username: administrator"
echo "  Password: admin@123"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Function to check if servers are running
check_servers() {
    # Check backend
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Backend is running"
    else
        echo -e "${YELLOW}⚠${NC} Backend is starting..."
    fi
    
    # Check frontend
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Frontend is running"
    else
        echo -e "${YELLOW}⚠${NC} Frontend is starting..."
    fi
}

# Show server status after a few seconds
sleep 5
print_status "Server status:"
check_servers

# Keep the script running and monitor servers
while true; do
    sleep 10
    
    # Check if processes are still running
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        print_error "Backend server stopped unexpectedly"
        cleanup
    fi
    
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        print_error "Frontend server stopped unexpectedly"
        cleanup
    fi
done 