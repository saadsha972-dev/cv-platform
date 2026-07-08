"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Search, Mail, Loader2, Download, ExternalLink, RefreshCw,
  Briefcase, Target, TrendingUp, Clock, CheckCircle2, AlertCircle,
  Sparkles, Wand2, Send, Eye, Filter, Globe, Trash2,
  ChevronRight, Zap, BarChart3, Users, ArrowUpRight, Star, Shield,
} from "lucide-react";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------
interface CvVariant {
  id: string; slug: string; roleTitle: string; roleShort: string; summary: string;
}
interface SearchProfile {
  id: string; name: string; countries: string; keywords: string;
  excludeKeywords: string | null; frequency: string; lastRunAt: string | null;
  cvVariant: { slug: string; roleTitle: string; roleShort: string };
}
interface JobPosting {
  id: string; title: string; company: string; location: string; url: string;
  description: string; source: string; matchScore: number; status: string; createdAt: string;
  searchProfile: { name: string; cvVariant: { slug: string; roleShort: string } };
}
interface JobAnalysis {
  jobTitle: string; company: string; location: string; industry: string;
  keywords: string[]; requirements: string[]; responsibilities: string[];
  seniority: string; tone: string;
}
interface TailoredContent {
  tailoredSummary: string; matchedKeywords: string[]; missingKeywords: string[];
}
interface RemoteJob {
  title: string; company: string; location: string; url: string;
  description: string; source: string; country: string; postedDate?: string;
}

// ---------------------------------------------------------------------------
// MAIN PAGE
// ---------------------------------------------------------------------------
export default function HomePage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* HEADER */}
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1b365d] to-[#0f2440] flex items-center justify-center shadow-lg shadow-[#1b365d]/20">
              <Briefcase className="w-5 h-5 text-[#c9a84c]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#1b365d] leading-tight tracking-tight">CV Platform</h1>
              <p className="text-[11px] text-slate-400 font-medium">Tailor &amp; Hunt &middot; Muhammad Ali Bhatti</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="hidden sm:flex border-[#c9a84c]/40 text-[#8c7853] bg-[#c9a84c]/5 text-xs font-medium">
              <Sparkles className="w-3 h-3 mr-1 text-[#c9a84c]" />
              AI-Powered
            </Badge>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 sm:px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8 max-w-xl mx-auto bg-slate-100/80 p-1 rounded-xl h-11">
            {[
              { v: "dashboard", icon: <BarChart3 className="w-4 h-4" />, label: "Dashboard" },
              { v: "tailor", icon: <Wand2 className="w-4 h-4" />, label: "CV Tailor" },
              { v: "hunter", icon: <Search className="w-4 h-4" />, label: "Job Hunter" },
              { v: "remote", icon: <Globe className="w-4 h-4" />, label: "Remote" },
            ].map((t) => (
              <TabsTrigger key={t.v} value={t.v} className="text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#1b365d] rounded-lg gap-1.5 transition-all">{t.icon}{t.label}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="dashboard"><DashboardTab onNavigate={setActiveTab} /></TabsContent>
          <TabsContent value="tailor"><TailorTab /></TabsContent>
          <TabsContent value="hunter"><HunterTab /></TabsContent>
          <TabsContent value="remote"><RemoteJobsTab /></TabsContent>
        </Tabs>
      </main>

      <footer className="mt-auto border-t border-slate-200/60 bg-white/60 backdrop-blur-sm py-4">
        <div className="container mx-auto px-4 text-center text-[11px] text-slate-400 font-medium">
          CV Platform &middot; AI-powered CV generation &amp; job matching
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DASHBOARD TAB
// ---------------------------------------------------------------------------
function DashboardTab({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [stats, setStats] = useState({ cvVariants: 0, searchProfiles: 0, jobs: 0, newJobs: 0 });
  const [loading, setLoading] = useState(true);
  const [recentJobs, setRecentJobs] = useState<JobPosting[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [cvRes, profileRes, jobsRes] = await Promise.all([
          fetch("/api/cv-variants"), fetch("/api/search-profiles"), fetch("/api/jobs?limit=8"),
        ]);
        const cvData = await cvRes.json();
        const profileData = await profileRes.json();
        const jobsData = await jobsRes.json();
        const jobs = jobsData.jobs || [];
        setStats({
          cvVariants: cvData.variants?.length || 0,
          searchProfiles: profileData.profiles?.length || 0,
          jobs: jobsData.jobs?.length || 0,
          newJobs: jobs.filter((j: JobPosting) => j.status === "new").length || 0,
        });
        setRecentJobs(jobs);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>;

  const scoreDistribution = [
    { label: "80%+", count: recentJobs.filter((j) => j.matchScore >= 80).length, color: "bg-emerald-500" },
    { label: "60-79%", count: recentJobs.filter((j) => j.matchScore >= 60 && j.matchScore < 80).length, color: "bg-amber-500" },
    { label: "&lt;60%", count: recentJobs.filter((j) => j.matchScore < 60).length, color: "bg-slate-300" },
  ];
  const maxCount = Math.max(...scoreDistribution.map((s) => s.count), 1);

  return (
    <div className="space-y-6">
      {/* HERO */}
      <Card className="border-0 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1b365d] via-[#162d50] to-[#0f2440]" />
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle at 25% 50%, #c9a84c 1px, transparent 1px), radial-gradient(circle at 75% 25%, #c9a84c 1px, transparent 1px)", backgroundSize: "40px 40px, 60px 60px" }} />
        <CardHeader className="relative z-10 pb-2 pt-8 px-6 sm:px-8">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-[#c9a84c] animate-pulse" />
            <span className="text-[11px] text-[#c9a84c] font-semibold uppercase tracking-widest">Live Dashboard</span>
          </div>
          <CardTitle className="text-2xl sm:text-3xl text-white font-bold tracking-tight">Welcome back, Muhammad</CardTitle>
          <CardDescription className="text-slate-400 text-sm mt-1 max-w-lg">
            Your AI-powered job application workflow — search, match, and generate tailored applications in seconds.
          </CardDescription>
        </CardHeader>
        <CardContent className="relative z-10 px-6 sm:px-8 pb-8 flex flex-wrap gap-3">
          <Button onClick={() => onNavigate("tailor")} className="bg-gradient-to-r from-[#c9a84c] to-[#a88a3a] hover:from-[#b89840] hover:to-[#9a7d35] text-white shadow-lg shadow-[#c9a84c]/20 font-medium rounded-lg px-5">
            <Wand2 className="w-4 h-4 mr-2" />Tailor a CV
          </Button>
          <Button onClick={() => onNavigate("hunter")} variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white font-medium rounded-lg px-5">
            <Search className="w-4 h-4 mr-2" />Search Jobs
          </Button>
        </CardContent>
      </Card>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: <FileText className="w-5 h-5" />, label: "CV Variants", value: stats.cvVariants, gradient: "from-[#1b365d] to-[#162d50]", iconColor: "#c9a84c" },
          { icon: <Target className="w-5 h-5" />, label: "Search Profiles", value: stats.searchProfiles, gradient: "from-[#2d3748] to-[#1a202c]", iconColor: "#8c7853" },
          { icon: <Briefcase className="w-5 h-5" />, label: "Jobs Found", value: stats.jobs, gradient: "from-[#1b365d] to-[#2d3748]", iconColor: "#c9a84c" },
          { icon: <Zap className="w-5 h-5" />, label: "New Matches", value: stats.newJobs, gradient: stats.newJobs > 0 ? "from-emerald-600 to-emerald-800" : "from-slate-500 to-slate-700", iconColor: stats.newJobs > 0 ? "#fff" : "#94a3b8" },
        ].map((s) => (
          <Card key={s.label} className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
            <CardContent className="p-0">
              <div className={`bg-gradient-to-br ${s.gradient} rounded-2xl p-5 relative overflow-hidden`}>
                <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center mb-3" style={{ color: s.iconColor }}>{s.icon}</div>
                  <p className="text-white/60 text-xs font-medium uppercase tracking-wider">{s.label}</p>
                  <p className="text-white text-3xl font-bold mt-0.5">{s.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* RECENT JOB MATCHES (2/3) */}
        <Card className="lg:col-span-2 border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-[#1b365d] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#c9a84c]" />
                  Recent Job Matches
                </CardTitle>
                <CardDescription className="text-xs mt-1">Latest jobs from all search profiles, sorted by relevance</CardDescription>
              </div>
              {recentJobs.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => onNavigate("hunter")} className="text-xs text-[#8c7853] hover:text-[#8c7853] hover:bg-[#8c7853]/5">
                  View All <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {recentJobs.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3"><Briefcase className="w-7 h-7 text-slate-300" /></div>
                <p className="text-sm text-slate-400 font-medium">No jobs found yet</p>
                <p className="text-xs text-slate-300 mt-1">Run a search to discover matching positions</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentJobs.slice(0, 6).map((job) => {
                  const scoreColor = job.matchScore >= 80 ? "text-emerald-600" : job.matchScore >= 60 ? "text-amber-600" : "text-slate-400";
                  const scoreBg = job.matchScore >= 80 ? "bg-emerald-50 border-emerald-200" : job.matchScore >= 60 ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200";
                  const barColor = job.matchScore >= 80 ? "bg-emerald-500" : job.matchScore >= 60 ? "bg-amber-500" : "bg-slate-300";
                  const initials = job.company.replace(/[^A-Z]/gi, "").slice(0, 2).toUpperCase() || "?";
                  const hue = job.company.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
                  return (
                    <div key={job.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 hover:shadow-md cursor-pointer group ${scoreBg} hover:border-[#c9a84c]/40`}
                      onClick={() => window.open(job.url, "_blank", "noopener,noreferrer")}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm" style={{ background: `hsl(${hue}, 40%, 45%)` }}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-[#1b365d] truncate group-hover:text-[#8c7853] transition-colors">{job.title}</h4>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500">
                          <span className="font-medium text-slate-600">{job.company}</span>
                          <span className="text-slate-300">&middot;</span>
                          <span>{job.location}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${job.matchScore}%` }} />
                          </div>
                          <span className={`text-xs font-bold ${scoreColor} w-8 text-right`}>{job.matchScore}%</span>
                        </div>
                        <Badge variant="outline" className="text-[9px] font-medium text-slate-400 border-slate-200 h-5">{job.source}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* SIDEBAR (1/3) */}
        <div className="space-y-6">
          {/* Score Distribution */}
          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-[#1b365d] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#c9a84c]" />
                Match Quality
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {scoreDistribution.map((s) => (
                <div key={s.label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-slate-600">{s.label}</span>
                    <span className="font-bold text-[#1b365d]">{s.count}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${s.color} transition-all duration-500`} style={{ width: `${(s.count / maxCount) * 100}%` }} />
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-[11px] text-slate-400 text-center">{recentJobs.length} total matches in last 3 weeks</p>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-[#1b365d] flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#c9a84c]" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {[
                { label: "Tailor CV", desc: "Paste a job posting", icon: <Wand2 className="w-4 h-4" />, tab: "tailor", color: "bg-[#1b365d]/5 text-[#1b365d] hover:bg-[#1b365d]/10" },
                { label: "Run Job Search", desc: "Find matching roles", icon: <Search className="w-4 h-4" />, tab: "hunter", color: "bg-[#8c7853]/5 text-[#8c7853] hover:bg-[#8c7853]/10" },
                { label: "Remote Jobs", desc: "Work-from-home roles", icon: <Globe className="w-4 h-4" />, tab: "remote", color: "bg-blue-50 text-blue-600 hover:bg-blue-100" },
              ].map((a) => (
                <button key={a.label} onClick={() => onNavigate(a.tab)} className={`w-full flex items-center gap-3 p-3 rounded-xl border border-slate-100 ${a.color} transition-all text-left group`}>
                  <div className="w-9 h-9 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">{a.icon}</div>
                  <div><p className="text-sm font-semibold">{a.label}</p><p className="text-[11px] opacity-60">{a.desc}</p></div>
                  <ChevronRight className="w-4 h-4 ml-auto opacity-30 group-hover:opacity-60 transition-opacity" />
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CV TAILOR TAB
// ---------------------------------------------------------------------------
function TailorTab() {
  const { toast: _toast } = useToast();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toastAny = (opts: any) => _toast(opts);
  const [variants, setVariants] = useState<CvVariant[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [jobPosting, setJobPosting] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    cvPdfBase64: string; coverLetterPdfBase64: string;
    jobAnalysis: JobAnalysis; tailoredContent: TailoredContent; generatedCvId: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/cv-variants").then((r) => r.json()).then((data) => {
      setVariants(data.variants || []);
      if (data.variants?.length) setSelectedSlug(data.variants[0].slug);
    });
  }, []);

  const handleTailor = async () => {
    if (!jobPosting.trim() || !selectedSlug) {
      toastAny({ title: "Missing input", description: "Please select a CV variant and paste a job posting.", variant: "destructive" });
      return;
    }
    setLoading(true); setResult(null);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90_000);
      const res = await fetch("/api/tailor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobPosting, cvVariantSlug: selectedSlug }), signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) { let errMsg = `Server error (${res.status})`; try { const err = await res.json(); errMsg = err.error || errMsg; } catch {} throw new Error(errMsg); }
      const data = await res.json();
      setResult({
        cvPdfBase64: data.cvPdfBase64 || "", coverLetterPdfBase64: data.coverLetterPdfBase64 || "", generatedCvId: data.generatedCvId || "",
        jobAnalysis: { jobTitle: data.jobAnalysis?.jobTitle || "Unknown", company: data.jobAnalysis?.company || "Unknown", location: data.jobAnalysis?.location || "", industry: data.jobAnalysis?.industry || "", seniority: data.jobAnalysis?.seniority || "", tone: data.jobAnalysis?.tone || "", keywords: Array.isArray(data.jobAnalysis?.keywords) ? data.jobAnalysis.keywords : [], requirements: Array.isArray(data.jobAnalysis?.requirements) ? data.jobAnalysis.requirements : [], responsibilities: Array.isArray(data.jobAnalysis?.responsibilities) ? data.jobAnalysis.responsibilities : [] },
        tailoredContent: { tailoredSummary: data.tailoredContent?.tailoredSummary || "", matchedKeywords: Array.isArray(data.tailoredContent?.matchedKeywords) ? data.tailoredContent.matchedKeywords : [], missingKeywords: Array.isArray(data.tailoredContent?.missingKeywords) ? data.tailoredContent.missingKeywords : [] },
      });
      toastAny({ title: "CV tailored!", description: `Generated for ${data.jobAnalysis?.jobTitle} at ${data.jobAnalysis?.company}` });
    } catch (err: any) {
      toastAny({ title: "CV generation failed", description: err.name === "AbortError" ? "Request timed out." : err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const downloadPdf = (base64: string, filename: string) => {
    const blob = new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#1b365d]"><Wand2 className="w-5 h-5 text-[#c9a84c]" />Tailor Your CV</CardTitle>
          <CardDescription>Paste a job posting — AI extracts keywords, matches them to your CV, and generates a tailored PDF.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">CV Variant</Label>
            <Select value={selectedSlug} onValueChange={setSelectedSlug}>
              <SelectTrigger><SelectValue placeholder="Select a CV variant" /></SelectTrigger>
              <SelectContent>{variants.map((v) => <SelectItem key={v.slug} value={v.slug}>{v.roleTitle}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Job Posting</Label>
            <Textarea placeholder="Paste the full job posting here..." value={jobPosting} onChange={(e) => setJobPosting(e.target.value)} className="min-h-[300px] font-mono text-xs border-slate-200 focus:border-[#8c7853]" />
            <p className="text-xs text-slate-400">{jobPosting.length} characters</p>
          </div>
          <Button onClick={handleTailor} disabled={loading || !jobPosting.trim() || !selectedSlug} className="w-full bg-gradient-to-r from-[#1b365d] to-[#162d50] hover:from-[#162d50] hover:to-[#0f2440] shadow-lg shadow-[#1b365d]/20 font-medium rounded-lg">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing &amp; Tailoring...</> : <><Sparkles className="w-4 h-4 mr-2" />Generate Tailored CV + Cover Letter</>}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#1b365d]"><FileText className="w-5 h-5 text-[#c9a84c]" />Generated Documents</CardTitle>
          <CardDescription>{result ? "Your tailored CV and cover letter are ready." : "Results will appear here after generation."}</CardDescription>
        </CardHeader>
        <CardContent>
          {!result && !loading && (<div className="flex flex-col items-center justify-center py-16 text-center"><div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4"><FileText className="w-8 h-8 text-slate-300" /></div><p className="text-sm text-slate-400 font-medium">No documents generated yet</p><p className="text-xs text-slate-300 mt-1">Paste a job posting and click Generate</p></div>)}
          {loading && (<div className="space-y-4 py-8">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>)}
          {result && !loading && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <h4 className="text-sm font-bold text-[#1b365d] mb-3 flex items-center gap-2"><Target className="w-4 h-4 text-[#c9a84c]" />Job Analysis</h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex gap-2"><span className="text-slate-400 w-16 shrink-0">Title</span><span className="font-medium text-slate-700">{result.jobAnalysis.jobTitle}</span></div>
                  <div className="flex gap-2"><span className="text-slate-400 w-16 shrink-0">Company</span><span className="font-medium text-slate-700">{result.jobAnalysis.company}</span></div>
                  {result.jobAnalysis.location && <div className="flex gap-2"><span className="text-slate-400 w-16 shrink-0">Location</span><span className="font-medium text-slate-700">{result.jobAnalysis.location}</span></div>}
                  {result.jobAnalysis.industry && <div className="flex gap-2"><span className="text-slate-400 w-16 shrink-0">Industry</span><span className="font-medium text-slate-700">{result.jobAnalysis.industry}</span></div>}
                </div>
                {result.jobAnalysis.keywords?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-slate-200">{result.jobAnalysis.keywords.slice(0, 15).map((kw: string) => <Badge key={kw} variant="secondary" className="text-[10px] bg-[#c9a84c]/10 text-[#8c7853] border-0 font-medium">{kw}</Badge>)}</div>
                )}
              </div>
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <h4 className="text-sm font-bold text-emerald-800 mb-2 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />Matched Keywords ({result.tailoredContent.matchedKeywords?.length || 0})</h4>
                <div className="flex flex-wrap gap-1">{(result.tailoredContent.matchedKeywords || []).map((kw: string) => <Badge key={kw} className="bg-emerald-100 text-emerald-700 text-[10px] border-0 font-medium">{kw}</Badge>)}</div>
              </div>
              {(result.tailoredContent.missingKeywords?.length || 0) > 0 && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <h4 className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-2"><AlertCircle className="w-4 h-4" />Gaps ({result.tailoredContent.missingKeywords.length})</h4>
                  <div className="flex flex-wrap gap-1">{result.tailoredContent.missingKeywords.map((kw: string) => <Badge key={kw} className="bg-amber-100 text-amber-700 text-[10px] border-0 font-medium">{kw}</Badge>)}</div>
                </div>
              )}
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={() => downloadPdf(result.cvPdfBase64, `CV_${(result.jobAnalysis.jobTitle || "CV").replace(/\s+/g, "_")}.pdf`)} className="bg-gradient-to-r from-[#1b365d] to-[#162d50] hover:from-[#162d50] hover:to-[#0f2440] shadow-md shadow-[#1b365d]/10 font-medium rounded-lg"><Download className="w-4 h-4 mr-2" />CV (PDF)</Button>
                <Button onClick={() => downloadPdf(result.coverLetterPdfBase64, `CoverLetter_${(result.jobAnalysis.company || "Company").replace(/\s+/g, "_")}.pdf`)} variant="outline" className="border-[#c9a84c]/40 text-[#8c7853] hover:bg-[#c9a84c]/10 font-medium rounded-lg"><Download className="w-4 h-4 mr-2" />Cover Letter (PDF)</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// JOB HUNTER TAB
// ---------------------------------------------------------------------------
function HunterTab() {
  const { toast: _toast } = useToast();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toastAny = (opts: any) => _toast(opts);
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchingProfileId, setSearchingProfileId] = useState<string | null>(null);
  const [minScore, setMinScore] = useState("0");
  const [clearing, setClearing] = useState(false);

  const loadProfiles = useCallback(async () => {
    try { const res = await fetch("/api/search-profiles"); const data = await res.json(); setProfiles(data.profiles || []); } catch {} finally { setLoadingProfiles(false); }
  }, []);

  const loadJobs = useCallback(async () => {
    try { const res = await fetch(`/api/jobs?limit=200&minScore=${minScore}&maxAgeDays=21`); const data = await res.json(); setJobs(data.jobs || []); } catch {} finally { setLoadingJobs(false); }
  }, [minScore]);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);
  useEffect(() => { loadJobs(); }, [loadJobs]);

  const handleSearchAll = async () => {
    setSearching(true);
    try {
      const res = await fetch("/api/search-run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (data.success) { toastAny({ title: "Search complete!", description: data.results.map((r: any) => `${r.profile}: ${r.saved} saved`).join(" \u00b7 ") }); loadJobs(); }
      else if (data.needsSetup) toastAny({ title: "Setup required", description: "Add GROQ_API_KEY and SERPER_API_KEY in Environment Variables.", variant: "destructive" });
      else throw new Error(data.error || "Search failed");
    } catch (err: any) { toastAny({ title: "Search failed", description: err.message, variant: "destructive" }); } finally { setSearching(false); }
  };

  const handleSearchSingle = async (profileId: string, profileName: string) => {
    setSearchingProfileId(profileId);
    try {
      const res = await fetch("/api/search-run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId }) });
      const data = await res.json();
      if (data.success) { const r = data.results?.[0]; toastAny({ title: `Done: ${profileName}`, description: r ? `Found ${r.found}, saved ${r.saved} jobs` : "Done" }); loadJobs(); loadProfiles(); }
      else throw new Error(data.error || "Search failed");
    } catch (err: any) { toastAny({ title: "Search failed", description: err.message, variant: "destructive" }); } finally { setSearchingProfileId(null); }
  };

  const handleClearOld = async () => {
    setClearing(true);
    try {
      const res = await fetch("/api/jobs?olderThanDays=30", { method: "DELETE" });
      const data = await res.json();
      toastAny({ title: "Cleared!", description: data.message });
      loadJobs();
    } catch (err: any) { toastAny({ title: "Clear failed", description: err.message, variant: "destructive" }); } finally { setClearing(false); }
  };

  const handleStatusUpdate = async (jobId: string, status: string) => {
    try { await fetch(`/api/jobs/${jobId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, status } : j)); } catch {}
  };

  const getStatusColor = (s: string) => {
    switch (s) { case "new": return "bg-blue-500"; case "applied": return "bg-emerald-500"; case "saved": return "bg-amber-500"; case "rejected": return "bg-red-400"; default: return "bg-slate-300"; }
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card className="border-0 overflow-hidden relative shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1b365d] via-[#162d50] to-[#0f2440]" />
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, #c9a84c 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
        <CardHeader className="relative z-10 pb-2 pt-6 px-6">
          <CardTitle className="text-xl flex items-center gap-2 text-white font-bold"><Search className="w-5 h-5 text-[#c9a84c]" />Job Hunter</CardTitle>
          <CardDescription className="text-slate-400 text-sm">AI-powered search — finds jobs matching your CV variants, scores them, and tracks applications.</CardDescription>
        </CardHeader>
        <CardContent className="relative z-10 px-6 pb-6 flex flex-wrap items-center gap-3">
          <Button onClick={handleSearchAll} disabled={searching} className="bg-gradient-to-r from-[#c9a84c] to-[#a88a3a] hover:from-[#b89840] hover:to-[#9a7d35] text-white shadow-lg shadow-[#c9a84c]/20 font-medium rounded-lg">
            {searching ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Searching...</> : <><Search className="w-4 h-4 mr-2" />Search All Profiles</>}
          </Button>
          <Button onClick={handleClearOld} disabled={clearing} variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white font-medium rounded-lg">
            <Trash2 className="w-4 h-4 mr-2" />Clear Jobs &gt; 30 days
          </Button>
        </CardContent>
      </Card>

      {/* Search Profiles */}
      {profiles.length > 0 && (
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base font-bold text-[#1b365d]">Search Profiles</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {profiles.map((p) => {
                const daysSince = p.lastRunAt ? Math.floor((Date.now() - new Date(p.lastRunAt).getTime()) / 86400000) : null;
                return (
                  <div key={p.id} className="p-4 rounded-xl border border-slate-200 hover:border-[#c9a84c]/40 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between">
                      <div className="font-semibold text-sm text-[#1b365d]">{p.name}</div>
                      {p.lastRunAt && (
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${daysSince !== null && daysSince <= 1 ? "bg-emerald-50 text-emerald-600" : daysSince !== null && daysSince <= 7 ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-400"}`}>
                          {daysSince === 0 ? "Today" : daysSince === 1 ? "Yesterday" : `${daysSince}d ago`}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-1"><Shield className="w-3 h-3" />{p.cvVariant.roleShort}</div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-1"><Globe className="w-3 h-3" />{p.countries}</div>
                    <div className="flex items-center gap-2 mt-3">
                      <Button size="sm" onClick={() => handleSearchSingle(p.id, p.name)} disabled={searchingProfileId === p.id} className="h-8 text-xs bg-[#1b365d] hover:bg-[#162d50] rounded-lg font-medium shadow-sm">
                        {searchingProfileId === p.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Search className="w-3 h-3 mr-1" />}
                        Search
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Found Jobs */}
      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-base font-bold text-[#1b365d] flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#c9a84c]" />
                Found Jobs
                <Badge variant="secondary" className="text-xs bg-[#1b365d]/10 text-[#1b365d] font-bold">{jobs.length}</Badge>
              </CardTitle>
              <CardDescription className="text-xs mt-1">Filtered to last 3 weeks &middot; Sorted by match score</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <Select value={minScore} onValueChange={setMinScore}>
                <SelectTrigger className="w-28 h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All Scores</SelectItem>
                  <SelectItem value="50">50%+</SelectItem>
                  <SelectItem value="60">60%+</SelectItem>
                  <SelectItem value="70">70%+</SelectItem>
                  <SelectItem value="80">80%+</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingJobs ? (<div className="space-y-3 py-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>) :
          jobs.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4"><Briefcase className="w-8 h-8 text-slate-300" /></div>
              <p className="text-sm text-slate-400 font-medium">No jobs found yet</p>
              <p className="text-xs text-slate-300 mt-1">Click &quot;Search All Profiles&quot; to discover matching positions</p>
            </div>
          ) : (
          <div className="max-h-[70vh] overflow-y-auto pr-1 space-y-3">
            {jobs.map((job) => {
              const scoreColor = job.matchScore >= 80 ? "text-emerald-600" : job.matchScore >= 60 ? "text-amber-600" : "text-slate-400";
              const barColor = job.matchScore >= 80 ? "bg-emerald-500" : job.matchScore >= 60 ? "bg-amber-500" : "bg-slate-300";
              const hue = job.company.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
              const initials = job.company.replace(/[^A-Z]/gi, "").slice(0, 2).toUpperCase() || "?";
              return (
                <div key={job.id} className="p-4 rounded-xl border border-slate-200 hover:border-[#c9a84c]/40 hover:shadow-md transition-all">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm" style={{ background: `hsl(${hue}, 40%, 45%)` }}>{initials}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-[#1b365d]">{job.title}</h4>
                        <Badge variant="outline" className="text-[9px] uppercase font-medium border-slate-200 text-slate-400">{job.source}</Badge>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                        <span className="font-medium text-slate-600">{job.company}</span>
                        <span className="text-slate-300">&middot;</span>
                        <span>{job.location}</span>
                        <span className="text-slate-300">&middot;</span>
                        <span className="text-slate-400">{job.searchProfile?.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-300" />
                        <span className="text-[11px] text-slate-400">{(() => { const d = new Date(job.createdAt); const now = new Date(); const days = Math.floor((now.getTime() - d.getTime()) / 86400000); return days === 0 ? "Today" : days === 1 ? "Yesterday" : days <= 7 ? days + "d ago" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); })()}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <div className="flex items-center gap-2">
                        <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${job.matchScore}%` }} />
                        </div>
                        <span className={`text-xs font-bold ${scoreColor} w-8 text-right`}>{job.matchScore}%</span>
                      </div>
                      <div className="flex gap-0.5">
                        {(["new", "applied", "saved", "rejected"] as const).map((s) => (
                          <button key={s} onClick={() => handleStatusUpdate(job.id, s)} className={`flex items-center gap-0.5 text-[9px] px-2 py-0.5 rounded-md font-medium transition-all ${job.status === s ? `${getStatusColor(s)} text-white shadow-sm` : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{s}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">{job.description}</p>
                  <div className="flex items-center gap-3 mt-3 pt-2 border-t border-slate-100">
                    <a href={job.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[#1b365d] font-medium hover:text-[#8c7853] transition-colors"><ExternalLink className="w-3 h-3" />View Job</a>
                    {job.url.includes("linkedin.com/jobs/view") && (
                      <button onClick={async () => { try { const text = job.title + " " + job.company + " " + job.description; navigator.clipboard.writeText(text); toastAny({ title: "Copied!", description: "Job text copied to clipboard" }); } catch {} }} className="inline-flex items-center gap-1 text-xs text-[#8c7853] font-medium hover:text-[#1b365d] transition-colors"><Eye className="w-3 h-3" />Copy for Tailor</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>)}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// REMOTE JOBS TAB
// ---------------------------------------------------------------------------
const REMOTE_COUNTRIES = ["All Countries", "USA", "Germany", "United Kingdom", "Australia", "Canada"];

function RemoteJobsTab() {
  const { toast: _toast } = useToast();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toastAny = (opts: any) => _toast(opts);
  const [jobs, setJobs] = useState<RemoteJob[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState("All Countries");
  const [filterCountry, setFilterCountry] = useState("All");

  const handleSearch = async () => {
    setSearching(true); setJobs([]);
    try {
      const body: any = {};
      if (selectedCountry !== "All Countries") body.country = selectedCountry;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);
      const res = await fetch("/api/remote-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
      clearTimeout(timeout);
      const data = await res.json();
      if (data.success && Array.isArray(data.jobs)) {
        setJobs(data.jobs);
        toastAny({ title: `Found ${data.jobs.length} remote jobs`, description: selectedCountry !== "All Countries" ? `Filtered to ${selectedCountry}` : "Across all countries" });
      } else throw new Error(data.error || "No remote jobs found");
    } catch (err: any) {
      toastAny({ title: "Remote search failed", description: err.name === "AbortError" ? "Search timed out." : err.message, variant: "destructive" });
    } finally { setSearching(false); }
  };

  const filteredJobs = filterCountry === "All" ? jobs : jobs.filter((j) => j.country === filterCountry);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card className="border-0 overflow-hidden relative shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1b365d] via-[#162d50] to-[#0f2440]" />
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "radial-gradient(circle at 20% 80%, #c9a84c 1px, transparent 1px)", backgroundSize: "35px 35px" }} />
        <CardHeader className="relative z-10 pb-2 pt-6 px-6">
          <CardTitle className="text-xl flex items-center gap-2 text-white font-bold"><Globe className="w-5 h-5 text-[#c9a84c]" />Remote Job Search</CardTitle>
          <CardDescription className="text-slate-400 text-sm">Authentic remote roles from LinkedIn, Indeed, Glassdoor, and dedicated remote job boards.</CardDescription>
        </CardHeader>
        <CardContent className="relative z-10 px-6 pb-6">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger className="w-52 bg-white/10 border-white/20 text-white rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>{REMOTE_COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={handleSearch} disabled={searching} className="bg-gradient-to-r from-[#c9a84c] to-[#a88a3a] hover:from-[#b89840] hover:to-[#9a7d35] text-white shadow-lg shadow-[#c9a84c]/20 font-medium rounded-lg">
              {searching ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Searching...</> : <><Search className="w-4 h-4 mr-2" />Search Remote Jobs</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-base font-bold text-[#1b365d] flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#c9a84c]" />
                Remote Jobs Found
                {filteredJobs.length > 0 && <Badge variant="secondary" className="text-xs bg-[#1b365d]/10 text-[#1b365d] font-bold">{filteredJobs.length}</Badge>}
              </CardTitle>
              <CardDescription className="text-xs mt-1">Authentic postings from credible job boards only</CardDescription>
            </div>
            {jobs.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <Select value={filterCountry} onValueChange={setFilterCountry}>
                  <SelectTrigger className="w-36 h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Countries</SelectItem>
                    <SelectItem value="USA">USA</SelectItem>
                    <SelectItem value="Germany">Germany</SelectItem>
                    <SelectItem value="United Kingdom">UK</SelectItem>
                    <SelectItem value="Australia">Australia</SelectItem>
                    <SelectItem value="Canada">Canada</SelectItem>
                    <SelectItem value="Global">Global</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {searching ? (<div className="space-y-3 py-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>) :
          filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4"><Globe className="w-8 h-8 text-slate-300" /></div>
              <p className="text-sm text-slate-400 font-medium">No remote jobs found yet</p>
              <p className="text-xs text-slate-300 mt-1">Select a country and click &quot;Search Remote Jobs&quot; to discover positions</p>
            </div>
          ) : (
          <div className="max-h-[80vh] overflow-y-auto pr-1">
            <div className="space-y-3">
              {filteredJobs.map((job, idx) => {
                const hue = (job.company || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
                const initials = job.company.replace(/[^A-Z]/gi, "").slice(0, 2).toUpperCase() || "?";
                return (
                  <div key={`${job.url}-${idx}`} className="p-4 rounded-xl border border-slate-200 hover:border-[#c9a84c]/40 hover:shadow-md transition-all">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm" style={{ background: `hsl(${hue}, 40%, 45%)` }}>{initials}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-[#1b365d]">{job.title}</h4>
                          <Badge variant="outline" className="text-[9px] uppercase font-medium border-slate-200 text-slate-400">{job.source}</Badge>
                          <Badge className="text-[9px] bg-blue-50 text-blue-600 border-blue-200 font-medium">Remote</Badge>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                          <span className="font-medium text-slate-600">{job.company}</span>
                          <span className="text-slate-300">&middot;</span>
                          <span>{job.location}</span>
                          <span className="text-slate-300">&middot;</span>
                          <span className="text-slate-400">{job.country}</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">{job.description}</p>
                    <div className="flex items-center gap-3 mt-3 pt-2 border-t border-slate-100">
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-[#1b365d] font-medium hover:text-[#8c7853] hover:bg-[#8c7853]/5 rounded-lg" onClick={() => window.open(job.url, "_blank", "noopener,noreferrer")}>
                        <ExternalLink className="w-3 h-3 mr-1" />View Job <ArrowUpRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>)}
        </CardContent>
      </Card>
    </div>
  );
}