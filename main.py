from fastapi import FastAPI, Request
from qa_engine import YouTubeConversationalQA

app = FastAPI()
qa = YouTubeConversationalQA()  # initialize once at startup

@app.post('/api/ask')
async def ask(request: Request):
    data = await request.json()
    video_url = data['video_url']
    question = data['question']
    # Add session_id if needed, else default
    answer = qa.ask(video_url, question)
    return {"answer": answer}
