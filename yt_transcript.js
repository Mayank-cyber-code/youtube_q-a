console.log("[Extension] Content script loaded.");

function waitForCaptions(attempts = 15) {
  return new Promise((resolve) => {
    function poll(count) {
      const captions = window.ytInitialPlayerResponse && window.ytInitialPlayerResponse.captions;
      if (captions && captions.playerCaptionsTracklistRenderer && captions.playerCaptionsTracklistRenderer.captionTracks) {
        console.log("[Extension] Captions found!");
        resolve(captions.playerCaptionsTracklistRenderer.captionTracks);
      } else if (count < attempts) {
        setTimeout(() => poll(count + 1), 300);
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
            console.log("[Extension] Transcript fetched, length:", transcript.length);
            resolve(transcript);
          } catch (e) {
            console.error("[Extension] XML parse error:", e);
            resolve("");
          }
        } else {
          console.warn("[Extension] XHR failed with status:", xhr.status);
          resolve("");
        }
      }
    };
    xhr.onerror = function () {
      console.error("[Extension] XHR network error.");
      resolve("");
    };
    xhr.send();
  });
}

async function getTranscriptFromPage() {
  console.log("[Extension] getTranscriptFromPage called");
  const captionTracks = await waitForCaptions();
  if (!captionTracks || captionTracks.length === 0) {
    console.warn("[Extension] No captionTracks found on this video.");
    return "";
  }
  const preferred = captionTracks.find(t => t.languageCode && t.languageCode.startsWith("en")) || captionTracks[0];
  console.log("[Extension] Using caption track:", preferred);
  const url = preferred.baseUrl;
  console.log("[Extension] Transcript URL to fetch:", url);
  if (!url) {
    console.warn("[Extension] Caption track has no baseUrl.");
    return "";
  }
  try {
    // Use XMLHttpRequest instead of fetch due to CORS/isolation issues
    const transcript = await fetchTranscriptWithXHR(url);
    if (!transcript) {
      console.warn("[Extension] Empty transcript fetched.");
    }
    return transcript;
  } catch (e) {
    console.error("[Extension] Unexpected error:", e);
    return "";
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getTranscript") {
    getTranscriptFromPage().then(transcript => {
      sendResponse({ transcript });
    });
    // Return true to indicate async response
    return true;
  }
});
