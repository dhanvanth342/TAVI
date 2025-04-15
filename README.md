

# TAVI: Surrounding Awareness System

TAVI is a multimodal system designed to enhance situational awareness for visually impaired users. The system processes live audio and video, performs advanced speech and intent recognition, and provides context-rich feedback via text and audio. The solution leverages cloud-based inference APIs for heavy processing tasks and offers a hands-free, continuous interaction loop.

## Table of Contents
- [Features](#features)
- [Installation](#installation)
  - [Clone the Repository](#clone-the-repository)
  - [Environment Setup](#environment-setup)
  - [Install Dependencies](#install-dependencies)
- [Running the Application](#running-the-application)
  - [Running the Backend](#running-the-backend)
  - [Running the Frontend (Kivy App)](#running-the-frontend-kivy-app)
- [Project Overview](#project-overview)
- [File Structure](#file-structure)
- [Connecting Backend and Frontend](#connecting-backend-and-frontend)
- [License](#license)

## Features

- **Continuous Voice Interaction:**  
  The app continuously listens for wake words (using pvporcupine) and records audio when prompted. It starts capturing when the user says, for example, “Hello Assistant” and stops when the user says “I am done Assistant.”

- **Speech and Intent Recognition:**  
  Audio input is converted to text using OpenAI’s Whisper API. The transcribed text is then analyzed with a lightweight GPT-based model to determine the user’s intent (Record, General, Fallback, or Tavi).

- **Multimodal Processing:**  
  - **Video Processing:**  
    Video input is processed by extracting frames, generating image captions via the Hugging Face Inference API (using BLIP), performing OCR to extract text from images, and then aggregating this information into a concise environmental summary through a ChatGroq-based LLM. The summary is converted into speech using pyttsx3.
  - **Audio Processing:**  
    The system uses the recognized intent to decide whether to initiate video recording or directly respond with an audio answer.

- **Accessible Chat UI:**  
  A Kivy-based mobile app presents a scrolling chat-like interface that displays transcripts, text responses, and media (e.g., recorded video previews and audio playback), all designed for ease of use by visually impaired users.

- **Continuous Interaction Loop:**  
  The microphone reactivates after each interaction, allowing the user to continuously converse with the system.

## Installation

### Clone the Repository

Open your terminal and execute the following commands:

```bash
git clone https://github.com/dhanvanth342/TAVI.git
cd TAVI
```

### Environment Setup

Create a `.env` file in the project’s root directory with the following keys (replace the placeholders with your actual API keys):

```dotenv
# .env
BACKEND_URL=http://127.0.0.1:8000
HF_API_KEY=hf_your_hf_api_key
MISTRAL_API_KEY=your_mistral_api_key
GROQ_API_KEY=your_groq_api_key
OPENAI_API_KEY=your_openai_api_key
PORCUPINE_KEY=your_pvporcupine_access_key
```

### Install Dependencies

First, create and activate a virtual environment, then install the dependencies:

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```



## Running the Application

### Running the Backend

The backend is implemented using FastAPI in `app.py` (located in the project root). Start the backend server with:

```bash
uvicorn app:app --reload
```

The backend will be available at the URL specified in your `.env` file (default is `http://127.0.0.1:8000`).

### Running the Frontend (Kivy App)

The Kivy mobile app is found in the `frontend` folder with files such as `main.py`, `config.py`, and optionally `chat.kv` for the UI layout. To start the Kivy app, run:

```bash
python frontend/main.py
```

The app will:
- Continuously listen for the wake word (via pvporcupine).
- Record audio when prompted and send the recording to the `/process_audio/` endpoint.
- Parse the JSON response to decide whether to capture video (if the "Record" intent is detected) or to simply display/play the audio response.
- Update the chat UI with transcripts, text responses, and video previews.

## Project Overview

### Problem Statement

Visually impaired users often face challenges navigating and understanding their surroundings due to a heavy reliance on visual cues in traditional interfaces. The lack of real-time, accessible environmental feedback creates significant barriers in everyday life and can lead to reduced independence.

### Proposed Solution

TAVI addresses these challenges by providing a robust, multimodal system that transforms environmental data into accessible formats. The solution includes:

- **Real-Time Audio & Video Processing:**  
  The system continuously listens for wake words, allowing users to initiate interactions without manual input.

- **Speech-to-Text and Intent Recognition:**  
  Audio is converted to text using Whisper, then analyzed for intent. Depending on the intent, the system may trigger video capture or generate an immediate answer.

- **Cloud-Powered Video Processing:**  
  Video data is processed by extracting frames and obtaining image captions using Hugging Face’s Inference API, along with OCR extraction. These outputs are aggregated and summarized using a ChatGroq LLM to provide clear, contextual feedback, which is then converted to speech.

- **Accessible Chat UI:**  
  All interactions are presented through a continuously updating, scrolling chat interface that displays text, audio, and video media, ensuring that users receive comprehensive, multi-sensory feedback.

### Technical Implementation

- **Video Processing:**  
  - **Frame Extraction:** The video is segmented into individual frames via OpenCV.
  - **Captioning:** Each frame is sent to the Hugging Face Inference API for image captioning (using the BLIP model), reducing local computational load.
  - **OCR and Summarization:** Additional text is extracted using Mistral OCR, then all extracted data is aggregated and sent to a ChatGroq-based LLM to generate a final environmental summary.
  - **Conversion to Audio:** The summary is converted to speech using pyttsx3.

- **Intent Recognition in Audio Processing:**  
  - **STT Conversion:** User speech is transcribed with Whisper.
  - **Intent Classification:** The transcription is analyzed using an OpenAI model to determine the user’s intent, optionally enhanced with context from the latest video summary if available.
  - **Conditional Workflow:**  
    - **Record Intent:** Launches video capture, sends video to the backend, displays the video and summary in the chat UI.
    - **General/Fallback/Tavi Intents:** Generates textual and audio responses accordingly.

## File Structure

```
TAVI/
├── venv/                 # Virtual environment directory
├── app.py                # FastAPI backend
├── processing.py         # Video processing functions and related logic
├── .env                  # Environment variables file (contains API keys, BACKEND_URL, etc.)
├── requirements.txt      # Required Python packages
└── frontend/
    ├── main.py           # Kivy mobile app (frontend UI, wake-word and media capture)
    ├── config.py         # Configuration file for frontend (e.g., BACKEND_URL, PORCUPINE_KEY)
    └── chat.kv           # (Optional) Kivy language file for chat UI layout
```

## Connecting Backend and Frontend

- **API Communication:**  
  The backend exposes endpoints (e.g., `/process_audio/` and `/process_video/`) via FastAPI. The frontend (Kivy app) sends HTTP requests to these endpoints using the `requests` library.
  
- **URL Construction:**  
  The frontend uses the `BACKEND_URL` defined in `config.py` (loaded from the `.env` file) to construct full URLs for audio and video media (e.g., `http://127.0.0.1:8000/download_audio/filename.mp3`).

- **Data Flow:**  
  Upon detecting a wake word and recording audio, the Kivy app sends data to the backend, parses the response (which includes intent, text response, and relative media URLs), and updates the chat UI accordingly.

## License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.
```

