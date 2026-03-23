/**
 * Maps technical error messages to user-friendly instructions.
 * @param {Error|string} error - The error object or message string.
 * @returns {string} A user-friendly error message.
 */
export function getFriendlyErrorMessage(error) {
  const msg = (error.message || error.toString()).toLowerCase();

  if (msg.includes("api key")) {
    return "⚠️ API Key Missing or Invalid. Please check your settings.";
  }
  
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch")) {
    return "🌐 Network Error. Please check your internet connection.";
  }

  if (msg.includes("429") || msg.includes("quota") || msg.includes("resource exhausted")) {
    return "⏳ Usage Limit Exceeded. You've hit the rate limit for the Gemini API. Please try again later.";
  }

  if (msg.includes("403") || msg.includes("permission denied")) {
    return "🚫 Access Denied. Your API key might not have permissions for this model.";
  }

  if (msg.includes("500") || msg.includes("internal server error")) {
    return "🔥 Google AI Service Error. Something went wrong on Google's side. Try again shortly.";
  }

  if (msg.includes("candidate") || msg.includes("safety")) {
    return "🛡️ Content Filtered. The AI response was blocked by safety settings.";
  }

  // Default fallback
  return `❌ Error: ${error.message || "Something went wrong."}`;
}