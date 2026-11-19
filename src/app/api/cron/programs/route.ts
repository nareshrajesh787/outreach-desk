import { NextRequest, NextResponse } from "next/server";
import { sql, hasDb, logEvent } from "@/lib/db";
import { gemini, parseJson } from "@/lib/gemini";
import { pool } from "@/lib/pool";
export const maxDuration = 300;

type Prog = { name?: string; org?: string; url?: string; deadline?: string; paid?: string; notes?: string };

const ANGLES = [
  "summer research programs at universities for high school students in computer science, AI, engineering or data science",
  "national laboratory, government agency and research institute summer programs and internships open to high school students",
  "company, startup, finance, business and nonprofit summer internship or fellowship programs open to high school students or recent graduates, including programs in Georgia and remote programs",
];

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new NextResponse("no", { status: 401 });
  if (!hasDb()) return NextResponse.json({ error: "no db" }, { status: 400 });
  let added = 0, failed = 0;
  await pool(ANGLES, 3, async (angle) => {
    try {
      const { text } = await gemini(`Find up to 20 real, currently running formal ${angle}, for summer 2027. The student graduates high school in May 2027 and starts college in fall 2027, is a U.S. citizen living in Georgia. Use web search. Only include programs you found evidence for. Give the application deadline only if a page states it. In "notes" say whether graduating seniors are eligible (or "eligibility unclear") and in one line why it fits.
Return ONLY a JSON array of objects: {"name","org","url","deadline":"YYYY-MM-DD or empty","paid":"paid|unpaid|unknown","notes"}.`, { search: true });
      const rows = parseJson<Prog[]>(text);
      for (const p of rows) {
        if (!p.name) continue;
        const org = p.org ?? "";
        const dl = /^\d{4}-\d{2}-\d{2}$/.test(p.deadline || "") ? (p.deadline as string) : null;
        const paid = ["paid", "unpaid"].includes((p.paid || "").toLowerCase()) ? (p.paid as string).toLowerCase() : "unknown";
        const res = await sql()`INSERT INTO programs (name,org,url,deadline,paid,notes)
          SELECT ${p.name}::text, ${org}::text, ${p.url || null}::text, ${dl}::date, ${paid}::text, ${p.notes || null}::text
          WHERE NOT EXISTS (SELECT 1 FROM programs WHERE lower(name)=lower(${p.name}::text) AND lower(org)=lower(${org}::text))
          RETURNING id`;
        if (res.length) added++;
      }
    } catch (e) { failed++; await logEvent("error", `Programs search failed: ${(e as Error).message.slice(0, 160)}`); }
  });
  await logEvent("research", `Programs run: ${added} new programs (${failed} searches failed)`);
  return NextResponse.json({ added, failed });
}
