/**
 * POST /api/docx
 * Body: { cvVariantSlug: string, tailoredContent?: { tailoredSummary, tailoredBullets, tailoredSidebarSection1 } }
 * Returns: { docxBase64: string, filename: string }
 *
 * Generates an editable Microsoft Word (.docx) file from CV data.
 * Uses the `docx` npm package with professional formatting.
 */

import { NextRequest, NextResponse } from "next/server";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, TabStopPosition, TabStopType, BorderStyle, ShadingType, Table, TableRow, TableCell, WidthType, VerticalAlign } from "docx";
import { getCvBySlug, CANDIDATE } from "@/lib/cv-data";

export const runtime = "nodejs";

// Navy/gold color constants (matching PDF design)
const NAVY = "1B365D";
const GOLD = "8C7853";
const GOLD_LIGHT = "C8AA5A";
const BODY_COLOR = "282828";
const MID_COLOR = "4B4B4B";
const GRAY_COLOR = "696969";

interface DocxBody {
  cvVariantSlug: string;
  tailoredContent?: {
    tailoredSummary?: string;
    tailoredBullets?: Record<string, string[]>;
    tailoredSidebarSection1?: { title: string; items: string[] };
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: DocxBody = await req.json();
    const { cvVariantSlug, tailoredContent } = body;

    if (!cvVariantSlug) {
      return NextResponse.json({ error: "cvVariantSlug is required" }, { status: 400 });
    }

    const cv = getCvBySlug(cvVariantSlug);
    if (!cv) {
      return NextResponse.json({ error: `Unknown CV variant: ${cvVariantSlug}` }, { status: 400 });
    }

    const summary = tailoredContent?.tailoredSummary || cv.summary;

    // Build experience paragraphs — apply tailored bullets if available
    const buildExpParagraphs = (entries: typeof cv.experiencePage1) => {
      const paras: Paragraph[] = [];
      for (const entry of entries) {
        // Check if there are tailored bullets for this entry
        let bullets = entry.bullets;
        if (tailoredContent?.tailoredBullets) {
          const tb = tailoredContent.tailoredBullets;
          const key1 = entry.title;
          const key2 = `${entry.title} @ ${entry.company}`;
          if (tb[key2]) {
            const items: string[] = [];
            for (const b of tb[key2]) {
              if (b.includes(" | ")) {
                for (const part of b.split(" | ")) { if (part.trim()) items.push(part.trim()); }
              } else if (b.trim()) items.push(b.trim());
            }
            if (items.length > 0) bullets = items.slice(0, 5);
          } else if (tb[key1]) {
            const items: string[] = [];
            for (const b of tb[key1]) {
              if (b.includes(" | ")) {
                for (const part of b.split(" | ")) { if (part.trim()) items.push(part.trim()); }
              } else if (b.trim()) items.push(b.trim());
            }
            if (items.length > 0) bullets = items.slice(0, 5);
          }
        }

        // Job title
        paras.push(
          new Paragraph({
            spacing: { before: 240, after: 40 },
            children: [
              new TextRun({ text: entry.title, bold: true, size: 22, color: NAVY, font: "Calibri" }),
            ],
          })
        );

        // Company + location + dates
        paras.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({ text: `${entry.company}  |  ${entry.location}`, italics: true, size: 20, color: GOLD, font: "Calibri" }),
              new TextRun({ text: `    ${entry.dates}`, size: 18, color: GRAY_COLOR, font: "Calibri" }),
            ],
          })
        );

        // Bullets
        for (const bullet of bullets) {
          paras.push(
            new Paragraph({
              spacing: { before: 40, after: 40 },
              indent: { left: 360 },
              children: [
                new TextRun({ text: "• ", size: 20, color: GOLD, font: "Calibri" }),
                new TextRun({ text: bullet, size: 20, color: BODY_COLOR, font: "Calibri" }),
              ],
            })
          );
        }
      }
      return paras;
    };

    // Build sidebar items
    const sidebarSkills = tailoredContent?.tailoredSidebarSection1?.items || 
      cv.sidebarPage1[0]?.items.map(i => typeof i === "string" ? i : i[0]) || [];

    // Build certifications
    const certs: Array<[string, string]> = [];
    const langs: string[] = [];
    for (const sec of cv.sidebarPage1) {
      const t = sec.title.toUpperCase();
      if (t.includes("CERTIF") || t.includes("CREDENTIAL")) {
        for (const item of sec.items) {
          if (Array.isArray(item) && typeof item[1] === "string") certs.push([item[0], item[1]]);
          else if (typeof item === "string") certs.push([item, ""]);
        }
      }
      if (t.includes("LANG")) {
        for (const item of sec.items) {
          if (typeof item === "string") langs.push(item);
        }
      }
    }

    // Build education + other certs from sidebarPage2
    const education: Array<[string, string]> = [];
    const otherCerts: Array<[string, string]> = [];
    for (const sec of cv.sidebarPage2) {
      const t = sec.title.toUpperCase();
      if (t.includes("EDUCATION")) {
        for (const item of sec.items) {
          if (Array.isArray(item)) education.push([item[0], String(item[1])]);
          else if (typeof item === "string") education.push([item, ""]);
        }
      } else if (t.includes("CERTIF") || t.includes("TRAINING") || t.includes("ADDITIONAL")) {
        for (const item of sec.items) {
          if (Array.isArray(item) && typeof item[1] === "string") otherCerts.push([item[0], item[1]]);
          else if (typeof item === "string") otherCerts.push([item, ""]);
        }
      }
    }

    // ---- BUILD DOCUMENT ----
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children: [
          // ---- NAME ----
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [
              new TextRun({ text: CANDIDATE.name, bold: true, size: 36, color: NAVY, font: "Calibri" }),
            ],
          }),

          // ---- GOLD LINE ----
          new Paragraph({
            spacing: { after: 60 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD } },
            children: [],
          }),

          // ---- ROLE TITLE ----
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [
              new TextRun({ text: cv.roleTitle, size: 22, color: GOLD, font: "Calibri" }),
            ],
          }),

          // ---- CONTACT ----
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({ text: CANDIDATE.contact, size: 18, color: GRAY_COLOR, font: "Calibri" }),
            ],
          }),

          // ---- PROFESSIONAL SUMMARY ----
          new Paragraph({
            spacing: { before: 120, after: 80 },
            children: [
              new TextRun({ text: "PROFESSIONAL SUMMARY", bold: true, size: 22, color: NAVY, font: "Calibri" }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({ text: summary, size: 20, color: BODY_COLOR, font: "Calibri" }),
            ],
          }),

          // ---- KEY COMPETENCIES ----
          new Paragraph({
            spacing: { before: 120, after: 80 },
            children: [
              new TextRun({ text: "KEY COMPETENCIES", bold: true, size: 22, color: NAVY, font: "Calibri" }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: sidebarSkills.map(skill =>
              new TextRun({ text: `■ ${skill}    `, size: 20, color: GOLD, font: "Calibri" })
            ),
          }),

          // ---- CERTIFICATIONS ----
          ...(certs.length > 0 ? [
            new Paragraph({
              spacing: { before: 120, after: 80 },
              children: [
                new TextRun({ text: "CERTIFICATIONS", bold: true, size: 22, color: NAVY, font: "Calibri" }),
              ],
            }),
            ...certs.map(([name, desc]) =>
              new Paragraph({
                spacing: { before: 40, after: 40 },
                indent: { left: 360 },
                children: [
                  new TextRun({ text: "■ ", size: 20, color: GOLD, font: "Calibri" }),
                  new TextRun({ text: name, bold: true, size: 20, color: BODY_COLOR, font: "Calibri" }),
                  desc ? new TextRun({ text: ` — ${desc}`, size: 18, color: GRAY_COLOR, font: "Calibri" }) : new TextRun({ text: "", size: 20 }),
                ],
              })
            ),
            new Paragraph({ spacing: { after: 200 }, children: [] }),
          ] : []),

          // ---- LANGUAGES ----
          ...(langs.length > 0 ? [
            new Paragraph({
              spacing: { before: 120, after: 80 },
              children: [
                new TextRun({ text: "LANGUAGES", bold: true, size: 22, color: NAVY, font: "Calibri" }),
              ],
            }),
            ...langs.map(lang =>
              new Paragraph({
                spacing: { before: 40, after: 40 },
                indent: { left: 360 },
                children: [
                  new TextRun({ text: "■ ", size: 20, color: GOLD, font: "Calibri" }),
                  new TextRun({ text: lang, size: 20, color: BODY_COLOR, font: "Calibri" }),
                ],
              })
            ),
            new Paragraph({ spacing: { after: 200 }, children: [] }),
          ] : []),

          // ---- PROFESSIONAL EXPERIENCE ----
          new Paragraph({
            spacing: { before: 120, after: 80 },
            children: [
              new TextRun({ text: "PROFESSIONAL EXPERIENCE", bold: true, size: 22, color: NAVY, font: "Calibri" }),
            ],
          }),
          ...buildExpParagraphs(cv.experiencePage1),
          ...buildExpParagraphs(cv.experiencePage2),

          // ---- EDUCATION ----
          ...(education.length > 0 ? [
            new Paragraph({
              spacing: { before: 240, after: 80 },
              children: [
                new TextRun({ text: "EDUCATION", bold: true, size: 22, color: NAVY, font: "Calibri" }),
              ],
            }),
            ...education.map(([name, desc]) =>
              new Paragraph({
                spacing: { before: 40, after: 40 },
                indent: { left: 360 },
                children: [
                  new TextRun({ text: "■ ", size: 20, color: GOLD, font: "Calibri" }),
                  new TextRun({ text: name, bold: true, size: 20, color: BODY_COLOR, font: "Calibri" }),
                  desc ? new TextRun({ text: ` — ${desc}`, size: 18, color: GRAY_COLOR, font: "Calibri" }) : new TextRun({ text: "", size: 20 }),
                ],
              })
            ),
          ] : []),

          // ---- ADDITIONAL CERTIFICATIONS ----
          ...(otherCerts.length > 0 ? [
            new Paragraph({
              spacing: { before: 240, after: 80 },
              children: [
                new TextRun({ text: "ADDITIONAL CERTIFICATIONS & TRAININGS", bold: true, size: 22, color: NAVY, font: "Calibri" }),
              ],
            }),
            ...otherCerts.map(([name, desc]) =>
              new Paragraph({
                spacing: { before: 40, after: 40 },
                indent: { left: 360 },
                children: [
                  new TextRun({ text: "■ ", size: 20, color: GOLD, font: "Calibri" }),
                  new TextRun({ text: name, bold: true, size: 20, color: BODY_COLOR, font: "Calibri" }),
                  desc ? new TextRun({ text: ` — ${desc}`, size: 18, color: GRAY_COLOR, font: "Calibri" }) : new TextRun({ text: "", size: 20 }),
                ],
              })
            ),
          ] : []),

          // ---- EARLIER CAREER ----
          ...(cv.earlierCareer.length > 0 ? [
            new Paragraph({
              spacing: { before: 240, after: 80 },
              children: [
                new TextRun({ text: "EARLIER CAREER", bold: true, size: 22, color: NAVY, font: "Calibri" }),
              ],
            }),
            ...cv.earlierCareer.map(e =>
              new Paragraph({
                spacing: { before: 40, after: 40 },
                indent: { left: 360 },
                children: [
                  new TextRun({ text: "■ ", size: 20, color: GOLD, font: "Calibri" }),
                  new TextRun({ text: `${e.company}, `, bold: true, size: 20, color: BODY_COLOR, font: "Calibri" }),
                  new TextRun({ text: e.place, italics: true, size: 20, color: MID_COLOR, font: "Calibri" }),
                  new TextRun({ text: `  |  ${e.dates}`, size: 18, color: GRAY_COLOR, font: "Calibri" }),
                ],
              })
            ),
          ] : []),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    const base64 = buffer.toString("base64");
    const filename = `CV_${cv.roleShort.replace(/\s+/g, "_")}.docx`;

    return NextResponse.json({ success: true, docxBase64: base64, filename });
  } catch (err: any) {
    console.error("[docx] Generation failed:", err);
    return NextResponse.json({ error: err.message || "DOCX generation failed" }, { status: 500 });
  }
}