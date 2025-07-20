async function getTranscriptFromPage() {
  let captionTracks = null;
  try {
    // Try new YouTube page data structure for captions
    if (window.ytInitialPlayerResponse && window.ytInitialPlayerResponse.captions) {
      captionTracks = window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
    }
  } catch (e) {}
  if (!captionTracks || captionTracks.length === 0) return "";
  // Prefer English if available
  const preferred = captionTracks.find(t => t.languageCode && t.languageCode.startsWith("en")) || captionTracks[0];
  const url = preferred.baseUrl;
  try {
    const response = await fetch(url);
    const xml = await response.text();
    const lines = [];
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, "text/xml");
    const texts = xmlDoc.querySelectorAll("text");
    texts.forEach(node => lines.push(node.textContent));
    return lines.join("\n").trim();
  } catch (e) {
    return "";
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getTranscript") {
    getTranscriptFromPage().then(transcript => {
      sendResponse({transcript});
    });
    return true; // Needed for async sendResponse
  }
});
