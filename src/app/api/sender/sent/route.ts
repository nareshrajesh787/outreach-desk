import { NextRequest, NextResponse } from "next/server";
import { sql, hasDb } from "@/lib/db";
// For the inbox check: emails sent in the last 21 days that have no reply logged yet.
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.SENDER_TOKEN}`) return new NextResponse("no", { status: 401 });
  if (!hasDb()) return NextResponse.json({ error: "no db" }, { status: 400 });
  const rows = await sql()`SELECT e.id, e.subject, e.sent_at, l.email, l.name FROM emails e JOIN leads l ON l.id=e.lead_id
    WHERE e.status='sent' AND e.sent_at > now() - interval '21 days' ORDER BY e.sent_at DESC`;
  return NextResponse.json({ emails: rows });
}
