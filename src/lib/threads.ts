import { sql, hasDb, migrate } from "@/lib/db";
import type { Email, Reply } from "@/lib/types";

export type Item =
  | { type: "out"; at: string; subject: string; body: string }
  | { type: "in"; at: string; id: number; from: string | null; body: string; reply_class: string | null; summary: string | null; summaryOnly?: boolean }
  | { type: "draft"; at: string; email: Email };
export type Thread = {
  id: number; lead_id: number; name: string; org: string | null; track: string; email: string | null; subject: string; status: string; handled: boolean;
  reply_class: string | null; reply_summary: string | null; last_at: string; items: Item[]; latestReply: Reply | null; draft: Email | null;
};

type BaseRow = { id: number; lead_id: number; subject: string; body: string; sent_at: string; status: string; handled: boolean; reply_class: string | null; reply_summary: string | null; name: string; org: string | null; track: string; email: string | null };

export async function getThreads(): Promise<Thread[]> {
  if (!hasDb()) return [];
  await migrate();
  const base = (await sql()`SELECT e.id, e.lead_id, e.subject, e.body, e.sent_at, e.status, e.handled, e.reply_class, e.reply_summary, l.name, l.org, l.track, l.email
    FROM emails e JOIN leads l ON l.id=e.lead_id
    WHERE e.kind<>'reply' AND (e.status='replied' OR EXISTS (SELECT 1 FROM replies r WHERE r.email_id=e.id))`) as unknown as BaseRow[];
  const msgs = (await sql()`SELECT * FROM replies ORDER BY received_at`) as unknown as Reply[];
  const drafts = (await sql()`SELECT * FROM emails WHERE kind='reply' ORDER BY created_at`) as unknown as Email[];
  const out: Thread[] = base.map((b) => {
    const mine = msgs.filter((m) => m.email_id === b.id);
    const items: Item[] = [{ type: "out", at: b.sent_at, subject: b.subject, body: b.body }];
    for (const m of mine) items.push({ type: "in", at: m.received_at, id: m.id, from: m.from_addr, body: m.body ?? "", reply_class: m.reply_class, summary: m.summary });
    if (!mine.length) items.push({ type: "in", at: b.sent_at, id: 0, from: b.email, body: "", reply_class: b.reply_class, summary: b.reply_summary, summaryOnly: true });
    const myDrafts = drafts.filter((d) => d.parent_id != null && mine.some((m) => m.id === d.parent_id));
    for (const d of myDrafts) items.push({ type: "draft", at: d.sent_at ?? d.created_at ?? new Date().toISOString(), email: d });
    items.sort((x, y) => +new Date(x.at) - +new Date(y.at));
    const latestReply = mine.length ? mine[mine.length - 1] : null;
    const draft = myDrafts.length ? myDrafts[myDrafts.length - 1] : null;
    return {
      id: b.id, lead_id: b.lead_id, name: b.name, org: b.org, track: b.track, email: b.email, subject: b.subject, status: b.status, handled: b.handled,
      reply_class: latestReply?.reply_class ?? b.reply_class, reply_summary: latestReply?.summary ?? b.reply_summary,
      last_at: items[items.length - 1].at, items, latestReply, draft,
    };
  });
  out.sort((a, b) => +new Date(b.last_at) - +new Date(a.last_at));
  return out;
}
