import { NextRequest, NextResponse } from "next/server";
import { sql, hasDb, logEvent } from "@/lib/db";
import { gemini, parseJson } from "@/lib/gemini";
import { FACT_SHEET } from "@/lib/facts";
import { pool } from "@/lib/pool";
import { programish, applyGuards } from "@/lib/guard";
export const maxDuration = 300;

type Found = { name: string; role?: string; org: string; email?: string; url?: string; field?: string; paid?: string; location?: string; remote?: boolean; fit?: number; why?: string };

// Robotics is deliberately last in every rotation.
const MAIN_AREAS = [
  "AI agents and LLM systems", "applied machine learning and data science",
  "computer science and software systems research", "applied mathematics and computational science",
  "finance, fintech and business data",
  "software engineering and cloud systems", "product, business strategy and entrepreneurship", "cybersecurity",
  "human-computer interaction and education technology",
];
const ROBOTICS = "robotics (lowest priority)";
const REGIONS = [
  "Georgia and the Atlanta area (in person)", "the Southeast U.S.", "the Northeast U.S.", "the Midwest U.S.", "the West Coast",
  "Texas and the Southwest", "the Mid-Atlantic U.S.", "national labs and non-university research institutes",
  "medical schools and hospital research groups", "remote-friendly labs anywhere in the U.S.",
];
const KINDS = [
  "early-stage startups with a founder or engineer to email", "Atlanta and Georgia startups and small companies (in person)", "small and mid-size software companies",
  "fintech and finance startups and small firms", "AI startups and small AI companies", "small consulting and data-analytics firms",
  "health, biotech and education-technology startups", "civic-tech startups and small technology nonprofits",
];

const combos = (variants: string[]) => [...MAIN_AREAS.flatMap((a) => variants.map((v) => [a, v])), ...variants.map((v) => [ROBOTICS, v])];

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new NextResponse("no", { status: 401 });
  if (!hasDb()) return NextResponse.json({ error: "no db" }, { status: 400 });
  const q = req.nextUrl.searchParams;
  const n = Math.min(Number(q.get("n")) || 6, 8);
  const slot = Number(q.get("slot")) || 0;
  const slots = Number(q.get("slots")) || 3;
  const offset = Number(q.get("offset")) || 0;
  const day = Math.floor(Date.now() / 864e5);

  const jobs: { track: "academia" | "corporate"; area: string; variant: string }[] = [];
  for (const track of ["academia", "corporate"] as const) {
    const list = combos(track === "academia" ? REGIONS : KINDS);
    const start = (day * n * slots + slot * n + offset) % list.length;
    for (let i = 0; i < n; i++) { const [area, variant] = list[(start + i) % list.length]; jobs.push({ track, area, variant }); }
  }

  let added = 0, failed = 0, skipped = 0, errMsg = "";
  await pool(jobs, 5, async ({ track, area, variant }) => {
    const ask = track === "academia"
      ? `Find up to 10 real professors, postdocs, research scientists or lab leads (focus on: ${variant}) working in "${area}" who plausibly take a high school senior (a strong student with Georgia Tech dual enrollment in computer science and math, a software engineering internship, and startup and student leadership experience) as a summer 2027 research assistant, paid or unpaid, in person or remote. Judge fit on the student's overall profile and general readiness, not on any one project. Only individual people who personally run or work in a research group: never admissions offices, summer or outreach programs, program coordinators, REU or fellowship programs, or department-wide inboxes. Prefer labs with public contact emails, undergraduate or high-school student pages, or past high-school interns. Include lesser-known labs, not just famous ones. At most one person per lab.`
      : `Find up to 10 real startups, small businesses and small-to-mid-size companies (focus on: ${variant}) with work in "${area}" that could plausibly give a high school senior a summer 2027 internship or part-time engineering, data, or business work. Each must have a named founder, CTO, engineering manager or hiring manager with a publicly listed email. Prefer companies under 500 employees and paid roles. Do NOT include large corporations' formal internship, university-recruiting or early-talent programs, academies, fellowships, accelerators, pre-college programs, or generic inboxes such as info@, careers@ or recruiting@. At most one person per company.`;
    const prompt = `${ask}
Use web search. Only include people or organizations you actually found evidence for. Never invent an email address; leave "email" empty unless it is publicly listed on a page you saw.
Return ONLY a JSON array of objects: {"name","role","org","email","url","field","paid":"paid|unpaid|unknown","location","remote":true|false,"fit":0-100,"why":"one sentence on why they fit this student"}.
Student: ${FACT_SHEET.split("\n")[0]}`;
    try {
      const { text, sources } = await gemini(prompt, { search: true });
      const rows = parseJson<Found[]>(text);
      for (const r of rows) {
        if (!r.name || !r.org) continue;
        if (programish({ name: r.name, role: r.role, org: r.org, email: r.email })) { skipped++; continue; }
        const penalty = area === ROBOTICS ? 25 : 0;
        const res = await sql()`INSERT INTO leads (track,name,role,org,email,url,field,paid,location,remote,fit,notes,sources,status)
          VALUES (${track},${r.name},${r.role ?? ""},${r.org},${r.email || null},${r.url || null},${r.field || (area === ROBOTICS ? "robotics" : area)},${r.paid || "unknown"},${r.location || null},${!!r.remote},${Math.max(0, (r.fit ?? 50) - penalty)},${r.why || null},${JSON.stringify(sources.slice(0, 5))}::jsonb,'found')
          ON CONFLICT (name, org) DO NOTHING RETURNING id`;
        if (res.length) added++;
      }
    } catch (e) { failed++; errMsg = (e as Error).message.slice(0, 160); await logEvent("error", `Research ${track} / ${area} / ${variant} failed: ${errMsg}`); }
  });
  let guard: { leadsSuppressed: number; emailsHeld: number } | null = null;
  try { const g = await applyGuards(); guard = { leadsSuppressed: g.leadsSuppressed, emailsHeld: g.emailsHeld }; } catch (e) { await logEvent("error", `Guard failed: ${(e as Error).message.slice(0, 160)}`); }
  await logEvent("research", `Research run (slot ${slot}): ${added} new leads from ${jobs.length - failed}/${jobs.length} searches (skipped ${skipped} program or generic rows)`);
  return NextResponse.json({ added, searches: jobs.length, failed, skipped, guard, errMsg });
}
