import os
import re
import logging
from typing import Optional
from langchain_community.vectorstores import FAISS
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.chains import ConversationalRetrievalChain
from langchain.memory import ConversationBufferMemory
from langchain.schema import Document
import wikipedia
from pytube import YouTube
import requests
import html

OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
logging.basicConfig(level=logging.INFO, format='%(asctime)s | %(levelname)s | %(message)s')

VAGUE_PATTERNS = [
    "do not like", "i don't know", "i do not know", "not mentioned", "not provided", "not stated",
    "no idea", "no information", "no details", "insufficient information", "unclear", "unable to determine",
    "cannot determine", "can't say", "no context", "context not found", "the transcript does not",
    "sorry", "unfortunately"
]

def is_incomplete(text: str) -> bool:
    if not text or len(text.strip()) < 8:
        return True
    lowered = text.lower()
    for pat in VAGUE_PATTERNS:
        if pat in lowered:
            return True
    return False

def is_summary_question(question: str) -> bool:
    qs = question.lower()
    return (
        "what is this video about" in qs
        or "what is the topic" in qs
        or "main topic" in qs
        or "summarize" in qs
        or "summary" in qs
    )

def get_video_title_and_description(youtube_url: str) -> (Optional[str], Optional[str]):
    try:
        yt = YouTube(youtube_url)
        return yt.title, yt.description
    except Exception as e:
        try:
            r = requests.get(youtube_url)
            if r.status_code == 200:
                m = re.search(r'<title>(.*?) - YouTube</title>', r.text)
                title = html.unescape(m.group(1)).strip() if m else None
                desc = None
                m_desc = re.search(r'<meta name="description" content="(.*?)">', r.text)
                if m_desc:
                    desc = html.unescape(m_desc.group(1)).strip()
                return title, desc
        except Exception:
            return None, None
    return None, None

def wikipedia_search(query: str) -> Optional[str]:
    try:
        summary = wikipedia.summary(query, sentences=2)
        return f"According to Wikipedia:\n{summary}"
    except wikipedia.exceptions.DisambiguationError as e:
        try:
            return f"According to Wikipedia ({e.options[0]}):\n{wikipedia.summary(e.options[0], sentences=2)}"
        except Exception:
            return None
    except wikipedia.exceptions.PageError:
        return None
    except Exception:
        return None

def web_search_links(query: str) -> str:
    import urllib.parse
    q_url = urllib.parse.quote(query)
    return (
        "Sorry, no transcript or Wikipedia answer was found.\n"
        f"Try searching the web:\n- [Google](https://www.google.com/search?q={q_url})\n- [DuckDuckGo](https://duckduckgo.com/?q={q_url})"
    )

class CombinedQAModel:
    def __init__(self, model="gpt-3.5-turbo"):
        self.embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
        self.llm = ChatOpenAI(
            openai_api_key=OPENAI_API_KEY,
            model=model,
            temperature=0.3,
            max_tokens=512
        )

    def ask(self, transcript, video_url, question):
        # 1. Use transcript if available and has content
        if transcript and len(transcript.strip()) > 16 and not transcript.lower().startswith("no transcript"):
            docs = [Document(page_content=transcript)]
            splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
            splits = splitter.split_documents(docs)
            vdb = FAISS.from_documents(splits, self.embeddings)
            retriever = vdb.as_retriever()
            mem = ConversationBufferMemory(memory_key="chat_history", return_messages=True, output_key="answer")
            chain = ConversationalRetrievalChain.from_llm(
                llm=self.llm, retriever=retriever, memory=mem, return_source_documents=False
            )
            if is_summary_question(question):
                prompt = (
                    "Given the transcript, summarize the main topic/content of this video. "
                    "2-4 sentences in clear English. Do not speculate. Transcript: {context}"
                )
                answer = (chain.invoke({"question": prompt}) or {}).get("answer", "")
            else:
                answer = (chain.invoke({"question": question}) or {}).get("answer", "")
            if answer and not is_incomplete(answer):
                return answer

        # 2. If transcript is missing/incomplete, get title and description
        title, desc = get_video_title_and_description(video_url)
        fallback_text = " ".join(filter(None, [title, desc]))
        if fallback_text and len(fallback_text.strip()) > 8:
            # Use title/description for QA
            docs = [Document(page_content=fallback_text)]
            splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
            splits = splitter.split_documents(docs)
            vdb = FAISS.from_documents(splits, self.embeddings)
            retriever = vdb.as_retriever()
            mem = ConversationBufferMemory(memory_key="chat_history", return_messages=True, output_key="answer")
            chain = ConversationalRetrievalChain.from_llm(
                llm=self.llm, retriever=retriever, memory=mem, return_source_documents=False
            )
            if is_summary_question(question):
                prompt = (
                    "Given the video title/description, summarize the main topic/content of this video in 2-4 sentences. "
                    "Do not speculate. Content: {context}"
                )
                answer = (chain.invoke({"question": prompt}) or {}).get("answer", "")
            else:
                answer = (chain.invoke({"question": question}) or {}).get("answer", "")
            if answer and not is_incomplete(answer):
                return answer

            # Try Wikipedia with the title
            wiki_ans = wikipedia_search(title)
            if wiki_ans and not is_incomplete(wiki_ans):
                return wiki_ans
            # Try Wikipedia with description
            if desc:
                wiki_ans2 = wikipedia_search(desc)
                if wiki_ans2 and not is_incomplete(wiki_ans2):
                    return wiki_ans2

        # 3. As last fallback, try Wikipedia with the question
        wiki_ans = wikipedia_search(question)
        if wiki_ans and not is_incomplete(wiki_ans):
            return wiki_ans

        return web_search_links(question)

if __name__ == "__main__":
    print("Welcome to YouTube Q&A! Paste any public YouTube video URL.")
    qa = YouTubeConversationalQA()
    url = input("YouTube video URL: ")
    session = "user1"
    print("You can ask multiple questions about this video! (Press Enter on empty line to exit)\n")
    while True:
        q = input("Your question (or just Enter to exit): ")
        if not q.strip():
            break
        try:
            ans = qa.ask(url, q, session)
            print(f"\nAnswer: {ans}\n")
        except Exception as e:
            print(f"Error: {e}")
