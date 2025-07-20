from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],    # In production, restrict this for security!
    allow_methods=["*"],
    allow_headers=["*"],
)

static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
async def root():
    return FileResponse(os.path.join(static_dir, "frontend.html"))

@app.post("/api/ask-transcript")
async def ask_transcript(request: Request):
    data = await request.json()
    transcript = data.get('transcript', "")
    video_url = data.get('video_url', "")
    question = data.get('question', "")
    if not question or (not transcript and not video_url):
        return JSONResponse({"error": "Missing video_url and/or transcript/question."})
    # Plug in your Q&A model here
    return {"answer": f"[MOCK] You asked: '{question}'\nTranscript length: {len(transcript)}\nVideo URL: {video_url}"}
