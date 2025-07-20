// Inject a function to YouTube to grab the transcript using browser XHR or YouTube APIs
async function getTranscriptFromPage() {
    // Try YT's built-in "playerCaptionsTracklistRenderer"
    const ytcfg = window.ytInitialPlayerResponse || window.ytplayer && window.ytplayer.config && window.ytplayer.config.args && window.ytplayer.config.args.player_response;
    let captionTracks = null;
    try {
        if(window.ytInitialPlayerResponse && window.ytInitialPlayerResponse.captions) {
            captionTracks = window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
        }
    } catch (e) {}

    if (!captionTracks || captionTracks.length === 0) return "";

    // Prefer English or Auto captions
    const preferred = captionTracks.find(t => t.languageCode.startsWith("en")) || captionTracks[0];
    const url = preferred.baseUrl;

    // Download and parse .srv3 or .xml transcript
    try {
        const response = await fetch(url);
        const xml = await response.text();
        // Extract lines from the XML/SRV3 transcript
        // Works for both .srv3 (newline+text node) or classic .xml (plaintext in <text> tags)
        const lines = [];
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xml, "text/xml");
        const texts = xmlDoc.querySelectorAll("text");
        texts.forEach(node => lines.push(node.textContent));
        return lines.join("\n");
    } catch (e) {
        return "";
    }
}

// Listen for popup.js asking for the transcript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getTranscript") {
        getTranscriptFromPage().then(transcript => {
            sendResponse({transcript});
        });
        // Must return true to allow async sendResponse:
        return true;
    }
});
