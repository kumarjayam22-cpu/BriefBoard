import { ContextAgent } from '../page_analysis/ContextAgent.js';
import { getYouTubeTranscript, getPageContent } from '../../content/content_script.js';
import { geminiService } from '../../core/services/geminiService.js';
import { saveState } from '../../state/state.js';

export class YouTubeContextAgent extends ContextAgent {
    constructor() {
        super();
        this.name = 'YouTubeContextAgent';
    }

    async getContext() {
        // 1. Check memory cache
        if (this.memoryCache) return this.memoryCache;

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return null;
        
        // 2. Check storage cache (reuse logic from base if possible, but we need to check storage manually here to be safe)
        const storageKey = `state_${tab.id}`;
        const cachedState = await new Promise(resolve => chrome.storage.local.get([storageKey], res => resolve(res[storageKey] || {})));
        
        if (cachedState.cachedContentName) {
             const params = { cachedContent: cachedState.cachedContentName };
             this.memoryCache = params;
             return params;
        }

        // 3. Try to get Transcript
        console.log("YouTubeContextAgent: Attempting to fetch transcript...");
        const transcript = await getYouTubeTranscript();

        let contentText = "";
        
        if (transcript) {
            console.log("YouTubeContextAgent: Transcript found!");
            contentText = `[YouTube Video Transcript]\n\n${transcript}`;
        } else {
            console.log("YouTubeContextAgent: Transcript not found, falling back to page text.");
            const pageContent = await getPageContent();
            if (pageContent) {
                 // If pageContent is object (from our content script), extract content
                 contentText = typeof pageContent === 'object' ? pageContent.content : pageContent;
            }
        }

        if (!contentText) return null;

        // Prepare context
        const fullContent = `Page Title: ${tab.title || 'YouTube Video'}\n\n${contentText}`;
        const truncatedContent = fullContent.substring(0, 800000);
        
        try {
            const contextParams = await geminiService.prepareContext(truncatedContent);
            if (contextParams.cachedContent) {
                await saveState({ cachedContentName: contextParams.cachedContent });
            }
            this.memoryCache = contextParams;
            return contextParams;
        } catch (e) {
            console.error("YouTubeContextAgent: Error preparing context", e);
            return null;
        }
    }
}