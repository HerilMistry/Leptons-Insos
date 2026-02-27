// ============================================================
// CortexFlow — Environment Setup Script
// ============================================================
// Run this ONCE after loading the extension to inject the
// Groq API key from .env into chrome.storage.local.
//
// Usage (from the extension's service-worker console or popup console):
//   1. Open chrome://extensions → CortexFlow → "service worker" link
//   2. Paste and run the contents of this file
//
// Or simply run in the popup's DevTools console:
//   chrome.storage.local.set({ groq_api_key: "gsk_YOUR_KEY_HERE" });
// ============================================================

const GROQ_KEY = "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";

chrome.storage.local.set({ groq_api_key: GROQ_KEY }, () => {
  console.log("[CortexFlow] Groq API key stored in chrome.storage.local.");
});
