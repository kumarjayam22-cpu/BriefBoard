import { ContextAgent } from '../../features/page_analysis/ContextAgent.js';
import { YouTubeContextAgent } from '../../features/youtube/YouTubeContextAgent.js';
import { ActionAgent } from '../../features/page_analysis/ActionAgent.js';
import { ChatAgent } from '../../features/chat/ChatAgent.js';
import { NoteAgent } from '../../features/notes/NoteAgent.js';

export class MasterAgent {
    constructor() {
        console.log("MasterAgent: Initializing agents...");
        this.defaultContextAgent = new ContextAgent();
        this.youtubeContextAgent = new YouTubeContextAgent();
        
        // We pass 'this' as the context agent to others.
        // MasterAgent acts as a proxy/router for context operations.
        this.noteAgent = new NoteAgent(this);
        this.actionAgent = new ActionAgent(this);
        this.chatAgent = new ChatAgent(this, this.noteAgent);
    }

    /**
     * Router for getContext. Selects the appropriate agent based on the URL.
     */
    async getContext() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url && (tab.url.includes('youtube.com/watch') || tab.url.includes('youtu.be'))) {
            console.log("MasterAgent: Routing to YouTubeContextAgent");
            return this.youtubeContextAgent.getContext();
        }
        return this.defaultContextAgent.getContext();
    }

    /**
     * Router for highlight.
     */
    async highlight(text) {
        // Highlighting logic is currently generic in content_script.js
        return this.defaultContextAgent.highlight(text);
    }

    /**
     * Delegates an action request to the ActionAgent.
     */
    async executeAction(useCase, onUpdate) {
        return this.actionAgent.execute(useCase, onUpdate);
    }

    /**
     * Delegates a chat request to the ChatAgent.
     * Orchestrates context sharing from ActionAgent (summary).
     */
    async chat(message, onUpdate, onAction) {
        // 1. Retrieve shared context (summary) from ActionAgent
        const summaryPromise = this.actionAgent.getStoredSummary();
        
        // Map the summary string to the context object structure expected by ChatAgent
        const contextPromise = summaryPromise.then(summary => ({ summary }));
        
        // 2. Pass the promise to ChatAgent
        return this.chatAgent.chat(message, onUpdate, onAction, contextPromise);
    }

    /**
     * Delegates a note creation request to the NoteAgent.
     */
    async addNote(text) {
        return this.noteAgent.processNote(text);
    }

    /**
     * Delegates note deletion to the NoteAgent.
     */
    async deleteNote(index) {
        return this.noteAgent.deleteNote(index);
    }

    /**
     * Delegates clearing all notes to the NoteAgent.
     */
    async clearNotes() {
        return this.noteAgent.clearNotes();
    }
}