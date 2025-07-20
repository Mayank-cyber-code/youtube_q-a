from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
import os

app = FastAPI()

# Allow all origins for extension and browser access; restrict as needed!
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files under /static (so /static/frontend.html works)
static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Serve frontend.html at root "/"
@app.get("/")
async def root():
    return FileResponse(os.path.join(static_dir, "frontend.html"))

# Q&A API endpoint
@app.post("/api/ask-transcript")
async def ask_transcript(request: Request):
    # Parse JSON body (from extension)
    data = await request.json()
    transcript = data.get('transcript', "")
    video_url = data.get('video_url', "")
    question = data.get('question', "")

    # For real use: replace with your model's answer logic
    if not question or (not transcript and not video_url):
        return JSONResponse({"error": "Missing video_url and/or transcript/question."})

    # Put your YouTube Q&A logic here instead:
    answer = (
        f"[MOCK] You asked: '{question}'\n"
        f"Transcript length: {len(transcript)}\n"
        f"Video URL: {video_url}\n"
    )

    return {"answer": answer}
