import "./globals.css";
import Link from "next/link";
import { isAuthed } from "@/lib/auth";
import { hasDb, getSettings } from "@/lib/db";
export const metadata = { title: "Outreach Desk" };
export const dynamic = "force-dynamic";
export default async function Root({ children }: { children: React.ReactNode }) {
  const authed = await isAuthed() || (!process.env.APP_PASSWORD && process.env.NODE_ENV !== "production");
  const s = authed ? await getSettings() : null;
  return (
    <html lang="en"><body>
      {authed && <nav>
        <b>Outreach Desk</b>
        <Link href="/">Today</Link><Link href="/leads">Leads</Link><Link href="/outreach">Outreach</Link>
        <Link href="/replies">Replies</Link><Link href="/programs">Programs</Link><Link href="/control">Control</Link>
        <span style={{ marginLeft: "auto" }} className={"pill " + (s?.paused ? "warn" : "ok")}>{s?.paused ? "Sending paused" : "Sending live"}</span>
      </nav>}
      <main>
        {authed && !hasDb() && <div className="banner">Demo mode: no database connected, showing sample data. Add Neon in Vercel Storage, then open /api/setup once.</div>}
        {children}
      </main>
    </body></html>
  );
}
