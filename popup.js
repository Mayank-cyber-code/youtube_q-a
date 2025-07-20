const BACKEND_API_URL = "https://youtube-q-a.onrender.com/api/ask-transcript";

// Utility to get the currently focused YouTube tab
function getCurrentYouTubeTab(cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs && tabs.length > 0 && tabs[0].url.startsWith("https://www.youtube.com/watch")) {
      cb(tabs[0]);
    } else {
      cb(null);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("ask_btn");
  const transcriptField = document.getElementById("transcript");
  const resultField = document.getElementById("result");
  btn.disabled = true;

  getCurrentYouTubeTab(tab => {
    if (!tab) {
      resultField.textContent = "Please open a YouTube video tab.";
      return;
    }

    // Fetch transcript from yt_transcript.js content script in that tab
    chrome.tabs.sendMessage(
      tab.id,
      { action: "getTranscript" },
      function (response) {
        if (chrome.runtime.lastError) {
          resultField.textContent = "Failed to access YouTube tab content.";
          return;
        }
        if (response && response.transcript && response.transcript.length > 10) {
          transcriptField.value = response.transcript;
          btn.disabled = false;
          btn.dataset.videoUrl = tab.url;
        } else {
          transcriptField.value = "";
          resultField.textContent = "No transcript found for this video.";
          btn.disabled = true;
        }
      }
    );
  });

  btn.addEventListener('click', async () => {
    const transcript = transcriptField.value;
    const question = document.getElementById('question').value.trim();
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
});
