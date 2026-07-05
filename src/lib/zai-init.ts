/**
 * Z-AI SDK Initialization
 * ========================
 * The z-ai-web-dev-sdk reads .z-ai-config from disk via ZAI.create().
 * On Vercel this file doesn't exist, so we monkey-patch ZAI.create()
 * to pass the config directly to the constructor.
 *
 * All config values have hardcoded defaults so ZERO env vars are needed.
 */

import ZAI from "z-ai-web-dev-sdk";

const CONFIG = {
  baseUrl: "https://internal-api.z.ai/v1",
  apiKey: "Z.ai",
  chatId: "chat-a7e1e7fb-7637-4a4c-9182-5956ba0dbf1b",
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMmIzMGFhOWItNzJlOS00MzQ3LWIwMWItY2NmOGRiMTY4ZmY0IiwiY2hhdF9pZCI6ImNoYXQtYTdlMWU3ZmItNzYzNy00YTRjLTkxODItNTk1NmJhMGRiZjFiIiwicGxhdGZvcm0iOiJ6YWkifQ.kPUg56QaKKg07kunr_sWai72rZ3Ew5c6tIWOYSc8ZkY",
  userId: "2b30aa9b-72e9-4347-b01b-ccf8db168ff4",
};

// Override env vars if set
if (process.env.ZAI_BASE_URL) CONFIG.baseUrl = process.env.ZAI_BASE_URL;
if (process.env.ZAI_API_KEY) CONFIG.apiKey = process.env.ZAI_API_KEY;
if (process.env.ZAI_CHAT_ID) CONFIG.chatId = process.env.ZAI_CHAT_ID;
if (process.env.ZAI_TOKEN) CONFIG.token = process.env.ZAI_TOKEN;
if (process.env.ZAI_USER_ID) CONFIG.userId = process.env.ZAI_USER_ID;

// Monkey-patch ZAI.create() to bypass the file-based loadConfig()
const _originalCreate = ZAI.create;
(ZAI as any).create = async () => {
  console.log("[zai] Using built-in config (bypassing .z-ai-config file)");
  return new ZAI(CONFIG);
};

export { ZAI };