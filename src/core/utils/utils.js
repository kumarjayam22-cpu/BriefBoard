// Utility functions for formatting and DOM manipulation

export function debounce(func, wait) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

export function formatText(text) {
  if (!text) return "";

  // 1. Extract Code Blocks
  // Regex: ``` followed by optional language (\w*), optional whitespace/newline (\s*), content, then ```
  const codeBlocks = [];
  let processedText = text.replace(/```(\w*)\s*([\s\S]*?)```/g, (match, lang, code) => {
    codeBlocks.push({ lang: lang || 'text', code: code });
    // Use a placeholder with NO underscores or asterisks to avoid markdown conflicts
    return `@@CODEBLOCK${codeBlocks.length - 1}@@`;
  });

  // 2. Extract Inline Code
  const inlineCodes = [];
  processedText = processedText.replace(/`([^`]+)`/g, (match, code) => {
    inlineCodes.push(code);
    return `@@INLINECODE${inlineCodes.length - 1}@@`;
  });

  // 3. Escape HTML in the main text (security)
  processedText = processedText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 4. Markdown Formatting

  // Headers
  processedText = processedText.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  processedText = processedText.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  processedText = processedText.replace(/^# (.*$)/gm, '<h1>$1</h1>');

  // Bold & Italic
  processedText = processedText
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>');

  // Blockquotes
  processedText = processedText.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>');

  // Lists (Simple bullet points)
  processedText = processedText.replace(/^\s*[-*] (.*$)/gm, '<span class="list-item">• $1</span>');

  // 5. Handle Newlines
  processedText = processedText.replace(/\n/g, '<br>');
  
  // Cleanup <br> after block elements
  processedText = processedText.replace(/(<\/h[1-6]>|<\/blockquote>|<\/pre>)<br>/g, '$1');

  // 6. Restore Code Blocks
  processedText = processedText.replace(/@@CODEBLOCK(\d+)@@/g, (match, index) => {
    const block = codeBlocks[parseInt(index, 10)];
    if (!block) return match;
    
    const { lang, code } = block;
    // Escape code content for display
    const safeCode = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    return `<pre><div class="code-header">${lang}</div><code>${safeCode}</code></pre>`;
  });

  // 7. Restore Inline Code
  processedText = processedText.replace(/@@INLINECODE(\d+)@@/g, (match, index) => {
    const code = inlineCodes[parseInt(index, 10)];
    if (!code) return match;

    const safeCode = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    return `<code class="inline-code">${safeCode}</code>`;
  });

  return processedText;
}

export function appendMessage(sender, text, chatHistory, shouldSave = false, saveStateCallback = null, onAddToNote = null) {
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('message', sender);
  
  // Avatar
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.innerHTML = sender === 'user' ? '👤' : '🤖';
  
  // Wrapper for content and actions
  const wrapper = document.createElement('div');
  wrapper.className = 'message-wrapper';

  // Content
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.innerHTML = formatText(text);
  wrapper.appendChild(contentDiv);

  // Add "Add to Note" and "Copy" buttons for AI messages
  if (sender === 'ai') {
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'message-actions';
      actionsDiv.style.marginTop = '8px';
      actionsDiv.style.display = 'flex';
      actionsDiv.style.justifyContent = 'flex-end';
      actionsDiv.style.opacity = '0.7';
      actionsDiv.style.transition = 'opacity 0.2s';

      // Hover effect for actions
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
          navigator.clipboard.writeText(text).then(() => {
              copyBtn.textContent = '✅ Copied!';
              setTimeout(() => { copyBtn.innerHTML = '📋 Copy'; }, 2000);
          });
      });
      actionsDiv.appendChild(copyBtn);

      // Add to Note Button
      if (onAddToNote) {
          const noteBtn = document.createElement('button');
          noteBtn.className = 'note-action-btn'; 
          noteBtn.innerHTML = '📝 Add to Notes';
          noteBtn.title = 'Save this response as a note';
          noteBtn.style.cssText = copyBtn.style.cssText; // Use same style
          
          noteBtn.addEventListener('click', (e) => {
              e.stopPropagation(); // Prevent bubbling
              onAddToNote(text, noteBtn);
          });
          actionsDiv.appendChild(noteBtn);
      }
      
      wrapper.appendChild(actionsDiv);
  }

  msgDiv.appendChild(avatar);
  msgDiv.appendChild(wrapper);

  chatHistory.appendChild(msgDiv);
  chatHistory.scrollTop = chatHistory.scrollHeight;
  
  if (shouldSave && saveStateCallback) {
    saveStateCallback({ chatMessage: { sender, text } });
  }
  
  return msgDiv;
}

export function setSummaryLoading(isLoading, summaryText, summaryLoader, summarizeBtn) {
  const loadingText = document.getElementById('summary-loading-text');
  if (isLoading) {
    summaryText.style.display = 'none';
    summaryLoader.style.display = 'block';
    if (loadingText) loadingText.style.display = 'block';
    if(summarizeBtn) summarizeBtn.disabled = true;
  } else {
    summaryText.style.display = 'block';
    summaryLoader.style.display = 'none';
    if (loadingText) loadingText.style.display = 'none';
    if(summarizeBtn) summarizeBtn.disabled = false;
  }
}