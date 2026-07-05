import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  let hasPdfmake = false;
  try { hasPdfmake = !!require("pdfmake/build/vfs_fonts"); } catch {}
  return NextResponse.json({
    commit: "2220beb",
    hasPdfmake,
    VERCEL: process.env.VERCEL,
    NODE: process.version,
  });
}
