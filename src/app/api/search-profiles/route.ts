/**
 * GET  /api/search-profiles — list all search profiles
 * POST /api/search-profiles — create/update a search profile
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    // Clean up any stale "Global Remote" profiles left from previous versions.
    // These belong in the dedicated Remote Jobs tab, not Job Hunter.
    await db.searchProfile.deleteMany({
      where: { name: { contains: "Remote", mode: "insensitive" } },
    });

    const profiles = await db.searchProfile.findMany({
      where: { isActive: true },
      include: {
        cvVariant: {
          select: { slug: true, roleTitle: true, roleShort: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ profiles });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, cvVariantSlug, countries, keywords, excludeKeywords, frequency } = body;

    if (!name || !cvVariantSlug || !countries || !keywords) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const cvVariant = await db.cvVariant.findUnique({ where: { slug: cvVariantSlug } });
    if (!cvVariant) {
      return NextResponse.json({ error: `Unknown CV variant: ${cvVariantSlug}` }, { status: 400 });
    }

    const profile = await db.searchProfile.create({
      data: {
        name,
        cvVariantId: cvVariant.id,
        countries,
        keywords,
        excludeKeywords: excludeKeywords || "",
        frequency: frequency || "daily",
      },
    });

    return NextResponse.json({ profile });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
