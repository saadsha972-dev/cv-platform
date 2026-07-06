/**
 * GET /api/seed
 * Seeds the database with 6 CV variants + 6 search profiles.
 * Safe to call multiple times — uses upsert.
 * Run once after fresh deploy: visit /api/seed
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CV_VARIANTS } from "@/lib/cv-data";

export const runtime = "nodejs";

const SEARCH_PROFILES = [
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

export async function GET() {
  try {
    let variantsCreated = 0;
    let profilesCreated = 0;

    // Seed CV variants
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
        update: {
          roleTitle: cv.roleTitle,
          roleShort: cv.roleShort,
          summary: cv.summary,
          data: JSON.stringify(data),
        },
        create: {
          slug: cv.slug,
          roleTitle: cv.roleTitle,
          roleShort: cv.roleShort,
          summary: cv.summary,
          data: JSON.stringify(data),
        },
      });
      variantsCreated++;
    }

    // Seed search profiles
    for (const profile of SEARCH_PROFILES) {
      const cv = await db.cvVariant.findUnique({ where: { slug: profile.cvVariantSlug } });
      if (!cv) continue;

      const existing = await db.searchProfile.findFirst({ where: { name: profile.name } });
      if (existing) continue;

      await db.searchProfile.create({
        data: {
          name: profile.name,
          cvVariantId: cv.id,
          countries: profile.countries,
          keywords: profile.keywords,
          excludeKeywords: profile.excludeKeywords,
          frequency: profile.frequency,
        },
      });
      profilesCreated++;
    }

    // Verify
    const totalVariants = await db.cvVariant.count();
    const totalProfiles = await db.searchProfile.count();

    return NextResponse.json({
      success: true,
      message: `Seeded ${variantsCreated} CV variants and ${profilesCreated} search profiles`,
      totalVariants,
      totalProfiles,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
      stack: err.stack?.split("\n").slice(0, 5),
    }, { status: 500 });
  }
}