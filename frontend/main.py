# main.py
import os
import uuid
import threading
import time
import json
import requests
import wave
import numpy as np 
from kivy.clock import Clock
from kivy.app import App
from kivy.lang import Builder
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.label import Label
from kivy.uix.scrollview import ScrollView
from kivy.uix.image import Image
from kivy.core.audio import SoundLoader

import pyaudio
import pvporcupine

from config import BACKEND_URL, PORCUPINE_KEY

# KV string for a simple chat UI layout (or load from chat.kv)
KV = '''
<ChatScreen>:
    orientation: 'vertical'
    ScrollView:
        id: scroll_view
        do_scroll_x: False
        do_scroll_y: True
        BoxLayout:
            id: chat_box
            orientation: 'vertical'
            size_hint_y: None
            height: self.minimum_height
    Label:
        id: mic_indicator
        text: ''
        size_hint_y: None
        height: '40dp'
'''

Builder.load_string(KV)

class ChatScreen(BoxLayout):
    pass

class MyKivyApp(App):
    def build(self):
        self.chat_screen = ChatScreen()
        # Start wake word detection in a separate thread
        threading.Thread(target=self.wake_word_listener, daemon=True).start()
        return self.chat_screen

    def add_message(self, message, sender="system"):
        lbl = Label(text=f"[{sender}] {message}", markup=True, size_hint_y=None, height='30dp')
        self.chat_screen.ids.chat_box.add_widget(lbl)
        # Scroll to bottom:
        Clock.schedule_once(lambda dt: setattr(self.chat_screen.ids.scroll_view, 'scroll_y', 0))

    def wake_word_listener(self):
        """
        Use pvporcupine to listen for a wake word to start and a stop phrase to end recording.
        (For custom wake words like "Hello Assistant" and "I am done Assistant", custom keyword models are required.
        Here we use a built-in keyword "ok google" as a demo.)
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
            Clock.schedule_once(lambda dt: self.add_message("Listening for wake word...", sender="app"))
            while True:
                pcm = audio_stream.read(porcupine.frame_length)
                pcm = np.frombuffer(pcm, dtype=np.int16)  # Convert bytes to an array of int16
                result = porcupine.process(pcm)

                if result >= 0:
                    Clock.schedule_once(lambda dt: self.add_message("Wake word detected! Start recording...", sender="app"))
                    self.record_audio()
                time.sleep(0.01)
        except Exception as e:
            # Capture 'e' in lambda default argument to prevent NameError
            Clock.schedule_once(lambda dt, err=e: self.add_message(f"Error in wake word detection: {err}", sender="error"))

    def record_audio(self):
        """
        Records audio from the microphone until the stop phrase is detected.
        For simplicity, this simulation records for a fixed duration of 5 seconds.
        """
        CHUNK = 1024
        FORMAT = pyaudio.paInt16
        CHANNELS = 1
        RATE = 16000
        
        pa = pyaudio.PyAudio()
        stream = pa.open(format=FORMAT, channels=CHANNELS, rate=RATE, input=True, frames_per_buffer=CHUNK)
        
        frames = []
        Clock.schedule_once(lambda dt: self.add_message("Recording... (simulated for 5 seconds)", sender="app"))
        record_seconds = 5
        for i in range(0, int(RATE / CHUNK * record_seconds)):
            data = stream.read(CHUNK)
            frames.append(data)
        
        stream.stop_stream()
        stream.close()
        pa.terminate()
        
        # Save the recorded audio to a temporary file
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
        
        Clock.schedule_once(lambda dt: self.add_message("Recording complete. Sending audio to backend...", sender="app"))
        self.send_audio_to_backend(filename)
    
    def send_audio_to_backend(self, audio_filepath):
        """
        Posts the recorded audio file to the /process_audio/ endpoint and processes the response.
        """
        try:
            files = {'file': open(audio_filepath, 'rb')}
            url = f"{BACKEND_URL}/process_audio/"
            response = requests.post(url, files=files)
            if response.status_code == 200:
                data = response.json()
                self.process_audio_response(data)
            else:
                Clock.schedule_once(lambda dt, err=response.status_code: self.add_message(f"Backend error: {err}", sender="error"))
        except Exception as e:
            Clock.schedule_once(lambda dt, err=e: self.add_message(f"Error sending audio: {err}", sender="error"))
    
    def process_audio_response(self, data):
        """
        Processes the JSON response from the audio API.
        """
        data1 = data.get("data1", {})
        data2 = data.get("data2", "")
        data3 = data.get("data3", "")  # Relative URL (e.g., "/download_audio/filename.mp3")
        
        # Build full audio URL
        audio_url = f"{BACKEND_URL}{data3}"
        transcript = data.get("transcript", "")
        
        Clock.schedule_once(lambda dt: self.add_message(f"Transcript: {transcript}", sender="user"))
        Clock.schedule_once(lambda dt: self.add_message(f"Response: {data2}", sender="assistant"))
        
        if data1.get("Record"):
            Clock.schedule_once(lambda dt: self.add_message("Record intent detected. Launching video capture...", sender="app"))
            self.capture_video()
        else:
            Clock.schedule_once(lambda dt: self.add_message("Playing response audio...", sender="app"))
            self.play_audio(audio_url)
        
        Clock.schedule_once(lambda dt: self.add_message("Re-listening for wake word...", sender="app"))
    
    def play_audio(self, audio_url):
        """
        Loads and plays the audio from the given URL using Kivy's SoundLoader.
        """
        sound = SoundLoader.load(audio_url)
        if sound:
            sound.play()
        else:
            Clock.schedule_once(lambda dt: self.add_message("Failed to load audio.", sender="error"))
    
    def capture_video(self):
        """
        Simulates video capture and processing.
        In production, integrate with a camera API (e.g., Plyer) to record video and send it to the backend.
        """
        Clock.schedule_once(lambda dt: self.add_message("Video capture simulated: recording video...", sender="app"))
        import time
        time.sleep(3)
        Clock.schedule_once(lambda dt: self.add_message("Video recorded. Sending video to backend...", sender="app"))
        dummy_response = {
            "text_summary": "You are in a large room filled with a crowd...",
            "audio_file": "/download_audio/dummy_video.mp3"
        }
        Clock.schedule_once(lambda dt: self.add_message(f"Video summary: {dummy_response['text_summary']}", sender="assistant"))
        video_audio_url = f"{BACKEND_URL}{dummy_response['audio_file']}"
        self.play_audio(video_audio_url)
    
if __name__ == "__main__":
    MyKivyApp().run()
