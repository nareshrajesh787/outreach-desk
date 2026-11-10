import { NextRequest, NextResponse } from "next/server";
import { sql, hasDb, getSettings } from "@/lib/db";
// The local Outlook sender polls this. It only ever receives emails that are queued, due, and under today's cap.
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.SENDER_TOKEN}`) return new NextResponse("no", { status: 401 });
  if (!hasDb()) return NextResponse.json({ error: "no db" }, { status: 400 });
  const s = await getSettings();
  if (s.paused) return NextResponse.json({ paused: true, emails: [] });
  const out: unknown[] = [];
  for (const track of ["academia", "corporate"] as const) {
    const cap = track === "academia" ? s.cap_academia : s.cap_corporate;
    const done = (await sql()`SELECT count(*)::int AS n FROM emails e JOIN leads l ON l.id=e.lead_id WHERE l.track=${track} AND e.sent_at::date = (now() AT TIME ZONE 'America/New_York')::date`)[0].n;
    if (done >= cap) continue;
    const rows = await sql()`SELECT e.id,e.subject,e.body,l.email,l.name FROM emails e JOIN leads l ON l.id=e.lead_id
      WHERE l.track=${track} AND e.status='queued' AND e.scheduled_send_at <= now() AND l.email IS NOT NULL ORDER BY e.scheduled_send_at LIMIT ${cap - done}`;
    out.push(...rows);
  }
  return NextResponse.json({ paused: false, emails: out });
}
