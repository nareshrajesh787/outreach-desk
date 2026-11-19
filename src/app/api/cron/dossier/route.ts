import { NextRequest, NextResponse } from "next/server";
import { sql, hasDb, logEvent } from "@/lib/db";
import { gemini, parseJson } from "@/lib/gemini";
import { pool } from "@/lib/pool";
export const maxDuration = 300;

const root = (h: string) => h.toLowerCase().replace(/^www\./, "").split(".").slice(-2).join(".");
const host = (u: string | null) => { try { return u ? new URL(u).hostname : ""; } catch { return ""; } };
const yes = (v?: string) => (v || "").toLowerCase().startsWith("y");
const NEAR_FLAGSHIP = /ocean|marine|coastal|climate|environmental|forecast|remote sens|satellite|geoscience|time.?series|hydrolog|atmospher|ecolog|machine learning|data science|statistic/i;

type Dossier = { summary?: string; email?: string; takes_students?: string; past_hs_students?: string; recent_activity?: string; in_georgia_or_remote?: string; paid?: string };

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new NextResponse("no", { status: 401 });
  if (!hasDb()) return NextResponse.json({ error: "no db" }, { status: 400 });
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 16, 24);
  const rows = await sql()`SELECT id,name,role,org,url,field,remote,warm FROM leads WHERE status='found' ORDER BY warm DESC, fit DESC LIMIT ${limit}`;
  let done = 0, withEmail = 0, closed = 0, failed = 0;
  await pool(rows, 4, async (l) => {
    try {
      const { text, sources, domains } = await gemini(`Research ${l.name} (${l.role}) at ${l.org}. Use web search. Reply with ONLY a JSON object with these keys: "summary" (under 120 words: what they work on lately, citing a specific recent paper, product or news item; whether they take high school students or interns; how to contact them), "email" (their public email address ONLY if it appears verbatim on a page you saw, otherwise an empty string), "takes_students" (yes|no|unknown), "past_hs_students" (yes|unknown: evidence of past high school or undergraduate interns), "recent_activity" (yes|no|unknown: evidence of activity in 2025 or 2026), "in_georgia_or_remote" (yes|no|unknown), "paid" (paid|unpaid|unknown). Write "not found" in the summary for anything you cannot verify. Never guess an email.`, { search: true });
      let j: Dossier = { summary: text };
      try { j = parseJson<Dossier>(text); } catch { /* keep raw text */ }
      const summary = j.summary || text;
      const email = (j.email || "").trim().toLowerCase();
      const takes = (j.takes_students || "unknown").toLowerCase();
      // Only accept an email whose domain matches a site the search actually used.
      const okDomains = new Set([...domains.map((d) => root(d)), root(host(l.url as string | null))].filter(Boolean));
      const emailOk = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(email) && okDomains.has(root(email.split("@")[1]));
      // Transparent fit rubric (0-100).
      let fit = 30;
      if (takes.startsWith("y")) fit += 25; else if (takes.startsWith("u")) fit += 8;
      if (yes(j.past_hs_students)) fit += 15;
      if (emailOk) fit += 10;
      if (yes(j.in_georgia_or_remote) || l.remote) fit += 10;
      if (yes(j.recent_activity)) fit += 5;
      if ((j.paid || "").toLowerCase() === "paid") fit += 5;
      if (NEAR_FLAGSHIP.test(String(l.field || "") + " " + summary)) fit += 8; // close to the Sargassum Forecast project
      if (/robot/i.test(String(l.field || ""))) fit -= 25;
      if (l.warm) fit = Math.max(fit, 90);
      fit = Math.max(0, Math.min(100, fit));
      const status = takes.startsWith("n") ? "closed" : "researched";
      const jpaid = (j.paid || "unknown").toLowerCase();
      await sql()`UPDATE leads SET dossier=${summary}, sources=${JSON.stringify(sources.slice(0, 6))}::jsonb, status=${status}, fit=${fit},
        email=COALESCE(email, ${emailOk ? email : null}),
        paid=CASE WHEN paid='unknown' AND ${jpaid}::text IN ('paid','unpaid') THEN ${jpaid}::text ELSE paid END WHERE id=${l.id}`;
      done++; if (emailOk) withEmail++; if (status === "closed") closed++;
    } catch (e) { failed++; await logEvent("error", `Dossier ${l.name} failed: ${(e as Error).message.slice(0, 160)}`); }
  });
  await logEvent("research", `Dossier run: ${done} researched, ${withEmail} new emails found, ${closed} ruled out, ${failed} failed`);
  return NextResponse.json({ done, withEmail, closed, failed, queued: rows.length });
}
