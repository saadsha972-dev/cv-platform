/**
 * PDF CV Generator v10.0 — Artisan Gold & Navy Design
 */

import { jsPDF } from "jspdf";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

import { CANDIDATE, type CvData, type SidebarSection, type ExperienceEntry, type EarlierCareerEntry } from "./cv-data";

const isVercel = process.env.VERCEL === "1";
const PDF_OUT_DIR = isVercel ? "/tmp/cv_pdfs" : join(homedir(), ".cv-platform", "pdfs");
if (!existsSync(PDF_OUT_DIR)) mkdirSync(PDF_OUT_DIR, { recursive: true });

const PW = 210;
const PH = 297;
const ML = 18;
const MR = 15;
const RAIL_W = 1.8;
const CONTENT_X = ML + RAIL_W + 3;
const CW = PW - ML - MR - RAIL_W - 3;
const BOTTOM = PH - 12;

const C = {
  navy: [10, 30, 60], navyLt: [20, 50, 90],
  gold: [170, 130, 50], goldLt: [200, 170, 90], goldDim: [140, 110, 50],
  body: [40, 40, 40], mid: [75, 75, 75], gray: [105, 105, 105],
  lgray: [195, 195, 195], vlgray: [235, 235, 235], div: [220, 220, 220],
  white: [255, 255, 255], railBg: [240, 235, 225],
};

const F = {
  bannerName: 24, bannerTitle: 11.5, bannerContact: 8.5,
  secHdr: 11, body: 9, bullet: 8.5, small: 7.5, tiny: 7,
  skill: 8, certName: 8, expTitle: 10, expCompany: 8.5, tag: 7.5,
};

function setClr(doc: jsPDF, rgb: number[]) { doc.setTextColor(rgb[0], rgb[1], rgb[2]); }

function drawGoldRail(doc: jsPDF) {
  doc.setFillColor(C.railBg[0], C.railBg[1], C.railBg[2]);
  doc.rect(ML - 1, 0, RAIL_W + 2, PH, "F");
  doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]);
  doc.rect(ML, 0, RAIL_W, PH, "F");
  doc.setFillColor(C.goldLt[0], C.goldLt[1], C.goldLt[2]);
  doc.rect(ML + 0.6, 0, 0.5, PH, "F");
}

function goldLine(doc: jsPDF, y: number, x1: number, x2: number, w?: number) {
  doc.setDrawColor(C.gold[0], C.gold[1], C.gold[2]);
  doc.setLineWidth(w || 0.4);
  doc.line(x1, y, x2, y);
}

function goldDiamond(doc: jsPDF, cx: number, cy: number, size = 1.2) {
  const s = size / 2;
  doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]);
  doc.triangle(cx, cy - s, cx + s, cy, cx, cy + s, "F");
  doc.triangle(cx, cy - s, cx - s, cy, cx, cy + s, "F");
}

function navyRect(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setFillColor(C.navy[0], C.navy[1], C.navy[2]);
  doc.rect(x, y, w, h, "F");
}

function drawGoldTag(doc: jsPDF, text: string, x: number, y: number, maxW: number) {
  doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]);
  doc.rect(x, y - 3, 1, 3.5, "F");
  doc.setFontSize(F.tag);
  setClr(doc, C.body);
  doc.setFont("helvetica", "normal");
  doc.text(text, x + 2, y - 0.5, { maxWidth: maxW - 2.5 });
}

function sectionHdr(doc: jsPDF, title: string, y: number, x?: number, xR?: number): number {
  const lx = x ?? CONTENT_X;
  const rx = xR ?? CONTENT_X + CW;
  goldDiamond(doc, lx + 3, y - 0.5, 2.2);
  doc.setFontSize(F.secHdr);
  setClr(doc, C.navy);
  doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), lx + 8, y);
  goldLine(doc, y + 1.8, lx, rx, 0.35);
  return y + 6.5;
}

function pageFooter(doc: jsPDF, text: string, pageNum: number) {
  const fy = BOTTOM + 4;
  goldLine(doc, fy, ML, PW - MR, 0.25);
  doc.setFontSize(F.tiny);
  setClr(doc, C.gray);
  doc.setFont("helvetica", "normal");
  doc.text(text, ML + RAIL_W + 3, fy + 3);
  doc.text(`${pageNum}`, PW - MR, fy + 3, { align: "right" });
}

function categorizeSidebar(sections: SidebarSection[]) {
  const skills: string[] = [];
  const certs: Array<[string, string]> = [];
  const langs: string[] = [];
  const otherItems: Array<[string, string]> = [];
  for (const sec of sections) {
    const t = sec.title.toUpperCase();
    const isCert = t.includes("CERTIF") || t.includes("CREDENTIAL") || t.includes("TRAINING") || t.includes("LICENSE");
    const isLang = t.includes("LANG");
    const isSkill = t.includes("COMPET") || (t.includes("SKILL") && !t.includes("PROF")) || t.includes("PORTFOLIO") || t.includes("FOCUS");
    for (const item of sec.items) {
      if (Array.isArray(item) && typeof item[1] === "string") {
        if (isCert) certs.push([item[0], item[1]]);
        else if (isSkill) { skills.push(item[0]); otherItems.push([item[0], item[1]]); }
        else otherItems.push([item[0], item[1]]);
      } else if (typeof item === "string") {
        if (isCert) certs.push([item, ""]);
        else if (isLang) langs.push(item);
        else skills.push(item);
      }
    }
  }
  return { skills, certs, langs, otherItems };
}

function page1(doc: jsPDF, cv: CvData): void {
  drawGoldRail(doc);
  const bannerH = 40;
  navyRect(doc, 0, 0, PW, bannerH);
  doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]);
  doc.rect(0, 0, PW, 1.5, "F");
  doc.rect(0, bannerH - 1.2, PW, 1.2, "F");
  // Corner brackets
  doc.setFillColor(C.goldLt[0], C.goldLt[1], C.goldLt[2]);
  doc.rect(8, 6, 12, 0.6, "F"); doc.rect(8, 6, 0.6, 12, "F");
  doc.rect(PW - 20, 6, 12, 0.6, "F"); doc.rect(PW - 8.6, 6, 0.6, 12, "F");
  doc.rect(8, bannerH - 6.6, 12, 0.6, "F"); doc.rect(8, bannerH - 18, 0.6, 12, "F");
  doc.rect(PW - 20, bannerH - 6.6, 12, 0.6, "F"); doc.rect(PW - 8.6, bannerH - 18, 0.6, 12, "F");
  // Text
  doc.setFontSize(F.bannerName); setClr(doc, C.white); doc.setFont("helvetica", "bold");
  doc.text(CANDIDATE.name, PW / 2, 17, { align: "center" });
  doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]); doc.rect(PW / 2 - 30, 19.5, 60, 0.4, "F");
  doc.setFontSize(F.bannerTitle); doc.setFont("helvetica", "normal"); setClr(doc, C.goldLt);
  doc.text(cv.roleTitle, PW / 2, 25, { align: "center" });
  doc.setFontSize(F.bannerContact); setClr(doc, C.lgray);
  doc.text(CANDIDATE.contact, PW / 2, 34, { align: "center" });

  let y = bannerH + 8;
  // Summary
  y = sectionHdr(doc, "Professional Summary", y);
  doc.setFontSize(F.body); setClr(doc, C.body); doc.setFont("helvetica", "normal");
  const sumLines = doc.splitTextToSize(cv.summary, CW);
  const maxSumLines = Math.min(sumLines.length, 6);
  for (let i = 0; i < maxSumLines; i++) { doc.text(sumLines[i], CONTENT_X, y); y += 4.2; }
  y += 3;

  const { skills: allSkills, certs: allCerts, langs: allLangs, otherItems } = categorizeSidebar(cv.sidebarPage1);
  const gap = 8; const colW = (CW - gap) / 2;
  const leftX = CONTENT_X; const rightX = CONTENT_X + colW + gap;

  // Left: Key Competencies
  let leftY = y;
  doc.setFontSize(F.secHdr); setClr(doc, C.navy); doc.setFont("helvetica", "bold");
  goldDiamond(doc, leftX + 3, leftY - 0.5, 2);
  doc.text("KEY COMPETENCIES", leftX + 8, leftY);
  goldLine(doc, leftY + 1.8, leftX, leftX + colW, 0.3);
  leftY += 5.5;
  const tagColW = (colW - 6) / 2; let tagY = leftY;
  for (let i = 0; i < allSkills.length; i++) {
    if (tagY > BOTTOM - 6) break;
    const isRight = i % 2 === 1;
    drawGoldTag(doc, allSkills[i], isRight ? leftX + tagColW + 6 : leftX, tagY, tagColW - 2);
    if (isRight || i === allSkills.length - 1) tagY += 4.5;
  }

  // Right: Certifications (only if data) + Languages
  let rightY = y;
  if (allCerts.length > 0) {
    doc.setFontSize(F.secHdr); setClr(doc, C.navy); doc.setFont("helvetica", "bold");
    goldDiamond(doc, rightX + 3, rightY - 0.5, 2);
    doc.text("CERTIFICATIONS", rightX + 8, rightY);
    goldLine(doc, rightY + 1.8, rightX, rightX + colW, 0.3);
    rightY += 5.5;
    for (const [name, desc] of allCerts) {
      if (rightY > BOTTOM - 8) break;
      doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]); doc.circle(rightX + 2, rightY - 1, 0.5, "F");
      doc.setFontSize(F.certName); setClr(doc, C.body); doc.setFont("helvetica", "bold");
      doc.text(name, rightX + 5, rightY, { maxWidth: colW - 8 }); rightY += 3.5;
      if (desc) { doc.setFontSize(F.small); setClr(doc, C.gray); doc.setFont("helvetica", "normal"); doc.text(desc, rightX + 5, rightY, { maxWidth: colW - 8 }); rightY += 3.2; }
    }
    rightY += 2;
  }
  if (otherItems.length > 0 && allCerts.length === 0) {
    doc.setFontSize(F.secHdr); setClr(doc, C.navy); doc.setFont("helvetica", "bold");
    goldDiamond(doc, rightX + 3, rightY - 0.5, 2);
    doc.text("KEY QUALIFICATIONS", rightX + 8, rightY);
    goldLine(doc, rightY + 1.8, rightX, rightX + colW, 0.3);
    rightY += 5.5;
    for (const [name, desc] of otherItems) {
      if (rightY > BOTTOM - 8) break;
      doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]); doc.circle(rightX + 2, rightY - 1, 0.5, "F");
      doc.setFontSize(F.certName); setClr(doc, C.body); doc.setFont("helvetica", "bold");
      doc.text(name, rightX + 5, rightY, { maxWidth: colW - 8 }); rightY += 3.5;
      if (desc) { doc.setFontSize(F.small); setClr(doc, C.gray); doc.setFont("helvetica", "normal"); doc.text(desc, rightX + 5, rightY, { maxWidth: colW - 8 }); rightY += 3.2; }
    }
    rightY += 2;
  }
  if (allLangs.length > 0 && rightY < BOTTOM - 12) {
    rightY += 1;
    doc.setFontSize(F.secHdr); setClr(doc, C.navy); doc.setFont("helvetica", "bold");
    goldDiamond(doc, rightX + 3, rightY - 0.5, 2);
    doc.text("LANGUAGES", rightX + 8, rightY);
    goldLine(doc, rightY + 1.8, rightX, rightX + colW, 0.3);
    rightY += 5.5;
    for (const lang of allLangs) {
      if (rightY > BOTTOM - 6) break;
      doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]); doc.circle(rightX + 2, rightY - 1, 0.6, "F");
      doc.setFontSize(F.skill); setClr(doc, C.body); doc.setFont("helvetica", "normal");
      doc.text(lang, rightX + 5, rightY, { maxWidth: colW - 8 }); rightY += 4;
    }
  }

  y = Math.max(tagY, rightY) + 5;
  y = sectionHdr(doc, "Professional Experience", y);
  for (const entry of cv.experiencePage1) {
    if (y > BOTTOM - 22) break;
    y = drawExperience(doc, entry, y, BOTTOM, 4); y += 3.5;
  }
  pageFooter(doc, `${CANDIDATE.email}  |  ${CANDIDATE.phone}`, 1);
}

function page2(doc: jsPDF, cv: CvData): void {
  drawGoldRail(doc);
  let y = 14;
  navyRect(doc, 0, 0, PW, 10);
  doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]); doc.rect(0, 10, PW, 0.8, "F");
  doc.setFontSize(F.tiny); setClr(doc, C.white); doc.setFont("helvetica", "normal");
  doc.text(`${cv.roleShort}  |  ${CANDIDATE.email}  |  ${CANDIDATE.phone}`, PW / 2, 7, { align: "center" });
  goldLine(doc, y, CONTENT_X, CONTENT_X + CW, 0.35); y += 7;

  y = sectionHdr(doc, "Professional Experience", y);
  for (const entry of cv.experiencePage2) {
    if (y > BOTTOM - 20) break;
    y = drawExperience(doc, entry, y, BOTTOM, 4); y += 3;
  }

  const otherCerts: Array<[string, string]> = [];
  const education: Array<[string, string]> = [];
  const highlights: string[] = [];
  const skillProf: Array<[string, number]> = [];
  for (const sec of cv.sidebarPage2) {
    const t = sec.title.toUpperCase();
    if (t.includes("EDUCATION")) {
      for (const item of sec.items) {
        if (Array.isArray(item) && typeof item[1] === "string") education.push([item[0], item[1]]);
        else if (typeof item === "string") education.push([item, ""]);
      }
    } else if (t.includes("ADDITIONAL") || t.includes("INFO") || t.includes("METRIC") || t.includes("RECOGNITION") || t.includes("DASHBOARD") || t.includes("SALES") || t.includes("HIGHLIGHT") || t.includes("ACHIEVEMENT")) {
      for (const item of sec.items) {
        if (typeof item === "string") highlights.push(item);
        else if (Array.isArray(item) && typeof item[1] === "string") highlights.push(`${item[0]} - ${item[1]}`);
      }
    } else if (t.includes("SKILL PROF") || t.includes("PROFICIENCY")) {
      for (const item of sec.items) {
        if (Array.isArray(item) && typeof item[1] === "number") skillProf.push([item[0], item[1] as number]);
      }
    } else {
      for (const item of sec.items) {
        if (Array.isArray(item) && typeof item[1] === "string") otherCerts.push([item[0], item[1]]);
        else if (typeof item === "string") otherCerts.push([item, ""]);
      }
    }
  }

  const gap = 8; const colW = (CW - gap) / 2;
  const leftX = CONTENT_X; const rightX = CONTENT_X + colW + gap;
  let ly = y + 1;

  if (otherCerts.length > 0) {
    ly = sectionHdr(doc, "Additional Certifications", ly, leftX, leftX + colW);
    for (const [name, desc] of otherCerts) {
      if (ly > BOTTOM - 8) break;
      doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]); doc.circle(leftX + 2, ly - 1, 0.6, "F");
      doc.setFontSize(F.certName); setClr(doc, C.body); doc.setFont("helvetica", "bold");
      doc.text(name, leftX + 5, ly, { maxWidth: colW - 8 }); ly += 3.8;
      if (desc) { doc.setFontSize(F.small); setClr(doc, C.gray); doc.setFont("helvetica", "normal"); doc.text(desc, leftX + 6.5, ly, { maxWidth: colW - 10 }); ly += 3.2; }
    }
    ly += 2;
  }
  if (education.length > 0 && ly < BOTTOM - 15) {
    ly = sectionHdr(doc, "Education", ly, leftX, leftX + colW);
    for (const [name, desc] of education) {
      if (ly > BOTTOM - 8) break;
      doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]); doc.circle(leftX + 2, ly - 1, 0.6, "F");
      doc.setFontSize(F.certName); setClr(doc, C.body); doc.setFont("helvetica", "bold");
      doc.text(name, leftX + 5, ly, { maxWidth: colW - 8 }); ly += 3.8;
      if (desc) { doc.setFontSize(F.small); setClr(doc, C.gray); doc.setFont("helvetica", "normal"); doc.text(desc, leftX + 6.5, ly, { maxWidth: colW - 10 }); ly += 3.2; }
    }
    ly += 2;
  }

  let ry = y + 1;
  if (skillProf.length > 0) {
    ry = sectionHdr(doc, "Skill Proficiency", ry, rightX, rightX + colW);
    for (const [name, rating] of skillProf) {
      if (ry > BOTTOM - 6) break;
      doc.setFontSize(F.skill); setClr(doc, C.body); doc.setFont("helvetica", "normal");
      doc.text(name, rightX + 2, ry, { maxWidth: colW - 24 });
      const dotX = rightX + colW - 16;
      for (let i = 0; i < 5; i++) {
        const cx = dotX + i * 2.8;
        if (i < rating) { doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]); doc.circle(cx, ry - 1, 0.65, "F"); }
        else { doc.setDrawColor(C.lgray[0], C.lgray[1], C.lgray[2]); doc.setLineWidth(0.3); doc.circle(cx, ry - 1, 0.65, "S"); }
      }
      ry += 5;
    }
    ry += 2;
  }
  if (highlights.length > 0 && ry < BOTTOM - 12) {
    ry = sectionHdr(doc, "Highlights", ry, rightX, rightX + colW);
    for (const item of highlights) {
      if (ry > BOTTOM - 6) break;
      doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]); doc.circle(rightX + 2, ry - 1, 0.6, "F");
      doc.setFontSize(F.skill); setClr(doc, C.body); doc.setFont("helvetica", "normal");
      doc.text(item, rightX + 5, ry, { maxWidth: colW - 8 }); ry += 4;
    }
    ry += 2;
  }

  let ey = Math.max(ly, ry) + 1;
  if (cv.earlierCareer.length > 0 && ey < BOTTOM - 15) {
    ey = sectionHdr(doc, "Earlier Career", ey);
    for (const e of cv.earlierCareer) {
      if (ey > BOTTOM - 10) break;
      doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]); doc.circle(CONTENT_X + 2, ey - 1, 0.6, "F");
      doc.setFontSize(F.bullet); setClr(doc, C.body); doc.setFont("helvetica", "bold");
      const hdrText = `${e.company}, `; doc.text(hdrText, CONTENT_X + 5, ey);
      const hdrW = doc.getTextWidth(hdrText); doc.setFont("helvetica", "italic");
      doc.text(e.place, CONTENT_X + 5 + hdrW, ey);
      const placeW = doc.getTextWidth(e.place);
      doc.setFontSize(F.small); setClr(doc, C.gray); doc.setFont("helvetica", "normal");
      doc.text(`  |  ${e.dates}`, CONTENT_X + 5 + hdrW + placeW, ey); ey += 4;
      doc.setFontSize(F.bullet); setClr(doc, C.mid); doc.setFont("helvetica", "normal");
      const oneLines = doc.splitTextToSize(e.oneLiner, CW - 10);
      for (const line of oneLines) { if (ey > BOTTOM - 4) break; doc.text(line, CONTENT_X + 7, ey); ey += 4; }
      ey += 2;
    }
  }
  pageFooter(doc, `${CANDIDATE.email}  |  ${CANDIDATE.phone}`, 2);
}

function drawExperience(doc: jsPDF, e: ExperienceEntry, y: number, maxY: number, maxBullets: number = 4): number {
  if (y > maxY - 22) return y;
  // Gold accent bar
  doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]);
  doc.rect(CONTENT_X, y - 3, 2.5, 8, "F");
  doc.setFillColor(C.goldLt[0], C.goldLt[1], C.goldLt[2]);
  doc.rect(CONTENT_X + 1, y - 2, 0.5, 6, "F");
  // Title + dates row
  doc.setFontSize(F.expTitle); setClr(doc, C.navy); doc.setFont("helvetica", "bold");
  doc.text(e.title, CONTENT_X + 7, y, { maxWidth: CW - 50 });
  doc.setFontSize(F.small); setClr(doc, C.gray); doc.setFont("helvetica", "normal");
  doc.text(e.dates, CONTENT_X + CW, y, { align: "right" }); y += 4.5;
  // Company + location row
  doc.setFontSize(F.expCompany); setClr(doc, C.mid); doc.setFont("helvetica", "italic");
  doc.text(`${e.company}  |  ${e.location}`, CONTENT_X + 7, y, { maxWidth: CW - 12 }); y += 5;
  // Bullets
  setClr(doc, C.body); doc.setFont("helvetica", "normal");
  const bulletTextW = CW - 18;
  const bulletCount = Math.min(e.bullets.length, maxBullets);
  for (let i = 0; i < bulletCount; i++) {
    if (y > maxY - 10) break;
    doc.setFontSize(F.bullet); setClr(doc, C.body);
    const lines = doc.splitTextToSize(e.bullets[i], bulletTextW);
    for (let li = 0; li < lines.length; li++) {
      if (y > maxY - 5) break;
      // Small dot marker on each line (not a diamond — cleaner, no overlap)
      doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]);
      doc.circle(CONTENT_X + 9.5, y - 1.2, 0.45, "F");
      if (li > 0) {
        setClr(doc, C.mid);
      }
      doc.text(lines[li], CONTENT_X + 12.5, y);
      y += 4.2;
    }
    y += 1.5;
  }
  return y;
}

function buildCv(cv: CvData): Buffer {
  const doc = new jsPDF({ compress: true, unit: "mm", format: "a4" });
  page1(doc, cv); doc.addPage(); page2(doc, cv);
  return Buffer.from(doc.output("arraybuffer"));
}

function buildCoverLetter(cv: CvData, jobTitle: string, company?: string, extraKeywords?: string[], coverLetterText?: string): Buffer {
  const doc = new jsPDF({ compress: true, unit: "mm", format: "a4" });
  const left = 28; const right = PW - 22; const textW = right - left;
  const companyName = (company && company !== "Unknown" && company !== "Not specified") ? company : "";

  drawGoldRail(doc);
  const bannerH = 34;
  navyRect(doc, 0, 0, PW, bannerH);
  doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]);
  doc.rect(0, 0, PW, 1.2, "F"); doc.rect(0, bannerH - 0.8, PW, 0.8, "F");
  doc.setFillColor(C.goldLt[0], C.goldLt[1], C.goldLt[2]);
  doc.rect(8, 5, 10, 0.5, "F"); doc.rect(8, 5, 0.5, 10, "F");
  doc.rect(PW - 18, 5, 10, 0.5, "F"); doc.rect(PW - 8.5, 5, 0.5, 10, "F");
  doc.setFontSize(17); setClr(doc, C.white); doc.setFont("helvetica", "bold");
  doc.text("MUHAMMAD ALI BHATTI", PW / 2, 13, { align: "center" });
  doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]); doc.rect(PW / 2 - 25, 15.5, 50, 0.35, "F");
  doc.setFontSize(8.5); setClr(doc, C.lgray); doc.setFont("helvetica", "normal");
  doc.text("Lahore, Pakistan  |  +92 332 4862219  |  marketbrain@gmail.com", PW / 2, 22, { align: "center" });
  goldLine(doc, bannerH, 0, PW, 0.5);

  let y = bannerH + 14;
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  doc.setFontSize(10.5); setClr(doc, C.body); doc.setFont("helvetica", "normal");
  doc.text(date, left, y); y += 10;
  if (companyName) { doc.text("Hiring Manager", left, y); y += 6; doc.text(companyName, left, y); y += 10; }
  else { doc.text("Hiring Manager", left, y); y += 10; }
  doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
  const subject = companyName ? `Re: Application for ${jobTitle} at ${companyName}` : `Re: Application for ${jobTitle}`;
  doc.text(subject, left, y); y += 10;
  doc.setFont("helvetica", "normal"); doc.text("Dear Hiring Manager,", left, y); y += 8;

  const writePara = (text: string, spacing = 5) => {
    const lines = doc.splitTextToSize(text, textW);
    for (const line of lines) { doc.text(line, left, y); y += spacing; } y += 4;
  };

  setClr(doc, C.body); doc.setFontSize(10.5);
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

  y += 4; doc.text("Yours sincerely,", left, y); y += 16;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); setClr(doc, C.navy);
  doc.text("Muhammad Ali Bhatti", left, y);
  pageFooter(doc, "Cover Letter", 1);
  return Buffer.from(doc.output("arraybuffer"));
}

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
  console.log("[pdf] Generating CV PDF (v10 artisan design)...");
  const cvBuffer = buildCv(cv);
  writeFileSync(cvPdfPath, cvBuffer);
  console.log(`[pdf] CV saved: ${cvPdfPath} (${cvBuffer.length} bytes)`);
  console.log("[pdf] Generating cover letter...");
  const clBuffer = buildCoverLetter(cv, options?.jobTitle || cv.roleTitle, options?.company, options?.extraKeywords, options?.coverLetterText);
  writeFileSync(clPdfPath, clBuffer);
  console.log(`[pdf] Cover letter saved: ${clPdfPath} (${clBuffer.length} bytes)`);
  return {
    cvPdfPath, coverLetterPdfPath: clPdfPath,
    cvTexContent: JSON.stringify({ variant: cv.roleShort, design: "v10-artisan", timestamp: new Date().toISOString() }, null, 2),
    coverLetterTexContent: JSON.stringify({ jobTitle: options?.jobTitle, company: options?.company, variant: cv.roleShort, timestamp: new Date().toISOString() }, null, 2),
  };
};

export const readPdfAsBase64 = (pdfPath: string): string => {
  return readFileSync(pdfPath).toString("base64");
};