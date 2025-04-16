# config.py
import os
from dotenv import load_dotenv

load_dotenv()  # Loads environment variables from .env if available

# Backend URL for API calls
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")

# Porcupine wake-word access key
PORCUPINE_KEY = os.getenv("PORCUPINE_KEY")

# Directory containing pre-recorded static audio files for default responses
AUDIO_FILES_DIR = os.getenv("AUDIO_FILES_DIR", "Audio_files")

# Mapping for default responses to corresponding audio file names
DEFAULT_AUDIO_MAP = {
    "welcome": "welcome.mp3",           # For welcome text on startup
    "get_started": "get_started.mp3",     # "Just say 'Jarvis' to get started."
    "jarvis_greeting": "jarvis_greeting.mp3",   # "Hello! This is Jarvis. How can I make your day easier"
    "processing": "processing.mp3",       # "Just a moment... I’m processing what's around you."
    "error": "error.mp3"                  # Example error response audio file
}
