/**
 * LLM Client — z-ai-web-dev-sdk with Groq fallback
 * ===================================================
 * Primary: z-ai-web-dev-sdk (works in server-side code)
 * Fallback: Groq API (free, requires GROQ_API_KEY env var)
 *
 * The old Space-Z proxy fallback has been removed because the proxy
 * does not forward /api/* routes, causing "Proxy API 404" errors.
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

// --- z-ai-web-dev-sdk client (primary) ---
const createSdkClient = (): ZaiLike => {
  // Dynamic import to avoid issues if SDK is not available
  let sdkModule: any = null;

  const chatCreate = async (body: any): Promise<ChatCompletionResponse> => {
    if (!sdkModule) {
      try {
        sdkModule = await import("z-ai-web-dev-sdk");
      } catch (err) {
        throw new Error("z-ai-web-dev-sdk not available. Set GROQ_API_KEY as fallback.");
      }
    }

    const ZAI = sdkModule.default || sdkModule.ZAI;
    let zai;
    try {
      zai = await ZAI.create();
    } catch (err: any) {
      throw new Error(`SDK init failed: ${err.message}. Set GROQ_API_KEY in Vercel env.`);
    }

    try {
      return await zai.chat.completions.create(body);
    } catch (err: any) {
      throw new Error(`SDK chat failed: ${err.message}`);
    }
  };

  const invoke = async (name: string, body: any) => {
    if (!sdkModule) {
      sdkModule = await import("z-ai-web-dev-sdk");
    }
    const ZAI = sdkModule.default || sdkModule.ZAI;
    const zai = await ZAI.create();
    return zai.functions.invoke(name, body);
  };

  return { chat: { completions: { create: chatCreate } }, functions: { invoke } };
};

// --- Groq direct client (fallback) ---
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

  const invoke = async (name: string, _body: any) => {
    if (name === "web_search") {
      console.log("[groq] web_search not available — returning empty results");
      return [];
    }
    throw new Error(`Unknown function: ${name}`);
  };

  return { chat: { completions: { create: chatCreate } }, functions: { invoke } };
};

// --- Singleton ---
let _instance: ZaiLike | null = null;
let _initError: string | null = null;

export const createZai = async (): Promise<ZaiLike> => {
  if (_instance) return _instance;
  if (_initError) throw new Error(_initError);

  // Priority 1: Groq API key (reliable from Vercel)
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    console.log("[llm] Using Groq API for LLM calls");
    _instance = createGroqClient(groqKey);
    return _instance;
  }

  // Priority 2: z-ai-web-dev-sdk (works in serverless if API is reachable)
  console.log("[llm] No GROQ_API_KEY — trying z-ai-web-dev-sdk directly...");
  try {
    _instance = createSdkClient();
    // Test with a tiny request to verify it works
    await _instance.chat.completions.create({
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 5,
    });
    console.log("[llm] z-ai-web-dev-sdk is working!");
    return _instance;
  } catch (err: any) {
    console.error("[llm] z-ai-web-dev-sdk failed:", err.message);
    _instance = null; // reset
  }

  // Both failed
  _initError =
    "No LLM available. Fix: Go to Vercel → Settings → Environment Variables → add GROQ_API_KEY. " +
    "Get a free key at https://console.groq.com/keys (takes 30 seconds).";
  throw new Error(_initError);
};