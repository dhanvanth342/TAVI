# frontend/main.py
import os
import uuid
import threading
import time
import json
import requests
import wave
import cv2  # For video recording
import numpy as np

from kivy.clock import Clock
from kivy.lang import Builder
from kivy.core.audio import SoundLoader
from kivy.core.window import Window  # Import Window for fallback width
from kivymd.app import MDApp

import pyaudio
import pvporcupine

from config import BACKEND_URL, PORCUPINE_KEY, AUDIO_FILES_DIR, DEFAULT_AUDIO_MAP

# Load the KV layout from chat.kv
KV = Builder.load_file("chat.kv")

class MyTaviApp(MDApp):
    def build(self):
        self.theme_cls.primary_palette = "DeepPurple"  # Uses a violet/blue theme
        self.theme_cls.primary_hue = "500"
        # Load the root widget from the KV file and assign it to self.root.
        self.root = Builder.load_file("chat.kv")
        return self.root

    def on_start(self):
        # Now that the root widget is available, assign self.chat_screen.
        self.chat_screen = self.root
        # Start the wake word listener thread after the UI is fully built.
        threading.Thread(target=self.wake_word_listener, daemon=True).start()
        # Schedule the welcome message and corresponding audio after a slight delay.
        welcome_text = ("Welcome to TAVI, a hands-free platform that lets you engage with your surroundings and ask anything, "
                        "with Jarvis as your intelligent assistant.\nJust say 'Jarvis' to get started.")
        Clock.schedule_once(lambda dt: self.add_message(welcome_text, sender="system"), 0.5)
        # Play welcome audio
        welcome_audio = os.path.join(AUDIO_FILES_DIR, DEFAULT_AUDIO_MAP["welcome"])
        self.play_audio(welcome_audio)

    def add_message(self, message, sender="system"):
        from kivymd.uix.label import MDLabel
        # Use Window.width as a fallback if self.chat_screen.width is not set
        chat_width = (getattr(self.chat_screen, 'width', Window.width) or Window.width) * 0.95

        lbl = MDLabel(
            text=f"{message}",
            markup=True,
            size_hint_y=None,
            halign="left",
            text_size=(chat_width, None)
        )
        lbl.texture_update()
        lbl.height = lbl.texture_size[1] + 20
        self.chat_screen.ids.chat_box.add_widget(lbl)
        Clock.schedule_once(lambda dt: setattr(self.chat_screen.ids.scroll_view, 'scroll_y', 0))

        # For default messages, play corresponding audio if available.
        mapping = {
            "Jarvis_greeting": "jarvis_greeting",    # When Jarvis speaks
            "app": "get_started",
            "error": "jerror",
            "error_b": "berror",
            "Jarvis": "jarvis",
            "Jarvis_record": "jarvis_camera",
            "processing": "jarvis_processing",
            "Jarvis_response": "jarvis_response",
            "Jarvis_again": "jarvis_again",
            "Audio_error": "audio_error",
            "Camera_error": "camera_error",
            "Recording_video": "recording_video",
            "Video_processing": "video_processing",
            "Video_response": "video_response",
            "Video_error": "video_error",
            "Camera_recording_error": "camera_recording_error"
        }
        if sender in mapping:
            audio_file = os.path.join(AUDIO_FILES_DIR, DEFAULT_AUDIO_MAP[mapping[sender]])
            self.play_audio(audio_file)

    def wake_word_listener(self):
        """
        Listens for the wake word "Jarvis" using Porcupine and starts recording audio when detected.
        """
        try:
            porcupine = pvporcupine.create(access_key=PORCUPINE_KEY, keywords=["jarvis"])
            pa = pyaudio.PyAudio()
            audio_stream = pa.open(
                rate=porcupine.sample_rate,
                channels=1,
                format=pyaudio.paInt16,
                input=True,
                frames_per_buffer=porcupine.frame_length
            )
            Clock.schedule_once(lambda dt: self.add_message("TAVI: Just say 'Jarvis' to get started.", sender="app"))
            while True:
                pcm = audio_stream.read(porcupine.frame_length)
                pcm = np.frombuffer(pcm, dtype=np.int16)
                result = porcupine.process(pcm)
                if result >= 0:
                    Clock.schedule_once(lambda dt: self.add_message("Jarvis: Hello! This is Jarvis. How can I make your day easier?", sender="Jarvis_greeting"))
                    time.sleep(3)  # Delay to ensure the greeting audio is finished.
                    self.record_audio()
                time.sleep(0.01)
        except Exception as e:
            Clock.schedule_once(lambda dt, err=e: self.add_message(f"App: Error in calling up 'Jarvis': {err}", sender="error"))

    def record_audio(self):
        """
        Records audio from the microphone (simulated for 5 seconds) and sends it to the backend.
        """
        CHUNK = 1024
        FORMAT = pyaudio.paInt16
        CHANNELS = 1
        RATE = 16000
        
        pa = pyaudio.PyAudio()
        stream = pa.open(format=FORMAT, channels=CHANNELS, rate=RATE, input=True, frames_per_buffer=CHUNK)
        frames = []
        Clock.schedule_once(lambda dt: self.add_message("Jarvis: You've got my attention. I'm listening to you now.", sender="Jarvis"))
        record_seconds = 5
        for i in range(0, int(RATE / CHUNK * record_seconds)):
            data = stream.read(CHUNK)
            frames.append(data)
        stream.stop_stream()
        stream.close()
        pa.terminate()
        
        temp_dir = "temp_uploads"
        if not os.path.exists(temp_dir):
            os.makedirs(temp_dir)
        filename = os.path.join(temp_dir, f"{uuid.uuid4()}_input.wav")
        wf = wave.open(filename, 'wb')
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(pa.get_sample_size(FORMAT))
        wf.setframerate(RATE)
        wf.writeframes(b''.join(frames))
        wf.close()
        
        self.send_audio_to_backend(filename)
    
    def send_audio_to_backend(self, audio_filepath):
        """
        Posts the recorded audio file to the /process_audio/ endpoint.
        """
        try:
            files = {'file': open(audio_filepath, 'rb')}
            url = f"{BACKEND_URL}/process_audio/"
            response = requests.post(url, files=files)
            if response.status_code == 200:
                data = response.json()
                self.process_audio_response(data)
            else:
                Clock.schedule_once(lambda dt, err=response.status_code: self.add_message(f"Jarvis: Sorry, I’m having trouble processing your request at the moment. {err}", sender="error_b"))
        except Exception as e:
            Clock.schedule_once(lambda dt, err=e: self.add_message(f"Jarvis: Sorry, I’m having trouble processing your request at the moment: {err}", sender="error_b"))
    
    def process_audio_response(self, data):
        """
        Processes the JSON response from the audio API.
        """
        data1 = data.get("data1", {})
        data2 = data.get("data2", "")
        data3 = data.get("data3", "")
        audio_url = f"{BACKEND_URL}{data3}"
        transcript = data.get("transcript", "")
        
        Clock.schedule_once(lambda dt: self.add_message(f"User: {transcript}", sender="user"))
        Clock.schedule_once(lambda dt: self.add_message("Jarvis: Hang tight, I'm processing that for you!", sender="processing"))
        
        if data1.get("Record"):
            Clock.schedule_once(lambda dt: self.add_message("Jarvis: Got it! You’d like to start recording—camera’s coming on.", sender="Jarvis_record"))
            self.capture_video()
        else:
            Clock.schedule_once(lambda dt: self.add_message("Jarvis: Umm... here's what I know!", sender="Jarvis_response"))
            self.play_audio(audio_url)
            Clock.schedule_once(lambda dt: self.add_message(f"Jarvis: {data2}", sender="Jarvis_responding"))
        
        Clock.schedule_once(lambda dt: self.add_message("TAVI: Just say 'Jarvis' if you need my help again!", sender="Jarvis_again"))
    
    def play_audio(self, audio_path):
        """
        Loads and plays the audio using Kivy's SoundLoader.
        For static audio files, audio_path can be an absolute file path.
        """
        sound = SoundLoader.load(audio_path)
        if sound:
            sound.play()
        else:
            Clock.schedule_once(lambda dt: self.add_message("Jarvis: Failed to play the audio.", sender="Audio_error"))
    
    def capture_video(self):
        """
        Captures video for 5 seconds using the webcam (via OpenCV), sends it to the backend,
        and updates the chat UI with the video summary and plays the TTS audio.
        The recorded video is displayed in the UI using a Kivy Video widget.
        """
        try:
            cap = cv2.VideoCapture(0)
            if not cap.isOpened():
                Clock.schedule_once(lambda dt: self.add_message("Jarvis: Failed to access the camera.", sender="Camera_error"))
                return
            
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            temp_dir = "temp_uploads"
            if not os.path.exists(temp_dir):
                os.makedirs(temp_dir)
            video_filename = os.path.join(temp_dir, f"{uuid.uuid4()}_video.mp4")
            fps = 20.0
            frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            out = cv2.VideoWriter(video_filename, fourcc, fps, (frame_width, frame_height))
            
            Clock.schedule_once(lambda dt: self.add_message("Recording video (preview active)...", sender="Recording_video"))
            start_time = time.time()
            while time.time() - start_time < 5:
                ret, frame = cap.read()
                if ret:
                    out.write(frame)
                else:
                    break
            cap.release()
            out.release()
            
            Clock.schedule_once(lambda dt: self.add_message("Jarvis: Just a moment... I’m processing what’s around you.", sender="Video_processing"))
            
            files = {'file': open(video_filename, 'rb')}
            url = f"{BACKEND_URL}/process_video/"
            response = requests.post(url, files=files)
            if response.status_code == 200:
                video_data = response.json()
                text_summary = video_data.get("text_summary", "")
                video_audio_relative = video_data.get("audio_file", "")
                full_audio_url = f"{BACKEND_URL}{video_audio_relative}"
                Clock.schedule_once(lambda dt: self.add_message(f"Jarvis: Based on what I see, here's my take on what's around you: {text_summary}", sender="Video_response"))
                self.play_audio(full_audio_url)
                Clock.schedule_once(lambda dt: self.add_video(video_filename))
            else:
                Clock.schedule_once(lambda dt, err=response.status_code: self.add_message(f"Jarvis: Unable to process the video due to: {err}", sender="Video_error"))
        except Exception as e:
            Clock.schedule_once(lambda dt, err=e: self.add_message(f"Jarvis: Error during video capture: {err}", sender="Camera_recording_error"))
    
    def add_video(self, video_filepath):
        from kivymd.uix.boxlayout import MDBoxLayout
        from kivy.uix.video import Video
        video_widget = Video(source=video_filepath, state='play', options={'eos': 'loop'}, size_hint_y=None, height='200dp')
        self.root.ids.chat_box.add_widget(video_widget)
        Clock.schedule_once(lambda dt: self.add_message("Jarvis: Saving your video in our chat.", sender="app"))
    
if __name__ == "__main__":
    MyTaviApp().run()
