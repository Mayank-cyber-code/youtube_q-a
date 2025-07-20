import os
import re
import logging
import random
from typing import List, Optional

from dotenv import load_dotenv

from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound
from langchain_community.vectorstores import FAISS
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_openai import ChatOpenAI
from langchain.chains import ConversationalRetrievalChain
from langchain.memory import ConversationBufferMemory
from langchain.schema import Document

import wikipedia  # pip install wikipedia

# --- SETUP API KEYS ---
load_dotenv()

# --- LOGGING ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s | %(levelname)s | %(message)s')
logger = logging.getLogger(__name__)

def extract_video_id(url: str) -> str:
    patterns = [
        r'(?:youtube\.com/(?:[^/]+/.+/|(?:v|e(?:mbed)?)/|.*[?&]v=)|youtu\.be/)([^"&?/\\s]{11})',
        r'youtube\.com/live/([^"&?/\\s]{11})',
        r'youtube\.com/shorts/([^"&?/\\s]{11})'
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            vid = match.group(1)
            if len(vid) == 11:
                return vid
    raise ValueError("No valid video ID found in URL")

def get_transcript_docs(video_id: str, prefer_languages=None) -> Optional[List[Document]]:
    if prefer_languages is None:
        prefer_languages = ["en", "en-US", "en-IN", "hi"]
    try_orders = [prefer_languages, []]
    for langs in try_orders:
        try:
            transcript = (YouTubeTranscriptApi.get_transcript(video_id, languages=langs)
                          if langs else YouTubeTranscriptApi.get_transcript(video_id))
            text = " ".join([d['text'] for d in transcript])
            logger.info(f"Transcript loaded for video {video_id} (languages={langs or 'any'})")
            return [Document(page_content=text)]
        except (NoTranscriptFound, TranscriptsDisabled):
            continue
        except Exception as e:
            logger.error(f"Error loading transcript: {e}")
    return None

def wikipedia_search(query: str) -> Optional[str]:
    """Try to answer a user's query using Wikipedia."""
    try:
        summary = wikipedia.summary(query, sentences=2)
        return f"According to Wikipedia:\n{summary}"
    except wikipedia.exceptions.DisambiguationError as e:
        try:
            sub_summary = wikipedia.summary(e.options[0], sentences=2)
            return f"According to Wikipedia ({e.options[0]}):\n{sub_summary}"
        except Exception:
            return None
    except wikipedia.exceptions.PageError:
        return None
    except Exception as ex:
        logger.error(f"Wikipedia search error: {ex}")
        return None

def web_search_links(query: str) -> str:
    import urllib.parse
    q_url = urllib.parse.quote(query)
    return (
        f"Sorry, I couldn't answer from the transcript or Wikipedia.\n"
        f"You can try searching the web:\n"
        f"- [Google](https://www.google.com/search?q={q_url})\n"
        f"- [DuckDuckGo](https://duckduckgo.com/?q={q_url})"
    )

def clean_for_wikipedia(query: str) -> str:
    """
    General extractor for Wikipedia topic: strips common question words, no special-casing.
    """
    query = query.strip()
    # Remove common question starters, e.g., "What is the capital of France?" -> "the capital of France"
    match = re.match(r"(who|what|when|where|why|how)\s+(is|are|was|were|do|does|did|has|have|can|could|should|would)?\s*(.*)", query, flags=re.IGNORECASE)
    if match:
        topic = match.group(3).strip(" .?")
        return topic
    return query

NO_CONTEXT_PHRASES = [
    "The provided context does not specify the reasons.",
    "The provided context doesn't explicitly explain why.",
    "It does not provide further details or explanations.",
    "It doesn't elaborate on the reasons.",
    "The provided context does not give any explanation.",
    "No clear explanation is provided in the given context.",
    "The reasons are not stated in the provided context.",
    "The transcript does not mention the reasons."
]

VAGUE_PATTERNS = [
    "the provided context does not",
    "do not like each other",
    "doesn't explicitly",
    "does not provide further",
    "it doesn't elaborate",
    "does not specify the reasons",
    "does not explicitly mention the reasons",
    "i don't know",
    "i do not know",
    "not mentioned",
    "not provided",
    "not stated",
    "no idea",
    "no information",
    "no details",
    "insufficient information",
    "unclear",
    "unable to determine",
    "cannot determine",
    "can't say",
    "no context",
    "context not found",
    "context does not",
    "the transcript does not",
    "sorry",
    "unfortunately"
]

class YouTubeConversationalQA:
    """
    Retrieval-augmented, chat-style Q&A for YouTube videos.
    Has conversation memory and Wikipedia+web fallback.
    """
    def __init__(self, model="meta-llama/llama-3-70b-instruct:nitro"):
        self.embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/paraphrase-MiniLM-L3-v2",
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True}
        )
        self.vectorstore_cache = {}
        self.llm = ChatOpenAI(
            openai_api_base="https://openrouter.ai/api/v1",
            openai_api_key=os.environ["OPENROUTER_API_KEY"],
            model=model,
            temperature=0.4,
            max_tokens=512,
        )
        self.convs = {}

    def build_chain(self, video_url: str, session_id: str = "default"):
        video_id = extract_video_id(video_url)
        if video_id not in self.vectorstore_cache:
            docs = get_transcript_docs(video_id)
            if not docs:
                raise RuntimeError("No transcript available for this video and answer may be wrong.")
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000, chunk_overlap=200, length_function=len,
                separators=["\n\n", "\n", ". ", " ", ""]
            )
            splits = splitter.split_documents(docs)
            vdb = FAISS.from_documents(splits, self.embeddings)
            self.vectorstore_cache[video_id] = vdb
        retriever = self.vectorstore_cache[video_id].as_retriever()
        if session_id not in self.convs:
            self.convs[session_id] = ConversationBufferMemory(
                memory_key="chat_history",
                return_messages=True,
                output_key="answer"
            )
        qa_chain = ConversationalRetrievalChain.from_llm(
            llm=self.llm,
            retriever=retriever,
            memory=self.convs[session_id],
            return_source_documents=False
        )
        return qa_chain

    def is_incomplete(self, text):
        if not text:
            return True
        lower = text.lower()
        for pat in VAGUE_PATTERNS:
            if pat in lower:
                return True
        # Optionally treat as incomplete if very short
        if len(text.strip()) < 48:
            return True
        return False

    def ask(self, video_url: str, question: str, session_id: str = "default") -> str:
        context_answer = None
        try:
            chain = self.build_chain(video_url, session_id)
            result = chain.invoke({"question": question})
            result_text = result.get("answer", "")
            context_answer = result_text.strip() if result_text else None
        except Exception as e:
            logger.error(f"Transcript-based QA failed: {e}")

        # Wikipedia fallback if context answer is missing or not detailed
        wiki_ans = None
        if context_answer is None or self.is_incomplete(context_answer):
            wiki_ans = wikipedia_search(question)
            # If Wikipedia answer is itself vague, try to clean the query and search again
            if wiki_ans:
                if self.is_incomplete(wiki_ans):
                    topic = clean_for_wikipedia(question)
                    if topic != question:
                        wiki_ans2 = wikipedia_search(topic)
                        if wiki_ans2 and not self.is_incomplete(wiki_ans2):
                            wiki_ans = wiki_ans2
            else:
                topic = clean_for_wikipedia(question)
                if topic != question:
                    wiki_ans = wikipedia_search(topic)

        if wiki_ans and (context_answer is None or self.is_incomplete(context_answer)):
            phrase = random.choice(NO_CONTEXT_PHRASES)
            context_msg = (context_answer + " ") if context_answer else (phrase + " ")
            return context_msg + wiki_ans

        if context_answer:
            return context_answer

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
