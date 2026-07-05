import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const variants = await db.cvVariant.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, slug: true, roleTitle: true, roleShort: true, summary: true },
    });
    return NextResponse.json({ variants });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
