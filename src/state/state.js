// State management functions
import { formatText, appendMessage } from '../core/utils/utils.js';
import { CONFIG } from '../core/config/config.js';

// Mutex queue to ensure sequential state updates
let saveQueue = Promise.resolve();

export async function loadState(summaryText, chatHistory, applySettingsCallback, updateNotesCallback, onAddToNoteCallback, onDeleteNoteCallback) {
  try {
    // Wait for any pending saves to complete before loading to ensure consistency
    await saveQueue;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    const tabKey = `state_${tab.id}`;
    const settingsKey = 'global_settings';

    chrome.storage.local.get([tabKey, settingsKey], (result) => {
      const tabState = result[tabKey];
      const globalSettings = result[settingsKey] || {};

      // Load Content State (Per Tab)
      if (tabState) {
        if (tabState.summary && summaryText) { // Check if summaryText exists
          summaryText.innerHTML = formatText(tabState.summary);
        }
        if (tabState.chat && tabState.chat.length > 0 && chatHistory) { // Check if chatHistory exists
          chatHistory.innerHTML = ''; 
          tabState.chat.forEach(msg => {
            appendMessage(msg.sender, msg.text, chatHistory, false, null, onAddToNoteCallback);
          });
        }
        // Load Notes
        if (tabState.notes && updateNotesCallback) {
            updateNotesCallback(tabState.notes, onDeleteNoteCallback);
        }
      }
      
      // Load Settings State (Global)
      if (applySettingsCallback) {
        // Default settings
        const defaults = { 
            themeHue: '235', 
            windowSize: 'normal', 
            fontSize: 'medium',
            fontFamily: 'inter',
            displayMode: 'light',
            cornerStyle: 'rounded',
            selectedModel: CONFIG.DEFAULT_MODEL
        };
        const finalSettings = { ...defaults, ...globalSettings };
        applySettingsCallback(finalSettings);
      }
    });
  } catch (e) {
    console.error("Error loading state:", e);
  }
}

export function saveState(updates) {
  // Enqueue the operation
  const operation = async () => {
      try {
        const promises = [];

        // 1. Handle Global Settings Updates
        if (updates.settings) {
          const settingsKey = 'global_settings';
          const p = new Promise((resolve) => {
              chrome.storage.local.get([settingsKey], (result) => {
                const currentSettings = result[settingsKey] || {};
                const newSettings = { ...currentSettings, ...updates.settings };
                chrome.storage.local.set({ [settingsKey]: newSettings }, resolve);
              });
          });
          promises.push(p);
        }

        // 2. Handle Tab-Specific Content Updates
        const hasContentUpdates = updates.summary !== undefined || 
                                  updates.cachedContentName !== undefined || 
                                  updates.clearChat || 
                                  updates.chatMessage ||
                                  updates.note; // Check for new note

        if (hasContentUpdates) {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab) {
              const tabKey = `state_${tab.id}`;
              const p = new Promise((resolve) => {
                  chrome.storage.local.get([tabKey], (result) => {
                    let currentState = result[tabKey] || { summary: null, chat: [], notes: [] };
                    
                    if (updates.summary !== undefined) currentState.summary = updates.summary;
                    if (updates.cachedContentName !== undefined) currentState.cachedContentName = updates.cachedContentName;
                    if (updates.clearChat) currentState.chat = [];
                    if (updates.chatMessage) {
                      if (!currentState.chat) currentState.chat = [];
                      currentState.chat.push(updates.chatMessage);
                    }

                    // Handle adding a new note
                    if (updates.note) {
                        if (!currentState.notes) currentState.notes = [];
                        currentState.notes.push(updates.note);
                    }
                    
                    chrome.storage.local.set({ [tabKey]: currentState }, resolve);
                  });
              });
              promises.push(p);
          }
        }
        
        await Promise.all(promises);
      } catch (e) {
        console.error("Error saving state:", e);
      }
  };

  // Chain the operation to the queue
  const resultPromise = saveQueue.then(operation);
  
  // Update the queue pointer, catching errors so the queue doesn't stall
  saveQueue = resultPromise.catch(e => console.error("State save queue error:", e));
  
  return resultPromise;
}