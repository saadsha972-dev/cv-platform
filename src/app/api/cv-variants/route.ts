import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CV_VARIANTS } from "@/lib/cv-data";

export const runtime = "nodejs";

/** Seed CV variants into the database (idempotent upsert). */
async function ensureSeeded() {
  const count = await db.cvVariant.count();
  if (count > 0) return;

  console.log("[cv-variants] Database empty — auto-seeding CV variants...");
  for (const cv of CV_VARIANTS) {
    const data = {
      sidebarPage1: cv.sidebarPage1,
      sidebarPage2: cv.sidebarPage2,
      experiencePage1: cv.experiencePage1,
      experiencePage2: cv.experiencePage2,
      earlierCareer: cv.earlierCareer,
    };
    await db.cvVariant.upsert({
      where: { slug: cv.slug },
      update: { roleTitle: cv.roleTitle, roleShort: cv.roleShort, summary: cv.summary, data: JSON.stringify(data) },
      create: { slug: cv.slug, roleTitle: cv.roleTitle, roleShort: cv.roleShort, summary: cv.summary, data: JSON.stringify(data) },
    });
  }
  console.log(`[cv-variants] Seeded ${CV_VARIANTS.length} CV variants`);
}

export async function GET() {
  try {
    await ensureSeeded();
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