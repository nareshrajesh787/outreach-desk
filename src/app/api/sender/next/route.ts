import { NextRequest, NextResponse } from "next/server";
import { sql, hasDb, getSettings, saveSettings, migrate } from "@/lib/db";

// Daily cap per lane, with catch-up: if the sender did not run on earlier weekdays
// (computer off), the allowance grows by one day's cap per missed weekday, up to 3 days' worth.
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.SENDER_TOKEN}`) return new NextResponse("no", { status: 401 });
  if (!hasDb()) return NextResponse.json({ error: "no db" }, { status: 400 });
  await migrate();
  const s = await getSettings();
  const today = (await sql()`SELECT (now() AT TIME ZONE 'America/New_York')::date::text AS d`)[0].d as string;
  if (s.paused) {
    // While paused, keep the heartbeat current so resuming does not look like missed days.
    if (s.last_run !== today) await saveSettings({ last_run: today });
    return NextResponse.json({ paused: true, emails: [] });
  }
  let missed = 0;
  if (s.last_run && s.last_run < today) {
    missed = (await sql()`SELECT count(*)::int AS n FROM generate_series(${s.last_run}::date + 1, ${today}::date - 1, interval '1 day') g WHERE extract(isodow FROM g) < 6`)[0].n;
  }
  missed = Math.min(missed, 2);
  const out: unknown[] = [];
  for (const track of ["academia", "corporate"] as const) {
    const cap = track === "academia" ? s.cap_academia : s.cap_corporate;
    const done = (await sql()`SELECT count(*)::int AS n FROM emails e JOIN leads l ON l.id=e.lead_id WHERE l.track=${track} AND e.kind<>'reply' AND e.sent_at::date = (now() AT TIME ZONE 'America/New_York')::date`)[0].n;
    const allowed = cap * (1 + missed) - done;
    if (allowed <= 0) continue;
    const rows = await sql()`SELECT e.id,e.subject,e.body,l.email,l.name FROM emails e JOIN leads l ON l.id=e.lead_id
      WHERE l.track=${track} AND e.kind<>'reply' AND e.status='queued' AND e.scheduled_send_at <= now() AND l.email IS NOT NULL ORDER BY e.scheduled_send_at LIMIT ${allowed}`;
    out.push(...rows);
  }
  // Approved replies are not capped and go out in the same run. kind 'reply' means: answer inside the existing conversation
  // (open the message from `email` in the Inbox and use Reply), not a new message.
  const replies = await sql()`SELECT e.id, e.subject, e.body, e.kind, COALESCE(e.to_addr, l.email) AS email, l.name,
      (SELECT x.subject FROM emails x WHERE x.id=(SELECT r.email_id FROM replies r WHERE r.id=e.parent_id)) AS original_subject
    FROM emails e JOIN leads l ON l.id=e.lead_id
    WHERE e.kind='reply' AND e.status='queued' AND e.scheduled_send_at <= now() AND COALESCE(e.to_addr, l.email) IS NOT NULL ORDER BY e.scheduled_send_at LIMIT 10`;
  out.push(...replies);
  return NextResponse.json({ paused: false, missed_weekdays: missed, emails: out });
}
