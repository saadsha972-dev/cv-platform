import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    v: "3.0",
    pdfEngine: "jspdf-v4",
    VERCEL: process.env.VERCEL === "1",
    NODE: process.version,
    deployedAt: new Date().toISOString(),
  });
}