from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],  # In prod, restrict as desired
    allow_methods=['*'],
    allow_headers=['*'],
)

@app.get("/")
def root():
    return {"status": "ok", "message": "Backend running."}

@app.post("/api/ask-transcript")
async def ask_transcript(request: Request):
    data = await request.json()
    transcript = data.get('transcript', "")
    video_url = data.get('video_url', "")
    question = data.get('question', "")
    # Dummy response while testing
    if not question or (not transcript and not video_url):
        return {"error": "Missing video_url and/or transcript/question."}
    # Here connect to your actual QA model logic!
    return {"answer": f"[MOCK] You asked: '{question}'\nTranscript length: {len(transcript)}\nVideo URL: {video_url}"}

