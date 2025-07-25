#!/bin/bash

# ISL Video Environment Setup Script for Ubuntu
# This script sets up the environment for ISL videos to be saved and served via Apache2

set -e  # Exit on any error

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

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root. Please run as a regular user with sudo privileges."
   exit 1
fi

print_status "Starting ISL Video Environment Setup..."

# Update package list
print_status "Updating package list..."
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
        sudo apt install --reinstall -y apache2 apache2-utils
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
print_status "Installing and verifying Apache2..."
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
print_status "Enabling Apache2 modules..."
sudo a2enmod headers
sudo a2enmod rewrite
sudo a2enmod mime
print_success "Apache2 modules enabled successfully"

# Create ISL video directories
print_status "Creating ISL video directories..."
sudo mkdir -p /var/www/final_isl_vid
sudo mkdir -p /var/www/isl_dataset

# Create publish_isl directory
print_status "Creating publish_isl directory..."
sudo mkdir -p /var/www/publish_isl

# Create final speech to isl directory
print_status "Creating final speech to isl directory..."
sudo mkdir -p /var/www/final_speech_isl_vid

# Set proper permissions for ISL video directories
print_status "Setting permissions for ISL video directories..."
# Get current user and group
CURRENT_USER=$(whoami)
CURRENT_GROUP=$(id -gn)

# Set ownership to current user but add www-data to the group
sudo chown -R $CURRENT_USER:$CURRENT_GROUP /var/www/final_isl_vid
sudo chown -R $CURRENT_USER:$CURRENT_GROUP /var/www/isl_dataset
sudo chown -R $CURRENT_USER:$CURRENT_GROUP /var/www/publish_isl
sudo chown -R $CURRENT_USER:$CURRENT_GROUP /var/www/final_speech_isl_vid
sudo chmod -R 775 /var/www/final_isl_vid
sudo chmod -R 775 /var/www/isl_dataset
sudo chmod -R 775 /var/www/publish_isl
sudo chmod -R 775 /var/www/final_speech_isl_vid

# Add www-data user to the current user's group for write access
sudo usermod -a -G $CURRENT_GROUP www-data

print_status "Added www-data user to $CURRENT_GROUP group for shared access"

# Create a .htaccess file for final ISL videos directory
print_status "Creating .htaccess file for final ISL videos..."
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

# Create a .htaccess file for ISL dataset directory
print_status "Creating .htaccess file for ISL dataset..."
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

# Create Apache2 virtual host configuration for ISL videos
print_status "Creating Apache2 virtual host configuration..."
sudo tee /etc/apache2/sites-available/isl-videos.conf > /dev/null << 'EOF'
<VirtualHost *:80>
    ServerName localhost
    DocumentRoot /var/www/html
    
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
    
    # ISL dataset alias
    Alias /isl_videos /var/www/isl_dataset
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
    
    # Logging
    ErrorLog ${APACHE_LOG_DIR}/isl_videos_error.log
    CustomLog ${APACHE_LOG_DIR}/isl_videos_access.log combined
</VirtualHost>
EOF

# Enable the ISL videos site
print_status "Enabling ISL videos site..."
sudo a2ensite isl-videos.conf
print_success "ISL videos site enabled successfully"

# Test Apache2 configuration
print_status "Testing Apache2 configuration..."
if sudo apache2ctl configtest; then
    print_success "Apache2 configuration is valid"
else
    print_error "Apache2 configuration test failed"
    exit 1
fi

# Restart Apache2
print_status "Restarting Apache2..."
sudo systemctl restart apache2

# Enable Apache2 to start on boot
print_status "Enabling Apache2 to start on boot..."
sudo systemctl enable apache2

# Create sample ISL dataset structure
print_status "Creating sample ISL dataset structure..."
sudo mkdir -p /var/www/isl_dataset/sample_word
print_status "Created sample directory: /var/www/isl_dataset/sample_word"
print_warning "Please add your ISL video files to the appropriate word directories"
print_warning "Example: /var/www/isl_dataset/train/train_sign.mp4"

# Create a configuration file for the application
print_status "Creating application configuration..."
tee isl_video_config.py > /dev/null << 'EOF'
# ISL Video Configuration
ISL_DATASET_DIR = "/var/www/isl_dataset"
FINAL_ISL_VID_DIR = "/var/www/final_isl_vid"
ISL_DATASET_URL = "/isl_videos"
FINAL_ISL_VID_URL = "/final_isl_vid"

# Supported video formats
SUPPORTED_VIDEO_FORMATS = ['.mp4', '.avi', '.mov', '.webm']

# File naming convention
ISL_VIDEO_PREFIX = "isl_announcement"
ISL_VIDEO_SEPARATOR = "_"

# FFmpeg settings
FFMPEG_CONCAT_METHOD = "concat"  # or "filter_complex"
FFMPEG_OUTPUT_FORMAT = "mp4"
FFMPEG_CODEC = "copy"  # or specific codec like "libx264"

# Permissions: Directory owned by current user, group writable (775)
# www-data user added to current user's group for shared access

# Example ISL dataset structure:
# /var/www/isl_dataset/
# ├── train/
# │   └── train_sign.mp4
# ├── platform/
# │   └── platform_sign.mp4
# ├── 1/
# │   └── number_1.mp4
# └── arriving/
#     └── arriving_sign.mp4

# Example generated video:
# /var/www/final_isl_vid/isl_announcement_a1b2c3d4_1234567890.mp4
EOF

print_success "ISL Video Environment Setup Complete!"
print_status "Summary of what was configured:"
echo "  • Apache2 installed and configured"
echo "  • FFmpeg installed for video processing"
echo "  • Final ISL videos directory: /var/www/final_isl_vid"
echo "  • ISL dataset directory: /var/www/isl_dataset"
echo "  • Virtual host configuration: /etc/apache2/sites-available/isl-videos.conf"
echo "  • Directories owned by current user ($CURRENT_USER)"
echo "  • Group permissions (775) for shared access"
echo "  • www-data user added to $CURRENT_GROUP group"
echo "  • MIME types configured for video files"
echo "  • CORS headers enabled for video streaming"
echo "  • Range requests enabled for video streaming"
echo ""
print_status "Next steps:"
echo "  1. Add your ISL video files to /var/www/isl_dataset/[word]/[video].mp4"
echo "  2. Update your FastAPI application to use the new video directories"
echo "  3. Use the URL patterns:"
echo "     • Generated videos: http://your-domain/final_isl_vid/filename.mp4"
echo "     • Dataset videos: http://your-domain/isl_videos/word/video.mp4"
echo "  4. Both current user and Apache2 can write to the video directories"
echo ""
print_warning "Important: Add your ISL video files to the dataset directory"
echo "           following the structure: /var/www/isl_dataset/[word]/[video].mp4"
echo ""
print_warning "Note: If you're running this in a development environment,"
echo "         you may need to adjust the virtual host configuration." 