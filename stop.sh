#!/bin/bash

# WRAS-DHH Project Stop Script
# This script stops all running frontend and backend servers

echo "🛑 Stopping WRAS-DHH Application"
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

# Kill Node.js processes related to our project
print_status "Stopping Node.js processes..."

# Kill processes on ports 3001 and 5173
PIDS=$(lsof -ti:3001,5173 2>/dev/null || true)

if [ -z "$PIDS" ]; then
    print_warning "No running servers found on ports 3001 or 5173"
else
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
    print_success "Stopped servers on ports 3001 and 5173"
fi

# Also kill any npm processes that might be running
NPM_PIDS=$(pgrep -f "npm run dev" 2>/dev/null || true)
if [ ! -z "$NPM_PIDS" ]; then
    echo "$NPM_PIDS" | xargs kill -9 2>/dev/null || true
    print_success "Stopped npm development processes"
fi

# Kill any tsx processes (TypeScript execution)
TSX_PIDS=$(pgrep -f "tsx" 2>/dev/null || true)
if [ ! -z "$TSX_PIDS" ]; then
    echo "$TSX_PIDS" | xargs kill -9 2>/dev/null || true
    print_success "Stopped TypeScript execution processes"
fi

print_success "🎉 All servers stopped successfully!" 