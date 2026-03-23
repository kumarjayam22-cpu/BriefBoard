// Configuration settings for the extension
export const CONFIG = {
  // API Key is now managed dynamically via storage, no default hardcoded key
  DEFAULT_MODEL: 'gemini-3-flash-preview',
  API_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta',
  
  // Available Models Configuration
  MODELS: {
    'gemini-3-flash': {
      name: 'Gemini 3 Flash',
      id: 'gemini-3-flash-preview',
      description: 'Fast and efficient, great for summaries.',
      contextWindow: 1000000
    },
    'gemini-3-pro-preview': {
      name: 'Gemini 3 Pro',
      id: 'gemini-3-pro-preview',
      description: 'More capable reasoning, better for complex tasks.',
      contextWindow: 2000000
    },
    'gemini-2.5-pro': {
      name: 'Gemini 2.5 Pro',
      id: 'gemini-2.5-pro',
      description: 'A previous generation model, still very capable.',
      contextWindow: 1000000
    }
  }
};