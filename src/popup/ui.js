// UI Management and DOM Manipulation

export const elements = {
  useCaseContainer: document.getElementById('use-case-container'),
  useCaseGrid: document.getElementById('use-case-grid'),
  resultArea: document.getElementById('result-area'),
  resultTitle: document.getElementById('result-title'),
  backToActionsBtn: document.getElementById('back-to-actions'),
  copyResultBtn: document.getElementById('copy-result-btn'),
  
  summaryText: document.getElementById('summary-text'),
  summaryLoader: document.getElementById('summary-loader'),
  
  chatHistory: document.getElementById('chat-history'),
  userInput: document.getElementById('user-input'),
  sendBtn: document.getElementById('send-btn'),
  tabBtns: document.querySelectorAll('.tab-btn'),
  tabContents: document.querySelectorAll('.tab-content'),

  // Notes Elements
  notesList: document.getElementById('notes-list'),
  clearNotesBtn: document.getElementById('clear-notes-btn'),
  downloadDocBtn: document.getElementById('download-doc-btn'),
  downloadPdfBtn: document.getElementById('download-pdf-btn'),

  // Settings Elements
  colorOptions: document.querySelectorAll('.color-option'),
  sizeBtns: document.querySelectorAll('.size-btn'),
  fontBtns: document.querySelectorAll('.font-btn'),
  fontFamilyBtns: document.querySelectorAll('.font-family-btn'),
  modeBtns: document.querySelectorAll('.mode-btn'),
  cornerBtns: document.querySelectorAll('.corner-btn'),
  modelSelect: document.getElementById('model-select'),
  languageSelect: document.getElementById('language-select'),
  apiKeyInput: document.getElementById('api-key-input')
};

export function showActionsGrid() {
  elements.useCaseContainer.style.display = 'flex';
  elements.resultArea.style.display = 'none';
}

export function showResultArea(title) {
  elements.useCaseContainer.style.display = 'none';
  elements.resultArea.style.display = 'flex';
  elements.resultTitle.textContent = title;
  elements.summaryText.innerHTML = ''; 
}

export function populateModelDropdown(models) {
  const select = elements.modelSelect;
  select.innerHTML = ''; 

  Object.values(models).forEach(model => {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = `${model.name} - ${model.description}`;
    select.appendChild(option);
  });
}

export function populateUseCaseGrid(useCases, onUseCaseClick) {
  const grid = elements.useCaseGrid;
  grid.innerHTML = '';
  
  const categories = {
      understand: '🧠 Understand',
      act: '🚀 Act',
      refine: '✨ Refine',
      tools: '🛠️ Tools'
  };

  const grouped = {};
  Object.values(useCases).forEach(uc => {
      const cat = uc.category || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(uc);
  });

  Object.entries(categories).forEach(([catKey, catLabel]) => {
      if (!grouped[catKey]) return;

      // Header
      const header = document.createElement('div');
      header.className = 'category-header';
      header.textContent = catLabel;
      grid.appendChild(header);

      // Items
      grouped[catKey].forEach(useCase => {
        const btn = document.createElement('div');
        btn.className = 'use-case-btn';
        btn.innerHTML = `
          <div class="use-case-icon">${useCase.icon}</div>
          <div class="use-case-label">${useCase.label}</div>
        `;
        btn.addEventListener('click', () => onUseCaseClick(useCase));
        grid.appendChild(btn);
      });
  });
}

export function setupTabSwitching() {
  elements.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.tabBtns.forEach(b => b.classList.remove('active'));
      elements.tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const tabId = `tab-${btn.dataset.tab}`;
      document.getElementById(tabId).classList.add('active');
    });
  });
}

export function renderNotes(notes, onDelete) {
    const list = elements.notesList;
    list.innerHTML = '';

    if (!notes || notes.length === 0) {
        list.innerHTML = '<div style="text-align: center; color: var(--text-muted); margin-top: 20px;">No notes yet. Ask the AI to "take a note" during chat!</div>';
        if(elements.clearNotesBtn) elements.clearNotesBtn.disabled = true;
        return;
    }

    if(elements.clearNotesBtn) elements.clearNotesBtn.disabled = false;

    const fragment = document.createDocumentFragment();

    notes.forEach((note, index) => {
        const item = document.createElement('div');
        item.className = 'note-item';
        
        // Note Content
        const content = document.createElement('div');
        content.className = 'note-content';
        content.innerHTML = note; // Assuming safe HTML from AI formatter

        // Meta & Actions
        const meta = document.createElement('div');
        meta.className = 'note-meta';
        
        const indexSpan = document.createElement('span');
        indexSpan.textContent = `Note #${index + 1}`;
        
        const actions = document.createElement('div');
        actions.className = 'note-actions';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'note-btn delete';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Delete Note';
        deleteBtn.onclick = () => {
            if(onDelete) onDelete(index);
        };
        
        actions.appendChild(deleteBtn);
        meta.appendChild(indexSpan);
        meta.appendChild(actions);
        
        item.appendChild(content);
        item.appendChild(meta);
        fragment.appendChild(item);
    });

    list.appendChild(fragment);
}