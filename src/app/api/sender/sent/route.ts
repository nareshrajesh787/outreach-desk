import { NextRequest, NextResponse } from "next/server";
import { sql, hasDb, migrate } from "@/lib/db";
// For the inbox check: emails sent in the last 21 days, plus conversations that already have a reply
// (so later replies in the same thread are picked up). known_replies / last_reply_at say what is already stored.
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.SENDER_TOKEN}`) return new NextResponse("no", { status: 401 });
  if (!hasDb()) return NextResponse.json({ error: "no db" }, { status: 400 });
  await migrate();
  const rows = await sql()`SELECT e.id, e.subject, e.sent_at, e.status, l.email, l.name,
      (SELECT count(*)::int FROM replies r WHERE r.email_id=e.id) AS known_replies,
      (SELECT max(r.received_at) FROM replies r WHERE r.email_id=e.id) AS last_reply_at
    FROM emails e JOIN leads l ON l.id=e.lead_id
    WHERE e.kind<>'reply' AND e.sent_at > now() - interval '21 days' AND (e.status='sent' OR (e.status='replied' AND e.handled=false))
    ORDER BY e.sent_at DESC`;
  return NextResponse.json({ emails: rows });
}
