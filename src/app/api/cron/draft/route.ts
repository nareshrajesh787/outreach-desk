import { NextRequest, NextResponse } from "next/server";
import { sql, hasDb, getSettings, logEvent } from "@/lib/db";
import { gemini, parseJson } from "@/lib/gemini";
import { FACT_SHEET, FORBIDDEN, STYLE, PROJECT_GUIDE } from "@/lib/facts";
import { pool } from "@/lib/pool";
import { applyGuards } from "@/lib/guard";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new NextResponse("no", { status: 401 });
  if (!hasDb()) return NextResponse.json({ error: "no db" }, { status: 400 });
  const g = await applyGuards();
  const s = await getSettings();
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 15, 20);
  const leads = await sql()`SELECT * FROM leads WHERE status='researched' AND email IS NOT NULL ORDER BY warm DESC, fit DESC LIMIT ${limit}`;
  const sent: Record<string, number> = {};
  for (const t of ["academia", "corporate"]) {
    sent[t] = (await sql()`SELECT count(*)::int AS n FROM emails e JOIN leads x ON x.id=e.lead_id WHERE x.track=${t} AND e.status IN ('sent','replied','bounced')`)[0].n;
  }
  let made = 0;
  await pool(leads, 3, async (l) => {
    try {
      const { text } = await gemini(`Write a first cold email from Naresh to ${l.name} (${l.role}, ${l.org}).
Style rules: ${STYLE}
${PROJECT_GUIDE}
Use ONLY these facts about Naresh; invent nothing:
${FACT_SHEET}
Facts about the recipient (from research; use at most one, only if clearly stated):
${l.dossier}
Purpose: ${l.track === "academia" ? "ask about a summer 2027 research assistant opportunity (paid if possible, unpaid is fine)" : "ask about a summer 2027 internship, or who to talk to"}.
Return ONLY JSON: {"subject":"...","body":"..."}`, { json: true, draft: true });
      const d = parseJson<{ subject: string; body: string }>(text);
      const flags = FORBIDDEN.filter((f) => f.re.test(d.subject + "\n" + d.body)).map((f) => f.why);
      let notes = flags.length ? "Blocked by red-line check: " + flags.join("; ") : "";
      if (!flags.length) {
        const c = await gemini(`You are a strict fact-checker. Facts allowed:\n${FACT_SHEET}\n\nEmail:\n${d.body}\n\nList any claim in the email that is NOT supported by the facts or that exaggerates. Also flag hype or an email over 150 words. Return ONLY JSON {"ok":true|false,"problems":["..."]}`, { json: true, draft: true });
        const v = parseJson<{ ok: boolean; problems: string[] }>(c.text);
        if (!v.ok) { notes = "Checker: " + v.problems.join("; "); flags.push("checker"); }
        else notes = "All claims match the fact sheet.";
      }
      const manual = sent[l.track as string] < 20;
      const status = flags.length || manual ? "review" : "queued";
      if (manual && !flags.length) notes += " (first 20 per lane need your approval)";
      const when = new Date(Date.now() + s.veto_hours * 36e5);
      await sql()`INSERT INTO emails (lead_id,kind,subject,body,status,critic_notes,scheduled_send_at) VALUES (${l.id},'initial',${d.subject},${d.body},${status},${notes},${status === "queued" ? when : null})`;
      await sql()`UPDATE leads SET status='drafted' WHERE id=${l.id}`;
      made++;
    } catch (e) { await logEvent("error", `Draft ${l.name} failed: ${(e as Error).message.slice(0, 160)}`); }
  });
  await logEvent("draft", `Draft run: ${made} drafts (guard suppressed ${g.leadsSuppressed} leads, held ${g.emailsHeld} drafts)`);
  return NextResponse.json({ made, candidates: leads.length, guard: { leadsSuppressed: g.leadsSuppressed, emailsHeld: g.emailsHeld } });
}
