import { NextRequest, NextResponse } from "next/server";
import { sql, hasDb } from "@/lib/db";

// Makes every approved (queued) email due right now, so the next sender run picks them up.
export async function GET(req: NextRequest) {
  const a = req.headers.get("authorization");
  const ok = (!!process.env.CRON_SECRET && a === `Bearer ${process.env.CRON_SECRET}`) || (!!process.env.SENDER_TOKEN && a === `Bearer ${process.env.SENDER_TOKEN}`);
  if (!ok) return new NextResponse("no", { status: 401 });
  if (!hasDb()) return NextResponse.json({ error: "no db" }, { status: 400 });
  const r = await sql()`UPDATE emails SET scheduled_send_at=now() WHERE status='queued' AND (scheduled_send_at IS NULL OR scheduled_send_at > now()) RETURNING id`;
  return NextResponse.json({ released: r.length });
}
