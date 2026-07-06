const {
  Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle,
} = require("docx");
const fs = require("fs");
const { CV_VARIANTS, CANDIDATE } = require("/home/z/my-project/cv-platform/src/lib/cv-data");

async function main() {
  const cv = CV_VARIANTS[0];
  const outPath = "/home/z/my-project/download/CV_Muhammad_Ali_Bhatti_Editable.docx";

  const bulletPara = (text) => new Paragraph({
    spacing: { after: 80 }, bullet: { level: 0 },
    children: [new TextRun({ text, size: 20, font: "Calibri" })],
  });

  const goldLine = () => new Paragraph({
    spacing: { after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "8C7853" } }, children: [],
  });

  const sectionHead = (text) => new Paragraph({
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, size: 22, font: "Calibri", color: "1B365D" })],
  });

  const certPara = (name, desc) => new Paragraph({
    spacing: { after: 60 }, indent: { left: 360 },
    children: [
      new TextRun({ text: name + (desc ? " — " + desc : ""), bold: true, size: 20, font: "Calibri" }),
    ],
  });

  const expSections = [];
  for (const entry of [...cv.experiencePage1, ...cv.experiencePage2]) {
    expSections.push(
      new Paragraph({ spacing: { before: 200, after: 40 }, children: [
        new TextRun({ text: entry.title, bold: true, size: 22, font: "Calibri", color: "1B365D" }),
      ]}),
      new Paragraph({ spacing: { after: 40 }, children: [
        new TextRun({ text: `${entry.company}  |  ${entry.location}`, italics: true, size: 20, font: "Calibri", color: "505050" }),
        new TextRun({ text: `    ${entry.dates}`, size: 18, font: "Calibri", color: "6E6E6E" }),
      ]}),
      ...entry.bullets.map(b => bulletPara(b)),
    );
  }

  const earlierSections = cv.earlierCareer.map(e => new Paragraph({
    spacing: { after: 80 }, indent: { left: 360 },
    children: [
      new TextRun({ text: `${e.company}, ${e.place}  |  ${e.dates}`, bold: true, size: 20, font: "Calibri" }),
      new TextRun({ text: ` — ${e.oneLiner}`, size: 20, font: "Calibri", color: "505050" }),
    ],
  }));

  const skills = [], certs = [], langs = [];
  for (const sec of cv.sidebarPage1) {
    const t = sec.title.toUpperCase();
    for (const item of sec.items) {
      if (Array.isArray(item) && typeof item[1] === "string") {
        if (t.includes("CERTIF") || t.includes("CREDENTIAL")) certs.push([item[0], item[1]]);
        else skills.push(item[0]);
      } else if (typeof item === "string") {
        if (t.includes("LANG")) langs.push(item);
        else if (t.includes("CERTIF")) certs.push([item, ""]);
        else skills.push(item);
      }
    }
  }

  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children: [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [
      new TextRun({ text: "MUHAMMAD ALI BHATTI", bold: true, size: 36, font: "Calibri", color: "1B365D" }),
    ]}),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [
      new TextRun({ text: cv.roleTitle, size: 24, font: "Calibri", color: "8C7853" }),
    ]}),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [
      new TextRun({ text: "Lahore, Pakistan | +92 332 4862219 | marketbrain@gmail.com | Open to International Relocation", size: 18, font: "Calibri", color: "6E6E6E" }),
    ]}),
    goldLine(),
    sectionHead("PROFESSIONAL SUMMARY"),
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: cv.summary, size: 20, font: "Calibri" })] }),
    sectionHead("KEY COMPETENCIES"),
    ...skills.map(s => bulletPara(s)),
    ...(certs.length ? [sectionHead("CERTIFICATIONS"), ...certs.map(([n, d]) => certPara(n, d))] : []),
    ...(langs.length ? [sectionHead("LANGUAGES"), ...langs.map(l => bulletPara(l))] : []),
    sectionHead("PROFESSIONAL EXPERIENCE"),
    ...expSections,
    ...(earlierSections.length ? [sectionHead("EARLIER CAREER"), ...earlierSections] : []),
  ]}] });

  fs.mkdirSync("/home/z/my-project/download", { recursive: true });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buffer);
  console.log(`Done: ${outPath} (${buffer.length} bytes)`);
}

main().catch(e => { console.error(e); process.exit(1); });