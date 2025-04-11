import os
import shutil
import uuid
import logging

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

import asyncio

from processing import SurroundingAwarenessProcessor

# Set up logging for the API. Only errors will be printed.
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

app = FastAPI(title="Surrounding Awareness API")

# Allow CORS if needed for future integration.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update as per your security requirements
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the processor once.
processor = SurroundingAwarenessProcessor()

@app.post("/process_video/")
async def process_video(file: UploadFile = File(...)):
    """
    Accept a video file, process it through the pipeline,
    and return the generated text summary and audio file (MP3).
    """
    try:
        temp_dir = "temp_uploads"
        os.makedirs(temp_dir, exist_ok=True)
        file_id = str(uuid.uuid4())
        temp_file_path = os.path.join(temp_dir, f"{file_id}_{file.filename}")
        
        with open(temp_file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        # logger.debug(f"Video saved temporarily at: {temp_file_path}")
        
        loop = asyncio.get_event_loop()
        video_process_result = await loop.run_in_executor(None, processor.process_video, temp_file_path)
        combined_text = video_process_result.get("combined_text", "")
        
        if not combined_text:
            raise HTTPException(status_code=500, detail="Failed to extract content from video.")
        
        llm_summary = await loop.run_in_executor(None, processor.generate_llm_summary, combined_text)
        if not llm_summary:
            raise HTTPException(status_code=500, detail="LLM summarization failed.")
        
        audio_output_path = os.path.join(temp_dir, f"{file_id}_output.mp3")
        audio_success = await loop.run_in_executor(None, processor.generate_audio, llm_summary, audio_output_path)
        if not audio_success:
            raise HTTPException(status_code=500, detail="Audio generation failed.")
        
        response = {
            "text_summary": llm_summary,
            "audio_file": f"/download_audio/{file_id}_output.mp3"
        }
        return response
    except Exception as e:
        logger.error(f"Error in processing video API: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {e}")
    finally:
        try:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
                # logger.debug(f"Temporary video file removed: {temp_file_path}")
        except Exception as e:
            logger.warning(f"Error cleaning up temporary file: {e}")

@app.get("/download_audio/{audio_filename}")
async def download_audio(audio_filename: str):
    """
    Endpoint to download the generated audio file.
    """
    file_path = os.path.join("temp_uploads", audio_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(path=file_path, filename=audio_filename, media_type='audio/mpeg')
