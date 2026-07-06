/**
 * GET /api/test-search
 * Hardcoded search test — no DB dependency.
 * Proves whether Serper calls work from Vercel.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  const t0 = Date.now();
  const apiKey = process.env.SERPER_API_KEY || "89280a05e2a42179789766db50570d66f5d52b1e";

  try {
    // Direct Serper call — same as search-run uses
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
      body: JSON.stringify({ q: '"HSE Manager" jobs Qatar hiring', num: 10, hl: "en", gl: "qa" }),
    });

    const text = await res.text();
    const data = JSON.parse(text);
    const organic = data.organic || [];

    return NextResponse.json({
      timing: `${Date.now() - t0}ms`,
      serperStatus: res.status,
      rawCount: organic.length,
      firstResult: organic[0] ? { title: organic[0].title, url: organic[0].link } : null,
      envHasKey: !!process.env.SERPER_API_KEY,
    });
  } catch (err: any) {
    return NextResponse.json({
      timing: `${Date.now() - t0}ms`,
      error: err.message,
      envHasKey: !!process.env.SERPER_API_KEY,
    }, { status: 500 });
  }
}