async function getTranscriptFromPage() {
  // Try several YouTube flavors for robustness
  let captionTracks = null;
  try {
    if (window.ytInitialPlayerResponse && window.ytInitialPlayerResponse.captions) {
      captionTracks = window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
    }
    // Fallback to older structure if necessary
    else if (window.ytplayer && window.ytplayer.config && window.ytplayer.config.args && window.ytplayer.config.args.player_response) {
      const response = JSON.parse(window.ytplayer.config.args.player_response);
      if (response.captions) {
        captionTracks = response.captions.playerCaptionsTracklistRenderer.captionTracks;
      }
    }
  } catch (e) { captionTracks = null; }

  if (!captionTracks || captionTracks.length === 0) return "";

  // Prefer English or first alternative
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

// Listen for popup requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getTranscript") {
    getTranscriptFromPage().then(transcript => {
      sendResponse({ transcript });
    });
    return true; // Allow sendResponse after async call
  }
});
