from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import os
from qa_engine import CombinedQAModel

app = FastAPI()
qa = CombinedQAModel()

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'], allow_methods=['*'], allow_headers=['*'],
)

@app.post('/api/ask-transcript')
async def ask_transcript(request: Request):
    data = await request.json()
    transcript = data.get('transcript', "")
    video_url = data.get('video_url', "")
    question = data.get('question')
    if not video_url or not question:
        return {"error": "Missing video_url or question."}
    answer = qa.ask(transcript, video_url, question)
    return {"answer": answer}

