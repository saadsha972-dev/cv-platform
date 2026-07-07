/**
 * LLM Client — Multi-Backend with Automatic Fallback
 * ====================================================
 * Tries backends in order:
 *   1. z.ai Platform API (if ZAI_TOKEN env var is set)
 *   2. Groq API (if GROQ_API_KEY env var is set)
 *
 * If a backend fails (network error, auth error, rate limit, bad response),
 * the next backend is tried automatically. This ensures CV tailoring works
 * as long as AT LEAST ONE backend is reachable.
 *
 * ENV VARS (set in Vercel Settings → Environment Variables):
 * - ZAI_TOKEN: JWT token from z.ai platform
 * - GROQ_API_KEY: Groq API key (free at console.groq.com)
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

// ---------------------------------------------------------------------------
// z.ai Platform API — direct HTTP call
// ---------------------------------------------------------------------------
const ZAI_BASE = "https://internal-api.z.ai/v1";

async function callZaiPlatform(token: string, body: any): Promise<ChatCompletionResponse> {
  // Ensure a model is specified — the z.ai API needs one
  const payload = {
    ...body,
    model: body.model || "glm-4-flash",
    thinking: body.thinking || { type: "disabled" },
  };

  console.log(`[llm] z.ai API call: model=${payload.model}, max_tokens=${payload.max_tokens}, messages=${payload.messages?.length || 0}`);

  const res = await fetch(`${ZAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer Z.ai`,
      "X-Z-AI-From": "Z",
      "X-Token": token,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`z.ai API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json() as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content?.trim();
  console.log(`[llm] z.ai response: ${content ? content.length + " chars" : "EMPTY"}, model=${payload.model}`);

  if (!content) {
    throw new Error("z.ai returned empty content");
  }

  return data;
}

// ---------------------------------------------------------------------------
// Groq API — direct HTTP call with model rotation
// ---------------------------------------------------------------------------
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

async function callGroqApi(apiKey: string, body: any): Promise<ChatCompletionResponse> {
  const requestedModel = body.model;
  const modelsToTry = requestedModel
    ? [requestedModel, ...GROQ_MODELS.filter((m) => m !== requestedModel)]
    : [...GROQ_MODELS];

  let lastError = "";
  for (const model of modelsToTry) {
    try {
      const payload = { ...body, model };
      console.log(`[groq] Trying model: ${model}, max_tokens=${payload.max_tokens}, messages=${payload.messages?.length || 0}`);

      const res = await fetchWithRetry(`${GROQ_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json() as ChatCompletionResponse;
        const content = data.choices?.[0]?.message?.content?.trim();
        console.log(`[groq] Model ${model} OK: ${content ? content.length + " chars" : "EMPTY"}`);
        return data;
      }

      const errText = await res.text().catch(() => "");
      lastError = `Groq ${model} ${res.status}: ${errText.slice(0, 200)}`;

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
}

// ---------------------------------------------------------------------------
// Composite client — tries z.ai first, falls back to Groq
// ---------------------------------------------------------------------------
function createCompositeClient(): ZaiLike {
  const chatCreate = async (body: any): Promise<ChatCompletionResponse> => {
    const errors: string[] = [];

    // Try 1: z.ai platform API
    const zaiToken = process.env.ZAI_TOKEN;
    if (zaiToken) {
      try {
        console.log("[llm] Attempting z.ai platform API...");
        return await callZaiPlatform(zaiToken, body);
      } catch (err: any) {
        const errMsg = err.message || "Unknown z.ai error";
        errors.push(`z.ai: ${errMsg}`);
        console.error(`[llm] z.ai FAILED: ${errMsg}`);
      }
    } else {
      console.log("[llm] ZAI_TOKEN not set, skipping z.ai backend");
    }

    // Try 2: Groq API
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      try {
        console.log("[llm] Attempting Groq API as fallback...");
        return await callGroqApi(groqKey, body);
      } catch (err: any) {
        const errMsg = err.message || "Unknown Groq error";
        errors.push(`groq: ${errMsg}`);
        console.error(`[llm] Groq FAILED: ${errMsg}`);
      }
    } else {
      console.log("[llm] GROQ_API_KEY not set, skipping Groq backend");
    }

    // Try 3: Local z.ai config (development only)
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
            console.log(`[llm] Attempting z.ai from local config: ${configPath}`);
            return await callZaiPlatform(config.token, body);
          }
        } catch {
          // continue
        }
      }
    } catch {
      // fs import might fail in serverless, that's ok
    }

    // All backends failed
    const hasZai = !!process.env.ZAI_TOKEN;
    const hasGroq = !!process.env.GROQ_API_KEY;
    const hint = !hasZai && !hasGroq
      ? "No LLM backend configured. Set ZAI_TOKEN or GROQ_API_KEY in Vercel Settings → Environment Variables."
      : `All backends failed. Errors:\n${errors.join("\n")}`;

    throw new Error(hint);
  };

  const invoke = async (name: string, _body: any) => {
    if (name === "web_search") return [];
    throw new Error(`Unknown function: ${name}`);
  };

  return { chat: { completions: { create: chatCreate } }, functions: { invoke } };
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------
let _instance: ZaiLike | null = null;

export const createZai = async (): Promise<ZaiLike> => {
  if (!_instance) {
    _instance = createCompositeClient();
    const hasZai = !!process.env.ZAI_TOKEN;
    const hasGroq = !!process.env.GROQ_API_KEY;
    console.log(`[llm] Composite LLM client created. Backends available: z.ai=${hasZai}, groq=${hasGroq}`);
  }
  return _instance;
};

/** Returns diagnostic info about available backends */
export const getLlmDiagnostics = () => ({
  zai_token_set: !!process.env.ZAI_TOKEN,
  groq_key_set: !!process.env.GROQ_API_KEY,
  groq_key_prefix: process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.slice(0, 8) + "..." : "(not set)",
  node_env: process.env.NODE_ENV || "unknown",
  vercel: !!process.env.VERCEL,
});