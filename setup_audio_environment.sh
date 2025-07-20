#!/bin/bash

# Audio Files Environment Setup Script for Ubuntu
# This script sets up the environment for audio files to be saved and served via Apache2

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

print_status "Starting Audio Files Environment Setup..."

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

# Install and verify Apache2 installation
print_status "Installing and verifying Apache2..."
sudo apt install -y apache2 apache2-utils libapache2-mod-wsgi-py3

# Verify Apache2 installation
if ! check_apache2_installation; then
    print_error "Apache2 installation failed. Please check your system and try again."
    exit 1
fi

# Enable required Apache2 modules
print_status "Enabling Apache2 modules..."
sudo a2enmod headers
sudo a2enmod rewrite
sudo a2enmod mime
print_success "Apache2 modules enabled successfully"

# Create audio files directory
print_status "Creating audio files directory..."
sudo mkdir -p /var/www/audio_files

# Set proper permissions for audio files directory
print_status "Setting permissions for audio files directory..."
# Get current user and group
CURRENT_USER=$(whoami)
CURRENT_GROUP=$(id -gn)

# Set ownership to current user but add www-data to the group
sudo chown -R $CURRENT_USER:$CURRENT_GROUP /var/www/audio_files
sudo chmod -R 775 /var/www/audio_files

# Add www-data user to the current user's group for write access
sudo usermod -a -G $CURRENT_GROUP www-data

print_status "Added www-data user to $CURRENT_GROUP group for shared access"

# Create a .htaccess file for audio files directory
print_status "Creating .htaccess file for audio files..."
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

# Create Apache2 virtual host configuration for audio files
print_status "Creating Apache2 virtual host configuration..."
sudo tee /etc/apache2/sites-available/audio-files.conf > /dev/null << 'EOF'
<VirtualHost *:80>
    ServerName localhost
    DocumentRoot /var/www/html
    
    # Audio files alias
    Alias /audio_files /var/www/audio_files
    <Directory /var/www/audio_files>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        # Enable directory listing for debugging (optional)
        # Options +Indexes +FollowSymLinks
        
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
    
    # Logging
    ErrorLog ${APACHE_LOG_DIR}/audio_files_error.log
    CustomLog ${APACHE_LOG_DIR}/audio_files_access.log combined
</VirtualHost>
EOF

# Enable the audio files site
print_status "Enabling audio files site..."
sudo a2ensite audio-files.conf
print_success "Audio files site enabled successfully"

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



# Create a configuration file for the application
print_status "Creating application configuration..."
tee audio_config.py > /dev/null << 'EOF'
# Audio Files Configuration
AUDIO_FILES_DIR = "/var/www/audio_files"
AUDIO_FILES_URL = "/audio_files"

# Supported audio formats
SUPPORTED_AUDIO_FORMATS = ['.mp3', '.wav', '.ogg', '.m4a', '.aac']

# File naming convention
AUDIO_FILE_PREFIX = "announcement"
AUDIO_FILE_SEPARATOR = "_"

# Permissions: Directory owned by current user, group writable (775)
# www-data user added to current user's group for shared access

# Example usage:
# announcement_1_english.mp3
# announcement_1_marathi.mp3
# announcement_1_hindi.mp3
# announcement_1_gujarati.mp3
EOF

print_success "Audio Files Environment Setup Complete!"
print_status "Summary of what was configured:"
echo "  • Apache2 installed and configured"
echo "  • Audio files directory: /var/www/audio_files"
echo "  • Virtual host configuration: /etc/apache2/sites-available/audio-files.conf"
echo "  • Directory owned by current user ($CURRENT_USER)"
echo "  • Group permissions (775) for shared access"
echo "  • www-data user added to $CURRENT_GROUP group"
echo "  • MIME types configured for audio files"
echo "  • CORS headers enabled for audio streaming"
echo ""
print_status "Next steps:"
echo "  1. Update your FastAPI application to save audio files to /var/www/audio_files/"
echo "  2. Use the URL pattern: http://your-domain/audio_files/filename.mp3"
echo "  3. Both current user and Apache2 can write to the audio directory"
echo ""
print_warning "Note: If you're running this in a development environment,"
echo "         you may need to adjust the virtual host configuration." 