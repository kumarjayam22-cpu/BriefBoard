// Functions to interact with the page content

export async function getPageContent() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return null;
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        // Helper to safely get text
        const getSafeText = () => {
            return document.body ? document.body.innerText : "";
        };

        // 1. Check for user selection first
        const selection = window.getSelection().toString().trim();
        if (selection) {
            return { type: 'selection', content: selection };
        }

        // 2. Check if YouTube video
        if (window.location.hostname.includes('youtube.com') && window.location.pathname.includes('/watch')) {
            const title = document.title;
            const bodyText = getSafeText().substring(0, 500000); // Truncate to avoid serialization limits
            return { type: 'youtube', content: `[YouTube Video Title: ${title}] \n\n(Note: Using page text.)\n\n` + bodyText };
        }

        // 3. Default: Full Page Text
        // Truncate to ~500k chars to ensure we don't hit Chrome's message passing limits
        const fullText = getSafeText();
        return { type: 'page', content: fullText.substring(0, 500000) };
      }
    });
    
    if (result && result[0] && result[0].result) {
        return result[0].result;
    }
    return null;
  } catch (e) {
    console.error("Failed to get page content:", e);
    return null;
  }
}

export async function toggleDarkMode() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    
    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
            const id = 'briefboard-dark-mode';
            const existing = document.getElementById(id);
            if (existing) {
                existing.remove();
            } else {
                const style = document.createElement('style');
                style.id = id;
                style.textContent = `
                    html { filter: invert(1) hue-rotate(180deg) !important; }
                    img, video, iframe { filter: invert(1) hue-rotate(180deg) !important; }
                `;
                document.head.appendChild(style);
            }
        }
    });
}

export async function toggleReaderView() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
            const id = 'briefboard-reader-view';
            if (document.body.classList.contains(id)) {
                document.body.classList.remove(id);
                location.reload(); 
            } else {
                document.body.classList.add(id);
                
                const article = document.querySelector('article') || document.querySelector('main') || document.querySelector('.post-content') || document.body;
                
                const container = document.createElement('div');
                container.style.cssText = `
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: #fff; color: #333; z-index: 999999;
                    overflow-y: auto; padding: 40px; font-family: Georgia, serif;
                    font-size: 20px; line-height: 1.6;
                `;
                
                const contentClone = article.cloneNode(true);
                const toRemove = contentClone.querySelectorAll('script, style, nav, header, footer, aside, .ad, .advertisement');
                toRemove.forEach(el => el.remove());
                
                container.appendChild(contentClone);
                
                const closeBtn = document.createElement('button');
                closeBtn.innerText = "Close Reader View";
                closeBtn.style.cssText = "position: fixed; top: 10px; right: 10px; padding: 10px; background: #333; color: #fff; border: none; cursor: pointer;";
                closeBtn.onclick = () => location.reload();
                container.appendChild(closeBtn);
                
                document.body.appendChild(container);
            }
        }
    });
}

export async function highlightText(text) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        args: [text],
        function: (textToFind) => {
            // 1. Clean up previous highlights
            document.querySelectorAll('.briefboard-highlight').forEach(el => {
                const parent = el.parentNode;
                parent.replaceChild(document.createTextNode(el.textContent), el);
                parent.normalize();
            });

            if (!textToFind) return;

            // 2. Attempt to find the text
            // Reset selection
            window.getSelection().removeAllRanges();
            
            // window.find(string, caseSensitive, backwards, wrapAround, wholeWord, searchInFrames, showDialog)
            const found = window.find(textToFind, false, false, true, false, true, false);

            if (found) {
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    
                    // Create highlight element
                    const span = document.createElement('span');
                    span.className = 'briefboard-highlight';
                    span.style.backgroundColor = '#ffff00'; // Standard yellow highlight
                    span.style.color = '#000'; // Ensure text is visible
                    span.style.boxShadow = '0 0 4px rgba(255, 255, 0, 0.8)';
                    span.style.borderRadius = '2px';
                    
                    try {
                        range.surroundContents(span);
                        
                        // Scroll into view
                        span.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    } catch (e) {
                        // surroundContents fails if the range partially selects a non-text node
                        // Fallback: just keep the selection active and scroll to it
                        console.warn("BriefBoard: Could not wrap text (complex range), keeping selection.", e);
                        const anchor = selection.anchorNode.parentElement;
                        if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            } else {
                console.log("BriefBoard: Text not found on page:", textToFind);
            }
        }
    });
}

export async function getYouTubeTranscript() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return null;

    try {
        const result = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: async () => {
                try {
                    // 1. Check ytInitialPlayerResponse
                    let playerResponse = window.ytInitialPlayerResponse;
                    
                    // If not found, try to extract from script tag
                    if (!playerResponse) {
                        const scripts = document.querySelectorAll('script');
                        for (const script of scripts) {
                            if (script.textContent.includes('var ytInitialPlayerResponse =')) {
                                const match = script.textContent.match(/var ytInitialPlayerResponse = ({.*?});/);
                                if (match) {
                                    try {
                                        playerResponse = JSON.parse(match[1]);
                                    } catch(e) {}
                                    break;
                                }
                            }
                        }
                    }

                    if (!playerResponse) return null;

                    const tracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;
                    if (!tracks || tracks.length === 0) return null;

                    // Prefer English
                    const track = tracks.find(t => t.languageCode === 'en') || tracks[0];
                    const trackUrl = track.baseUrl;

                    // Fetch the transcript XML
                    const response = await fetch(trackUrl);
                    const text = await response.text();
                    
                    // Parse XML to text
                    // Simple regex to extract text content from <text> tags
                    const cleanText = text.replace(/<text[^>]*>/g, ' ')
                                          .replace(/<\/text>/g, '\n')
                                          .replace(/&amp;#39;/g, "'")
                                          .replace(/&amp;quot;/g, '"')
                                          .replace(/<[^>]+>/g, '') // Remove other tags
                                          .replace(/\s+/g, ' ') // Normalize whitespace
                                          .trim();
                    
                    return cleanText;

                } catch (e) {
                    console.error("BriefBoard: Error extracting transcript", e);
                    return null;
                }
            }
        });

        if (result && result[0] && result[0].result) {
            return result[0].result;
        }
        return null;
    } catch (e) {
        console.error("BriefBoard: Failed to execute transcript script", e);
        return null;
    }
}