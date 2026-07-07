import { NextResponse } from "next/server";
import { createZai, getLlmDiagnostics } from "@/lib/zai-init";

export const runtime = "nodejs";

export async function GET() {
  const status: Record<string, string | boolean> = {};

  // Check env vars
  status.hasZaiToken = !!process.env.ZAI_TOKEN;
  status.hasGroqKey = !!process.env.GROQ_API_KEY;

  // Try initializing the client
  try {
    const zai = await createZai();
    const diag = getLlmDiagnostics();
    status.backend = diag.zai_token_set ? "z.ai" : diag.groq_key_set ? "groq" : "none";
    status.ready = true;

    // Quick test call
    const testRes = await zai.chat.completions.create({
      messages: [{ role: "user", content: "Reply with only: OK" }],
      max_tokens: 10,
    });
    status.testResponse = testRes.choices?.[0]?.message?.content?.trim() || "empty";
    status.testPassed = true;
  } catch (err: any) {
    status.ready = false;
    status.error = err.message?.slice(0, 300) || "Unknown error";
    const diag = getLlmDiagnostics();
    status.backend = diag.zai_token_set ? "z.ai" : diag.groq_key_set ? "groq" : "none";
  }

  return NextResponse.json(status);
}