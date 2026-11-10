import type { Lead, Email, Program } from "./types";
const d = (n: number) => new Date(Date.now() - n * 864e5).toISOString();
export const DEMO_LEADS: Lead[] = [
  { id: 1, track: "academia", name: "Dr. Sample Professor", role: "Assistant Professor", org: "Example University, Dept. of CS", email: "prof@example.edu", url: "https://example.edu", field: "LLM agents", paid: "unknown", location: "Remote OK", remote: true, status: "drafted", fit: 88, warm: false, notes: "Sample row", dossier: "Sample dossier: recent paper on tool-using agents; lab takes high school researchers.", sources: ["https://example.edu/lab"], created_at: d(1) },
  { id: 2, track: "corporate", name: "Sample Recruiter", role: "University Recruiter", org: "Example Co", email: "recruit@example.com", url: null, field: "Software", paid: "paid", location: "Atlanta, GA", remote: false, status: "found", fit: 71, warm: false, notes: "Sample row", dossier: null, sources: [], created_at: d(0) },
];
export const DEMO_EMAILS: Email[] = [
  { id: 1, lead_id: 1, kind: "initial", subject: "High school senior interested in your agents research", body: "Hi Dr. Sample,\n\nSample draft body.\n\nThank you,\nNaresh Rajesh", status: "queued", critic_notes: "All claims match the fact sheet.", scheduled_send_at: new Date(Date.now() + 4 * 36e5).toISOString(), sent_at: null, reply_class: null, reply_summary: null, handled: false, lead_name: "Dr. Sample Professor", lead_org: "Example University", track: "academia" },
];
export const DEMO_PROGRAMS: Program[] = [
  { id: 1, name: "Sample summer program", org: "Example", url: null, deadline: null, paid: "unknown", status: "to-verify", notes: "Sample" },
];
