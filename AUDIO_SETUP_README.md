# Audio Files Environment Setup

This document explains how to set up the environment for audio files to be saved and served via Apache2 on Ubuntu.

## 🎯 Overview

The audio files will be:
- **Saved to**: `/var/www/audio_files/`
- **Served via**: Apache2 at `http://your-domain/audio_files/`
- **Accessible from**: FastAPI application and frontend

## 🚀 Quick Setup

### 1. Run the Setup Script

```bash
# Make sure you're in the project root directory
cd /path/to/your/project

# Run the setup script (requires sudo privileges)
./setup_audio_environment.sh
```

### 2. What the Script Does

The setup script will:

✅ **Install Apache2** (if not already installed)
✅ **Install required Apache2 modules** (headers, rewrite, mime)
✅ **Create audio directory** at `/var/www/audio_files/`
✅ **Set proper permissions** for `www-data` user
✅ **Configure Apache2 virtual host** for audio files
✅ **Enable CORS headers** for audio streaming
✅ **Create test files** for verification
✅ **Generate configuration** for your application

### 3. Verify Setup

After running the script, test the setup:

```bash
# Run the verification script
python3 test_audio_access.py
```

You should see:
```
✅ Audio directory exists: /var/www/audio_files
✅ Audio files directory is accessible via HTTP
```

## 📁 Directory Structure

After setup, your audio files will be organized as:

```
/var/www/audio_files/
├── .htaccess                    # Apache2 configuration
├── test.txt                     # Test file
├── audio_english_20241201_123456_1.mp3
├── audio_marathi_20241201_123456_1.mp3
├── audio_hindi_20241201_123456_1.mp3
└── audio_gujarati_20241201_123456_1.mp3
```

## 🔧 Configuration Files

### Apache2 Configuration
- **File**: `/etc/apache2/sites-available/audio-files.conf`
- **Status**: Enabled automatically by the script
- **Access**: `http://localhost/audio_files/`

### Application Configuration
- **File**: `audio_config.py` (created by script)
- **Usage**: Import in your FastAPI application

## 🎵 File Naming Convention

Audio files follow this naming pattern:
```
audio_{language}_{timestamp}_{file_id}.mp3
```

Examples:
- `audio_english_20241201_143022_1.mp3`
- `audio_marathi_20241201_143022_1.mp3`
- `audio_hindi_20241201_143022_1.mp3`
- `audio_gujarati_20241201_143022_1.mp3`

## 🔗 URL Access

Audio files are accessible via:
```
http://your-domain/audio_files/filename.mp3
```

For local development:
```
http://localhost/audio_files/filename.mp3
```

## 🛠️ Manual Setup (Alternative)

If you prefer to set up manually:

### 1. Install Apache2
```bash
sudo apt update
sudo apt install -y apache2 apache2-utils libapache2-mod-wsgi-py3
```

### 2. Enable Modules
```bash
sudo a2enmod headers
sudo a2enmod rewrite
sudo a2enmod mime
```

### 3. Create Directory
```bash
sudo mkdir -p /var/www/audio_files
sudo chown -R www-data:www-data /var/www/audio_files
sudo chmod -R 755 /var/www/audio_files
```

### 4. Configure Apache2
Create `/etc/apache2/sites-available/audio-files.conf`:
```apache
<VirtualHost *:80>
    ServerName localhost
    DocumentRoot /var/www/html
    
    Alias /audio_files /var/www/audio_files
    <Directory /var/www/audio_files>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        AddType audio/mpeg .mp3
        AddType audio/wav .wav
        AddType audio/ogg .ogg
        AddType audio/mp4 .m4a
        AddType audio/aac .aac
        
        <IfModule mod_headers.c>
            Header set Accept-Ranges "bytes"
        </IfModule>
    </Directory>
</VirtualHost>
```

### 5. Enable and Restart
```bash
sudo a2ensite audio-files.conf
sudo systemctl restart apache2
```

## 🔒 Security Considerations

### File Permissions
- Audio directory: `755` (readable by all, writable by owner)
- Audio files: `644` (readable by all, writable by owner)
- Owner: `www-data` (Apache2 user)

### Access Control
- Directory listing disabled (`Options -Indexes`)
- CORS enabled for audio streaming
- Range requests enabled for audio streaming

## 🐛 Troubleshooting

### Common Issues

#### 1. Permission Denied
```bash
# Check directory permissions
ls -la /var/www/audio_files/

# Fix permissions if needed
sudo chown -R www-data:www-data /var/www/audio_files/
sudo chmod -R 755 /var/www/audio_files/
```

#### 2. Apache2 Configuration Error
```bash
# Test configuration
sudo apache2ctl configtest

# Check error logs
sudo tail -f /var/log/apache2/error.log
```

#### 3. Audio Files Not Accessible
```bash
# Check if Apache2 is running
sudo systemctl status apache2

# Check if site is enabled
sudo a2query -s audio-files

# Restart Apache2
sudo systemctl restart apache2
```

#### 4. CORS Issues
Check that the `.htaccess` file exists and contains:
```apache
Header always set Access-Control-Allow-Origin "*"
Header always set Access-Control-Allow-Methods "GET, OPTIONS"
```

### Log Files
- **Apache2 Error Log**: `/var/log/apache2/audio_files_error.log`
- **Apache2 Access Log**: `/var/log/apache2/audio_files_access.log`

## 📝 Integration with FastAPI

### Update Your Application

1. **Audio Directory**: Update your FastAPI app to save files to `/var/www/audio_files/`
2. **URL Paths**: Use `/audio_files/filename.mp3` in your database
3. **Permissions**: Ensure your app can write to the audio directory

### Example Usage

```python
# In your FastAPI audio generation code
audio_dir = "/var/www/audio_files"
filename = f"audio_english_{timestamp}_{file_id}.mp3"
filepath = os.path.join(audio_dir, filename)

# Save audio file
with open(filepath, 'wb') as f:
    f.write(audio_content)

# Store URL in database
audio_url = f"/audio_files/{filename}"
```

## 🎉 Success Indicators

After successful setup, you should be able to:

1. ✅ Create audio files via your FastAPI application
2. ✅ Access audio files via `http://localhost/audio_files/filename.mp3`
3. ✅ Play audio files in your frontend application
4. ✅ See proper MIME types and CORS headers

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review Apache2 error logs
3. Verify file permissions
4. Test with the provided verification script

---

**Note**: This setup is optimized for Ubuntu systems. For other distributions, you may need to adjust package names and paths accordingly. 