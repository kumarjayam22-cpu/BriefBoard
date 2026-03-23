// Content script to interact with the page
console.log('BriefBoard: Content script loaded');

// --- Styles for the Floating Button ---
const style = document.createElement('style');
style.textContent = `
  #briefboard-float-btn {
    position: fixed; /* Fixed is safer for overlays */
    z-index: 2147483647;
    background: #27272a;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 8px 12px;
    font-family: sans-serif;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: none;
    pointer-events: auto;
    transform: translate(-50%, -100%); /* Center horizontally and move above */
    margin-top: -10px; /* Spacing */
  }
  #briefboard-float-btn:hover {
    background: #3f3f46;
    transform: translate(-50%, -100%) scale(1.05);
  }
  #briefboard-float-btn.visible {
    display: block;
    animation: briefboard-fade-in 0.2s ease-out;
  }
  @keyframes briefboard-fade-in {
    from { opacity: 0; transform: translate(-50%, -90%); }
    to { opacity: 1; transform: translate(-50%, -100%); }
  }
  .briefboard-highlight {
    background-color: #ffff00;
    color: #000;
    border-radius: 2px;
    box-shadow: 0 0 2px rgba(255, 255, 0, 0.5);
  }
`;
document.head.appendChild(style);

// --- Create Floating Button ---
const btn = document.createElement('button');
btn.id = 'briefboard-float-btn';
btn.innerHTML = '🖊️ Highlight';
document.body.appendChild(btn);

// --- Event Listeners ---

let selectionRange = null;

document.addEventListener('mouseup', (e) => {
  // Wait a tick to let selection settle
  setTimeout(() => {
    const selection = window.getSelection();
    
    // If clicking the button itself, don't hide it yet
    if (e.target === btn) return;

    const text = selection.toString().trim();

    if (text.length > 0) {
      // We have text selected
      try {
          selectionRange = selection.getRangeAt(0);
          const rect = selectionRange.getBoundingClientRect();
          
          // Check if selection is visible
          if (rect.width === 0 || rect.height === 0) {
              hideButton();
              return;
          }

          // Calculate position (centered above selection)
          // Using fixed position, so we use client rects directly
          const top = rect.top; 
          const left = rect.left + (rect.width / 2);

          // Boundary checks to keep on screen
          if (top < 40) {
              // If too close to top, show below
              btn.style.top = `${rect.bottom + 10}px`;
              btn.style.transform = 'translate(-50%, 0)';
          } else {
              btn.style.top = `${top}px`;
              btn.style.transform = 'translate(-50%, -100%)';
          }
          
          btn.style.left = `${left}px`;
          btn.classList.add('visible');
      } catch (err) {
          console.error("BriefBoard: Error getting selection rect", err);
      }
    } else {
      // No selection
      hideButton();
    }
  }, 10);
});

// Hide on mousedown if not clicking the button
document.addEventListener('mousedown', (e) => {
  if (e.target !== btn) {
    hideButton();
  }
});

// --- Button Action ---
btn.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  if (selectionRange) {
    highlightSelection(selectionRange);
    hideButton();
    window.getSelection().removeAllRanges(); // Clear selection after highlighting
  }
});

function hideButton() {
  btn.classList.remove('visible');
  // Don't nullify selectionRange immediately in case of click race, 
  // but mousedown handles the hide.
}

function highlightSelection(range) {
  try {
    const span = document.createElement('span');
    span.className = 'briefboard-highlight';
    range.surroundContents(span);
  } catch (e) {
    console.warn("BriefBoard: Could not highlight complex selection.", e);
    // Fallback: Try to use execCommand for better compatibility with complex selections
    // (e.g. across paragraphs)
    document.designMode = "on";
    document.execCommand("BackColor", false, "#ffff00");
    document.designMode = "off";
  }
}