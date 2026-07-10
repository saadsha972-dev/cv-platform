/**
 * Seed the database with the 6 CV variants.
 * Run with: bun run src/lib/seed.ts
 */

import { db } from "@/lib/db";
import { CV_VARIANTS } from "@/lib/cv-data";

const DEFAULT_SEARCH_PROFILES = [
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

async function main() {
  console.log("Seeding CV variants...");

  // Insert CV variants
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
    console.log(`  ✓ ${cv.slug}`);
  }

  // Insert default search profiles
  console.log("\nSeeding search profiles...");
  for (const profile of DEFAULT_SEARCH_PROFILES) {
    const cv = await db.cvVariant.findUnique({ where: { slug: profile.cvVariantSlug } });
    if (!cv) continue;

    const existing = await db.searchProfile.findFirst({
      where: { name: profile.name },
    });
    if (existing) {
      console.log(`  (skip) ${profile.name} — already exists`);
      continue;
    }

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
    console.log(`  ✓ ${profile.name}`);
  }

  console.log("\nSeed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
