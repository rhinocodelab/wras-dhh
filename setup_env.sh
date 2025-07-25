#!/bin/bash

# Comprehensive Environment Setup Script for WRAS-DHH Project
# This script sets up the complete environment for audio files, ISL videos, and all project directories
# Merges setup_audio_environment.sh and setup_isl_video_environment.sh

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
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

print_header() {
    echo -e "${PURPLE}[SETUP]${NC} $1"
}

print_subheader() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root. Please run as a regular user with sudo privileges."
   exit 1
fi

print_header "Starting Comprehensive Environment Setup for WRAS-DHH Project..."

# Get current user and group
CURRENT_USER=$(whoami)
CURRENT_GROUP=$(id -gn)

print_status "Current user: $CURRENT_USER"
print_status "Current group: $CURRENT_GROUP"

# Update package list
print_subheader "Updating package list..."
sudo apt update

# Function to check Apache2 installation
check_apache2_installation() {
    local missing_commands=()
    
    # Check for essential Apache2 commands
    for cmd in apache2 a2enmod a2ensite apache2ctl; do
        if ! command -v $cmd &> /dev/null; then
            missing_commands+=($cmd)
        fi
    done
    
    if [ ${#missing_commands[@]} -gt 0 ]; then
        print_error "Missing Apache2 commands: ${missing_commands[*]}"
        print_status "Attempting to install/reinstall Apache2..."
        sudo apt install --reinstall -y apache2 apache2-utils libapache2-mod-wsgi-py3
        sleep 3
        
        # Check again after reinstall
        for cmd in apache2 a2enmod a2ensite apache2ctl; do
            if ! command -v $cmd &> /dev/null; then
                print_error "Failed to install $cmd. Please check your system."
                return 1
            fi
        done
    fi
    
    print_success "Apache2 installation verified"
    return 0
}

# Function to check FFmpeg installation
check_ffmpeg_installation() {
    if ! command -v ffmpeg &> /dev/null; then
        print_warning "FFmpeg not found. Installing FFmpeg..."
        sudo apt install -y ffmpeg
        sleep 2
        
        if ! command -v ffmpeg &> /dev/null; then
            print_error "Failed to install FFmpeg. Please check your system."
            return 1
        fi
    fi
    
    print_success "FFmpeg installation verified"
    return 0
}

# Install and verify Apache2 installation
print_subheader "Installing and verifying Apache2..."
sudo apt install -y apache2 apache2-utils libapache2-mod-wsgi-py3

# Verify Apache2 installation
if ! check_apache2_installation; then
    print_error "Apache2 installation failed. Please check your system and try again."
    exit 1
fi

# Verify FFmpeg installation
if ! check_ffmpeg_installation; then
    print_error "FFmpeg installation failed. Please check your system and try again."
    exit 1
fi

# Enable required Apache2 modules
print_subheader "Enabling Apache2 modules..."
sudo a2enmod headers
sudo a2enmod rewrite
sudo a2enmod mime
print_success "Apache2 modules enabled successfully"

# Create all necessary directories
print_subheader "Creating all necessary directories in /var/www/..."

# Audio-related directories
sudo mkdir -p /var/www/audio_files
sudo mkdir -p /var/www/audio_files/merged_speech_to_isl
sudo mkdir -p /var/www/audio_files/merged_text_isl

# ISL video directories
sudo mkdir -p /var/www/final_isl_vid
sudo mkdir -p /var/www/final_speech_isl_vid
sudo mkdir -p /var/www/final_text_isl_vid
sudo mkdir -p /var/www/isl_dataset

# Publish directories
sudo mkdir -p /var/www/publish_isl
sudo mkdir -p /var/www/publish_speech_isl
sudo mkdir -p /var/www/publish_text_isl

# Create ISL dataset subdirectories
print_subheader "Creating ISL dataset subdirectories..."
sudo mkdir -p /var/www/isl_dataset/1
sudo mkdir -p /var/www/isl_dataset/2
sudo mkdir -p /var/www/isl_dataset/3
sudo mkdir -p /var/www/isl_dataset/arrive
sudo mkdir -p /var/www/isl_dataset/arriving
sudo mkdir -p /var/www/isl_dataset/attention
sudo mkdir -p /var/www/isl_dataset/bandra
sudo mkdir -p /var/www/isl_dataset/cancelled
sudo mkdir -p /var/www/isl_dataset/express
sudo mkdir -p /var/www/isl_dataset/late
sudo mkdir -p /var/www/isl_dataset/number
sudo mkdir -p /var/www/isl_dataset/platform
sudo mkdir -p /var/www/isl_dataset/running
sudo mkdir -p /var/www/isl_dataset/train
sudo mkdir -p /var/www/isl_dataset/vapi

print_success "All directories created successfully"

# Set proper permissions for all directories
print_subheader "Setting permissions for all directories..."

# Set ownership to current user but add www-data to the group
sudo chown -R $CURRENT_USER:$CURRENT_GROUP /var/www/audio_files
sudo chown -R $CURRENT_USER:$CURRENT_GROUP /var/www/final_isl_vid
sudo chown -R $CURRENT_USER:$CURRENT_GROUP /var/www/final_speech_isl_vid
sudo chown -R $CURRENT_USER:$CURRENT_GROUP /var/www/final_text_isl_vid
sudo chown -R $CURRENT_USER:$CURRENT_GROUP /var/www/isl_dataset
sudo chown -R $CURRENT_USER:$CURRENT_GROUP /var/www/publish_isl
sudo chown -R $CURRENT_USER:$CURRENT_GROUP /var/www/publish_speech_isl
sudo chown -R $CURRENT_USER:$CURRENT_GROUP /var/www/publish_text_isl

# Set permissions to 775 for shared access
sudo chmod -R 775 /var/www/audio_files
sudo chmod -R 775 /var/www/final_isl_vid
sudo chmod -R 775 /var/www/final_speech_isl_vid
sudo chmod -R 775 /var/www/final_text_isl_vid
sudo chmod -R 775 /var/www/isl_dataset
sudo chmod -R 775 /var/www/publish_isl
sudo chmod -R 775 /var/www/publish_speech_isl
sudo chmod -R 775 /var/www/publish_text_isl

# Add www-data user to the current user's group for write access
sudo usermod -a -G $CURRENT_GROUP www-data

print_status "Added www-data user to $CURRENT_GROUP group for shared access"

# Create .htaccess files for audio files directory
print_subheader "Creating .htaccess file for audio files..."
sudo tee /var/www/audio_files/.htaccess > /dev/null << 'EOF'
# Audio Files Directory Configuration
Options -Indexes
Allow from all

# Set proper MIME types for different audio formats
<FilesMatch "\.mp3$">
    Header set Content-Type "audio/mpeg"
    Header set Accept-Ranges "bytes"
</FilesMatch>

<FilesMatch "\.wav$">
    Header set Content-Type "audio/wav"
    Header set Accept-Ranges "bytes"
</FilesMatch>

<FilesMatch "\.ogg$">
    Header set Content-Type "audio/ogg"
    Header set Accept-Ranges "bytes"
</FilesMatch>

<FilesMatch "\.m4a$">
    Header set Content-Type "audio/mp4"
    Header set Accept-Ranges "bytes"
</FilesMatch>

<FilesMatch "\.aac$">
    Header set Content-Type "audio/aac"
    Header set Accept-Ranges "bytes"
</FilesMatch>

# Enable CORS for audio files
Header always set Access-Control-Allow-Origin "*"
Header always set Access-Control-Allow-Methods "GET, OPTIONS"
Header always set Access-Control-Allow-Headers "Range"

# Handle range requests for audio streaming
<IfModule mod_headers.c>
    Header set Accept-Ranges "bytes"
</IfModule>

# Force download for unsupported formats (optional)
<FilesMatch "\.(mp3|wav|ogg|m4a|aac)$">
    Header set Content-Disposition "inline"
</FilesMatch>
EOF

# Create .htaccess files for video directories
print_subheader "Creating .htaccess files for video directories..."

# Final ISL videos
sudo tee /var/www/final_isl_vid/.htaccess > /dev/null << 'EOF'
# Final ISL Videos Directory Configuration
Options -Indexes
Allow from all

# Set proper MIME types for video formats
<FilesMatch "\.mp4$">
    Header set Content-Type "video/mp4"
    Header set Accept-Ranges "bytes"
</FilesMatch>

<FilesMatch "\.avi$">
    Header set Content-Type "video/x-msvideo"
    Header set Accept-Ranges "bytes"
</FilesMatch>

<FilesMatch "\.mov$">
    Header set Content-Type "video/quicktime"
    Header set Accept-Ranges "bytes"
</FilesMatch>

<FilesMatch "\.webm$">
    Header set Content-Type "video/webm"
    Header set Accept-Ranges "bytes"
</FilesMatch>

# Enable CORS for video files
Header always set Access-Control-Allow-Origin "*"
Header always set Access-Control-Allow-Methods "GET, OPTIONS"
Header always set Access-Control-Allow-Headers "Range"

# Handle range requests for video streaming
<IfModule mod_headers.c>
    Header set Accept-Ranges "bytes"
</IfModule>

# Force inline display for video files
<FilesMatch "\.(mp4|avi|mov|webm)$">
    Header set Content-Disposition "inline"
</FilesMatch>

# Cache control for video files
<FilesMatch "\.(mp4|avi|mov|webm)$">
    Header set Cache-Control "public, max-age=3600"
</FilesMatch>
EOF

# ISL dataset
sudo tee /var/www/isl_dataset/.htaccess > /dev/null << 'EOF'
# ISL Dataset Directory Configuration
Options -Indexes
Allow from all

# Set proper MIME types for video formats
<FilesMatch "\.mp4$">
    Header set Content-Type "video/mp4"
    Header set Accept-Ranges "bytes"
</FilesMatch>

# Enable CORS for video files
Header always set Access-Control-Allow-Origin "*"
Header always set Access-Control-Allow-Methods "GET, OPTIONS"
Header always set Access-Control-Allow-Headers "Range"

# Handle range requests for video streaming
<IfModule mod_headers.c>
    Header set Accept-Ranges "bytes"
</IfModule>

# Force inline display for video files
<FilesMatch "\.mp4$">
    Header set Content-Disposition "inline"
</FilesMatch>

# Cache control for video files
<FilesMatch "\.mp4$">
    Header set Cache-Control "public, max-age=3600"
</FilesMatch>
EOF

# Create Apache2 virtual host configuration
print_subheader "Creating Apache2 virtual host configuration..."
sudo tee /etc/apache2/sites-available/wras-dhh.conf > /dev/null << 'EOF'
<VirtualHost *:80>
    ServerName localhost
    DocumentRoot /var/www/html
    
    # Audio files alias
    Alias /audio_files /var/www/audio_files
    <Directory /var/www/audio_files>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        # Set proper MIME types for audio files
        AddType audio/mpeg .mp3
        AddType audio/wav .wav
        AddType audio/ogg .ogg
        AddType audio/mp4 .m4a
        AddType audio/aac .aac
        
        # Ensure proper headers for audio streaming
        <FilesMatch "\.(mp3|wav|ogg|m4a|aac)$">
            Header set Accept-Ranges "bytes"
            Header set Cache-Control "public, max-age=3600"
        </FilesMatch>
        
        # Enable range requests for audio streaming
        <IfModule mod_headers.c>
            Header set Accept-Ranges "bytes"
        </IfModule>
    </Directory>
    
    # Final ISL videos alias
    Alias /final_isl_vid /var/www/final_isl_vid
    <Directory /var/www/final_isl_vid>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        # Set proper MIME types for video files
        AddType video/mp4 .mp4
        AddType video/x-msvideo .avi
        AddType video/quicktime .mov
        AddType video/webm .webm
        
        # Ensure proper headers for video streaming
        <FilesMatch "\.(mp4|avi|mov|webm)$">
            Header set Accept-Ranges "bytes"
            Header set Cache-Control "public, max-age=3600"
        </FilesMatch>
        
        # Enable range requests for video streaming
        <IfModule mod_headers.c>
            Header set Accept-Ranges "bytes"
        </IfModule>
    </Directory>
    
    # Final Speech-to-ISL videos alias
    Alias /final_speech_isl_vid /var/www/final_speech_isl_vid
    <Directory /var/www/final_speech_isl_vid>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        # Set proper MIME types for video files
        AddType video/mp4 .mp4
        
        # Ensure proper headers for video streaming
        <FilesMatch "\.mp4$">
            Header set Accept-Ranges "bytes"
            Header set Cache-Control "public, max-age=3600"
        </FilesMatch>
        
        # Enable range requests for video streaming
        <IfModule mod_headers.c>
            Header set Accept-Ranges "bytes"
        </IfModule>
    </Directory>
    
    # Final Text-to-ISL videos alias
    Alias /final_text_isl_vid /var/www/final_text_isl_vid
    <Directory /var/www/final_text_isl_vid>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        # Set proper MIME types for video files
        AddType video/mp4 .mp4
        
        # Ensure proper headers for video streaming
        <FilesMatch "\.mp4$">
            Header set Accept-Ranges "bytes"
            Header set Cache-Control "public, max-age=3600"
        </FilesMatch>
        
        # Enable range requests for video streaming
        <IfModule mod_headers.c>
            Header set Accept-Ranges "bytes"
        </IfModule>
    </Directory>
    
    # ISL dataset alias
    Alias /isl_dataset /var/www/isl_dataset
    <Directory /var/www/isl_dataset>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        # Set proper MIME types for video files
        AddType video/mp4 .mp4
        
        # Ensure proper headers for video streaming
        <FilesMatch "\.mp4$">
            Header set Accept-Ranges "bytes"
            Header set Cache-Control "public, max-age=3600"
        </FilesMatch>
        
        # Enable range requests for video streaming
        <IfModule mod_headers.c>
            Header set Accept-Ranges "bytes"
        </IfModule>
    </Directory>
    
    # Publish ISL alias
    Alias /publish_isl /var/www/publish_isl
    <Directory /var/www/publish_isl>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        # Set proper MIME types for HTML files
        AddType text/html .html
        
        # Ensure proper headers for HTML files
        <FilesMatch "\.html$">
            Header set Cache-Control "public, max-age=3600"
        </FilesMatch>
    </Directory>
    
    # Publish Speech-to-ISL alias
    Alias /publish_speech_isl /var/www/publish_speech_isl
    <Directory /var/www/publish_speech_isl>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        # Set proper MIME types for HTML files
        AddType text/html .html
        
        # Ensure proper headers for HTML files
        <FilesMatch "\.html$">
            Header set Cache-Control "public, max-age=3600"
        </FilesMatch>
    </Directory>
    
    # Publish Text-to-ISL alias
    Alias /publish_text_isl /var/www/publish_text_isl
    <Directory /var/www/publish_text_isl>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        # Set proper MIME types for HTML files
        AddType text/html .html
        
        # Ensure proper headers for HTML files
        <FilesMatch "\.html$">
            Header set Cache-Control "public, max-age=3600"
        </FilesMatch>
    </Directory>
    
    # Logging
    ErrorLog ${APACHE_LOG_DIR}/wras_dhh_error.log
    CustomLog ${APACHE_LOG_DIR}/wras_dhh_access.log combined
</VirtualHost>
EOF

# Enable the WRAS-DHH site
print_subheader "Enabling WRAS-DHH site..."
sudo a2ensite wras-dhh.conf
print_success "WRAS-DHH site enabled successfully"

# Test Apache2 configuration
print_subheader "Testing Apache2 configuration..."
if sudo apache2ctl configtest; then
    print_success "Apache2 configuration is valid"
else
    print_error "Apache2 configuration test failed"
    exit 1
fi

# Restart Apache2
print_subheader "Restarting Apache2..."
sudo systemctl restart apache2

# Enable Apache2 to start on boot
print_subheader "Enabling Apache2 to start on boot..."
sudo systemctl enable apache2

# Create sample files for testing
print_subheader "Creating sample files for testing..."

# Create a sample audio file (empty file for testing)
sudo touch /var/www/audio_files/sample_audio.mp3
sudo chown $CURRENT_USER:$CURRENT_GROUP /var/www/audio_files/sample_audio.mp3

# Create a sample video file (empty file for testing)
sudo touch /var/www/isl_dataset/train/train.mp4
sudo chown $CURRENT_USER:$CURRENT_GROUP /var/www/isl_dataset/train/train.mp4

print_warning "Sample files created. Please replace with actual audio/video files."

# Create comprehensive configuration file
print_subheader "Creating comprehensive application configuration..."
tee project_config.py > /dev/null << 'EOF'
# WRAS-DHH Project Configuration
# This file contains all the configuration settings for the project

# Audio Files Configuration
AUDIO_FILES_DIR = "/var/www/audio_files"
AUDIO_FILES_URL = "/audio_files"
MERGED_SPEECH_TO_ISL_DIR = "/var/www/audio_files/merged_speech_to_isl"
MERGED_TEXT_ISL_DIR = "/var/www/audio_files/merged_text_isl"

# ISL Video Configuration
ISL_DATASET_DIR = "/var/www/isl_dataset"
FINAL_ISL_VID_DIR = "/var/www/final_isl_vid"
FINAL_SPEECH_ISL_VID_DIR = "/var/www/final_speech_isl_vid"
FINAL_TEXT_ISL_VID_DIR = "/var/www/final_text_isl_vid"

# Publish Directories
PUBLISH_ISL_DIR = "/var/www/publish_isl"
PUBLISH_SPEECH_ISL_DIR = "/var/www/publish_speech_isl"
PUBLISH_TEXT_ISL_DIR = "/var/www/publish_text_isl"

# URL Patterns
ISL_DATASET_URL = "/isl_dataset"
FINAL_ISL_VID_URL = "/final_isl_vid"
FINAL_SPEECH_ISL_VID_URL = "/final_speech_isl_vid"
FINAL_TEXT_ISL_VID_URL = "/final_text_isl_vid"
PUBLISH_ISL_URL = "/publish_isl"
PUBLISH_SPEECH_ISL_URL = "/publish_speech_isl"
PUBLISH_TEXT_ISL_URL = "/publish_text_isl"

# Supported Formats
SUPPORTED_AUDIO_FORMATS = ['.mp3', '.wav', '.ogg', '.m4a', '.aac']
SUPPORTED_VIDEO_FORMATS = ['.mp4', '.avi', '.mov', '.webm']

# File Naming Conventions
AUDIO_FILE_PREFIX = "announcement"
ISL_VIDEO_PREFIX = "isl_announcement"
AUDIO_FILE_SEPARATOR = "_"
ISL_VIDEO_SEPARATOR = "_"

# FFmpeg Settings
FFMPEG_CONCAT_METHOD = "concat"
FFMPEG_OUTPUT_FORMAT = "mp4"
FFMPEG_CODEC = "copy"

# Permissions
# All directories are owned by current user with group permissions (775)
# www-data user is added to current user's group for shared access

# Directory Structure Created:
# /var/www/
# ├── audio_files/
# │   ├── merged_speech_to_isl/     # Speech-to-ISL merged audio files
# │   └── merged_text_isl/          # Text-to-ISL merged audio files
# ├── final_isl_vid/                # Original ISL videos
# ├── final_speech_isl_vid/         # Speech-to-ISL generated videos
# ├── final_text_isl_vid/           # Text-to-ISL generated videos
# ├── isl_dataset/                  # ISL video dataset
# │   ├── 1/, 2/, 3/               # Number signs
# │   ├── arrive/, arriving/       # Arrival signs
# │   ├── attention/               # Attention sign
# │   ├── bandra/                  # Station name
# │   ├── cancelled/               # Cancelled sign
# │   ├── express/                 # Express train sign
# │   ├── late/                    # Late sign
# │   ├── number/                  # Number sign
# │   ├── platform/                # Platform sign
# │   ├── running/                 # Running sign
# │   ├── train/                   # Train sign
# │   └── vapi/                    # Vapi station
# ├── publish_isl/                 # Published ISL HTML pages
# ├── publish_speech_isl/          # Published Speech-to-ISL HTML pages
# └── publish_text_isl/            # Published Text-to-ISL HTML pages

# Example Usage:
# Audio files: http://your-domain/audio_files/filename.mp3
# ISL videos: http://your-domain/final_isl_vid/filename.mp4
# Dataset videos: http://your-domain/isl_dataset/train/train.mp4
# Published pages: http://your-domain/publish_isl/filename.html
EOF

print_success "Comprehensive Environment Setup Complete!"
print_header "Summary of what was configured:"

echo ""
echo -e "${GREEN}📁 Directories Created:${NC}"
echo "  • /var/www/audio_files/ (with merged subdirectories)"
echo "  • /var/www/final_isl_vid/"
echo "  • /var/www/final_speech_isl_vid/"
echo "  • /var/www/final_text_isl_vid/"
echo "  • /var/www/isl_dataset/ (with all subdirectories)"
echo "  • /var/www/publish_isl/"
echo "  • /var/www/publish_speech_isl/"
echo "  • /var/www/publish_text_isl/"

echo ""
echo -e "${GREEN}🔧 System Configuration:${NC}"
echo "  • Apache2 installed and configured"
echo "  • FFmpeg installed for video processing"
echo "  • Virtual host: /etc/apache2/sites-available/wras-dhh.conf"
echo "  • All directories owned by user: $CURRENT_USER"
echo "  • Group permissions (775) for shared access"
echo "  • www-data user added to $CURRENT_GROUP group"

echo ""
echo -e "${GREEN}🌐 URL Patterns:${NC}"
echo "  • Audio files: http://your-domain/audio_files/filename.mp3"
echo "  • ISL videos: http://your-domain/final_isl_vid/filename.mp4"
echo "  • Speech-to-ISL videos: http://your-domain/final_speech_isl_vid/filename.mp4"
echo "  • Text-to-ISL videos: http://your-domain/final_text_isl_vid/filename.mp4"
echo "  • Dataset videos: http://your-domain/isl_dataset/word/video.mp4"
echo "  • Published pages: http://your-domain/publish_*/filename.html"

echo ""
echo -e "${GREEN}📋 Next Steps:${NC}"
echo "  1. Add your ISL video files to /var/www/isl_dataset/[word]/[video].mp4"
echo "  2. Update your FastAPI application to use the new directories"
echo "  3. Test the setup by accessing the URL patterns above"
echo "  4. Both current user and Apache2 can write to all directories"

echo ""
print_warning "Important: Replace sample files with actual audio/video files"
echo "           following the structure: /var/www/isl_dataset/[word]/[video].mp4"

echo ""
print_warning "Note: If running in development environment,"
echo "         you may need to adjust the virtual host configuration."

echo ""
print_success "Environment setup completed successfully! 🎉" 