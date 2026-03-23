// Gemini API interaction functions
import { CONFIG } from '../config/config.js';
import { PROMPTS } from '../config/prompts.js';

// Minimum tokens required for context caching (approximate)
// Gemini API requires ~32k tokens minimum for caching.
// 1 token ~= 4 chars. So 32000 * 4 = 128,000 chars.
const MIN_CHARS_FOR_CACHE = 130000;

export class GeminiService {
  constructor() {
    this.apiKey = null; // Initialize as null, will be set from storage
    this.modelName = CONFIG.DEFAULT_MODEL; // Default model
    this.baseUrl = CONFIG.API_BASE_URL;
    this.language = 'English'; // Default language
    
    // Standard persona for the extension
    this.systemInstructionText = PROMPTS.SYSTEM_INSTRUCTION;
  }

  setApiKey(key) {
    this.apiKey = key;
  }

  setModel(modelId) {
    // Check if the modelId exists as a key in CONFIG.MODELS
    // OR if it matches the 'id' property of any model object (for backward compatibility or direct ID usage)
    const modelConfig = CONFIG.MODELS[modelId] || Object.values(CONFIG.MODELS).find(m => m.id === modelId);

    if (modelConfig) {
      this.modelName = modelConfig.id;
      console.log(`Switched to model: ${this.modelName}`);
    } else {
      console.warn(`Model ${modelId} not found in configuration, keeping ${this.modelName}`);
    }
  }

  setLanguage(lang) {
    this.language = lang;
    console.log(`Language set to: ${this.language}`);
  }

  validateConfig() {
    if (!this.apiKey) {
      throw new Error("Please configure your API Key in Settings.");
    }
  }

  async createCache(content, ttlMinutes = 60) {
    this.validateConfig();
    
    const url = `${this.baseUrl}/cachedContents?key=${this.apiKey}`;
    
    const requestBody = {
      model: `models/${this.modelName}`,
      // We put the large content in the 'contents' as a user message context
      contents: [{
        parts: [{ text: content }],
        role: 'user'
      }],
      // We bake the system instruction (persona) into the cache
      systemInstruction: {
        parts: [{ text: this.systemInstructionText }]
      },
      ttl: `${ttlMinutes * 60}s`
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.warn("Cache creation failed:", errorData);
      return null;
    }

    const data = await response.json();
    return data.name; // Returns the resource name of the cache
  }

  async streamGenerateContent(params, onChunk) {
    this.validateConfig();
    
    const { contents, systemInstruction, cachedContent, maxTokens } = params;
    
    const url = `${this.baseUrl}/models/${this.modelName}:streamGenerateContent?key=${this.apiKey}`;

    // Removed maxOutputTokens calculation to allow model to determine length
    const generationConfig = {
        temperature: 0.7
    };

    // Only set maxOutputTokens if explicitly provided (e.g. for very specific short tasks), otherwise let it be unlimited (default)
    if (maxTokens) {
        generationConfig.maxOutputTokens = maxTokens;
    }

    // Inject Language Instruction
    let finalContents = contents;
    if (this.language && this.language !== 'English') {
        // Clone to avoid mutation
        finalContents = JSON.parse(JSON.stringify(contents));
        
        const lastMsg = finalContents[finalContents.length - 1];
        if (lastMsg && lastMsg.role === 'user') {
             const lastPart = lastMsg.parts[lastMsg.parts.length - 1];
             if (lastPart && lastPart.text) {
                 lastPart.text += `\n\n(IMPORTANT: Please respond in ${this.language})`;
             } else {
                 lastMsg.parts.push({ text: `(IMPORTANT: Please respond in ${this.language})` });
             }
        }
    }

    const requestBody = {
      contents: finalContents,
      generationConfig: generationConfig
    };

    // Use cached content if available
    if (cachedContent) {
      requestBody.cachedContent = cachedContent;
      // Note: When using cachedContent, we cannot send a new systemInstruction. 
      // It must be part of the cache.
    } else if (systemInstruction) {
      // Fallback: Send system instruction in the request
      requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `API Error: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      let cursor = 0;
      let braceBalance = 0;
      let inQuote = false;
      let start = -1;
      
      for (let i = 0; i < buffer.length; i++) {
          const char = buffer[i];
          if (char === '"' && buffer[i-1] !== '\\') {
              inQuote = !inQuote;
          }
          
          if (!inQuote) {
              if (char === '{') {
                  if (braceBalance === 0) start = i;
                  braceBalance++;
              } else if (char === '}') {
                  braceBalance--;
                  if (braceBalance === 0 && start !== -1) {
                      const jsonStr = buffer.substring(start, i + 1);
                      try {
                          const data = JSON.parse(jsonStr);
                          if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
                              const textChunk = data.candidates[0].content.parts[0].text;
                              if (textChunk) {
                                  fullText += textChunk;
                                  onChunk(fullText);
                              }
                          }
                          cursor = i + 1;
                          start = -1; 
                      } catch (e) {
                          // Not valid JSON yet
                      }
                  }
              }
          }
      }
      
      if (cursor > 0) {
          buffer = buffer.substring(cursor);
      }
    }
    
    return fullText;
  }
  
  // Helper to decide whether to cache or not
  async prepareContext(content) {
      if (content.length > MIN_CHARS_FOR_CACHE) {
          try {
              const cacheName = await this.createCache(content);
              if (cacheName) {
                  return { cachedContent: cacheName };
              }
          } catch (e) {
              console.warn("Failed to create cache, falling back to system instruction", e);
          }
      }
      
      // Fallback or if content is small
      return { 
          systemInstruction: this.systemInstructionText + PROMPTS.CONTEXT_PREFIX + content 
      };
  }
}

export const geminiService = new GeminiService();