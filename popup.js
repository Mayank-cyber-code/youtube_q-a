const BACKEND_API_URL = "https://youtube-q-a.onrender.com/api/ask-transcript"; // change to your actual API

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("ask_btn").disabled = true;

  // Request transcript from content script in YouTube tab
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.tabs.sendMessage(
      tabs[0].id,
      {action: "getTranscript"},
      function (response) {
        if(response && response.transcript) {
          document.getElementById("transcript").value = response.transcript;
          document.getElementById("ask_btn").disabled = false;
        } else {
          document.getElementById("result").textContent = "Unable to fetch transcript for this video.";
        }
      }
    );
  });

  document.getElementById('ask_btn').addEventListener('click', async () => {
    const transcript = document.getElementById('transcript').value;
    const question = document.getElementById('question').value.trim();
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
        body: JSON.stringify({transcript, question})
      });
      const data = await res.json();
      document.getElementById('result').textContent = data.answer || data.error || "No answer.";
    } catch (e) {
      document.getElementById('result').textContent = "Network error: " + e;
    }
  });
});
