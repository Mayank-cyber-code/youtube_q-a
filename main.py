from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import os
from qa_engine import TranscriptQAModel

app = FastAPI()
qa = TranscriptQAModel()

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)

@app.post('/api/ask-transcript')
async def ask_transcript(request: Request):
    data = await request.json()
    transcript = data.get('transcript')
    question = data.get('question')
    if not transcript or not question:
        return {"error": "Missing transcript or question"}
    answer = qa.ask(transcript, question)
    return {"answer": answer}

