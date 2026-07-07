/**
 * LLM Client — z.ai Platform API (primary) + Groq API (fallback)
 * =================================================================
 * Uses the z.ai internal platform API by default (no API key needed
 * if ZAI_TOKEN env var is set). Falls back to Groq free API if available.
 *
 * ENV VARS (set in Vercel Settings → Environment Variables):
 * - ZAI_TOKEN: JWT token from z.ai platform (primary, no rate limits)
 * - GROQ_API_KEY: Groq API key (fallback, free at console.groq.com)
 *
 * At least ONE of these must be set for AI tailoring to work.
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

// --- z.ai Platform API Client ---
function createZaiPlatformClient(token: string): ZaiLike {
  const ZAI_BASE = "https://internal-api.z.ai/v1";

  const chatCreate = async (body: any): Promise<ChatCompletionResponse> => {
    const res = await fetch(`${ZAI_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer Z.ai`,
        "X-Z-AI-From": "Z",
        "X-Token": token,
      },
      body: JSON.stringify({ ...body, thinking: body.thinking || { type: "disabled" } }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`z.ai API error ${res.status}: ${errText.slice(0, 200)}`);
    }

    return res.json();
  };

  const invoke = async (name: string, _body: any) => {
    if (name === "web_search") return [];
    throw new Error(`Unknown function: ${name}`);
  };

  return { chat: { completions: { create: chatCreate } }, functions: { invoke } };
}

// --- Groq API Client (fallback) ---
const GROQ_BASE = "https://api.groq.com/openai/v1";
const GROQ_MODELS = [
  "llama-3.1-8b-instant",
  "llama3-70b-8192",
  "llama-3.3-70b-versatile",
];

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.status !== 429) return res;
      const waitMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 6000);
      console.warn(`[groq] Rate limited (429), retry ${attempt + 1}/${maxRetries} in ${Math.round(waitMs)}ms...`);
      await new Promise((r) => setTimeout(r, waitMs));
    } catch (fetchErr: any) {
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      throw fetchErr;
    }
  }
  return fetch(url, options);
}

function createGroqClient(apiKey: string): ZaiLike {
  const chatCreate = async (body: any): Promise<ChatCompletionResponse> => {
    const requestedModel = body.model;
    const modelsToTry = requestedModel
      ? [requestedModel, ...GROQ_MODELS.filter((m) => m !== requestedModel)]
      : [...GROQ_MODELS];

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

        if (res.ok) return res.json();

        const errText = await res.text().catch(() => "");
        lastError = `Groq ${res.status}: ${errText.slice(0, 200)}`;

        if (res.status === 429) {
          console.warn(`[groq] Model ${model} rate-limited, trying next...`);
          continue;
        }
        if (res.status === 401 || res.status === 403) {
          throw new Error(`Groq API key is invalid or disabled.`);
        }
        console.warn(`[groq] Model ${model} error ${res.status}, trying next...`);
      } catch (err: any) {
        if (err.message?.includes("invalid or disabled")) throw err;
        lastError = err.message;
        continue;
      }
    }

    throw new Error(lastError.includes("429")
      ? "Groq is temporarily rate-limited."
      : lastError || "All Groq models unavailable.");
  };

  const invoke = async (name: string, _body: any) => {
    if (name === "web_search") return [];
    throw new Error(`Unknown function: ${name}`);
  };

  return { chat: { completions: { create: chatCreate } }, functions: { invoke } };
}

// --- Singleton with auto-detection ---
let _instance: ZaiLike | null = null;
let _backend: string | null = null;

export const createZai = async (): Promise<ZaiLike> => {
  if (_instance) return _instance;

  // Priority 1: z.ai platform API (via ZAI_TOKEN env var)
  const zaiToken = process.env.ZAI_TOKEN;
  if (zaiToken) {
    _instance = createZaiPlatformClient(zaiToken);
    _backend = "z.ai";
    console.log("[llm] Using z.ai platform API as LLM backend");
    return _instance;
  }

  // Priority 2: Groq API (via GROQ_API_KEY env var)
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    _instance = createGroqClient(groqKey);
    _backend = "groq";
    console.log("[llm] Using Groq API as LLM backend");
    return _instance;
  }

  // Priority 3: Check for local z.ai config file (development only)
  try {
    const fs = await import("fs");
    const os = await import("os");
    const path = await import("path");
    const configPaths = [
      path.join(process.cwd(), ".z-ai-config"),
      path.join(os.homedir(), ".z-ai-config"),
      "/etc/.z-ai-config",
    ];
    for (const configPath of configPaths) {
      try {
        const configStr = fs.readFileSync(configPath, "utf8");
        const config = JSON.parse(configStr);
        if (config.token) {
          _instance = createZaiPlatformClient(config.token);
          _backend = "z.ai-local";
          console.log(`[llm] Using z.ai platform API from local config: ${configPath}`);
          return _instance;
        }
      } catch {
        // continue to next path
      }
    }
  } catch {
    // fs import might fail in some environments, that's ok
  }

  // No LLM backend available
  throw new Error(
    "No LLM backend configured. Set ZAI_TOKEN or GROQ_API_KEY in Vercel Settings → Environment Variables. " +
    "Get a free Groq key at https://console.groq.com/keys"
  );
};

/** Returns which backend is active: 'z.ai', 'z.ai-local', 'groq', or null */
export const getLlmBackend = (): string | null => _backend;