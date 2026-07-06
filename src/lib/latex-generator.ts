/**
 * PDF CV Generator v9.0 — Modern Full-Width Premium Design
 * ========================================================
 * No sidebar. Full-width layout with:
 *   - Navy header banner with white text
 *   - Two-column grid for skills/certs/education
 *   - Gold timeline accent on experience entries
 *   - Clean section headers with gold underlines
 *   - Maximum content room = zero overflow risk
 */

import { jsPDF } from "jspdf";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

import { CANDIDATE, type CvData, type SidebarSection, type ExperienceEntry, type EarlierCareerEntry } from "./cv-data";

// ---------------------------------------------------------------------------
// PATHS
// ---------------------------------------------------------------------------
const isVercel = process.env.VERCEL === "1";
const PDF_OUT_DIR = isVercel ? "/tmp/cv_pdfs" : join(homedir(), ".cv-platform", "pdfs");
if (!existsSync(PDF_OUT_DIR)) mkdirSync(PDF_OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// LAYOUT (A4 = 210 x 297mm)
// ---------------------------------------------------------------------------
const PW = 210;
const PH = 297;
const ML = 15;
const MR = 15;
const CW = PW - ML - MR; // 180mm — full width!

const BOTTOM = PH - 10; // 287mm

// ---------------------------------------------------------------------------
// COLORS
// ---------------------------------------------------------------------------
const C = {
  navy:   [0, 33, 71],
  gold:   [184, 134, 11],
  body:   [44, 44, 44],
  mid:    [80, 80, 80],
  gray:   [110, 110, 110],
  lgray:  [200, 200, 200],
  div:    [230, 230, 230],
  white:  [255, 255, 255],
  banner: [0, 33, 71],
};

// ---------------------------------------------------------------------------
// FONT SIZES
// ---------------------------------------------------------------------------
const F = {
  bannerName:  22,
  bannerTitle: 11,
  bannerContact: 8.5,
  secHdr:   11,
  body:     9.5,
  bullet:   9,
  small:    8,
  tiny:     7.5,
  skill:    8.5,
  certName: 8.5,
  expTitle: 10,
  expCompany: 9,
};

const BULLET = "\u2022";

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
function setClr(doc: jsPDF, rgb: number[]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function goldLine(doc: jsPDF, y: number, x1: number, x2: number, w?: number) {
  doc.setDrawColor(C.gold[0], C.gold[1], C.gold[2]);
  doc.setLineWidth(w || 0.4);
  doc.line(x1, y, x2, y);
}

function grayLine(doc: jsPDF, y: number, x1: number, x2: number) {
  doc.setDrawColor(C.div[0], C.div[1], C.div[2]);
  doc.setLineWidth(0.15);
  doc.line(x1, y, x2, y);
}

/** Section header: navy text + gold underline, returns Y after header. */
function sectionHdr(doc: jsPDF, title: string, y: number, x?: number, xR?: number): number {
  const lx = x ?? ML;
  const rx = xR ?? ML + CW;
  doc.setFontSize(F.secHdr);
  setClr(doc, C.navy);
  doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), lx, y);
  goldLine(doc, y + 1.5, lx, rx, 0.4);
  return y + 6;
}

/** Draw a filled navy rectangle. */
function navyRect(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setFillColor(C.banner[0], C.banner[1], C.banner[2]);
  doc.rect(x, y, w, h, "F");
}

// ---------------------------------------------------------------------------
// PAGE 1
// ---------------------------------------------------------------------------
function page1(doc: jsPDF, cv: CvData): void {
  // ── NAVY HEADER BANNER ──────────────────────────────────────────────
  const bannerH = 36;
  navyRect(doc, 0, 0, PW, bannerH);

  // Name
  doc.setFontSize(F.bannerName);
  setClr(doc, C.white);
  doc.setFont("helvetica", "bold");
  doc.text(CANDIDATE.name, PW / 2, 15, { align: "center" });

  // Title
  doc.setFontSize(F.bannerTitle);
  doc.setFont("helvetica", "normal");
  doc.text(cv.roleTitle, PW / 2, 23, { align: "center" });

  // Contact line
  doc.setFontSize(F.bannerContact);
  setClr(doc, C.lgray);
  doc.text(CANDIDATE.contact, PW / 2, 31, { align: "center" });

  // Gold accent line below banner
  goldLine(doc, bannerH, 0, PW, 0.8);

  let y = bannerH + 8;

  // ── PROFESSIONAL SUMMARY ───────────────────────────────────────────
  y = sectionHdr(doc, "Professional Summary", y);
  doc.setFontSize(F.body);
  setClr(doc, C.body);
  doc.setFont("helvetica", "normal");
  const sumLines = doc.splitTextToSize(cv.summary, CW);
  const maxSumLines = 5;
  for (let i = 0; i < Math.min(sumLines.length, maxSumLines); i++) {
    doc.text(sumLines[i], ML, y);
    y += 4.2;
  }
  y += 5;

  // ── TWO-COLUMN: COMPETENCIES + CERTIFICATIONS + LANGUAGES ─────────
  // Merge sidebar page 1 sections into a balanced two-column layout
  const colW = (CW - 6) / 2; // ~87mm each
  const leftX = ML;
  const rightX = ML + colW + 6;

  // Flatten all sidebarPage1 items into categories
  const allSkills: string[] = [];
  const allCerts: Array<[string, string]> = [];
  const allLangs: string[] = [];

  for (const sec of cv.sidebarPage1) {
    const t = sec.title.toUpperCase();
    if (t.includes("COMPET") || t.includes("SKILL") && !t.includes("PROF")) {
      for (const item of sec.items) {
        if (typeof item === "string") allSkills.push(item);
      }
    } else if (t.includes("CERTIF") || t.includes("CREDENTIAL") || t.includes("TRAINING")) {
      for (const item of sec.items) {
        if (Array.isArray(item) && typeof item[1] === "string") {
          allCerts.push([item[0], item[1]]);
        } else if (typeof item === "string") {
          allCerts.push([item, ""]);
        }
      }
    } else if (t.includes("LANG")) {
      for (const item of sec.items) {
        if (typeof item === "string") allLangs.push(item);
      }
    } else {
      // Catch-all: put in skills
      for (const item of sec.items) {
        if (typeof item === "string") allSkills.push(item);
      }
    }
  }

  // Left column: Skills (as a clean grid, 2 columns of bullets)
  doc.setFontSize(F.secHdr);
  setClr(doc, C.navy);
  doc.setFont("helvetica", "bold");
  doc.text("KEY COMPETENCIES", leftX, y);
  goldLine(doc, y + 1.5, leftX, leftX + colW, 0.3);

  // Skills in 2 sub-columns within the left column
  const skillColW = (colW - 4) / 2;
  const skillLeftX = leftX + 1;
  const skillRightX = leftX + skillColW + 4;
  let skillY = y + 5;

  doc.setFontSize(F.skill);
  setClr(doc, C.body);
  doc.setFont("helvetica", "normal");

  for (let i = 0; i < allSkills.length; i++) {
    if (skillY > BOTTOM - 4) break;
    const isRight = i % 2 === 1;
    const sx = isRight ? skillRightX : skillLeftX;
    // Gold bullet dot
    doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]);
    doc.circle(sx, skillY - 1, 0.5, "F");
    doc.text(allSkills[i], sx + 2.5, skillY, { maxWidth: skillColW - 4 });
    if (isRight || i === allSkills.length - 1) skillY += 3.8;
  }

  // Right column: Certifications + Languages
  let rightY = y;
  doc.setFontSize(F.secHdr);
  setClr(doc, C.navy);
  doc.setFont("helvetica", "bold");
  doc.text("CERTIFICATIONS", rightX, rightY);
  goldLine(doc, rightY + 1.5, rightX, rightX + colW, 0.3);
  rightY += 5;

  for (const [name, desc] of allCerts) {
    if (rightY > BOTTOM - 6) break;
    doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]);
    doc.circle(rightX + 1, rightY - 1, 0.5, "F");
    doc.setFontSize(F.certName);
    setClr(doc, C.body);
    doc.setFont("helvetica", "bold");
    doc.text(name, rightX + 3.5, rightY, { maxWidth: colW - 6 });
    rightY += 3.8;
    if (desc) {
      doc.setFontSize(F.small);
      setClr(doc, C.gray);
      doc.setFont("helvetica", "normal");
      doc.text(desc, rightX + 5, rightY, { maxWidth: colW - 8 });
      rightY += 3.5;
    }
  }

  // Languages under certs
  if (allLangs.length > 0 && rightY < BOTTOM - 12) {
    rightY += 2;
    doc.setFontSize(F.secHdr);
    setClr(doc, C.navy);
    doc.setFont("helvetica", "bold");
    doc.text("LANGUAGES", rightX, rightY);
    goldLine(doc, rightY + 1.5, rightX, rightX + colW, 0.3);
    rightY += 5;

    doc.setFontSize(F.skill);
    setClr(doc, C.body);
    doc.setFont("helvetica", "normal");
    for (const lang of allLangs) {
      if (rightY > BOTTOM - 4) break;
      doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]);
      doc.circle(rightX + 1, rightY - 1, 0.5, "F");
      doc.text(lang, rightX + 3.5, rightY, { maxWidth: colW - 6 });
      rightY += 3.8;
    }
  }

  // Y continues below the taller column
  y = Math.max(skillY, rightY) + 6;

  // ── PROFESSIONAL EXPERIENCE ────────────────────────────────────────
  y = sectionHdr(doc, "Professional Experience", y);

  for (const entry of cv.experiencePage1) {
    if (y > BOTTOM - 22) break;
    y = drawExperience(doc, entry, y, BOTTOM, 4);
    y += 4;
  }
}

// ---------------------------------------------------------------------------
// PAGE 2
// ---------------------------------------------------------------------------
function page2(doc: jsPDF, cv: CvData): void {
  let y = 12;

  // Slim header bar
  doc.setFontSize(F.tiny);
  setClr(doc, C.gray);
  doc.setFont("helvetica", "normal");
  doc.text(`${cv.roleShort}  |  ${CANDIDATE.email}  |  ${CANDIDATE.phone}`, PW / 2, y, { align: "center" });
  goldLine(doc, y + 2, ML, ML + CW, 0.4);
  y += 8;

  // ── EXPERIENCE (continued) ─────────────────────────────────────────
  y = sectionHdr(doc, "Professional Experience", y);
  for (const entry of cv.experiencePage2) {
    if (y > BOTTOM - 20) break;
    y = drawExperience(doc, entry, y, BOTTOM, 4);
    y += 3;
  }

  // ── TWO-COLUMN BOTTOM SECTIONS ─────────────────────────────────────
  // Collect all sidebarPage2 items
  const otherCerts: Array<[string, string]> = [];
  const education: Array<[string, string]> = [];
  const additionalInfo: string[] = [];
  const skillProf: Array<[string, number]> = [];
  const dashboards: string[] = [];

  for (const sec of cv.sidebarPage2) {
    const t = sec.title.toUpperCase();
    if (t.includes("EDUCATION")) {
      for (const item of sec.items) {
        if (Array.isArray(item) && typeof item[1] === "string") education.push([item[0], item[1]]);
        else if (typeof item === "string") education.push([item, ""]);
      }
    } else if (t.includes("ADDITIONAL") || t.includes("INFO") || t.includes("METRIC") || t.includes("RECOGNITION") || t.includes("DASHBOARD") || t.includes("SALES")) {
      for (const item of sec.items) {
        if (typeof item === "string") dashboards.push(item);
      }
    } else if (t.includes("SKILL PROF") || t.includes("PROFICIENCY")) {
      for (const item of sec.items) {
        if (Array.isArray(item) && typeof item[1] === "number") skillProf.push([item[0], item[1] as number]);
      }
    } else {
      // Other certs / trainings
      for (const item of sec.items) {
        if (Array.isArray(item) && typeof item[1] === "string") otherCerts.push([item[0], item[1]]);
        else if (typeof item === "string") otherCerts.push([item, ""]);
      }
    }
  }

  const colW = (CW - 6) / 2;
  const leftX = ML;
  const rightX = ML + colW + 6;

  // ── LEFT COLUMN: Other Certs + Education ───────────────────────────
  let ly = y + 2;

  if (otherCerts.length > 0) {
    ly = sectionHdr(doc, "Additional Certifications", ly, leftX, leftX + colW);
    for (const [name, desc] of otherCerts) {
      if (ly > BOTTOM - 6) break;
      doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]);
      doc.circle(leftX + 1, ly - 1, 0.5, "F");
      doc.setFontSize(F.certName);
      setClr(doc, C.body);
      doc.setFont("helvetica", "bold");
      doc.text(name, leftX + 3.5, ly, { maxWidth: colW - 6 });
      ly += 3.8;
      if (desc) {
        doc.setFontSize(F.small);
        setClr(doc, C.gray);
        doc.setFont("helvetica", "normal");
        doc.text(desc, leftX + 5, ly, { maxWidth: colW - 8 });
        ly += 3.5;
      }
    }
    ly += 2;
  }

  if (education.length > 0 && ly < BOTTOM - 15) {
    ly = sectionHdr(doc, "Education", ly, leftX, leftX + colW);
    for (const [name, desc] of education) {
      if (ly > BOTTOM - 6) break;
      doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]);
      doc.circle(leftX + 1, ly - 1, 0.5, "F");
      doc.setFontSize(F.certName);
      setClr(doc, C.body);
      doc.setFont("helvetica", "bold");
      doc.text(name, leftX + 3.5, ly, { maxWidth: colW - 6 });
      ly += 3.8;
      if (desc) {
        doc.setFontSize(F.small);
        setClr(doc, C.gray);
        doc.setFont("helvetica", "normal");
        doc.text(desc, leftX + 5, ly, { maxWidth: colW - 8 });
        ly += 3.5;
      }
    }
    ly += 2;
  }

  // ── RIGHT COLUMN: Skill Proficiency + Additional Info ──────────────
  let ry = y + 2;

  if (skillProf.length > 0) {
    ry = sectionHdr(doc, "Skill Proficiency", ry, rightX, rightX + colW);
    for (const [name, rating] of skillProf) {
      if (ry > BOTTOM - 6) break;
      doc.setFontSize(F.skill);
      setClr(doc, C.body);
      doc.setFont("helvetica", "normal");
      doc.text(name, rightX + 2, ry, { maxWidth: colW - 22 });
      // Dots
      const dotX = rightX + colW - 14;
      const dotY = ry - 1;
      for (let i = 0; i < 5; i++) {
        const cx = dotX + i * 2.5;
        if (i < rating) {
          doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]);
          doc.circle(cx, dotY, 0.55, "F");
        } else {
          doc.setDrawColor(C.div[0], C.div[1], C.div[2]);
          doc.circle(cx, dotY, 0.55, "S");
        }
      }
      ry += 4.5;
    }
    ry += 2;
  }

  if (dashboards.length > 0 && ry < BOTTOM - 12) {
    ry = sectionHdr(doc, "Highlights", ry, rightX, rightX + colW);
    doc.setFontSize(F.skill);
    setClr(doc, C.body);
    doc.setFont("helvetica", "normal");
    for (const item of dashboards) {
      if (ry > BOTTOM - 5) break;
      doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]);
      doc.circle(rightX + 1, ry - 1, 0.5, "F");
      doc.text(item, rightX + 3.5, ry, { maxWidth: colW - 6 });
      ry += 3.8;
    }
    ry += 2;
  }

  // ── EARLIER CAREER (full width, below both columns) ───────────────
  let ey = Math.max(ly, ry) + 2;

  if (cv.earlierCareer.length > 0 && ey < BOTTOM - 15) {
    ey = sectionHdr(doc, "Earlier Career", ey);
    for (const e of cv.earlierCareer) {
      if (ey > BOTTOM - 10) break;
      doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]);
      doc.circle(ML + 1, ey - 1, 0.5, "F");
      doc.setFontSize(F.bullet);
      setClr(doc, C.body);
      doc.setFont("helvetica", "bold");
      const hdrText = `${e.company}, `;
      doc.text(hdrText, ML + 3.5, ey);
      const hdrW = doc.getTextWidth(hdrText);
      doc.setFont("helvetica", "italic");
      doc.text(e.place, ML + 3.5 + hdrW, ey);
      const placeW = doc.getTextWidth(e.place);
      doc.setFontSize(F.small);
      setClr(doc, C.gray);
      doc.setFont("helvetica", "normal");
      doc.text(`  |  ${e.dates}`, ML + 3.5 + hdrW + placeW, ey);
      ey += 4;
      doc.setFontSize(F.bullet);
      setClr(doc, C.mid);
      doc.setFont("helvetica", "normal");
      const oneLines = doc.splitTextToSize(e.oneLiner, CW - 8);
      for (const line of oneLines) {
        if (ey > BOTTOM - 4) break;
        doc.text(line, ML + 5, ey);
        ey += 3.8;
      }
      ey += 2;
    }
  }
}

// ---------------------------------------------------------------------------
// EXPERIENCE ENTRY — with gold timeline accent
// ---------------------------------------------------------------------------
function drawExperience(doc: jsPDF, e: ExperienceEntry, y: number, maxY: number, maxBullets: number = 4): number {
  if (y > maxY - 20) return y;

  // Gold timeline accent bar (2mm wide, left edge)
  doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]);
  doc.rect(ML, y - 2.5, 2, 6, "F");

  // Job title (bold navy) + dates (right-aligned gray)
  doc.setFontSize(F.expTitle);
  setClr(doc, C.navy);
  doc.setFont("helvetica", "bold");
  doc.text(e.title, ML + 6, y, { maxWidth: CW - 45 });
  doc.setFontSize(F.small);
  setClr(doc, C.gray);
  doc.setFont("helvetica", "normal");
  doc.text(e.dates, ML + CW, y, { align: "right" });
  y += 4;

  // Company + Location on one line
  doc.setFontSize(F.expCompany);
  setClr(doc, C.mid);
  doc.setFont("helvetica", "italic");
  const companyText = `${e.company}  |  ${e.location}`;
  doc.text(companyText, ML + 6, y, { maxWidth: CW - 10 });
  y += 4;

  // Bullets
  setClr(doc, C.body);
  doc.setFont("helvetica", "normal");
  const bulletCount = Math.min(e.bullets.length, maxBullets);
  for (let i = 0; i < bulletCount; i++) {
    if (y > maxY - 6) break;
    // Small gold bullet
    doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]);
    doc.circle(ML + 8, y - 1, 0.4, "F");
    setClr(doc, C.body);
    doc.setFontSize(F.bullet);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(e.bullets[i], CW - 16);
    for (const line of lines) {
      if (y > maxY - 4) break;
      doc.text(line, ML + 12, y);
      y += 3.6;
    }
    y += 1.2;
  }
  return y;
}

// ---------------------------------------------------------------------------
// BUILD CV PDF
// ---------------------------------------------------------------------------
function buildCv(cv: CvData): Buffer {
  const doc = new jsPDF({ compress: true, unit: "mm", format: "a4" });
  page1(doc, cv);
  doc.addPage();
  page2(doc, cv);
  return Buffer.from(doc.output("arraybuffer"));
}

// ---------------------------------------------------------------------------
// BUILD COVER LETTER PDF
// ---------------------------------------------------------------------------
function buildCoverLetter(
  cv: CvData,
  jobTitle: string,
  company?: string,
  extraKeywords?: string[],
  coverLetterText?: string
): Buffer {
  const doc = new jsPDF({ compress: true, unit: "mm", format: "a4" });

  const left = 25;
  const right = PW - 25;
  const textW = right - left;
  const companyName = (company && company !== "Unknown" && company !== "Not specified") ? company : "";

  // Navy header banner
  navyRect(doc, 0, 0, PW, 30);
  doc.setFontSize(16);
  setClr(doc, C.white);
  doc.setFont("helvetica", "bold");
  doc.text("MUHAMMAD ALI BHATTI", PW / 2, 12, { align: "center" });
  doc.setFontSize(8.5);
  setClr(doc, C.lgray);
  doc.setFont("helvetica", "normal");
  doc.text("Lahore, Pakistan  |  +92 332 4862219  |  marketbrain@gmail.com", PW / 2, 21, { align: "center" });

  goldLine(doc, 30, 0, PW, 0.6);

  let y = 42;

  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  doc.setFontSize(10.5);
  setClr(doc, C.body);
  doc.setFont("helvetica", "normal");
  doc.text(date, left, y);
  y += 10;

  if (companyName) {
    doc.text("Hiring Manager", left, y); y += 6;
    doc.text(companyName, left, y); y += 10;
  } else {
    doc.text("Hiring Manager", left, y); y += 10;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  const subject = companyName ? `Re: Application for ${jobTitle} at ${companyName}` : `Re: Application for ${jobTitle}`;
  doc.text(subject, left, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.text("Dear Hiring Manager,", left, y);
  y += 8;

  const writePara = (text: string, spacing = 5) => {
    const lines = doc.splitTextToSize(text, textW);
    for (const line of lines) { doc.text(line, left, y); y += spacing; }
    y += 4;
  };

  setClr(doc, C.body);
  doc.setFontSize(10.5);

  if (coverLetterText) {
    const paras = coverLetterText.split(/\n\n+/).filter(p => p.trim());
    for (const para of paras) writePara(para.trim());
  } else {
    writePara(`I am writing to express my strong interest in the ${jobTitle} position${companyName ? ` at ${companyName}` : ""}. With over 20 years of progressive international experience across Germany, the GCC, the UK, and Pakistan, and a proven track record of delivering measurable results in roles demanding both technical command and commercial acumen, I am confident that my background aligns closely with the requirements of this opportunity.`);
    writePara(`Throughout my career, I have successfully led cross-functional teams, managed regulatory compliance across multiple jurisdictions, and delivered measurable outcomes for complex multi-site operations. My certifications and hands-on expertise provide a strong technical foundation for this role, while my international experience enables me to navigate diverse cultural and business environments effectively.`);
    const kw = extraKeywords && extraKeywords.length > 0 ? extraKeywords.slice(0, 4).join(", ") : "";
    const p3 = kw
      ? `What draws me specifically to this opportunity is the chance to bring my expertise in ${kw} to your team${companyName ? `, and to contribute to ${companyName}'s continued growth and success` : ""}. I am equally comfortable leading from the front in the field or advising from the boardroom, and I am open to international relocation should the role require it.`
      : `What draws me to this opportunity is the strong alignment between my career achievements and the demands of this role. I am equally comfortable leading from the front in the field or advising from the boardroom, and I am open to international relocation should the role require it.`;
    writePara(p3);
    writePara(`I would welcome the opportunity to discuss how my experience and qualifications can add value to your team. I am available for an interview at your earliest convenience and can be reached at +92 332 4862219 or marketbrain@gmail.com. Thank you for considering my application.`);
  }

  y += 4;
  doc.text("Yours sincerely,", left, y);
  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setClr(doc, C.navy);
  doc.text("Muhammad Ali Bhatti", left, y);

  return Buffer.from(doc.output("arraybuffer"));
}

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------
export interface GenerateCvResult {
  cvPdfPath: string;
  coverLetterPdfPath: string;
  cvTexContent: string;
  coverLetterTexContent: string;
}

export const generateCvPdfs = async (
  cv: CvData,
  options?: { jobTitle?: string; company?: string; extraKeywords?: string[]; idPrefix?: string; coverLetterText?: string }
): Promise<GenerateCvResult> => {
  const id = options?.idPrefix || `cv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const cvPdfPath = join(PDF_OUT_DIR, `${id}_cv.pdf`);
  const clPdfPath = join(PDF_OUT_DIR, `${id}_cover.pdf`);

  console.log("[pdf] Generating CV PDF...");
  const cvBuffer = buildCv(cv);
  writeFileSync(cvPdfPath, cvBuffer);
  console.log(`[pdf] CV saved: ${cvPdfPath} (${cvBuffer.length} bytes)`);

  console.log("[pdf] Generating cover letter...");
  const clBuffer = buildCoverLetter(cv, options?.jobTitle || cv.roleTitle, options?.company, options?.extraKeywords, options?.coverLetterText);
  writeFileSync(clPdfPath, clBuffer);
  console.log(`[pdf] Cover letter saved: ${clPdfPath} (${clBuffer.length} bytes)`);

  return {
    cvPdfPath,
    coverLetterPdfPath: clPdfPath,
    cvTexContent: JSON.stringify({ variant: cv.roleShort, timestamp: new Date().toISOString() }, null, 2),
    coverLetterTexContent: JSON.stringify({ jobTitle: options?.jobTitle, company: options?.company, variant: cv.roleShort, timestamp: new Date().toISOString() }, null, 2),
  };
};

export const readPdfAsBase64 = (pdfPath: string): string => {
  return readFileSync(pdfPath).toString("base64");
};