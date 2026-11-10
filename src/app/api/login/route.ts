import { NextRequest, NextResponse } from "next/server";
import { makeToken } from "@/lib/auth";
export async function POST(req: NextRequest) {
  const f = await req.formData();
  const ok = process.env.APP_PASSWORD && f.get("password") === process.env.APP_PASSWORD;
  if (!ok) return NextResponse.redirect(new URL("/login?e=1", req.url), 303);
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.set("od", await makeToken(), { httpOnly: true, secure: true, sameSite: "lax", maxAge: 30 * 86400, path: "/" });
  return res;
}
