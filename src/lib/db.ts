import { neon } from "@neondatabase/serverless";
import type { Lead, Email, Program, Settings } from "./types";
import { DEMO_LEADS, DEMO_EMAILS, DEMO_PROGRAMS } from "./demo";

export const hasDb = () => !!process.env.DATABASE_URL;
const sql = () => neon(process.env.DATABASE_URL!);

export const DEFAULT_SETTINGS: Settings = {
  paused: true, pause_reason: "Setup not finished. Sending stays off until you resume.",
  cap_academia: 5, cap_corporate: 5, veto_hours: 4,
};

export async function setup() {
  const q = sql();
  await q`CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY, track TEXT NOT NULL, name TEXT NOT NULL, role TEXT DEFAULT '', org TEXT DEFAULT '',
    email TEXT, url TEXT, field TEXT, paid TEXT DEFAULT 'unknown', location TEXT, remote BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'found', fit INT DEFAULT 0, warm BOOLEAN DEFAULT false, notes TEXT, dossier TEXT,
    sources JSONB DEFAULT '[]', created_at TIMESTAMPTZ DEFAULT now(), UNIQUE (name, org))`;
  await q`CREATE TABLE IF NOT EXISTS emails (
    id SERIAL PRIMARY KEY, lead_id INT REFERENCES leads(id) ON DELETE CASCADE, kind TEXT DEFAULT 'initial',
    subject TEXT, body TEXT, status TEXT DEFAULT 'draft', critic_notes TEXT, scheduled_send_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ, reply_class TEXT, reply_summary TEXT, handled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now())`;
  await q`CREATE TABLE IF NOT EXISTS programs (
    id SERIAL PRIMARY KEY, name TEXT, org TEXT, url TEXT, deadline DATE, paid TEXT DEFAULT 'unknown',
    status TEXT DEFAULT 'to-verify', notes TEXT)`;
  await q`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB)`;
  await q`CREATE TABLE IF NOT EXISTS events (id SERIAL PRIMARY KEY, at TIMESTAMPTZ DEFAULT now(), kind TEXT, message TEXT)`;
  await q`INSERT INTO settings (key, value) VALUES ('control', ${JSON.stringify(DEFAULT_SETTINGS)}::jsonb) ON CONFLICT DO NOTHING`;
}

export async function getSettings(): Promise<Settings> {
  if (!hasDb()) return DEFAULT_SETTINGS;
  try {
    const r = await sql()`SELECT value FROM settings WHERE key='control'`;
    return { ...DEFAULT_SETTINGS, ...(r[0]?.value ?? {}) };
  } catch { return DEFAULT_SETTINGS; }
}
export async function saveSettings(p: Partial<Settings>) {
  const next = { ...(await getSettings()), ...p };
  await sql()`INSERT INTO settings (key, value) VALUES ('control', ${JSON.stringify(next)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}
export async function logEvent(kind: string, message: string) {
  if (hasDb()) await sql()`INSERT INTO events (kind, message) VALUES (${kind}, ${message})`;
}
export async function getLeads(): Promise<Lead[]> {
  if (!hasDb()) return DEMO_LEADS;
  try { return (await sql()`SELECT * FROM leads ORDER BY fit DESC, created_at DESC`) as unknown as Lead[]; } catch { return []; }
}
export async function getLead(id: number): Promise<Lead | null> {
  if (!hasDb()) return DEMO_LEADS.find((l) => l.id === id) ?? null;
  const r = await sql()`SELECT * FROM leads WHERE id=${id}`; return (r[0] as unknown as Lead) ?? null;
}
export async function getEmails(): Promise<Email[]> {
  if (!hasDb()) return DEMO_EMAILS;
  try {
    return (await sql()`SELECT e.*, l.name AS lead_name, l.org AS lead_org, l.track FROM emails e
      JOIN leads l ON l.id=e.lead_id ORDER BY e.created_at DESC`) as unknown as Email[];
  } catch { return []; }
}
export async function getPrograms(): Promise<Program[]> {
  if (!hasDb()) return DEMO_PROGRAMS;
  try { return (await sql()`SELECT * FROM programs ORDER BY deadline NULLS LAST`) as unknown as Program[]; } catch { return []; }
}
export async function getEvents(n = 15) {
  if (!hasDb()) return [{ at: new Date().toISOString(), kind: "demo", message: "Sample data. Connect a database to go live." }];
  try { return (await sql()`SELECT * FROM events ORDER BY at DESC LIMIT ${n}`) as unknown as { at: string; kind: string; message: string }[]; } catch { return []; }
}
export { sql };
