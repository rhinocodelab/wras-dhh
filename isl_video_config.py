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
