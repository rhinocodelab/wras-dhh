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
