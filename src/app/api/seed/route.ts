/**
 * GET /api/seed
 * Seeds the database with 6 CV variants + 6 search profiles.
 * Uses upsert for CV variants, update-or-create for search profiles.
 * Run after fresh deploy or to update profile configs: visit /api/seed
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CV_VARIANTS } from "@/lib/cv-data";

export const runtime = "nodejs";

const SEARCH_PROFILES = [
  {
    name: "QHSE / Audit Roles — Global Remote",
    cvVariantSlug: "QMS_Lead_Auditor",
    countries: "USA, Germany, United Kingdom, Australia, Canada, Qatar, UAE, Saudi Arabia",
    keywords: "QMS Lead Auditor, ISO 9001, Integrated Management Systems, QHSE Manager, Remote",
    excludeKeywords: "junior, intern, graduate, training course",
    frequency: "daily",
  },
  {
    name: "Safety Manager — Global Remote",
    cvVariantSlug: "QHSE_Manager",
    countries: "USA, Germany, United Kingdom, Australia, Canada, Qatar, UAE, Saudi Arabia, Kuwait, Oman",
    keywords: "HSE Manager, Safety Manager, NEBOSH, QCS 2014, Construction Safety, Remote",
    excludeKeywords: "junior, intern, training course",
    frequency: "daily",
  },
  {
    name: "ISO Auditor — Global Remote",
    cvVariantSlug: "ISO_Auditor",
    countries: "USA, Germany, United Kingdom, Australia, Canada, UAE, Singapore",
    keywords: "ISO Lead Auditor, CQI IRCA, Third Party Audit, Certification Body, Remote",
    excludeKeywords: "junior, intern, training course",
    frequency: "weekly",
  },
  {
    name: "ICT Enterprise Sales — Global",
    cvVariantSlug: "ICT_Enterprise_Sales",
    countries: "USA, Germany, United Kingdom, Australia, Canada, UAE, Saudi Arabia, Qatar, Pakistan, Singapore",
    keywords: "Enterprise Sales, ICT Sales, Cisco, SD-WAN, Account Manager, Remote",
    excludeKeywords: "junior, intern, commission only, training course",
    frequency: "daily",
  },
  {
    name: "Sales Director — Global Remote",
    cvVariantSlug: "Director_Corporate_Sales",
    countries: "USA, Germany, United Kingdom, Australia, Canada, UAE, Qatar, Pakistan",
    keywords: "Sales Director, Head of Sales, Commercial Director, VP Sales, Remote",
    excludeKeywords: "junior, intern, commission only, training course",
    frequency: "daily",
  },
  {
    name: "Quality Director — Global Remote",
    cvVariantSlug: "Quality_Management_Director",
    countries: "USA, Germany, United Kingdom, Australia, Canada, UAE, Saudi Arabia, Pakistan",
    keywords: "Quality Director, Head of Quality, QMS Manager, Lean Six Sigma, Remote",
    excludeKeywords: "junior, intern, training course",
    frequency: "weekly",
  },
];

export async function GET() {
  try {
    let variantsCreated = 0;
    let profilesUpdated = 0;

    // Seed CV variants (upsert)
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

    // Seed/update search profiles
    for (const profile of SEARCH_PROFILES) {
      const cv = await db.cvVariant.findUnique({ where: { slug: profile.cvVariantSlug } });
      if (!cv) continue;

      const existing = await db.searchProfile.findFirst({ where: { name: profile.name } });

      if (existing) {
        // Update existing profile with new countries/keywords
        await db.searchProfile.update({
          where: { id: existing.id },
          data: {
            countries: profile.countries,
            keywords: profile.keywords,
            excludeKeywords: profile.excludeKeywords,
            frequency: profile.frequency,
          },
        });
        profilesUpdated++;
      } else {
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
        profilesUpdated++;
      }
    }

    // Verify
    const totalVariants = await db.cvVariant.count();
    const totalProfiles = await db.searchProfile.count();

    return NextResponse.json({
      success: true,
      message: `Seeded ${variantsCreated} CV variants, updated ${profilesUpdated} search profiles`,
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