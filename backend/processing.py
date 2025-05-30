import os
import cv2
import torch
import logging
import tempfile
from pathlib import Path
from dotenv import load_dotenv
import base64
from transformers import BlipProcessor, BlipForConditionalGeneration  # AutoProcessor, BlipForQuestionAnswering 
from mistralai import Mistral  # Ensure this package is installed
import pyttsx3
import requests  # In case needed later; kept for debugging/logging purposes
from openai import OpenAI
from PIL import Image
from langchain_groq import ChatGroq  # New import for ChatGroq integration

# Load environment variables
load_dotenv()

# Set up logging. Only errors and warnings will be printed; debug logs are commented out.
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

# Set device to CUDA if available
device = torch.device("cuda") if torch.cuda.is_available() else torch.device("cpu")


class SurroundingAwarenessProcessor:
    def __init__(self, sampling_rate: int = 40):
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
            # logger.debug("Loading BLIP processor and model...")
            self.blip_processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
            
            self.blip_model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base").to(device)
            # logger.debug("BLIP model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load BLIP model: {e}")
            raise

        # Initialize Mistral OCR client
        try:
            # logger.debug("Initializing Mistral OCR client...")
            self.mistral_api_key = os.getenv('MISTRAL_API_KEY')
            if not self.mistral_api_key:
                raise ValueError("MISTRAL_API_KEY not found in environment variables.")
            self.mistral_client = Mistral(api_key=self.mistral_api_key)
            # logger.debug("Mistral OCR client initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize Mistral client: {e}")
            raise

        # Initialize TTS Engine
        try:
            # logger.debug("Initializing TTS engine...")
            self.tts_engine = pyttsx3.init()
            # Optional: adjust voice properties (rate, volume, etc.) here
            # logger.debug("TTS engine initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize TTS engine: {e}")
            raise

        # Initialize ChatGroq for LLM summarization instead of using a REST endpoint
        try:
            # logger.debug("Initializing ChatGroq LLM...")
            self.groq_api_key = os.getenv('GROQ_API_KEY')
            if not self.groq_api_key:
                raise ValueError("GROQ_API_KEY not found in environment variables.")
            self.llm = ChatGroq(
                temperature=0.2, 
                model_name="llama-3.3-70b-versatile",
                api_key=self.groq_api_key
            )
            # logger.debug("ChatGroq LLM initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize ChatGroq LLM: {e}")
            raise

        
        # System prompt for LLM summarization (currently not used directly)
        # self.system_prompt = """ ... """

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
                return frames

            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            # logger.debug(f"Total frames in video: {total_frames}")
            current_frame = 0

            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                if current_frame % self.sampling_rate == 0:
                    frames.append(frame)
                    # logger.debug(f"Extracted frame at index {current_frame}")
                current_frame += 1

            cap.release()
        except Exception as e:
            logger.error(f"Error during frame extraction: {e}")
        return frames

    def get_caption(self, image: Image.Image) -> str:
        """
        Use the BLIP model to generate a caption for the image.
        """
        try:
            # Optionally, you could include a text prompt for Q&A here.
            inputs = self.blip_processor(images=image, return_tensors="pt").to(device)
            output = self.blip_model.generate(**inputs)
            caption = self.blip_processor.decode(output[0], skip_special_tokens=True)
            # logger.debug(f"BLIP output: {caption}")
            return caption
        except Exception as e:
            logger.error(f"Error in BLIP caption generation: {e}")
            return ""

    def get_ocr_text(self, frame: any) -> str:
        """
        Save the frame as a temporary file, encode it in base64, and perform OCR extraction
        using the Mistral OCR process.
        The image is sent as a data URI (base64 string) using "image_url" type.
        """
        ocr_text = ""
        temp_filename = None

        def encode_image(image_path):
            """Encode the image at the given path to a base64 string."""
            try:
                with open(image_path, "rb") as image_file:
                    return base64.b64encode(image_file.read()).decode('utf-8')
            except FileNotFoundError:
                logger.error(f"Error: The file {image_path} was not found.")
                return None
            except Exception as e:
                logger.error(f"Error encoding image: {e}")
                return None

        try:
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                temp_filename = tmp.name
                cv2.imwrite(temp_filename, frame)
                # logger.debug(f"Temporary frame file saved: {temp_filename}")

            base64_image = encode_image(temp_filename)
            if base64_image is None:
                logger.error("Failed to encode image to base64.")
                return ""

            ocr_response = self.mistral_client.ocr.process(
                model="mistral-ocr-latest",
                document={
                    "type": "image_url",
                    "image_url": f"data:image/jpeg;base64,{base64_image}"
                }
            )

            # Uncomment and adjust the following lines if the OCR response structure changes.
            # ocr_text = ocr_response.get("text", "")
            # if not ocr_text:
            #     logger.debug("OCR returned empty text for this frame.")
            # else:
            #     logger.debug(f"OCR result: {ocr_text}")
            ocr_text = ocr_response
        except Exception as e:
            logger.error(f"Error in OCR processing: {e}")
        finally:
            if temp_filename and os.path.exists(temp_filename):
                try:
                    os.remove(temp_filename)
                    # logger.debug(f"Temporary file removed: {temp_filename}")
                except Exception as e:
                    logger.warning(f"Could not remove temporary file: {e}")
        return ocr_text

    def process_video(self, video_path: str) -> dict:
        """
        Process the entire video:
          - Extract frames
          - Generate caption (via BLIP) and perform OCR (via Mistral OCR) for each sampled frame
          - Aggregate the outputs into combined text for summarization.
        Returns a dictionary with keys 'combined_text' and 'frame_details' for debugging.
        """
        combined_texts = []
        frame_details = []

        frames = self.extract_frames(video_path)
        if not frames:
            logger.error("No frames extracted from video.")
            return {"combined_text": "", "frame_details": frame_details}

        for idx, frame in enumerate(frames):
            try:
                image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            except Exception as e:
                logger.error(f"Error converting frame {idx} to PIL image: {e}")
                continue

            caption = self.get_caption(image)
            ocr_text = self.get_ocr_text(frame)
            frame_text = f"Caption: {caption} | OCR: {ocr_text}"
            combined_texts.append(frame_text)
            frame_details.append({"frame_index": idx, "caption": caption, "ocr": ocr_text})
            # logger.debug(f"Processed frame {idx}")

        all_text = "\n".join(combined_texts)
        return {"combined_text": all_text, "frame_details": frame_details}

    def generate_llm_summary(self, combined_text: str) -> str:
        """
        Generate a surrounding awareness summary using ChatGroq (LLM).
        """
        try:
            system_prompt = """
                You are a virtual AI assistant designed to help visually impaired individuals by enhancing their situational awareness. 
                Analyze the provided scene context, which includes descriptions of surroundings, objects, spatial layout, and other relevant elements derived from visual data.
                Generate a clear, coherent, and engaging single-paragraph summary in a natural, human-like tone. If any navigation instructions are present, 
                seamlessly incorporate them into the description. The summary should resemble a short narrative that vividly and accessibly communicates the environment, 
                without referencing how the information was obtained. Do not use any special characters, line breaks, or bullet points. 
                Ensure the output is exactly 100 to 150 words, with no preamble, greetings, or closing statements, only the summary.
            """
            messages = [
                ("system", system_prompt),
                ("human", f"{combined_text}")
            ]
            response = self.llm.invoke(messages)
            summary = response.content.strip()
            # logger.debug(f"LLM summary: {summary}")
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
            # logger.debug(f"Audio generated and saved to: {output_path}")
            return True
        except Exception as e:
            logger.error(f"Error generating audio: {e}")
            return False
        

# The below functions are to process 
