/**
 * GET /api/pdf?path=<path> — serve a generated PDF file
 * Used to download generated CV/cover letter PDFs.
 */

import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path");

    if (!path) {
      return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
    }

    // Security: only allow paths under the .cv-platform directory
    const allowedPrefix = `${process.env.HOME}/.cv-platform/`;
    const normalized = path.startsWith("/") ? path : `${allowedPrefix}${path}`;
    if (!normalized.startsWith(allowedPrefix)) {
      return NextResponse.json({ error: "Path not allowed" }, { status: 403 });
    }

    if (!existsSync(normalized)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const buf = readFileSync(normalized);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${normalized.split("/").pop()}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
