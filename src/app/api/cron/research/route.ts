import { NextRequest, NextResponse } from "next/server";
import { sql, hasDb, getSettings, logEvent } from "@/lib/db";
import { gemini, parseJson } from "@/lib/gemini";
import { FACT_SHEET } from "@/lib/facts";
export const maxDuration = 300;
type Found = { name: string; role: string; org: string; email?: string; url?: string; field?: string; paid?: string; location?: string; remote?: boolean; fit?: number; why?: string };
const AREAS = ["AI agents and LLM systems", "applied machine learning", "finance and business data", "software engineering", "product and business strategy", "robotics (lowest priority)"];

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new NextResponse("no", { status: 401 });
  if (!hasDb()) return NextResponse.json({ error: "no db" }, { status: 400 });
  const s = await getSettings();
  if (s.paused && req.nextUrl.searchParams.get("force") !== "1") {
    // Research is harmless while sending is paused, so we still run it.
  }
  const area = AREAS[Math.floor(Date.now() / 864e5) % AREAS.length];
  let added = 0;
  for (const track of ["academia", "corporate"] as const) {
    const ask = track === "academia"
      ? `Find 8 real professors, postdocs or lab leads (U.S., any state) in "${area}" who plausibly take a high school senior as a summer 2027 research assistant (remote or in person). Prefer labs that list public contact emails or student-opportunity pages.`
      : `Find 8 real companies or startups (U.S., any state) with summer 2027 internship, university-recruiting or early-talent pages relevant to "${area}", open to a high school student or with a named recruiter/engineer/founder to email. Prefer paid roles.`;
    const prompt = `${ask}
Use web search. Only include people/orgs you actually found evidence for. Never invent an email address; leave "email" empty unless it is publicly listed on a page you saw.
Return ONLY a JSON array of objects: {"name","role","org","email","url","field","paid":"paid|unpaid|unknown","location","remote":true|false,"fit":0-100,"why":"one sentence on why they fit this student"}.
Student: ${FACT_SHEET.split("\n")[0]}`;
    try {
      const { text, sources } = await gemini(prompt, { search: true });
      const rows = parseJson<Found[]>(text);
      for (const r of rows) {
        if (!r.name || !r.org) continue;
        const res = await sql()`INSERT INTO leads (track,name,role,org,email,url,field,paid,location,remote,fit,notes,sources,status)
          VALUES (${track},${r.name},${r.role ?? ""},${r.org},${r.email || null},${r.url || null},${r.field || null},${r.paid || "unknown"},${r.location || null},${!!r.remote},${r.fit ?? 50},${r.why || null},${JSON.stringify(sources.slice(0, 5))}::jsonb,'found')
          ON CONFLICT (name, org) DO NOTHING RETURNING id`;
        if (res.length) added++;
      }
    } catch (e) { await logEvent("error", `Research ${track} failed: ${(e as Error).message}`); }
  }
  // Build short dossiers for the best unresearched leads.
  const todo = await sql()`SELECT id,name,role,org,url FROM leads WHERE status='found' ORDER BY fit DESC LIMIT 6`;
  for (const l of todo) {
    try {
      const { text, sources } = await gemini(`Research ${l.name} (${l.role}) at ${l.org}. In under 120 words give: what they work on lately (cite a specific recent paper/product/news), whether they take high school students or interns, and how to contact them. Say "not found" for anything you cannot verify. Do not guess.`, { search: true });
      await sql()`UPDATE leads SET dossier=${text}, sources=${JSON.stringify(sources.slice(0, 6))}::jsonb, status='researched' WHERE id=${l.id}`;
    } catch (e) { await logEvent("error", `Dossier ${l.name} failed: ${(e as Error).message}`); }
  }
  await logEvent("research", `Research run (${area}): ${added} new leads, ${todo.length} dossiers`);
  return NextResponse.json({ added, dossiers: todo.length });
}
