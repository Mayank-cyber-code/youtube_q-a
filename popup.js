const BACKEND_API_URL = "https://httpbin.org/post"; // <-- For testing, replace with your backend endpoint

function getCurrentTabUrl(cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    cb(tabs && tabs.length > 0 ? tabs[0] : null);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("ask_btn").disabled = true;

  getCurrentTabUrl(tab => {
    if (!tab || !tab.url.startsWith("https://www.youtube.com/watch")) {
      document.getElementById("result").textContent = "Open a YouTube video tab!";
      return;
    }
    chrome.tabs.sendMessage(
      tab.id,
      {action: "getTranscript"},
      function (response) {
        if(response && response.transcript && response.transcript.length > 10) {
          document.getElementById("transcript").value = response.transcript;
          document.getElementById("ask_btn").disabled = false;
          // Store the tab URL for queries!
          document.getElementById("ask_btn").dataset.videoUrl = tab.url;
        } else {
          document.getElementById("result").textContent = "Transcript not found for this video.";
        }
      }
    );
  });

  document.getElementById('ask_btn').addEventListener('click', async () => {
    const transcript = document.getElementById('transcript').value;
    const question = document.getElementById('question').value.trim();
    const video_url = document.getElementById('ask_btn').dataset.videoUrl || "";
    if (!transcript || transcript.length < 10) {
      document.getElementById('result').textContent = "Transcript not loaded or too short.";
      return;
    }
    if (!question) {
      document.getElementById('result').textContent = "Please enter a question.";
      return;
    }
    document.getElementById('result').textContent = "Loading...";
    try {
      const res = await fetch(BACKEND_API_URL, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({transcript, question, video_url})
      });
      const data = await res.json();
      document.getElementById('result').textContent = (data.answer || data.data || data.error || "No answer.");
    } catch (e) {
      document.getElementById('result').textContent = "Network error: " + e;
    }
  });
});

