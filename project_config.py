# WRAS-DHH Project Configuration
# This file contains all the configuration settings for the project

# Audio Files Configuration
AUDIO_FILES_DIR = "/var/www/audio_files"
AUDIO_FILES_URL = "/audio_files"
MERGED_SPEECH_TO_ISL_DIR = "/var/www/audio_files/merged_speech_to_isl"
MERGED_TEXT_ISL_DIR = "/var/www/audio_files/merged_text_isl"
MERGED_AUDIO_FILE_ISL_DIR = "/var/www/audio_files/merged_audio_file_isl"

# ISL Video Configuration
ISL_DATASET_DIR = "/var/www/isl_dataset"
FINAL_ISL_VID_DIR = "/var/www/final_isl_vid"
FINAL_SPEECH_ISL_VID_DIR = "/var/www/final_speech_isl_vid"
FINAL_TEXT_ISL_VID_DIR = "/var/www/final_text_isl_vid"
FINAL_AUDIO_FILE_ISL_VID_DIR = "/var/www/final_audio_file_isl_vid"

# Publish Directories
PUBLISH_ISL_DIR = "/var/www/publish_isl"
PUBLISH_SPEECH_ISL_DIR = "/var/www/publish_speech_isl"
PUBLISH_TEXT_ISL_DIR = "/var/www/publish_text_isl"
PUBLISH_AUDIO_FILE_ISL_DIR = "/var/www/publish_audio_file_isl"

# URL Patterns
ISL_DATASET_URL = "/isl_dataset"
FINAL_ISL_VID_URL = "/final_isl_vid"
FINAL_SPEECH_ISL_VID_URL = "/final_speech_isl_vid"
FINAL_TEXT_ISL_VID_URL = "/final_text_isl_vid"
FINAL_AUDIO_FILE_ISL_VID_URL = "/final_audio_file_isl_vid"
PUBLISH_ISL_URL = "/publish_isl"
PUBLISH_SPEECH_ISL_URL = "/publish_speech_isl"
PUBLISH_TEXT_ISL_URL = "/publish_text_isl"
PUBLISH_AUDIO_FILE_ISL_URL = "/publish_audio_file_isl"

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
# │   ├── merged_text_isl/          # Text-to-ISL merged audio files
# │   └── merged_audio_file_isl/    # Audio File to ISL merged audio files
# ├── final_isl_vid/                # Original ISL videos
# ├── final_speech_isl_vid/         # Speech-to-ISL generated videos
# ├── final_text_isl_vid/           # Text-to-ISL generated videos
# ├── final_audio_file_isl_vid/     # Audio File to ISL generated videos
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
# ├── publish_text_isl/            # Published Text-to-ISL HTML pages
# └── publish_audio_file_isl/      # Published Audio File to ISL HTML pages

# Example Usage:
# Audio files: http://your-domain/audio_files/filename.mp3
# ISL videos: http://your-domain/final_isl_vid/filename.mp4
# Dataset videos: http://your-domain/isl_dataset/train/train.mp4
# Published pages: http://your-domain/publish_isl/filename.html
