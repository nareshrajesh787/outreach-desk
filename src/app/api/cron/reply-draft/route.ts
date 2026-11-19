import { NextRequest, NextResponse } from "next/server";
import { hasDb } from "@/lib/db";
import { draftReplies } from "@/lib/replies";
export const maxDuration = 120;

// Drafts replies for new inbound messages. Called after the evening inbox check and by a daily cron.
export async function GET(req: NextRequest) {
  const a = req.headers.get("authorization");
  const ok = (!!process.env.CRON_SECRET && a === `Bearer ${process.env.CRON_SECRET}`) || (!!process.env.SENDER_TOKEN && a === `Bearer ${process.env.SENDER_TOKEN}`);
  if (!ok) return new NextResponse("no", { status: 401 });
  if (!hasDb()) return NextResponse.json({ error: "no db" }, { status: 400 });
  return NextResponse.json(await draftReplies({ redo: req.nextUrl.searchParams.get("redo") === "1" }));
}
