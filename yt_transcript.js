function waitForCaptions(attempts = 15) {
  return new Promise((resolve, reject) => {
    function poll(count) {
      const res = window.ytInitialPlayerResponse && window.ytInitialPlayerResponse.captions;
      if (res && res.playerCaptionsTracklistRenderer && res.playerCaptionsTracklistRenderer.captionTracks) {
        resolve(window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks);
      } else if (count < attempts) {
        setTimeout(() => poll(count + 1), 300);
      } else {
        resolve(null);
      }
    }
    poll(0);
  });
}

async function getTranscriptFromPage() {
  const captionTracks = await waitForCaptions();
  if (!captionTracks || captionTracks.length === 0) return "";
  const preferred = captionTracks.find(t => t.languageCode && t.languageCode.startsWith("en")) || captionTracks[0];
  const url = preferred.baseUrl;
  try {
    const response = await fetch(url);
    const xml = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, "text/xml");
    const texts = xmlDoc.querySelectorAll("text");
    return Array.from(texts).map(node => node.textContent).join("\n").trim();
  } catch (e) {
    return "";
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getTranscript") {
    getTranscriptFromPage().then(transcript => {
      sendResponse({ transcript });
    });
    return true; // Needed for async response
  }
});
