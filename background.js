// Background service worker

// Listen for tab updates to clear storage when a page is reloaded or navigated away
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    const storageKey = `state_${tabId}`;
    chrome.storage.local.remove(storageKey);
  }
});

// Clean up storage when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  const storageKey = `state_${tabId}`;
  chrome.storage.local.remove(storageKey);
});