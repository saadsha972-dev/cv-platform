/**
 * LLM Client — Groq API with retry + fallback
 * ===============================================
 * Uses Groq's free API with automatic retry on 429 rate limits.
 * Falls back to a lighter model when rate-limited.
 *
 * Set GROQ_API_KEY in Vercel Environment Variables.
 * Get a free key at https://console.groq.com/keys
 */

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

interface ZaiLike {
  chat: {
    completions: {
      create: (body: any) => Promise<ChatCompletionResponse>;
    };
  };
  functions: {
    invoke: (name: string, body: any) => Promise<any>;
  };
}

const GROQ_BASE = "https://api.groq.com/openai/v1";

// Models ordered by preference (fastest + highest rate limit first)
const MODELS = [
  "llama-3.1-8b-instant",   // Very fast, highest rate limit on free tier
  "llama3-70b-8192",        // Good quality, moderate rate limit
  "llama-3.3-70b-versatile", // Best quality, lowest rate limit
];

// --- Retry logic ---
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, options);
    if (res.status !== 429) return res;

    // Rate limited — wait with exponential backoff
    const waitMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 8000);
    console.warn(`[groq] Rate limited (429), retry ${attempt + 1}/${maxRetries} in ${Math.round(waitMs)}ms...`);
    await new Promise((r) => setTimeout(r, waitMs));
  }
  // Return the last response even if still 429
  return fetch(url, options);
}

// --- Groq client with model fallback ---
const createClient = (apiKey: string): ZaiLike => {
  const chatCreate = async (body: any): Promise<ChatCompletionResponse> => {
    const requestedModel = body.model;

    // Try models in order (skip the requested one if it's in the list, try it first)
    const modelsToTry = requestedModel
      ? [requestedModel, ...MODELS.filter((m) => m !== requestedModel)]
      : [...MODELS];

    for (const model of modelsToTry) {
      try {
        const res = await fetchWithRetry(`${GROQ_BASE}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ ...body, model }),
        });

        if (res.ok) {
          return res.json();
        }

        // If 429 on this model, try next model
        if (res.status === 429) {
          console.warn(`[groq] Model ${model} rate-limited, trying next model...`);
          continue;
        }

        // Other error — throw
        const errText = await res.text().catch(() => "");
        throw new Error(`Groq API ${res.status}: ${errText.slice(0, 300)}`);
      } catch (err: any) {
        // If it's a rate limit error, try next model
        if (err.message?.includes("429")) {
          console.warn(`[groq] Model ${model} failed with 429, trying next...`);
          continue;
        }
        throw err;
      }
    }

    // All models failed
    throw new Error("All Groq models rate-limited. Please wait a minute and try again, or upgrade your Groq plan at console.groq.com.");
  };

  const invoke = async (name: string, _body: any) => {
    if (name === "web_search") return [];
    throw new Error(`Unknown function: ${name}`);
  };

  return { chat: { completions: { create: chatCreate } }, functions: { invoke } };
};

// --- Singleton ---
let _instance: ZaiLike | null = null;

export const createZai = async (): Promise<ZaiLike> => {
  if (_instance) return _instance;

  const apiKey = process.env.GROQ_API_KEY || "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";

  _instance = createClient(apiKey);
  return _instance;
};