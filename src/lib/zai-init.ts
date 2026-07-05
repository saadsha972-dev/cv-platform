/**
 * Z-AI SDK Wrapper
 * =================
 * The z-ai-web-dev-sdk's ZAI.create() reads .z-ai-config from disk,
 * which doesn't exist on Vercel. This module creates ZAI instances
 * directly with hardcoded config, bypassing the file lookup entirely.
 */

import ZAI_SDK from "z-ai-web-dev-sdk";

const CONFIG = {
  baseUrl: "https://internal-api.z.ai/v1",
  apiKey: "Z.ai",
  chatId: "chat-a7e1e7fb-7637-4a4c-9182-5956ba0dbf1b",
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMmIzMGFhOWItNzJlOS00MzQ3LWIwMWItY2NmOGRiMTY4ZmY0IiwiY2hhdF9pZCI6ImNoYXQtYTdlMWU3ZmItNzYzNy00YTRjLTkxODItNTk1NmJhMGRiZjFiIiwicGxhdGZvcm0iOiJ6YWkifQ.kPUg56QaKKg07kunr_sWai72rZ3Ew5c6tIWOYSc8ZkY",
  userId: "2b30aa9b-72e9-4347-b01b-ccf8db168ff4",
};

// Allow env var overrides
if (process.env.ZAI_BASE_URL) (CONFIG as any).baseUrl = process.env.ZAI_BASE_URL;
if (process.env.ZAI_API_KEY) (CONFIG as any).apiKey = process.env.ZAI_API_KEY;
if (process.env.ZAI_CHAT_ID) (CONFIG as any).chatId = process.env.ZAI_CHAT_ID;
if (process.env.ZAI_TOKEN) (CONFIG as any).token = process.env.ZAI_TOKEN;
if (process.env.ZAI_USER_ID) (CONFIG as any).userId = process.env.ZAI_USER_ID;

// Singleton — create once, reuse across all API routes in the same serverless instance
let _instance: any = null;

export const createZai = async () => {
  if (!_instance) {
    console.log("[zai] Creating ZAI instance with built-in config");
    _instance = new (ZAI_SDK as any)(CONFIG);
  }
  return _instance;
};