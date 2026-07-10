import { NextResponse } from "next/server";
import { createZai } from "@/lib/zai-init";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  try {
    const zai = await createZai();
    const response = await zai.chat.completions.create({
      messages: [{ role: "user", content: "Reply with just: OK" }],
      temperature: 0,
      max_tokens: 10,
    });
    const text = response.choices?.[0]?.message?.content || "(empty)";
    return NextResponse.json({ success: true, reply: text });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
      code: err.code,
      cause: err.cause?.message || err.cause?.code || String(err.cause || ""),
    }, { status: 500 });
  }
}