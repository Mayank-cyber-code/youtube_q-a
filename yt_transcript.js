// content.js

console.log("[Extension] Content script loaded.");

function waitForCaptions(attempts = 20) {
  return new Promise((resolve) => {
    function poll(count) {
      const c = window.ytInitialPlayerResponse && window.ytInitialPlayerResponse.captions;
      if (c && c.playerCaptionsTracklistRenderer && c.playerCaptionsTracklistRenderer.captionTracks) {
        console.log("[Extension] Captions found!");
        resolve(c.playerCaptionsTracklistRenderer.captionTracks);
      } else if (count < attempts) {
        setTimeout(() => poll(count + 1), 400);
      } else {
        console.warn("[Extension] Timed out waiting for captions.");
        resolve(null);
      }
    }
    poll(0);
  });
}

function fetchTranscriptWithXHR(url) {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xhr.responseText, "text/xml");
            const texts = xmlDoc.querySelectorAll("text");
            const transcript = Array.from(texts).map(node => node.textContent).join("\n").trim();
            resolve(transcript);
          } catch (e) {
            resolve("");
          }
        } else {
          resolve("");
        }
      }
    };
    xhr.onerror = function () {
      resolve("");
    };
    xhr.send();
  });
}

async function getTranscriptFromPage() {
  const captionTracks = await waitForCaptions();
  if (!captionTracks || captionTracks.length === 0) return "";

  // Prefer English track if available, otherwise first track.
  const preferred = captionTracks.find(t => t.languageCode && t.languageCode.startsWith("en")) || captionTracks[0];
  const url = preferred.baseUrl;
  if (!url) return "";

  // Fetch transcript XML using XMLHttpRequest because fetch() may fail from extension context
  return await fetchTranscriptWithXHR(url);
}

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getTranscript") {
    getTranscriptFromPage().then(transcript => {
      sendResponse({ transcript });
    });
    return true; // Indicates async response
  }
});

