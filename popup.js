const BACKEND_API_URL = "https://youtube-q-a.onrender.com/api/ask";
 // <-- PUT YOUR DEPLOYED BACKEND URL HERE

document.addEventListener("DOMContentLoaded", function () {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
        const tab = tabs[0];
        if (tab && tab.url && tab.url.includes("youtube.com/watch")) {
            document.getElementById("video_url").value = tab.url;
        } else {
            document.getElementById("result").textContent = 'Please open a YouTube video page and reload the extension.';
            document.getElementById("ask_btn").disabled = true;
        }
    });

    document.getElementById('ask_btn').addEventListener('click', async () => {
        const video_url = document.getElementById('video_url').value;
        const question = document.getElementById('question').value.trim();

        if (!question) {
            document.getElementById('result').textContent = "Please enter a question.";
            return;
        }

        document.getElementById('result').textContent = 'Loading...';

        try {
            const res = await fetch(BACKEND_API_URL, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({video_url, question})
            });
            const data = await res.json();
            document.getElementById('result').textContent = data.answer;
        } catch (error) {
            document.getElementById('result').textContent = "Error: " + error;
        }
    });
});
