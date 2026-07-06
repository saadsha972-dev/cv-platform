/**
 * GET  /api/search-profiles — list local search profiles (auto-heals if missing)
 * POST /api/search-profiles — create a search profile
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const DEFAULT_PROFILES = [
  {
    name: "QHSE / Audit Roles — GCC + Europe",
    cvVariantSlug: "QMS_Lead_Auditor",
    countries: "Qatar, UAE, Saudi Arabia, Germany, UK",
    keywords: "QMS Lead Auditor, ISO 9001, Integrated Management Systems, QHSE Manager",
    excludeKeywords: "junior, intern, graduate",
    frequency: "daily",
  },
  {
    name: "Safety Manager Roles — Middle East",
    cvVariantSlug: "QHSE_Manager",
    countries: "Qatar, UAE, Saudi Arabia, Kuwait, Oman",
    keywords: "HSE Manager, Safety Manager, NEBOSH, QCS 2014, Construction Safety",
    excludeKeywords: "junior, intern",
    frequency: "daily",
  },
  {
    name: "ISO Auditor Roles — Global",
    cvVariantSlug: "ISO_Auditor",
    countries: "UAE, Germany, UK, Pakistan, Singapore",
    keywords: "ISO Lead Auditor, CQI IRCA, Third Party Audit, Certification Body",
    excludeKeywords: "junior, intern",
    frequency: "weekly",
  },
  {
    name: "ICT Sales Roles — GCC + Asia",
    cvVariantSlug: "ICT_Enterprise_Sales",
    countries: "UAE, Saudi Arabia, Qatar, Pakistan, Singapore",
    keywords: "Enterprise Sales, ICT Sales, Cisco, SD-WAN, Account Manager",
    excludeKeywords: "junior, intern, commission only",
    frequency: "daily",
  },
  {
    name: "Sales Director Roles — Global",
    cvVariantSlug: "Director_Corporate_Sales",
    countries: "UAE, Qatar, UK, Germany, Pakistan",
    keywords: "Sales Director, Head of Sales, Commercial Director, VP Sales",
    excludeKeywords: "junior, intern, commission only",
    frequency: "daily",
  },
  {
    name: "Quality Director Roles — Global",
    cvVariantSlug: "Quality_Management_Director",
    countries: "UAE, Germany, UK, Pakistan, Saudi Arabia",
    keywords: "Quality Director, Head of Quality, QMS Manager, Lean Six Sigma",
    excludeKeywords: "junior, intern",
    frequency: "weekly",
  },
];

export async function GET(req: NextRequest) {
  try {
    // Delete any leftover "Remote" profiles (they belong in the Remote Jobs tab)
    await db.searchProfile.deleteMany({
      where: { name: { contains: "Remote", mode: "insensitive" } },
    });

    // Auto-heal: ensure all 6 default profiles exist
    for (const def of DEFAULT_PROFILES) {
      const cv = await db.cvVariant.findUnique({ where: { slug: def.cvVariantSlug } });
      if (!cv) continue;

      const exists = await db.searchProfile.findFirst({ where: { name: def.name } });
      if (!exists) {
        await db.searchProfile.create({
          data: {
            name: def.name,
            cvVariantId: cv.id,
            countries: def.countries,
            keywords: def.keywords,
            excludeKeywords: def.excludeKeywords,
            frequency: def.frequency,
          },
        });
        console.log(`[search-profiles] Auto-created: ${def.name}`);
      }
    }

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