import { NextRequest, NextResponse } from "next/server";
import { setup, hasDb } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
export async function GET(req: NextRequest) {
  const ok = (await isAuthed()) || req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  if (!ok && (process.env.APP_PASSWORD || process.env.NODE_ENV === "production")) return new NextResponse("Sign in first", { status: 401 });
  if (!hasDb()) return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 400 });
  await setup();
  return NextResponse.json({ ok: true });
}
