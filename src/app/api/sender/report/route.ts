import { NextRequest, NextResponse } from "next/server";
import { sql, saveSettings, logEvent, migrate } from "@/lib/db";
import { isDecline } from "@/lib/replies";
export const maxDuration = 30;
export async function POST(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.SENDER_TOKEN}`) return new NextResponse("no", { status: 401 });
  await migrate();
  const b = await req.json();
  const id = Number(b.id);
  if (b.result === "sent") {
    await sql()`UPDATE emails SET status='sent', sent_at=now() WHERE id=${id}`;
    // A sent reply keeps the lead in "replied"; only first emails and follow-ups move a lead to "contacted".
    await sql()`UPDATE leads SET status='contacted' WHERE id=(SELECT lead_id FROM emails WHERE id=${id} AND kind<>'reply')`;
    const d = (await sql()`SELECT (now() AT TIME ZONE 'America/New_York')::date::text AS d`)[0].d as string;
    await saveSettings({ last_run: d });
    await logEvent("send", `Email ${id} sent`);
  } else if (b.result === "replied") {
    const cls = String(b.reply_class ?? "reply");
    await sql()`UPDATE emails SET status='replied', reply_class=${cls}, reply_summary=${b.reply_summary ?? ""} WHERE id=${id}`;
    await sql()`UPDATE leads SET status='replied' WHERE id=(SELECT lead_id FROM emails WHERE id=${id})`;
    // Full text of the reply, so the dashboard can show the whole thread. Safe to send again: duplicates are ignored.
    if (b.reply_text) {
      await sql()`INSERT INTO replies (email_id, lead_id, from_addr, subject, body, received_at, reply_class, summary)
        VALUES (${id}, (SELECT lead_id FROM emails WHERE id=${id}), ${b.reply_from ?? null}, ${b.reply_subject ?? null}, ${String(b.reply_text).slice(0, 20000)},
          ${b.received_at ?? new Date().toISOString()}, ${cls}, ${b.reply_summary ?? ""})
        ON CONFLICT (email_id, received_at) DO NOTHING`;
    }
    if (isDecline(cls)) {
      // A no ends the conversation: no follow-ups or leftover drafts for this lead.
      await sql()`UPDATE emails SET status='skipped', critic_notes='Skipped: they declined' WHERE lead_id=(SELECT lead_id FROM emails WHERE id=${id}) AND id<>${id} AND status IN ('draft','review','queued','held')`;
      await sql()`UPDATE leads SET status='closed' WHERE id=(SELECT lead_id FROM emails WHERE id=${id})`;
    }
    await logEvent("reply", `Reply on email ${id}: ${cls}`);
  } else if (b.result === "bounced") {
    await sql()`UPDATE emails SET status='bounced' WHERE id=${id}`;
    await logEvent("bounce", `Email ${id} bounced`);
  } else {
    await sql()`UPDATE emails SET status='held', critic_notes=${"Send failed: " + (b.note ?? "")} WHERE id=${id}`;
    await logEvent("error", `Send failed on ${id}: ${b.note ?? ""}`);
    const fails = (await sql()`SELECT count(*)::int AS n FROM events WHERE kind='error' AND message LIKE 'Send failed%' AND at > now() - interval '1 day'`)[0].n;
    if (fails >= 2) { await saveSettings({ paused: true, pause_reason: "Auto-paused: two failed sends in a day." }); await logEvent("control", "Auto-paused after two failed sends"); }
  }
  if (b.result === "sent" || b.result === "bounced") {
    const r = (await sql()`SELECT count(*) FILTER (WHERE status='bounced')::float AS b, count(*)::float AS t FROM emails WHERE kind<>'reply' AND (sent_at > now() - interval '14 days' OR status='bounced')`)[0];
    if (r.t >= 10 && r.b / r.t > 0.05) { await saveSettings({ paused: true, pause_reason: "Auto-paused: bounce rate above 5%." }); await logEvent("control", "Auto-paused on bounce rate"); }
  }
  return NextResponse.json({ ok: true });
}
