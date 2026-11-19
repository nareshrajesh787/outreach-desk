import { NextRequest, NextResponse } from "next/server";
import { sql, hasDb, getSettings, logEvent } from "@/lib/db";
import { gemini, parseJson } from "@/lib/gemini";
import { FACT_SHEET, FORBIDDEN, STYLE } from "@/lib/facts";
import { pool } from "@/lib/pool";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new NextResponse("no", { status: 401 });
  if (!hasDb()) return NextResponse.json({ error: "no db" }, { status: 400 });
  const s = await getSettings();
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 10, 20);
  const rows = await sql()`SELECT e.id, e.lead_id, e.kind, e.subject, e.body, l.name, l.role, l.org, l.track
    FROM emails e JOIN leads l ON l.id = e.lead_id
    WHERE e.status='sent' AND e.kind IN ('initial','fu1') AND e.sent_at < now() - interval '7 days'
      AND l.status NOT IN ('replied','closed','rejected')
      AND NOT EXISTS (SELECT 1 FROM emails x WHERE x.lead_id = e.lead_id AND (x.status IN ('replied','bounced') OR x.kind = CASE WHEN e.kind='initial' THEN 'fu1' ELSE 'fu2' END))
    ORDER BY e.sent_at LIMIT ${limit}`;
  const sent: Record<string, number> = {};
  for (const t of ["academia", "corporate"]) {
    sent[t] = (await sql()`SELECT count(*)::int AS n FROM emails e JOIN leads x ON x.id=e.lead_id WHERE x.track=${t} AND e.status IN ('sent','replied','bounced')`)[0].n;
  }
  let made = 0;
  await pool(rows, 3, async (e) => {
    try {
      const final = e.kind === "fu1";
      const { text } = await gemini(`Write a very short follow-up email (40 to 70 words) from Naresh to ${e.name} (${e.role}, ${e.org}) about his earlier email below. Politely remind them, restate the ask in one line, and make it easy to say no or to point him to someone else. ${final ? "This is the final follow-up: say thank you and that he will not keep writing." : ""}
Style rules: ${STYLE}
Use ONLY these facts about Naresh; invent nothing new:
${FACT_SHEET}
Earlier email:
${e.body}
Return ONLY JSON: {"body":"..."}`, { json: true, draft: true });
      const d = parseJson<{ body: string }>(text);
      const base = String(e.subject).replace(/^Following up:\s*/i, "");
      const subject = `Following up: ${base}`;
      const flags = FORBIDDEN.filter((f) => f.re.test(subject + "\n" + d.body)).map((f) => f.why);
      const words = d.body.trim().split(/\s+/).length;
      if (words > 110) flags.push("too long");
      const manual = sent[e.track as string] < 20;
      const status = flags.length || manual ? "review" : "queued";
      const notes = flags.length ? "Blocked: " + flags.join("; ") : manual ? "Follow-up (first 20 per lane need your approval)" : "Follow-up";
      const when = new Date(Date.now() + s.veto_hours * 36e5);
      await sql()`INSERT INTO emails (lead_id,kind,subject,body,status,critic_notes,scheduled_send_at) VALUES (${e.lead_id},${final ? "fu2" : "fu1"},${subject},${d.body},${status},${notes},${status === "queued" ? when : null})`;
      made++;
    } catch (err) { await logEvent("error", `Follow-up for ${e.name} failed: ${(err as Error).message.slice(0, 160)}`); }
  });
  await logEvent("draft", `Follow-up run: ${made} follow-ups drafted`);
  return NextResponse.json({ made, candidates: rows.length });
}
