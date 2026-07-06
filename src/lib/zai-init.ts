/**
 * LLM Client — Groq API (works from Vercel)
 * ===========================================
 * Uses Groq's free API for all LLM calls.
 * Get a free key at https://console.groq.com/keys
 *
 * Set GROQ_API_KEY in Vercel Environment Variables.
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

// --- Groq client ---
const createClient = (apiKey: string): ZaiLike => {
  const chatCreate = async (body: any): Promise<ChatCompletionResponse> => {
    const model = body.model || "llama-3.3-70b-versatile";
    const res = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ ...body, model }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Groq API ${res.status}: ${errText.slice(0, 300)}`);
    }
    return res.json();
  };

  const invoke = async (name: string, _body: any) => {
    if (name === "web_search") {
      // Web search is handled separately in job-search.ts
      return [];
    }
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