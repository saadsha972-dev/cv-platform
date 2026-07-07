/**
 * GET /api/debug/llm
 * Diagnostic endpoint to verify LLM backend configuration and connectivity.
 * Returns: env var status, which backends are available, and a live test call.
 */
import { NextResponse } from "next/server";
import { createZai, getLlmDiagnostics } from "@/lib/zai-init";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  const diag = getLlmDiagnostics();

  // Try a minimal LLM call to verify connectivity
  let testResult = "not_tested";
  let testError = "";
  try {
    const zai = await createZai();
    const response = await zai.chat.completions.create({
      messages: [
        { role: "system", content: "Return valid JSON only." },
        { role: "user", content: 'Return JSON: {"status":"ok","message":"hello"}' },
      ],
      max_tokens: 50,
      temperature: 0,
    });
    const content = response.choices?.[0]?.message?.content?.trim() || "";
    testResult = content.slice(0, 500);
  } catch (err: any) {
    testError = err.message?.slice(0, 500) || "Unknown error";
  }

  return NextResponse.json({
    diagnostics: diag,
    test: {
      result: testResult,
      error: testError,
      success: !!testResult && !testError,
    },
    timestamp: new Date().toISOString(),
  });
}