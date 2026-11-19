import { NextRequest, NextResponse } from "next/server";
import { hasDb, sql } from "@/lib/db";
import { applyGuards } from "@/lib/guard";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const a = req.headers.get("authorization");
  if (a !== `Bearer ${process.env.CRON_SECRET}` && a !== `Bearer ${process.env.SENDER_TOKEN}`) return new NextResponse("no", { status: 401 });
  if (!hasDb()) return NextResponse.json({ error: "no db" }, { status: 400 });
  const addr = req.nextUrl.searchParams.get("bounce");
  let bounced: unknown[] = [];
  if (addr) {
    bounced = await sql()`UPDATE emails SET status='bounced' WHERE status <> 'bounced' AND lead_id IN (SELECT id FROM leads WHERE lower(email)=lower(${addr})) RETURNING id, kind, subject`;
  }
  return NextResponse.json({ bounced, ...(await applyGuards()) });
}
