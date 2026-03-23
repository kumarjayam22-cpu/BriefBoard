// Settings Logic
import { saveState } from '../state/state.js';
import { geminiService } from '../core/services/geminiService.js';
import { CONFIG } from '../core/config/config.js';
import { elements } from './ui.js';
import { debounce } from '../core/utils/utils.js';

export function setupSettingsListeners() {
  // API Key Input - Debounced
  const debouncedSaveApiKey = debounce((key) => {
      if (key) {
          geminiService.setApiKey(key);
          saveState({ settings: { apiKey: key } });
      }
  }, 500);

  elements.apiKeyInput.addEventListener('input', (e) => {
      const key = e.target.value.trim();
      debouncedSaveApiKey(key);
  });

  // Color Theme
  elements.colorOptions.forEach(option => {
    option.addEventListener('click', () => {
      const hue = option.dataset.hue;
      applyThemeColor(hue);
      updateSelection(elements.colorOptions, option);
      saveState({ settings: { themeHue: hue } });
    });
  });

  // Window Size
  elements.sizeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const size = btn.dataset.size;
      applyWindowSize(size);
      updateSelection(elements.sizeBtns, btn);
      saveState({ settings: { windowSize: size } });
    });
  });

  // Font Size
  elements.fontBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const size = btn.dataset.font;
      applyFontSize(size);
      updateSelection(elements.fontBtns, btn);
      saveState({ settings: { fontSize: size } });
    });
  });
  
  // Font Family
  elements.fontFamilyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const font = btn.dataset.font;
      applyFontFamily(font);
      updateSelection(elements.fontFamilyBtns, btn);
      saveState({ settings: { fontFamily: font } });
    });
  });
  
  // Display Mode (Light/Dark)
  elements.modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      applyDisplayMode(mode);
      updateSelection(elements.modeBtns, btn);
      saveState({ settings: { displayMode: mode } });
    });
  });
  
  // Corner Style (Rounded/Square)
  elements.cornerBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const corner = btn.dataset.corner;
      applyCornerStyle(corner);
      updateSelection(elements.cornerBtns, btn);
      saveState({ settings: { cornerStyle: corner } });
    });
  });

  // Model Selection
  elements.modelSelect.addEventListener('change', (e) => {
      const modelId = e.target.value;
      geminiService.setModel(modelId);
      saveState({ settings: { selectedModel: modelId } });
  });

  // Language Selection
  elements.languageSelect.addEventListener('change', (e) => {
      const lang = e.target.value;
      geminiService.setLanguage(lang);
      saveState({ settings: { language: lang } });
  });
}

export function applySettings(settings) {
  if (!settings) return;
  
  if (settings.apiKey) {
      elements.apiKeyInput.value = settings.apiKey;
      geminiService.setApiKey(settings.apiKey);
  }

  if (settings.themeHue) {
    applyThemeColor(settings.themeHue);
    updateSelectionByData(elements.colorOptions, 'hue', settings.themeHue);
  }
  
  if (settings.windowSize) {
    applyWindowSize(settings.windowSize);
    updateSelectionByData(elements.sizeBtns, 'size', settings.windowSize);
  }

  if (settings.fontSize) {
    applyFontSize(settings.fontSize);
    updateSelectionByData(elements.fontBtns, 'font', settings.fontSize);
  }
  
  if (settings.fontFamily) {
    applyFontFamily(settings.fontFamily);
    updateSelectionByData(elements.fontFamilyBtns, 'font', settings.fontFamily);
  }
  
  if (settings.displayMode) {
    applyDisplayMode(settings.displayMode);
    updateSelectionByData(elements.modeBtns, 'mode', settings.displayMode);
  }
  
  if (settings.cornerStyle) {
    applyCornerStyle(settings.cornerStyle);
    updateSelectionByData(elements.cornerBtns, 'corner', settings.cornerStyle);
  }

  if (settings.selectedModel) {
      if (elements.modelSelect.querySelector(`option[value="${settings.selectedModel}"]`)) {
          elements.modelSelect.value = settings.selectedModel;
          geminiService.setModel(settings.selectedModel);
      } else {
          elements.modelSelect.value = CONFIG.DEFAULT_MODEL;
          geminiService.setModel(CONFIG.DEFAULT_MODEL);
      }
  }

  if (settings.language) {
      elements.languageSelect.value = settings.language;
      geminiService.setLanguage(settings.language);
  }
}

// --- Helper Functions ---

function updateSelection(nodeList, selectedElement) {
    nodeList.forEach(el => el.classList.remove('selected'));
    selectedElement.classList.add('selected');
}

function updateSelectionByData(nodeList, dataAttr, value) {
    nodeList.forEach(el => {
        if (el.dataset[dataAttr] === value) {
            updateSelection(nodeList, el);
        }
    });
}

function applyThemeColor(hue) {
  document.documentElement.style.setProperty('--primary-hue', hue);
}

function applyWindowSize(size) {
  document.body.className = document.body.className.replace(/size-\w+/g, '');
  document.body.classList.add(`size-${size}`);
}

function applyFontSize(size) {
  let pixelSize = '14px';
  if (size === 'small') pixelSize = '12px';
  if (size === 'large') pixelSize = '16px';
  document.documentElement.style.setProperty('--font-size-base', pixelSize);
}

function applyFontFamily(font) {
  let fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  if (font === 'serif') fontFamily = "'Georgia', 'Times New Roman', Times, serif";
  if (font === 'mono') fontFamily = "'Courier New', Courier, monospace";
  if (font === 'system') fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  if (font === 'comic') fontFamily = "'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', sans-serif";
  document.documentElement.style.setProperty('--font-family', fontFamily);
}

function applyDisplayMode(mode) {
    document.body.setAttribute('data-theme', mode);
}

function applyCornerStyle(style) {
    document.body.setAttribute('data-corners', style);
}