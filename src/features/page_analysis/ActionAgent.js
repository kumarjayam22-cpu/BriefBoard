import { formatText } from '../../core/utils/utils.js';
import { geminiService } from '../../core/services/geminiService.js';
import { saveState } from '../../state/state.js';

export class ActionAgent {
    constructor(contextAgent) {
        this.name = 'ActionAgent';
        this.contextAgent = contextAgent;
    }

    /**
     * Executes a specific use case (action) like Summarize, ELI5, etc.
     * @param {Object} useCase - The use case configuration object.
     * @param {Function} onUpdate - Callback for streaming updates (receives formatted HTML).
     */
    async execute(useCase, onUpdate) {
        console.log(`ActionAgent: Executing ${useCase.label}`);

        try {
            const contextParams = await this.contextAgent.getContext();
            if (!contextParams) throw new Error("Could not read page content.");

            const prompt = useCase.prompt;
            const contents = [{ role: "user", parts: [{ text: prompt }] }];

            // Stream the result
            const result = await geminiService.streamGenerateContent({
                ...contextParams,
                contents: contents
            }, (currentText) => {
                if (onUpdate) onUpdate(formatText(currentText));
            });

            // Save the result and wait for it
            // If this is a summary action, it effectively becomes the shared summary context
            if (useCase.id === 'summary') {
                await saveState({ summary: result });
            } else {
                // For other actions, we might just save it as the last result or similar
                // But currently our state only has 'summary'. 
                // We'll save it to summary for now if it's the main view, 
                // or we could separate it. The current UI treats the result area as 'summary'.
                await saveState({ summary: result });
            }
            
            return result;

        } catch (error) {
            console.error("ActionAgent: Error executing use case:", error);
            throw error;
        }
    }

    /**
     * Retrieves the stored summary from the state without regenerating it.
     * This allows other agents to share this context.
     * @returns {Promise<string|null>} The stored summary or null.
     */
    async getStoredSummary() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return null;
        const tabKey = `state_${tab.id}`;

        return new Promise((resolve) => {
            chrome.storage.local.get([tabKey], (result) => {
                const state = result[tabKey] || {};
                resolve(state.summary || null);
            });
        });
    }
}