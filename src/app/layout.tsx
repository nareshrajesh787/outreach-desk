import "./globals.css";
import Nav from "./nav";
import Particles from "./particles";
import { isAuthed } from "@/lib/auth";
import { hasDb, getSettings, getEmails } from "@/lib/db";
export const metadata = { title: "Outreach Desk" };
export const dynamic = "force-dynamic";
export default async function Root({ children }: { children: React.ReactNode }) {
  const authed = await isAuthed() || (!process.env.APP_PASSWORD && process.env.NODE_ENV !== "production");
  if (!authed) return <html lang="en"><body><Particles />{children}</body></html>;
  const [s, emails] = await Promise.all([getSettings(), getEmails()]);
  const badges: Record<string, number> = {
    "/outreach": emails.filter((e) => e.status === "review").length,
    "/replies": emails.filter((e) => e.status === "replied" && !e.handled).length,
  };
  return (
    <html lang="en"><body>
      <Particles />
      <div className="shell">
        <aside className="side">
          <div className="brand"><div className="mark" /><span>Outreach Desk</span></div>
          <Nav badges={badges} />
          <div className={"state" + (s.paused ? "" : " live")}><i className="dot" />{s.paused ? "Sending paused" : "Sending live"}</div>
        </aside>
        <main>
          {!hasDb() && <div className="banner">Demo mode: no database connected, showing sample data. Add Neon in Vercel Storage, then open /api/setup once.</div>}
          {children}
        </main>
      </div>
    </body></html>
  );
}
