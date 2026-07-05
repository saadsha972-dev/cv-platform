/**
 * GET /api/test-pdf
 * Quick endpoint to verify jsPDF works on Vercel's serverless runtime.
 * Returns a tiny PDF as base64 — no DB, no LLM, just PDF generation.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ compress: true, unit: "mm", format: "a4" });

    doc.setFontSize(20);
    doc.text("CV Platform - PDF Test", 105, 100, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Generated at ${new Date().toISOString()}`, 105, 110, { align: "center" });
    doc.text("If you can see this, jsPDF works on Vercel!", 105, 120, { align: "center" });

    const buf = Buffer.from(doc.output("arraybuffer"));
    return NextResponse.json({
      success: true,
      size: buf.length,
      base64: buf.toString("base64"),
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
      stack: err.stack?.split("\n").slice(0, 5),
    }, { status: 500 });
  }
}