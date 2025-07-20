const BACKEND_API_URL = "https://youtube-q-a.onrender.com/api/ask-transcript";

// Fetch and display the transcript
document.getElementById('fetchBtn').addEventListener('click', function() {
  const transcriptElement = document.getElementById('transcript');
  const resultField = document.getElementById('result');
  transcriptElement.value = "Loading...";
  resultField.textContent = "";

  // Query YouTube tab for transcript
  chrome.tabs.query({active: true, lastFocusedWindow: true}, function(tabs) {
    const tab = tabs[0];
    if (!tab || !tab.url || !tab.url.startsWith("https://www.youtube.com/watch")) {
      transcriptElement.value = "";
      resultField.textContent = "Please open a YouTube video tab.";
      return;
    }
    chrome.tabs.sendMessage(tab.id, {action: "getTranscript"}, function(response) {
      if (chrome.runtime.lastError) {
        transcriptElement.value = "";
        resultField.textContent = "Failed to access YouTube tab content.";
        return;
      }
      if (response && response.transcript && response.transcript.length > 10) {
        transcriptElement.value = response.transcript;
        document.getElementById('ask_btn').disabled = false;
        document.getElementById('ask_btn').dataset.videoUrl = tab.url;
      } else {
        transcriptElement.value = "";
        resultField.textContent = "No transcript found for this video.";
        document.getElementById('ask_btn').disabled = true;
      }
    });
  });
});

// Ask question using backend API
document.getElementById('ask_btn').addEventListener('click', async function() {
  const transcript = document.getElementById('transcript').value;
  const question = document.getElementById('question').value.trim();
  const resultField = document.getElementById('result');
  const btn = document.getElementById('ask_btn');
  const video_url = btn.dataset.videoUrl || "";

  if (!transcript || transcript.length < 10) {
    resultField.textContent = "Transcript too short or missing.";
    return;
  }
  if (!question) {
    resultField.textContent = "Please enter your question.";
    return;
  }

  resultField.textContent = "Loading...";
  try {
    const res = await fetch(BACKEND_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript, question, video_url })
    });
    const data = await res.json();
    resultField.textContent = data.answer || data.error || "No answer.";
  } catch (e) {
    resultField.textContent = "Network error: " + e;
  }
});

// On popup load: disable "Ask" button initially
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById('ask_btn').disabled = true;
  document.getElementById('transcript').value = "";
  document.getElementById('result').textContent = "";
});
