/**
 * GET /api/test-tectonic
 * Diagnostic endpoint to test Tectonic on Vercel.
 */
import { NextResponse } from "next/server";
import { execSync, spawnSync } from "child_process";
import { existsSync, writeFileSync, mkdirSync, statSync, unlinkSync, readFileSync } from "fs";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  const steps: { step: string; ok: boolean; detail: string }[] = [];
  const log = (step: string, ok: boolean, detail: string) => {
    steps.push({ step, ok, detail });
    console.log(`[test] ${ok ? "OK" : "FAIL"} ${step}: ${detail}`);
  };

  log("ENV", true, `VERCEL=${process.env.VERCEL} HOME=${process.env.HOME} NODE=${process.version}`);

  try { mkdirSync("/tmp/tv", { recursive: true }); } catch {}

  try {
    writeFileSync("/tmp/tv/t.txt", "x");
    unlinkSync("/tmp/tv/t.txt");
    log("/tmp write", true, "ok");
  } catch (e: any) { log("/tmp write", false, e.message); }

  const tp = "/tmp/tectonic";
  try {
    if (!existsSync(tp)) {
      log("Download", true, "starting...");
      const out = execSync(
        "curl -fsSL https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.15.0/tectonic-0.15.0-x86_64-unknown-linux-gnu.tar.gz | tar xz -C /tmp tectonic 2>&1; ls -la /tmp/tectonic 2>&1",
        { timeout: 120000, encoding: "utf-8" }
      );
      log("Download out", true, out.substring(0, 500));
    }
    const s = statSync(tp);
    log("Binary", s.size > 1000000, `size=${s.size}`);
  } catch (e: any) { log("Download", false, e.message.substring(0, 300)); }

  try {
    const f = execSync("file /tmp/tectonic 2>&1", { encoding: "utf-8" });
    log("file type", true, f.trim());
  } catch (e: any) { log("file type", false, e.message.substring(0, 200)); }

  try {
    const l = execSync("ldd /tmp/tectonic 2>&1", { encoding: "utf-8" });
    log("ldd", true, l.trim().substring(0, 500));
  } catch (e: any) { log("ldd", false, e.message.substring(0, 200)); }

  try {
    execSync("chmod +x /tmp/tectonic 2>&1", { encoding: "utf-8" });
    log("chmod", true, "done");
  } catch (e: any) { log("chmod", false, e.message.substring(0, 200)); }

  const env = { ...process.env, HOME: "/tmp", XDG_CACHE_HOME: "/tmp" };
  try {
    const v = spawnSync("/tmp/tectonic", ["--version"], { captureOutput: true, text: true, timeout: 30000, env });
    log("version", v.status === 0, `exit=${v.status} out="${(v.stdout||"").trim()}" err="${(v.stderr||"").trim().substring(0,300)}"`);
  } catch (e: any) { log("version", false, e.message.substring(0, 300)); }

  try {
    writeFileSync("/tmp/tv/test.tex", "\\documentclass{article}\\begin{document}Hello\\end{document}");
    const c = spawnSync("/tmp/tectonic", ["-X", "compile", "/tmp/tv/test.tex", "-o", "/tmp/tv", "--keep-logs"], {
      captureOutput: true, text: true, timeout: 120000, env,
    });
    log("compile", c.status === 0, `exit=${c.status} err="${(c.stderr||"").substring(0,500)}" out="${(c.stdout||"").substring(0,500)}"`);
    if (existsSync("/tmp/tv/test.log")) {
      log("tex log", true, readFileSync("/tmp/tv/test.log", "utf-8").slice(-800));
    }
    log("pdf exists", existsSync("/tmp/tv/test.pdf"), existsSync("/tmp/tv/test.pdf") ? `size=${statSync("/tmp/tv/test.pdf").size}` : "no");
  } catch (e: any) { log("compile", false, e.message.substring(0, 300)); }

  return NextResponse.json({ steps });
}