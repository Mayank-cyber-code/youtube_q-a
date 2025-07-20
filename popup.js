const BACKEND_API_URL = "https://your-backend-domain.com/api/ask-transcript"; // Set to your backend endpoint

document.addEventListener("DOMContentLoaded", () => {
  let currentTranscript = "";
  document.getElementById("ask_btn").disabled = true;

  // Request content script for transcript
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.tabs.sendMessage(
      tabs[0].id,
      {action: "getTranscript"},
      function (response) {
        if(response && response.transcript) {
          document.getElementById("transcript").value = response.transcript;
          document.getElementById("ask_btn").disabled = false;
          currentTranscript = response.transcript;
        } else {
          document.getElementById("result").textContent = "Unable to fetch transcript on this video.";
        }
      }
    );
  });

  document.getElementById('ask_btn').addEventListener('click', async () => {
    const transcript = document.getElementById('transcript').value;
    const question = document.getElementById('question').value.trim();
    if (!transcript) {
      document.getElementById('result').textContent = "Transcript not loaded.";
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
        body: JSON.stringify({transcript, question})
      });
      const data = await res.json();
      document.getElementById('result').textContent = data.answer || data.error || "No answer.";
    } catch (e) {
      document.getElementById('result').textContent = "Network error: " + e;
    }
  });
});
