import { formatText } from '../../core/utils/utils.js';
import { geminiService } from '../../core/services/geminiService.js';
import { saveState } from '../../state/state.js';
import { PROMPTS } from '../../core/config/prompts.js';

export class ChatAgent {
    constructor(contextAgent, noteAgent) {
        this.name = 'ChatAgent';
        this.contextAgent = contextAgent;
        this.noteAgent = noteAgent;
    }

    /**
     * Handles a user chat message.
     * @param {string} message - The user's message.
     * @param {Function} onUpdate - Callback for streaming text updates.
     * @param {Function} onAction - Callback for side effects (highlighting, etc.).
     * @param {Object|Promise<Object>} injectedContext - Shared context from other agents (e.g., summary).
     * @returns {Promise<string>} - The final AI response.
     */
    async chat(message, onUpdate, onAction, injectedContext = {}) {
        console.log("ChatAgent: Processing message...");

        try {
            // 1. Start fetching Context and History in parallel
            const contextPromise = this.contextAgent.getContext();
            
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const storageKey = `state_${tab.id}`;
            
            const historyPromise = new Promise(resolve => {
                chrome.storage.local.get([storageKey], (result) => {
                    const state = result[storageKey] || {};
                    resolve({
                        chat: state.chat || []
                    });
                });
            });

            // 2. Wait for core dependencies
            // We also resolve injectedContext if it's a promise
            const [contextParams, history, resolvedInjectedContext] = await Promise.all([
                contextPromise, 
                historyPromise,
                Promise.resolve(injectedContext)
            ]);

            if (!contextParams) throw new Error("Could not read page content.");

            const contents = [];

            // Inject Shared Summary Context if provided
            if (resolvedInjectedContext && resolvedInjectedContext.summary) {
                console.log("ChatAgent: Injecting shared summary context.");
                contents.push({ role: "user", parts: [{ text: PROMPTS.SUMMARY_INJECTION_USER }] });
                contents.push({ role: "model", parts: [{ text: resolvedInjectedContext.summary }] });
            }

            // Append History
            history.chat.forEach(msg => {
                const role = msg.sender === 'user' ? 'user' : 'model';
                contents.push({ role: role, parts: [{ text: msg.text }] });
            });

            // Append Current Message
            contents.push({ role: "user", parts: [{ text: message }] });

            // 3. Call Gemini API
            let noteProcessed = false;

            const response = await geminiService.streamGenerateContent({
                ...contextParams,
                contents: contents,
                maxTokens: 2000
            }, (currentText) => {
                // Check for highlight tag
                const highlightMatch = currentText.match(/@@HIGHLIGHT:\s*(.*?)@@/);
                if (highlightMatch) {
                    const textToHighlight = highlightMatch[1];
                    const cleanText = currentText.replace(/@@HIGHLIGHT:.*?@@/, '');
                    
                    if (onUpdate) onUpdate(formatText(cleanText));
                    
                    // Delegate to ContextAgent via callback
                    this.contextAgent.highlight(textToHighlight);
                    if (onAction) onAction({ type: 'highlight', text: textToHighlight });
                } 
                // Check for note tag
                else {
                    const noteMatch = currentText.match(/@@NOTE:\s*([\s\S]*?)@@/);
                    if (noteMatch) {
                        const noteContent = noteMatch[1].trim();
                        const cleanText = currentText.replace(/@@NOTE:[\s\S]*?@@/, '');
                        
                        if (onUpdate) onUpdate(formatText(cleanText));

                        if (!noteProcessed && noteContent.length > 0) {
                            noteProcessed = true;
                            // Ensure note is saved before triggering UI update
                            saveState({ note: noteContent }).then(() => {
                                if (onAction) onAction({ type: 'note_saved', content: noteContent });
                            });
                        }
                    } else {
                        if (onUpdate) onUpdate(formatText(currentText));
                    }
                }
            });

            // 4. Save AI Response
            await saveState({ chatMessage: { sender: 'ai', text: response } });
            
            return response;

        } catch (error) {
            console.error("ChatAgent: Error during chat:", error);
            throw error;
        }
    }
}