import { sql } from "@/lib/db";

type L = { id: number; track: string; name: string; role: string | null; org: string | null; email: string | null; status: string; fit: number | null; warm: boolean | null };
type M = { id: number; lead_id: number; kind: string; status: string; reply_class: string | null; reply_summary: string | null };

const STOP = new Set(["the", "university", "of", "at", "inc", "llc", "corp", "corporation", "company", "co", "group", "labs", "lab", "institute", "school", "college", "for", "and", "a"]);

export function orgKey(org: string | null | undefined): string {
  const t = (org ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));
  return t.slice(0, 2).join(" ");
}

const GENERIC_LOCAL = /^(info|contact|hello|admissions?|academy|apply|applications?|careers?|jobs?|hr|recruit\w*|talent|internships?|interns?|students?|stem|outreach|team|office|support|help|programs?|press|admin|enquiries|inquiries|mail|general|webmaster)$/i;
const LISTISH = /(^|[-_.])(dl|list|listserv|noreply|no-reply|donotreply)([-_.]|$)/i;
export function genericEmail(e?: string | null): boolean {
  if (!e) return false;
  const local = e.split("@")[0];
  return GENERIC_LOCAL.test(local) || LISTISH.test(local);
}

const PROGRAMISH = /\b(admissions?|academy|summer (program|institute|school|camp)|pre-?college|early[- ]talent|campus recruiting|university recruiting|outreach (office|program)|stem outreach|youth program|k-?12|reu|fellowship program|accelerator program|nasa develop)\b/i;
const TEAMISH = /\b(team|department|office|admissions|programs?)\s*$/i;
export function programish(l: { name: string; role?: string | null; org?: string | null; email?: string | null }): boolean {
  return PROGRAMISH.test(`${l.name} ${l.role ?? ""} ${l.org ?? ""}`) || TEAMISH.test(l.name.trim()) || genericEmail(l.email);
}

const NEG_CLASS = /(neg|declin|reject|^no\b|not[_ -]?(interested|available|accepting|hiring)|closed|unavailable|ineligible|cannot)/i;
const NEG_SUM = /(not (currently |presently )?(accept|hiring|taking|offer|able)|no (open|position|opening|opportunit|internship)|unable to|cannot|can't (offer|accommodate|take)|must be (at least )?18|age (requirement|limit)|at capacity|do not (have|offer|take|accept)|don't (have|offer|take|accept)|unfortunately|regret to|declin|not a fit|not available|application (only|process)|apply (through|via|online))/i;

const LIVE = new Set(["sent", "replied", "bounced", "review", "queued", "held", "draft"]);

export async function applyGuards() {
  const db = sql();
  const leads = (await db`SELECT id, track, name, role, org, email, status, fit, warm FROM leads`) as unknown as L[];
  const mails = (await db`SELECT id, lead_id, kind, status, reply_class, reply_summary FROM emails`) as unknown as M[];
  const leadById = new Map<number, L>(leads.map((l) => [l.id, l]));

  const firstEmail = new Map<string, number>();
  const firstName = new Map<string, number>();
  const firstOrg = new Map<string, number>();
  const put = (map: Map<string, number>, k: string, id: number) => { const cur = map.get(k); if (k && (cur === undefined || id < cur)) map.set(k, id); };
  for (const m of mails) {
    if (m.kind !== "initial" || !LIVE.has(m.status)) continue;
    const l = leadById.get(m.lead_id);
    if (!l) continue;
    if (l.email) put(firstEmail, l.email.toLowerCase(), m.id);
    const nm = l.name.trim().toLowerCase();
    if (/\s/.test(nm) && !/\b(team|office|department)\b/.test(nm)) put(firstName, nm, m.id);
    if (l.track === "corporate" || programish(l)) put(firstOrg, orgKey(l.org), m.id);
  }

  const declined = new Set<string>();
  for (const m of mails) {
    if (m.status !== "replied") continue;
    const l = leadById.get(m.lead_id);
    if (!l) continue;
    const neg = NEG_CLASS.test(m.reply_class ?? "") || NEG_SUM.test(m.reply_summary ?? "");
    if (neg && (l.track === "corporate" || programish(l))) declined.add(orgKey(l.org));
  }
  declined.delete("");

  const reason = (l: L, mailId: number): string | null => {
    if (programish(l)) return "program, generic inbox or team address";
    if (l.email && (firstEmail.get(l.email.toLowerCase()) ?? Infinity) < mailId) return "this address was already emailed";
    const nm = l.name.trim().toLowerCase();
    if (/\s/.test(nm) && (firstName.get(nm) ?? Infinity) < mailId) return "this person was already emailed";
    const k = orgKey(l.org);
    if (k && declined.has(k)) return "this organization already said no";
    if (l.track === "corporate" && k && (firstOrg.get(k) ?? Infinity) < mailId) return "this company was already contacted";
    return null;
  };

  // 1) Leads that have no email yet
  const byReason = new Map<string, number[]>();
  const add = (r: string, id: number) => { const a = byReason.get(r) ?? []; a.push(id); byReason.set(r, a); };
  const pending = leads.filter((l) => l.status === "found" || l.status === "researched");
  const survivors: L[] = [];
  for (const l of pending) {
    const r = reason(l, Infinity);
    if (r) add(r, l.id); else survivors.push(l);
  }
  // one contact per company / per address inside the new batch, best lead wins
  const rank = (l: L) => (l.email ? 1000 : 0) + (l.warm ? 500 : 0) + (l.fit ?? 0);
  survivors.sort((a, b) => rank(b) - rank(a));
  const seenOrg = new Set<string>();
  const seenAddr = new Set<string>();
  for (const l of survivors) {
    const k = orgKey(l.org);
    const a = l.email ? l.email.toLowerCase() : "";
    if (l.track === "corporate" && k && seenOrg.has(k)) { add("another contact at this company is already in the pipeline", l.id); continue; }
    if (a && seenAddr.has(a)) { add("duplicate address in the pipeline", l.id); continue; }
    if (l.track === "corporate" && k) seenOrg.add(k);
    if (a) seenAddr.add(a);
  }
  let leadsSuppressed = 0;
  for (const [r, ids] of byReason) {
    leadsSuppressed += ids.length;
    await db`UPDATE leads SET status='suppressed', notes = COALESCE(notes,'') || ${" [Guard: " + r + "]"} WHERE id IN (SELECT jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)::int)`;
  }

  // 2) Drafts that are waiting (review / approved) but should not go out
  const held = new Map<string, number[]>();
  const sample: string[] = [];
  for (const m of mails) {
    if (m.kind !== "initial" || (m.status !== "review" && m.status !== "queued")) continue;
    const l = leadById.get(m.lead_id);
    if (!l) continue;
    const r = reason(l, m.id);
    if (!r) continue;
    const a = held.get(r) ?? [];
    a.push(m.id);
    held.set(r, a);
    if (sample.length < 12) sample.push(`${l.name} (${l.org ?? ""}): ${r}`);
  }
  let emailsHeld = 0;
  for (const [r, ids] of held) {
    emailsHeld += ids.length;
    await db`UPDATE emails SET status='held', scheduled_send_at=NULL, critic_notes=${"Held by guard: " + r} WHERE id IN (SELECT jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)::int)`;
  }
  return { leadsSuppressed, emailsHeld, declinedOrgs: [...declined], sample, reasons: Object.fromEntries([...byReason].map(([r, ids]) => [r, ids.length])) };
}
