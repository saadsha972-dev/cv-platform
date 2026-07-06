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
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.status !== 429) return res;

      // Rate limited — wait with exponential backoff
      const waitMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 6000);
      console.warn(`[groq] Rate limited (429), retry ${attempt + 1}/${maxRetries} in ${Math.round(waitMs)}ms...`);
      await new Promise((r) => setTimeout(r, waitMs));
    } catch (fetchErr: any) {
      // Network error — retry once
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      throw fetchErr;
    }
  }
  // Return the last response even if still 429
  return fetch(url, options);
}

// --- Is this error a rate limit or auth error? ---
function isTransientError(status: number, msg: string): boolean {
  if (status === 429) return true;
  if (status === 403 && msg.includes("Forbidden")) return false; // Permanent — don't retry
  if (status === 401) return false; // Permanent
  return status >= 500; // Server error — retry
}

// --- Groq client with model fallback ---
const createClient = (apiKey: string): ZaiLike => {
  const chatCreate = async (body: any): Promise<ChatCompletionResponse> => {
    const requestedModel = body.model;

    // Try models in order (skip the requested one if it's in the list, try it first)
    const modelsToTry = requestedModel
      ? [requestedModel, ...MODELS.filter((m) => m !== requestedModel)]
      : [...MODELS];

    let lastError = "";
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

        const errText = await res.text().catch(() => "");
        lastError = `Groq ${res.status}: ${errText.slice(0, 200)}`;

        // If 429, try next model
        if (res.status === 429) {
          console.warn(`[groq] Model ${model} rate-limited, trying next model...`);
          continue;
        }

        // 401/403 = permanent auth error, don't bother trying other models
        if (res.status === 401 || res.status === 403) {
          throw new Error(`Groq API key is invalid or disabled. Please update GROQ_API_KEY in Vercel Settings → Environment Variables.`);
        }

        // Other server error — try next model
        console.warn(`[groq] Model ${model} error ${res.status}, trying next...`);
      } catch (err: any) {
        // If it's a permanent auth error, re-throw immediately
        if (err.message?.includes("invalid or disabled")) throw err;
        // If it's a rate limit error, try next model
        if (err.message?.includes("429")) {
          console.warn(`[groq] Model ${model} failed with 429, trying next...`);
          lastError = err.message;
          continue;
        }
        throw err;
      }
    }

    // All models failed
    throw new Error(lastError.includes("429")
      ? "Groq is temporarily rate-limited. Your CV will be generated with the base template — AI tailoring will resume automatically in a few minutes."
      : lastError || "All Groq models unavailable.");
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

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY not set. Add it in Vercel \u2192 Settings \u2192 Environment Variables.");
  }

  _instance = createClient(apiKey);
  return _instance;
};