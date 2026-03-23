import { getPageContent, highlightText } from '../../content/content_script.js';
import { geminiService } from '../../core/services/geminiService.js';
import { saveState } from '../../state/state.js';

export class ContextAgent {
    constructor() {
        this.name = 'ContextAgent';
        this.memoryCache = null; // In-memory cache for the current session
    }

    /**
     * Retrieves the current page content and prepares the context for the AI.
     * Handles caching if the content is large.
     */
    async getContext() {
        // 1. Check in-memory cache first (fastest)
        if (this.memoryCache) {
            return this.memoryCache;
        }

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return null;

        const storageKey = `state_${tab.id}`;
        
        return new Promise((resolve) => {
            chrome.storage.local.get([storageKey], async (result) => {
                const state = result[storageKey] || {};
                
                // 2. Try to use existing cached context from storage
                if (state.cachedContentName) {
                    const params = { cachedContent: state.cachedContentName };
                    this.memoryCache = params; // Update memory cache
                    resolve(params);
                    return;
                }
                
                // 3. If no cache, fetch page content
                try {
                    const pageContent = await getPageContent();
                    if (!pageContent) {
                        resolve(null);
                        return;
                    }

                    // Handle different content types
                    let contentText = "";
                    if (typeof pageContent === 'object') {
                        if (pageContent.type === 'selection') {
                            contentText = `Selected Text:\n"${pageContent.content}"\n\n(Context: This is a specific selection from the page)`;
                        } else {
                            contentText = pageContent.content;
                        }
                    } else {
                        contentText = pageContent;
                    }

                    // Include Page Title
                    const fullContent = `Page Title: ${tab.title || 'Untitled Page'}\n\n${contentText}`;
                    
                    // Truncate to safe limit
                    const truncatedContent = fullContent.substring(0, 800000);
                    
                    // Prepare context (creates cache if content is large enough)
                    const contextParams = await geminiService.prepareContext(truncatedContent);
                    
                    // Save cache name if created
                    if (contextParams.cachedContent) {
                        await saveState({ cachedContentName: contextParams.cachedContent });
                    }
                    
                    this.memoryCache = contextParams; // Update memory cache
                    resolve(contextParams);
                } catch (e) {
                    console.error("ContextAgent: Error preparing context:", e);
                    resolve(null);
                }
            });
        });
    }

    /**
     * Highlights specific text on the page.
     */
    async highlight(text) {
        console.log(`ContextAgent: Highlighting text: "${text}"`);
        await highlightText(text);
    }
}