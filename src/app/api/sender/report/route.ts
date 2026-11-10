import { NextRequest, NextResponse } from "next/server";
import { sql, saveSettings, logEvent } from "@/lib/db";
// Body: {id, result: "sent"|"failed"|"bounced"|"replied", note?, reply_class?, reply_summary?}
export async function POST(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.SENDER_TOKEN}`) return new NextResponse("no", { status: 401 });
  const b = await req.json();
  const id = Number(b.id);
  if (b.result === "sent") {
    await sql()`UPDATE emails SET status='sent', sent_at=now() WHERE id=${id}`;
    await sql()`UPDATE leads SET status='contacted' WHERE id=(SELECT lead_id FROM emails WHERE id=${id})`;
    await logEvent("send", `Email ${id} sent`);
  } else if (b.result === "replied") {
    await sql()`UPDATE emails SET status='replied', reply_class=${b.reply_class ?? "reply"}, reply_summary=${b.reply_summary ?? ""} WHERE id=${id}`;
    await sql()`UPDATE leads SET status='replied' WHERE id=(SELECT lead_id FROM emails WHERE id=${id})`;
    await logEvent("reply", `Reply on email ${id}: ${b.reply_class ?? ""}`);
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
    const r = (await sql()`SELECT count(*) FILTER (WHERE status='bounced')::float AS b, count(*)::float AS t FROM emails WHERE sent_at > now() - interval '14 days' OR status='bounced'`)[0];
    if (r.t >= 10 && r.b / r.t > 0.05) { await saveSettings({ paused: true, pause_reason: "Auto-paused: bounce rate above 5%." }); await logEvent("control", "Auto-paused on bounce rate"); }
  }
  return NextResponse.json({ ok: true });
}
