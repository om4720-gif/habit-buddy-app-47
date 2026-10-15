// Optional free/cheap fallback for Mero when the Lovable AI gateway is out of credits.
// Works with any OpenAI-compatible chat-completions API. Defaults to Google's Gemini
// API (free tier available with a Google AI Studio key, no credit card needed).
//
// Environment variables (set as secrets in your project):
//   FALLBACK_AI_API_KEY   required to enable the fallback (GEMINI_API_KEY also works)
//   FALLBACK_AI_BASE_URL  optional, default: Gemini's OpenAI-compatible endpoint
//   FALLBACK_AI_MODEL     optional, default: gemini-3.5-flash

export type FallbackAI = { baseURL: string; apiKey: string; model: string };

export function getFallbackAI(): FallbackAI | null {
  const apiKey = process.env["FALLBACK_AI_API_KEY"] ?? process.env["GEMINI_API_KEY"];
  if (!apiKey) return null;
  return {
    apiKey,
    baseURL:
      process.env["FALLBACK_AI_BASE_URL"] ??
      "https://generativelanguage.googleapis.com/v1beta/openai/",
    model: process.env["FALLBACK_AI_MODEL"] ?? "gemini-3.5-flash",
  };
}

// Once the primary gateway reports "out of credits", skip it for a while so
// every message doesn't pay for a failed first attempt.
let primaryDownUntil = 0;
export const primaryIsDown = () => Date.now() < primaryDownUntil;
export const markPrimaryDown = () => {
  primaryDownUntil = Date.now() + 10 * 60 * 1000;
};
export const isOutOfCredits = (status?: number) => status === 402 || status === 403;
