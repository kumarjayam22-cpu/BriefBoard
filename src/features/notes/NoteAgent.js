import { geminiService } from '../../core/services/geminiService.js';
import { saveState } from '../../state/state.js';
import { PROMPTS } from '../../core/config/prompts.js';

export class NoteAgent {
    constructor(contextAgent) {
        this.name = 'NoteAgent';
        this.contextAgent = contextAgent;
    }

    /**
     * Formats raw text into a structured note using the AI.
     * @param {string} text - The text to format.
     * @returns {Promise<string>} - The formatted note.
     */
    async processNote(text) {
        console.log("NoteAgent: Processing note...");
        
        try {
            const prompt = PROMPTS.NOTE_FORMAT_PROMPT + text;
            
            // We use the context agent to get context, as the note might depend on page content
            const contextParams = await this.contextAgent.getContext();
            
            const contents = [{ role: "user", parts: [{ text: prompt }] }];
            
            // We don't need streaming for this background task
            let formattedNote = await geminiService.streamGenerateContent({
                ...contextParams,
                contents: contents
            }, () => {}); 

            // Post-processing cleanup
            formattedNote = formattedNote
                .replace(/@@HIGHLIGHT:.*?@@/g, '') // Remove highlight tags
                .replace(/^Source Excerpt:\s*/i, '') // Remove "Source Excerpt:" prefix
                .trim();

            // Save the note and wait for it to complete
            await saveState({ note: formattedNote });
            
            return formattedNote;
        } catch (error) {
            console.error("NoteAgent: Failed to process note:", error);
            throw error;
        }
    }

    /**
     * Deletes a note at a specific index.
     * @param {number} index - The index of the note to delete.
     * @returns {Promise<Array>} - The updated list of notes.
     */
    async deleteNote(index) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return [];
        const tabKey = `state_${tab.id}`;
        
        return new Promise((resolve) => {
            chrome.storage.local.get([tabKey], (result) => {
                const state = result[tabKey] || {};
                const notes = state.notes || [];
                
                if (index >= 0 && index < notes.length) {
                    notes.splice(index, 1);
                    chrome.storage.local.set({ [tabKey]: { ...state, notes } }, () => {
                        resolve(notes);
                    });
                } else {
                    resolve(notes);
                }
            });
        });
    }

    /**
     * Clears all notes for the current page.
     * @returns {Promise<Array>} - An empty array.
     */
    async clearNotes() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return [];
        const tabKey = `state_${tab.id}`;
        
        return new Promise((resolve) => {
            chrome.storage.local.get([tabKey], (result) => {
                const state = result[tabKey] || {};
                chrome.storage.local.set({ [tabKey]: { ...state, notes: [] } }, () => {
                    resolve([]);
                });
            });
        });
    }
}