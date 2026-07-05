/**
 * LLM Client — replaces z-ai-web-dev-sdk with Groq (free, public API)
 * ====================================================================
 * The z-ai-web-dev-sdk connects to internal-api.z.ai which is a private
 * endpoint (172.25.x.x) unreachable from Vercel. Groq provides the same
 * OpenAI-compatible API, is free, and is accessible from anywhere.
 *
 * Set GROQ_API_KEY env var in Vercel (get one at https://console.groq.com/keys).
 * Falls back to proxying through the Space-Z deployment if no key is set.
 */

// Minimal type for what we use from the SDK
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

// --- Groq direct client ---
const createGroqClient = (apiKey: string): ZaiLike => {
  const baseUrl = "https://api.groq.com/openai/v1";

  const chatCreate = async (body: any): Promise<ChatCompletionResponse> => {
    const model = body.model || "llama-3.3-70b-versatile";
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ ...body, model }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Groq API ${res.status}: ${errText.slice(0, 200)}`);
    }
    return res.json();
  };

  // Web search is not available via Groq — return empty results
  const invoke = async (name: string, _body: any) => {
    if (name === "web_search") {
      console.log("[groq] web_search not available — returning empty results");
      return [];
    }
    throw new Error(`Unknown function: ${name}`);
  };

  return { chat: { completions: { create: chatCreate } }, functions: { invoke } };
};

// --- Proxy client (falls back to Space-Z proxy) ---
const createProxyClient = (): ZaiLike => {
  const proxyBaseUrl = process.env.SPACE_Z_PROXY || "https://z18n25jy39x1-d.space-z.ai";

  const chatCreate = async (body: any): Promise<ChatCompletionResponse> => {
    const res = await fetch(`${proxyBaseUrl}/api/ai-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Proxy API ${res.status}: ${errText.slice(0, 200)}`);
    }
    return res.json();
  };

  const invoke = async (name: string, body: any) => {
    const res = await fetch(`${proxyBaseUrl}/api/ai-function`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ...body }),
    });
    if (!res.ok) throw new Error(`Proxy function ${res.status}`);
    return res.json();
  };

  return { chat: { completions: { create: chatCreate } }, functions: { invoke } };
};

// --- Singleton ---
let _instance: ZaiLike | null = null;

export const createZai = async (): Promise<ZaiLike> => {
  if (_instance) return _instance;

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    console.log("[llm] Using Groq API for LLM calls");
    _instance = createGroqClient(groqKey);
  } else {
    console.log("[llm] No GROQ_API_KEY set — using Space-Z proxy fallback");
    _instance = createProxyClient();
  }

  return _instance;
};