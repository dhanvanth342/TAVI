import os
import cv2
import torch
import logging
import tempfile
from pathlib import Path
from dotenv import load_dotenv

from transformers import BlipProcessor, BlipForConditionalGeneration
from mistralai import Mistral  # Ensure this package is installed
import pyttsx3
import requests  # In case needed later; kept for debugging/logging purposes

from PIL import Image
from langchain_groq import ChatGroq  # New import for ChatGroq integration

# Load environment variables
load_dotenv()

# Set up logging; during development, use DEBUG level.
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Set device to CUDA if available
device = torch.device("cuda") if torch.cuda.is_available() else torch.device("cpu")


class SurroundingAwarenessProcessor:
    def __init__(self, sampling_rate: int = 20):
        """
        Initialize the required models and clients once.
        This includes:
          - BLIP (for image captioning / Q&A)
          - Mistral OCR client
          - TTS engine via pyttsx3
          - ChatGroq-based LLM client
        """
        self.sampling_rate = sampling_rate

        # Initialize BLIP for image captioning / Q&A
        try:
            logger.debug("Loading BLIP processor and model...")
            self.blip_processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
            self.blip_model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base").to(device)
            logger.debug("BLIP model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load BLIP model: {e}")
            raise

        # Initialize Mistral OCR client
        try:
            logger.debug("Initializing Mistral OCR client...")
            self.mistral_api_key = os.getenv('MISTRAL_API_KEY')
            if not self.mistral_api_key:
                raise ValueError("MISTRAL_API_KEY not found in environment variables.")
            self.mistral_client = Mistral(api_key=self.mistral_api_key)
            logger.debug("Mistral OCR client initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize Mistral client: {e}")
            raise

        # Initialize TTS Engine
        try:
            logger.debug("Initializing TTS engine...")
            self.tts_engine = pyttsx3.init()
            # Optional: adjust voice properties (rate, volume, etc.) here
            logger.debug("TTS engine initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize TTS engine: {e}")
            raise

        # Initialize ChatGroq for LLM summarization instead of using a REST endpoint
        try:
            logger.debug("Initializing ChatGroq LLM...")
            self.groq_api_key = os.getenv('GROQ_API_KEY')
            if not self.groq_api_key:
                raise ValueError("GROQ_API_KEY not found in environment variables.")
            self.llm = ChatGroq(
                temperature=0.2, 
                model_name="llama-3.3-70b-versatile",
                api_key=self.groq_api_key
            )
            logger.debug("ChatGroq LLM initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize ChatGroq LLM: {e}")
            raise

        # System prompt for LLM summarization
        self.system_prompt = """
        You are an AI assistant analyzing a video scene. 
        Generate a comprehensive surrounding awareness summary 
        based on the frame captions and OCR texts.
        Do not mention the OCR process or the video itself.
        Focus on the content of the frames and the context provided.
        The summary should not be in a single line, but rather in paragraph format.
        """
    
    def extract_frames(self, video_path: str) -> list:
        """
        Extract frames from the input video using OpenCV.
        Sampling strategy: select one frame every 'sampling_rate' frames.
        """
        frames = []
        try:
            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                logger.error("Error opening video file.")
                return frames  # Or raise an Exception if preferred

            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            logger.debug(f"Total frames in video: {total_frames}")
            current_frame = 0

            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                if current_frame % self.sampling_rate == 0:
                    frames.append(frame)
                    logger.debug(f"Extracted frame at index {current_frame}")
                current_frame += 1

            cap.release()
        except Exception as e:
            logger.error(f"Error during frame extraction: {e}")
        return frames

    def get_caption(self, image: Image.Image) -> str:
        """
        Use the BLIP model to answer a specific question about the image.
        The question is: "Give me information about the surroundings, objects and things present in this image".
        Token limits are set using max_length and min_length.
        """
        try:
            question = "Give me information about the surroundings, objects and things present in this image"
            # Prepare input: image with text prompt
            inputs = self.blip_processor(images=image, text=question, return_tensors="pt").to(device)
            output = self.blip_model.generate(**inputs, max_length=50, min_length=10)
            caption = self.blip_processor.decode(output[0], skip_special_tokens=True)
            logger.debug(f"BLIP output: {caption}")
            return caption
        except Exception as e:
            logger.error(f"Error in BLIP caption generation: {e}")
            return ""

    def get_ocr_text(self, frame: any) -> str:
        """
        Save the frame as a temporary file and run the Mistral OCR to extract text.
        Uses the 'process' method of the OCR interface with type "image_file".
        If the extraction fails or returns no text, the process continues.
        """
        ocr_text = ""
        temp_filename = None
        try:
            # Write frame to a temporary file
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                temp_filename = tmp.name
                cv2.imwrite(temp_filename, frame)
                logger.debug(f"Temporary frame file saved: {temp_filename}")
            
            # Open the file in binary mode for OCR processing
            with open(temp_filename, "rb") as image_file:
                ocr_response = self.mistral_client.ocr.process(
                    model="mistral-ocr-latest",
                    document={
                        "type": "image_file",
                        "image_file": image_file
                    }
                )
            
            # Assume the OCR response returns a dictionary with key "text"
            ocr_text = ocr_response.get("text", "")
            if not ocr_text:
                logger.debug("OCR returned empty text for this frame.")
            else:
                logger.debug(f"OCR result: {ocr_text}")
        except Exception as e:
            logger.error(f"Error in OCR processing: {e}")
        finally:
            if temp_filename and os.path.exists(temp_filename):
                try:
                    os.remove(temp_filename)
                    logger.debug(f"Temporary file removed: {temp_filename}")
                except Exception as e:
                    logger.warning(f"Could not remove temporary file: {e}")
        return ocr_text

    def process_video(self, video_path: str) -> dict:
        """
        Process the entire video:
          - Extract frames
          - For each sampled frame, generate a caption (via BLIP) and perform OCR (via Mistral OCR)
          - Aggregate the outputs into a single combined text for LLM summarization.
        Returns a dictionary with keys 'combined_text' and 'frame_details' for debugging.
        """
        combined_texts = []
        frame_details = []  # Holds per-frame details for debugging

        frames = self.extract_frames(video_path)
        if not frames:
            logger.error("No frames extracted from video.")
            return {"combined_text": "", "frame_details": frame_details}

        for idx, frame in enumerate(frames):
            try:
                # Convert OpenCV BGR image to PIL RGB image
                image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            except Exception as e:
                logger.error(f"Error converting frame {idx} to PIL image: {e}")
                continue

            caption = self.get_caption(image)
            ocr_text = self.get_ocr_text(frame)
            # Concatenate BLIP caption and OCR text for the current frame
            frame_text = f"Caption: {caption} | OCR: {ocr_text}"
            combined_texts.append(frame_text)
            frame_details.append({"frame_index": idx, "caption": caption, "ocr": ocr_text})
            logger.debug(f"Processed frame {idx}")

        all_text = "\n".join(combined_texts)
        return {"combined_text": all_text, "frame_details": frame_details}

    def generate_llm_summary(self, combined_text: str) -> str:
        """
        Generate a surrounding awareness summary using ChatGroq (LLM).
        The call includes the system prompt and the aggregated text.
        """
        try:
            # Call the ChatGroq client with the system prompt and the combined input text.
            response = self.llm({
                "system_prompt": self.system_prompt,
                "user_input": combined_text
            })
            # Assume the returned response is a dictionary containing the key 'summary'
            summary = response.get("summary", "")
            logger.debug(f"LLM summary: {summary}")
            return summary
        except Exception as e:
            logger.error(f"Error in LLM summarization: {e}")
            return ""

    def generate_audio(self, text: str, output_path: str = "output.mp3") -> bool:
        """
        Convert the LLM summary text into speech using pyttsx3 and save as an MP3 file.
        """
        try:
            self.tts_engine.save_to_file(text, output_path)
            self.tts_engine.runAndWait()
            logger.debug(f"Audio generated and saved to: {output_path}")
            return True
        except Exception as e:
            logger.error(f"Error generating audio: {e}")
            return False
