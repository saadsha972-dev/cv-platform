/**
 * Z-AI SDK Initialization
 * ========================
 * The z-ai-web-dev-sdk reads .z-ai-config from disk.
 * On Vercel this file doesn't exist, so we write it at startup
 * from environment variables (with hardcoded defaults for static values).
 */

import { writeFileSync, existsSync } from "fs";
import { join } from "path";

const CONFIG_PATH = join(process.cwd(), ".z-ai-config");

if (!existsSync(CONFIG_PATH)) {
  const config = {
    baseUrl: process.env.ZAI_BASE_URL || "https://internal-api.z.ai/v1",
    apiKey: process.env.ZAI_API_KEY || "Z.ai",
    chatId: process.env.ZAI_CHAT_ID || "chat-a7e1e7fb-7637-4a4c-9182-5956ba0dbf1b",
    token: process.env.ZAI_TOKEN || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMmIzMGFhOWItNzJlOS00MzQ3LWIwMWItY2NmOGRiMTY4ZmY0IiwiY2hhdF9pZCI6ImNoYXQtYTdlMWU3ZmItNzYzNy00YTRjLTkxODItNTk1NmJhMGRiZjFiIiwicGxhdGZvcm0iOiJ6YWkifQ.kPUg56QaKKg07kunr_sWai72rZ3Ew5c6tIWOYSc8ZkY",
    userId: process.env.ZAI_USER_ID || "2b30aa9b-72e9-4347-b01b-ccf8db168ff4",
  };
  try {
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log("[zai] Wrote .z-ai-config to", CONFIG_PATH);
  } catch (err: any) {
    console.error("[zai] Failed to write .z-ai-config:", err.message);
  }
}

export {};