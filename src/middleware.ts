import { NextRequest, NextResponse } from "next/server";
import { validToken } from "@/lib/auth";
export async function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;
  if (p.startsWith("/login") || p.startsWith("/api/login") || p.startsWith("/api/cron") || p.startsWith("/api/sender") || p.startsWith("/api/setup")) return NextResponse.next();
  if (!process.env.APP_PASSWORD && process.env.NODE_ENV !== "production") return NextResponse.next(); // open only in local dev
  if (await validToken(req.cookies.get("od")?.value)) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", req.url));
}
export const config = { matcher: ["/((?!_next|favicon.ico).*)"] };
