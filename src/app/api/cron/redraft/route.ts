import { NextRequest, NextResponse } from "next/server";
import { sql, hasDb, logEvent } from "@/lib/db";
import { gemini, parseJson } from "@/lib/gemini";
import { FACT_SHEET, FORBIDDEN, STYLE, PROJECT_GUIDE } from "@/lib/facts";
import { pool } from "@/lib/pool";
export const maxDuration = 300;
const TAG = "Rebalanced to profile-first.";

// One-off: rebalances unsent first emails that lean on Sargassum Forecast so they lead with his overall profile.
// Only touches emails in review or held that mention Sargassum; approved (queued) and sent emails are never touched.
// Safe to call repeatedly; already-rebalanced emails are skipped.
// Accepts the cron secret or the sender token (both are server-side secrets).
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const okCron = !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
  const okSender = !!process.env.SENDER_TOKEN && auth === `Bearer ${process.env.SENDER_TOKEN}`;
  if (!okCron && !okSender) return new NextResponse("no", { status: 401 });
  if (!hasDb()) return NextResponse.json({ error: "no db" }, { status: 400 });
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 12, 20);
  const rows = await sql()`SELECT e.id, e.subject, e.body, e.status, e.critic_notes, l.name, l.role, l.org, l.track, l.dossier
    FROM emails e JOIN leads l ON l.id = e.lead_id
    WHERE e.kind='initial' AND e.status IN ('review','held') AND e.body ILIKE '%sargassum%' AND COALESCE(e.critic_notes,'') NOT LIKE ${TAG + "%"}
    ORDER BY l.fit DESC LIMIT ${limit}`;
  let revised = 0, flagged = 0, failed = 0;
  await pool(rows, 3, async (e) => {
    try {
      const { text } = await gemini(`Rebalance this unsent cold email from Naresh to ${e.name} (${e.role}, ${e.org}). Keep what is specific to this recipient and the ask. Open with who he is overall (high school senior, Georgia Tech dual enrollment, what he does and has led), then use the one or two facts from his whole profile that best fit this recipient. If the email leans on his Sargassum Forecast project, cut it to one short supporting line, or remove it if it is not closely related to this recipient's work. Keep it 90 to 140 words and keep the same sign-off.
Style rules: ${STYLE}
${PROJECT_GUIDE}
Use ONLY these facts about Naresh; invent nothing:
${FACT_SHEET}
Facts about the recipient (use at most one, only if clearly stated):
${e.dossier ?? "none"}
Current subject: ${e.subject}
Current email:
${e.body}
Return ONLY JSON: {"subject":"...","body":"..."}`, { json: true, draft: true });
      const d = parseJson<{ subject: string; body: string }>(text);
      const flags = FORBIDDEN.filter((f) => f.re.test(d.subject + "\n" + d.body)).map((f) => f.why);
      let notes = flags.length ? "Blocked by red-line check: " + flags.join("; ") : "";
      if (!flags.length) {
        const c = await gemini(`You are a strict fact-checker. Facts allowed:\n${FACT_SHEET}\n\nEmail:\n${d.body}\n\nList any claim in the email that is NOT supported by the facts or that exaggerates (for example saying the forecast is accurate, predicts well, or is a warning system). Also flag hype or an email over 150 words. Return ONLY JSON {"ok":true|false,"problems":["..."]}`, { json: true, draft: true });
        const v = parseJson<{ ok: boolean; problems: string[] }>(c.text);
        if (!v.ok) { notes = "Checker: " + v.problems.join("; "); flags.push("checker"); } else notes = "All claims match the fact sheet.";
      }
      if (flags.length) flagged++;
      // Changed text always goes back to review so Naresh approves the new version.
      await sql()`UPDATE emails SET subject=${d.subject}, body=${d.body}, status='review', scheduled_send_at=NULL, critic_notes=${TAG + " " + notes} WHERE id=${e.id}`;
      revised++;
    } catch (err) { failed++; await logEvent("error", `Redraft ${e.name} failed: ${(err as Error).message.slice(0, 160)}`); }
  });
  const left = (await sql()`SELECT count(*)::int AS n FROM emails WHERE kind='initial' AND status IN ('review','held') AND body ILIKE '%sargassum%' AND COALESCE(critic_notes,'') NOT LIKE ${TAG + "%"}`)[0].n;
  await logEvent("draft", `Redraft run: ${revised} drafts rebalanced to profile-first (${flagged} flagged, ${failed} failed, ${left} left)`);
  return NextResponse.json({ revised, flagged, failed, left });
}
