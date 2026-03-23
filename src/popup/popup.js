import { loadState, saveState } from '../state/state.js';
import { appendMessage, formatText } from '../core/utils/utils.js';
import { toggleDarkMode, toggleReaderView } from '../content/content_script.js'; // Keep UI toggles here for now
import { PROMPTS } from '../core/config/prompts.js';
import { CONFIG } from '../core/config/config.js';
import { elements, showActionsGrid, showResultArea, populateModelDropdown, populateUseCaseGrid, setupTabSwitching, renderNotes } from './ui.js';
import { setupSettingsListeners, applySettings } from './settings.js';
import { MasterAgent } from '../core/agents/MasterAgent.js';
import { getFriendlyErrorMessage } from '../core/utils/errorHandler.js';

// Initialize the Master Agent
const masterAgent = new MasterAgent();

document.addEventListener('DOMContentLoaded', initialize);

async function initialize() {
  // Populate Model Dropdown dynamically
  populateModelDropdown(CONFIG.MODELS);
  
  // Determine Context
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isYouTube = tab && tab.url && (tab.url.includes('youtube.com/watch') || tab.url.includes('youtu.be'));
  const context = isYouTube ? 'youtube' : 'page';
  
  // Populate Use Case Grid with Context
  populateUseCaseGrid(PROMPTS.USE_CASES, handleUseCaseClick, context);

  // Load saved state (summary, chat history, settings, and notes)
  loadState(elements.summaryText, elements.chatHistory, applySettings, renderNotes, handleAddToNote, handleDeleteNote);

  // Attach Event Listeners
  elements.backToActionsBtn.addEventListener('click', showActionsGrid);
  elements.copyResultBtn.addEventListener('click', handleCopyResult);
  
  elements.sendBtn.addEventListener('click', () => {
      startChatFlow();
      resetTextarea();
  });
  
  // Textarea Auto-Resize & Enter to Send
  elements.userInput.addEventListener('input', autoResizeTextarea);
  elements.userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        startChatFlow();
        resetTextarea();
    }
  });

  // Notes Listeners
  if(elements.clearNotesBtn) {
      elements.clearNotesBtn.addEventListener('click', handleClearNotes);
  }
  elements.downloadDocBtn.addEventListener('click', () => downloadNotes('doc'));
  elements.downloadPdfBtn.addEventListener('click', () => downloadNotes('pdf'));

  // Tab Switching Logic
  setupTabSwitching();

  // Settings Logic
  setupSettingsListeners();
}

function autoResizeTextarea() {
    const textarea = elements.userInput;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

function resetTextarea() {
    const textarea = elements.userInput;
    textarea.value = '';
    textarea.style.height = 'auto';
}

// --- Use Case Execution Flow ---

async function handleUseCaseClick(useCase) {
    if (useCase.type === 'action') {
        // Handle direct actions (non-AI)
        if (useCase.action === 'toggleDarkMode') {
            await toggleDarkMode();
            window.close(); // Close popup after action
        } else if (useCase.action === 'toggleReaderView') {
            await toggleReaderView();
            window.close();
        }
    } else {
        // Handle AI prompts via Agent
        executeUseCase(useCase);
    }
}

async function executeUseCase(useCase) {
  const { summaryText, summaryLoader } = elements;
  
  showResultArea(useCase.label);
  
  // UI Loading State
  summaryText.style.display = 'none';
  summaryLoader.style.display = 'block';
  summaryText.innerHTML = `<i>Generating ${useCase.label}...</i>`;

  try {
    // Delegate to Master Agent
    await masterAgent.executeAction(useCase, (htmlContent) => {
        summaryText.innerHTML = htmlContent;
    });
    
    // Done
    summaryLoader.style.display = 'none';
    summaryText.style.display = 'block';
    
  } catch (error) {
    summaryText.innerText = getFriendlyErrorMessage(error);
    summaryLoader.style.display = 'none';
    summaryText.style.display = 'block';
  }
}

// --- Chat Flow ---

async function startChatFlow() {
  const { userInput, chatHistory } = elements;
  const message = userInput.value.trim();
  if (!message) return;

  // UI: Show user message immediately
  appendMessage('user', message, chatHistory, true, saveState);
  // userInput.value = ''; // Handled by resetTextarea

  // UI: Placeholder for AI response
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('message', 'ai');
  
  // Avatar
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.innerHTML = '🤖';
  msgDiv.appendChild(avatar);

  // Wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'message-wrapper';
  msgDiv.appendChild(wrapper);
  
  // Create content container
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.innerHTML = "<i>Thinking...</i>";
  wrapper.appendChild(contentDiv);
  
  chatHistory.appendChild(msgDiv);
  chatHistory.scrollTop = chatHistory.scrollHeight;

  try {
    // Delegate to Master Agent
    const response = await masterAgent.chat(message, 
        (htmlContent) => {
            // Update UI with streaming content
            contentDiv.innerHTML = htmlContent;
            
            // Smart Scroll: Only scroll if user was already near bottom
            const isNearBottom = chatHistory.scrollHeight - chatHistory.scrollTop - chatHistory.clientHeight < 100;
            if (isNearBottom) {
                chatHistory.scrollTop = chatHistory.scrollHeight;
            }
        },
        (action) => {
            // Handle side effects triggered by the agent
            if (action.type === 'note_saved') {
                // Refresh notes list if a note was auto-saved
                loadState(null, null, null, renderNotes, null, handleDeleteNote);
            }
        }
    );

    // 5. Add "Add to Note" button to the completed message
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'message-actions';
    actionsDiv.style.marginTop = '8px';
    actionsDiv.style.display = 'flex';
    actionsDiv.style.justifyContent = 'flex-end';
    actionsDiv.style.opacity = '0.7';
    actionsDiv.style.transition = 'opacity 0.2s';

    msgDiv.addEventListener('mouseenter', () => { actionsDiv.style.opacity = '1'; });
    msgDiv.addEventListener('mouseleave', () => { actionsDiv.style.opacity = '0.7'; });

    // Copy Button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'note-action-btn'; 
    copyBtn.innerHTML = '📋 Copy';
    copyBtn.title = 'Copy to Clipboard';
    copyBtn.style.cssText = `font-size: 0.75em; padding: 4px 8px; background: rgba(0,0,0,0.05); border: 1px solid rgba(0,0,0,0.1); border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 4px; color: inherit; font-family: inherit;`;
    copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(response).then(() => {
            copyBtn.textContent = '✅ Copied!';
            setTimeout(() => { copyBtn.innerHTML = '📋 Copy'; }, 2000);
        });
    });
    actionsDiv.appendChild(copyBtn);

    const noteBtn = document.createElement('button');
    noteBtn.className = 'note-action-btn'; 
    noteBtn.innerHTML = '📝 Add to Notes';
    noteBtn.title = 'Save this response as a note';
    
    // Inline styles (keeping consistent with utils.js)
    noteBtn.style.fontSize = '0.75em';
    noteBtn.style.padding = '4px 8px';
    noteBtn.style.background = 'rgba(0,0,0,0.05)';
    noteBtn.style.border = '1px solid rgba(0,0,0,0.1)';
    noteBtn.style.borderRadius = '4px';
    noteBtn.style.cursor = 'pointer';
    noteBtn.style.display = 'flex';
    noteBtn.style.alignItems = 'center';
    noteBtn.style.gap = '4px';
    noteBtn.style.color = 'inherit';
    noteBtn.style.fontFamily = 'inherit';
    
    noteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleAddToNote(response, noteBtn);
    });

    // Hover effect for button
    noteBtn.addEventListener('mouseenter', () => { noteBtn.style.background = 'rgba(0,0,0,0.1)'; });
    noteBtn.addEventListener('mouseleave', () => { noteBtn.style.background = 'rgba(0,0,0,0.05)'; });

    actionsDiv.appendChild(noteBtn);
    wrapper.appendChild(actionsDiv);
    
    // Final scroll to bottom
    chatHistory.scrollTop = chatHistory.scrollHeight;

  } catch (error) {
    contentDiv.innerText = getFriendlyErrorMessage(error);
  }
}

// --- Note Handling ---

async function handleAddToNote(text, btnElement) {
    // Visual feedback
    const originalText = btnElement.innerHTML;
    btnElement.innerHTML = '⏳ Saving...';
    btnElement.disabled = true;

    try {
        // Delegate to Master Agent
        await masterAgent.addNote(text);
        
        // Update UI
        loadState(null, null, null, renderNotes, null, handleDeleteNote); // Refresh notes list
        
        btnElement.innerHTML = '✅ Saved!';
        setTimeout(() => {
            btnElement.innerHTML = originalText;
            btnElement.disabled = false;
        }, 2000);

    } catch (error) {
        console.error("Failed to add note:", error);
        btnElement.innerHTML = '❌ Error';
        btnElement.title = getFriendlyErrorMessage(error);
        setTimeout(() => {
            btnElement.innerHTML = originalText;
            btnElement.disabled = false;
        }, 2000);
    }
}

async function handleDeleteNote(index) {
    if(confirm("Are you sure you want to delete this note?")) {
        await masterAgent.deleteNote(index);
        // Refresh UI
        loadState(null, null, null, renderNotes, null, handleDeleteNote);
    }
}

async function handleClearNotes() {
    if(confirm("Are you sure you want to delete ALL notes? This cannot be undone.")) {
        await masterAgent.clearNotes();
        // Refresh UI
        loadState(null, null, null, renderNotes, null, handleDeleteNote);
    }
}

function handleCopyResult() {
    const textToCopy = elements.summaryText.innerText;
    navigator.clipboard.writeText(textToCopy).then(() => {
        const originalText = elements.copyResultBtn.textContent;
        elements.copyResultBtn.textContent = 'Copied!';
        setTimeout(() => {
            elements.copyResultBtn.textContent = originalText;
        }, 2000);
    });
}

// --- Helper for PDF Cleaning ---
function markdownToCleanText(md) {
    let text = md;
    
    // Remove bold/italic markers
    text = text.replace(/\*\*(.*?)\*\*/g, '$1'); // Bold
    text = text.replace(/\*(.*?)\*/g, '$1');     // Italic
    text = text.replace(/__(.*?)__/g, '$1');     // Bold
    text = text.replace(/_(.*?)_/g, '$1');       // Italic
    
    // Remove LaTeX markers
    text = text.replace(/\$(.*?)\$/g, '$1');

    // Fix bullet points
    const lines = text.split('\n');
    const cleanLines = lines.map(line => {
        let l = line.trim();
        if (l.startsWith('* ') || l.startsWith('- ')) {
            return '  • ' + l.substring(2);
        }
        return l;
    });
    
    return cleanLines.join('\n');
}

// --- Notes Download Logic ---

async function downloadNotes(format) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    const storageKey = `state_${tab.id}`;
    chrome.storage.local.get([storageKey], async (result) => {
        const state = result[storageKey] || {};
        const notes = state.notes || [];

        if (notes.length === 0) {
            alert("No notes to download!");
            return;
        }

        let content = "";
        let mimeType = "";
        let extension = "";

        if (format === 'doc') {
            // Use formatText to convert Markdown to HTML for Word
            const notesHtml = notes.map(n => `<li>${formatText(n)}</li>`).join('');
            
            content = `
                <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                <head><meta charset='utf-8'><title>BriefBoard Notes</title></head>
                <body>
                    <h1>BriefBoard Notes</h1>
                    <ul>
                        ${notesHtml}
                    </ul>
                </body>
                </html>
            `;
            mimeType = "application/msword";
            extension = "doc";
        } else if (format === 'pdf') {
            // Dynamic import for SimplePDF
            const { SimplePDF } = await import('../../features/notes/simplePdf.js');
            const pdfGen = new SimplePDF();
            
            // Title
            pdfGen.fontSize = 16;
            pdfGen.addText("BriefBoard Notes\n");
            pdfGen.fontSize = 11; // Reset font size

            notes.forEach((note, i) => {
                pdfGen.yPos -= 10; // Spacing before note
                pdfGen.addText(`Note #${i + 1}`, { isBold: true }); 
                pdfGen.yPos -= 5;

                // Process note lines
                const lines = note.split('\n');
                lines.forEach(line => {
                    let cleanLine = line.trim();
                    
                    // Remove Markdown bold/italic chars for cleaner look
                    cleanLine = cleanLine.replace(/\*\*/g, '').replace(/\*/g, '').replace(/__/g, '').replace(/_/g, '');

                    if (cleanLine.startsWith('- ') || cleanLine.startsWith('* ')) {
                        // Bullet point
                        pdfGen.addText('• ' + cleanLine.substring(2), { indent: 15 });
                    } else if (cleanLine.startsWith('#')) {
                        // Header (simulate with spacing)
                        pdfGen.yPos -= 5;
                        pdfGen.addText(cleanLine.replace(/^#+\s*/, ''), { isBold: true });
                    } else {
                        // Normal text
                        if (cleanLine.length > 0) {
                            pdfGen.addText(cleanLine);
                        } else {
                            pdfGen.yPos -= 5; // Empty line spacing
                        }
                    }
                });
                
                pdfGen.addText("\n___________________________________________________\n");
            });

            content = pdfGen.generate();
            mimeType = "application/pdf";
            extension = "pdf";
        }

        // Create download link
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `briefboard-notes.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}