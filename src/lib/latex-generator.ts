/**
 * PDF CV Generator
 * ==================
 * Generates a tailored CV and cover letter PDF using pdfmake.
 * Pure JavaScript — no external binaries needed. Works on Vercel.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

import { CANDIDATE, CvData, SidebarSection, ExperienceEntry, EarlierCareerEntry } from "./cv-data";

// ---------------------------------------------------------------------------
// PATHS
// ---------------------------------------------------------------------------
const isVercel = process.env.VERCEL === "1";
const PDF_OUT_DIR = isVercel ? "/tmp/cv_pdfs" : join(homedir(), ".cv-platform", "pdfs");
if (!existsSync(PDF_OUT_DIR)) mkdirSync(PDF_OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// PDFMAKE SETUP — decode VFS fonts from base64 to Buffers
// ---------------------------------------------------------------------------
let _printer: any = null;
const getPrinter = () => {
  if (_printer) return _printer;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PdfPrinter = require("pdfmake/src/printer") as any;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfFonts = require("pdfmake/build/vfs_fonts") as any;
  const vfs = pdfFonts.pdfMake.vfs;

  const fontBuf = (name: string): Buffer | undefined => {
    const entry = vfs[name];
    if (!entry) return undefined;
    // VFS stores fonts as { content: base64string, contentType: '...' }
    if (entry && typeof entry.content === "string" && entry.content.length > 100) {
      return Buffer.from(entry.content, "base64");
    }
    // Fallback: might already be a buffer or raw string path
    return entry;
  };

  const fontDescriptor = {
    Roboto: {
      normal: fontBuf("Roboto-Regular.ttf"),
      bold: fontBuf("Roboto-Medium.ttf"),
      italics: fontBuf("Roboto-Italic.ttf"),
      bolditalics: fontBuf("Roboto-MediumItalic.ttf"),
    },
  };

  _printer = new PdfPrinter(fontDescriptor);
  return _printer;
};

// ---------------------------------------------------------------------------
// COLORS (matching LaTeX template)
// ---------------------------------------------------------------------------
const C = {
  accent: "#1b365d",
  sechdr: "#2d3748",
  bronze: "#8c7853",
  darkgray: "#333333",
  midgray: "#606774",
  lightgray: "#989ca5",
  lightrule: "#cbd5e0",
};

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
const emptyLine = (h = 4): any => ({ text: "", fontSize: h * 1.5 });

const bronzeRule = (): any => ({
  canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.6, lineColor: C.bronze }],
  margin: [0, 0, 0, 2],
});

const thinRule = (): any => ({
  canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: C.bronze }],
});

const accentRule = (): any => ({
  canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.6, lineColor: C.lightrule }],
});

// ---------------------------------------------------------------------------
// SECTION BUILDERS
// ---------------------------------------------------------------------------
const sidebarHeader = (title: string): any => ({
  stack: [
    { text: title.toUpperCase(), fontSize: 10.5, bold: true, color: C.accent, margin: [0, 2, 0, 0] },
    accentRule(),
    emptyLine(1),
  ],
});

const mainHeader = (title: string): any => ({
  stack: [
    { text: title.toUpperCase(), fontSize: 11, bold: true, color: C.accent, margin: [0, 4, 0, 0] },
    bronzeRule(),
    emptyLine(1.5),
  ],
});

const buildSidebarSection = (section: SidebarSection): any => {
  const items: any[] = [sidebarHeader(section.title)];

  if (section.title === "SKILL PROFICIENCY") {
    for (const item of section.items) {
      const [skill, rating] = item as [string, number];
      const filled = "\u2022"; // bullet
      const empty = "\u25CB"; // white circle
      const dots: string[] = [];
      for (let i = 0; i < 5; i++) dots.push(i < rating ? filled : empty);
      items.push({
        columns: [
          { text: skill, fontSize: 9, width: "auto", color: C.sechdr },
          { text: dots.join("  "), fontSize: 12, width: "auto", alignment: "right", color: C.bronze },
        ],
        margin: [0, 0, 0, 4],
      });
    }
  } else {
    for (const item of section.items) {
      if (Array.isArray(item)) {
        const [main, sub] = item as [string, string];
        items.push({ text: main, fontSize: 9, bold: true, color: C.sechdr, margin: [0, 1, 0, 0] });
        if (sub) {
          items.push({ text: sub, fontSize: 8, color: C.midgray, margin: [8, 0, 0, 1] });
        }
      } else {
        items.push({
          text: `\u2022  ${String(item)}`,
          fontSize: 9,
          color: C.sechdr,
          margin: [0, 1, 0, 0],
        });
      }
    }
  }

  items.push(emptyLine(2));
  return { stack: items };
};

const buildSummary = (text: string): any => ({
  stack: [
    mainHeader("Professional Summary"),
    { text: text, fontSize: 10, color: C.sechdr, lineHeight: 1.25, margin: [0, 0, 0, 4] },
  ],
});

const buildTimeline = (): any => {
  const timeline = [
    ["2008", "Etisalat/PTCL"], ["2014", "Independent"], ["2015", "Guardian ICS"],
    ["2017", "DQS-Pakistan"], ["2018", "Mace"], ["2020", "Power Intl."], ["2024", "Michael Kors"],
  ];
  return {
    stack: [
      mainHeader("Career Timeline"),
      {
        table: {
          headerRows: 1,
          widths: Array(7).fill("*"),
          body: [
            timeline.map(([y]) => ({ text: y, fontSize: 10.5, bold: true, color: C.accent, alignment: "center" })),
            [
              { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, color: C.bronze }], fillColor: undefined },
            ],
            timeline.map(([, c]) => ({ text: c, fontSize: 8.5, color: C.sechdr, alignment: "center" })),
          ],
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingTop: () => 2,
          paddingBottom: () => 2,
        },
        margin: [0, 0, 0, 4],
      },
    ],
  };
};

const buildExperience = (entries: ExperienceEntry[], isPage2: boolean): any => {
  const items: any[] = [];
  if (!isPage2) items.push(mainHeader("Professional Experience"));

  for (const e of entries) {
    const bullets: any[] = e.bullets.map((b) => ({
      text: [`\u2022  `, { text: b, fontSize: 9, color: C.sechdr }],
      fontSize: 9,
      margin: [8, 0, 0, 1],
      lineHeight: 1.2,
    }));

    items.push({
      stack: [
        {
          columns: [
            { text: e.title, fontSize: 9, bold: true, color: C.sechdr, width: "auto" },
            { text: e.dates, fontSize: 8, color: C.midgray, width: "auto", alignment: "right" },
          ],
          margin: [0, isPage2 ? 10 : 2, 0, 0],
        },
        {
          columns: [
            { text: e.company, fontSize: 8.5, italics: true, color: C.sechdr, width: "auto" },
            { text: e.location, fontSize: 8.5, italics: true, color: C.midgray, width: "auto", alignment: "right" },
          ],
          margin: [0, 0, 0, 2],
        },
        ...bullets,
      ],
    });
  }
  return { stack: items };
};

const buildEarlierCareer = (entries: EarlierCareerEntry[]): any => {
  if (!entries.length) return emptyLine();
  const items: any[] = [mainHeader("Earlier Career Summary")];
  for (const e of entries) {
    items.push({
      text: [
        { text: "\u2022  ", color: C.bronze },
        { text: e.company, bold: true, fontSize: 9, color: C.sechdr },
        { text: ", ", color: C.sechdr },
        { text: e.place, italics: true, fontSize: 9, color: C.sechdr },
        { text: "  ", color: C.midgray },
        { text: `| ${e.dates}`, color: C.midgray, fontSize: 9 },
      ],
      margin: [0, 2, 0, 0],
    });
    items.push({ text: e.oneLiner, fontSize: 9, color: C.midgray, margin: [16, 0, 0, 5] });
  }
  return { stack: items };
};

// ---------------------------------------------------------------------------
// BUILD FULL CV DOCUMENT DEFINITION
// ---------------------------------------------------------------------------
const buildCvDocument = (cv: CvData): any => {
  const sidebarP1: any[] = cv.sidebarPage1.map(buildSidebarSection);
  const sidebarP2: any[] = cv.sidebarPage2.map(buildSidebarSection);
  const summary = buildSummary(cv.summary);
  const timeline = buildTimeline();
  const expP1 = buildExperience(cv.experiencePage1, false);
  const expP2 = buildExperience(cv.experiencePage2, true);
  const earlier = buildEarlierCareer(cv.earlierCareer);

  return {
    pageSize: "A4",
    pageMargins: [37, 30, 37, 30],
    defaultStyle: { font: "Roboto", fontSize: 10, color: C.sechdr },
    content: [
      // === PAGE 1 ===
      { text: CANDIDATE.name, fontSize: 24, bold: true, color: C.accent, alignment: "center" },
      { text: cv.roleTitle, fontSize: 12, color: C.darkgray, alignment: "center", margin: [0, 0, 0, 2] },
      { text: CANDIDATE.contact, fontSize: 9, color: C.midgray, alignment: "center", margin: [0, 0, 0, 2] },
      thinRule(),
      emptyLine(1.5),

      {
        columns: [
          { width: "31%", stack: sidebarP1 },
          { width: "3%", text: "" },
          { width: "66%", stack: [summary, timeline, expP1] },
        ],
        columnGap: 0,
      },

      // === PAGE 2 ===
      { text: "", pageBreak: "before" },
      emptyLine(2),
      {
        text: "MUHAMMAD ALI BHATTI",
        bold: true,
        fontSize: 9,
        color: C.accent,
        alignment: "center",
      },
      {
        text: `Page 2  |  ${cv.roleShort}  |  ${CANDIDATE.email}  |  ${CANDIDATE.phone}`,
        fontSize: 8,
        color: C.midgray,
        alignment: "center",
        margin: [0, 0, 0, 4],
      },
      emptyLine(2),

      {
        columns: [
          { width: "31%", stack: sidebarP2 },
          { width: "3%", text: "" },
          { width: "66%", stack: [expP2, earlier] },
        ],
        columnGap: 0,
      },
    ],
    info: {
      title: `CV - Muhammad Ali Bhatti - ${cv.roleTitle}`,
      author: "Muhammad Ali Bhatti",
      subject: "Curriculum Vitae",
      creator: "Z.ai CV Platform",
    },
  };
};

// ---------------------------------------------------------------------------
// BUILD COVER LETTER DOCUMENT DEFINITION
// ---------------------------------------------------------------------------
const buildCoverLetterDocument = (cv: CvData, jobTitle: string, company?: string, extraKeywords?: string[]): any => {
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const para1 = `I am writing to express my strong interest in the ${jobTitle} position${company ? ` at ${company}` : ""}. With over 20 years of progressive international experience across Germany, the GCC, the UK, and Pakistan, and a proven track record of delivering measurable results in roles demanding both technical command and commercial instinct, I am confident that my background aligns closely with the requirements of this opportunity.`;
  const para2 = `As a ${cv.roleShort}, I have built a career on the kind of outcomes your role demands: ${cv.summary.split(".").slice(1, 3).join(". ").trim()}. My work has consistently paired technical rigor with the ability to win trust across industries, cultures, and senior stakeholders \u2014 translating complex requirements into practical systems that hold up to scrutiny while genuinely improving business performance.`;
  const para3 = `What draws me specifically to this opportunity is the chance to bring ${extraKeywords && extraKeywords.length > 0 ? `my expertise in ${extraKeywords.slice(0, 3).join(", ")}${extraKeywords.length > 3 ? ", and related areas" : ""}` : "my cross-border experience and audit-grade rigor"} to your team, and to contribute to ${company ? `${company}'s` : "your organization's"} continued growth. I am comfortable leading from the front in the field or advising from the boardroom, and I am open to international relocation should the role require it.`;
  const para4 = `I would welcome the opportunity to discuss how my experience can contribute to your team's continued success. Thank you for considering my application; I look forward to the possibility of speaking with you further.`;

  return {
    pageSize: "A4",
    pageMargins: [56, 50, 56, 50],
    defaultStyle: { font: "Roboto", fontSize: 11, color: C.sechdr, lineHeight: 1.5 },
    content: [
      { text: "MUHAMMAD ALI BHATTI", fontSize: 16, bold: true, color: C.accent, alignment: "center" },
      { text: CANDIDATE.contact, fontSize: 9, color: C.midgray, alignment: "center", margin: [0, 0, 0, 2] },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 483, y2: 0, lineWidth: 0.8, lineColor: C.bronze }] },
      emptyLine(3),
      { text: date, margin: [0, 0, 0, 8] },
      { text: company ? `To the Hiring Manager\n${company}` : "To the Hiring Committee", margin: [0, 0, 0, 8] },
      emptyLine(1.5),
      { text: [`Re: Application for `, { text: jobTitle + (company ? ` at ${company}` : ""), bold: true }], margin: [0, 0, 0, 8] },
      { text: "Dear Hiring Manager,", margin: [0, 0, 0, 4] },
      emptyLine(0.5),
      { text: para1, alignment: "justify", margin: [0, 0, 0, 4] },
      { text: para2, alignment: "justify", margin: [0, 0, 0, 4] },
      { text: para3, alignment: "justify", margin: [0, 0, 0, 4] },
      { text: para4, alignment: "justify", margin: [0, 0, 0, 4] },
      emptyLine(3),
      { text: "Yours sincerely," },
      emptyLine(4),
      { text: "Muhammad Ali Bhatti", bold: true, fontSize: 12 },
    ],
    info: {
      title: `Cover Letter - ${jobTitle}`,
      author: "Muhammad Ali Bhatti",
      creator: "Z.ai CV Platform",
    },
  };
};

// ---------------------------------------------------------------------------
// GENERATE PDF TO FILE
// ---------------------------------------------------------------------------
const generatePdfToFile = (docDefinition: any, pdfPath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const printer = getPrinter();
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const chunks: Buffer[] = [];
      pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on("end", () => {
        const pdfBuffer = Buffer.concat(chunks);
        writeFileSync(pdfPath, pdfBuffer);
        console.log(`[pdf] Generated: ${pdfPath} (${pdfBuffer.length} bytes)`);
        resolve(pdfPath);
      });
      pdfDoc.on("error", (err: Error) => {
        console.error("[pdf] Error:", err);
        reject(err);
      });
      pdfDoc.end();
    } catch (e) {
      reject(e);
    }
  });
};

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------
export interface GenerateCvResult {
  cvPdfPath: string;
  coverLetterPdfPath: string;
  cvTexContent: string;
  coverLetterTexContent: string;
}

/**
 * Generate a tailored CV + cover letter PDF from CvData.
 */
export const generateCvPdfs = async (
  cv: CvData,
  options?: { jobTitle?: string; company?: string; extraKeywords?: string[]; idPrefix?: string }
): Promise<GenerateCvResult> => {
  const id = options?.idPrefix || `cv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const cvPdfPath = join(PDF_OUT_DIR, `${id}_cv.pdf`);
  const clPdfPath = join(PDF_OUT_DIR, `${id}_cover.pdf`);

  // Build document definitions (store as JSON for debugging/reference)
  const cvDoc = buildCvDocument(cv);
  const clDoc = buildCoverLetterDocument(
    cv,
    options?.jobTitle || cv.roleTitle,
    options?.company,
    options?.extraKeywords
  );

  const cvTexContent = JSON.stringify(cvDoc, null, 2);
  const coverLetterTexContent = JSON.stringify(clDoc, null, 2);

  // Generate PDFs
  console.log("[pdf] Generating CV PDF...");
  await generatePdfToFile(cvDoc, cvPdfPath);

  console.log("[pdf] Generating cover letter PDF...");
  await generatePdfToFile(clDoc, clPdfPath);

  return { cvPdfPath, coverLetterPdfPath, cvTexContent, coverLetterTexContent };
};

/**
 * Read a PDF file as base64 (for sending via API response).
 */
export const readPdfAsBase64 = (pdfPath: string): string => {
  const buf = readFileSync(pdfPath);
  return buf.toString("base64");
};