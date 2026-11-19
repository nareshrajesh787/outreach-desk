import { sql, logEvent, migrate } from "@/lib/db";
import { gemini, parseJson } from "@/lib/gemini";
import { FACT_SHEET, FORBIDDEN } from "@/lib/facts";
import { pool } from "@/lib/pool";

// Replies that need no answer: declines, out-of-office / auto replies, bounces.
const NO_DRAFT = /(declin|reject|^no\b|not[_ -]?interested|auto|out[_ -]?of[_ -]?office|bounce|unsubscribe)/i;
export const needsDraft = (cls?: string | null) => !NO_DRAFT.test(cls ?? "");
export const isDecline = (cls?: string | null) => /(declin|reject|^no\b|not[_ -]?interested)/i.test(cls ?? "");

const REPLY_STYLE = `Write like a real 17-year-old answering a professional who took time to reply: natural, specific, a little informal, never stiff. 35 to 80 words, 2 or 3 short paragraphs. Start with "Hi Dr./Prof./Ms./Mr. LastName," (or first name if they signed with only a first name and are not a professor). Do NOT open with "Thank you for your prompt/kind/insightful response" or any stock gratitude line; instead react to the one concrete thing they actually said (the program they named, the call they offered, the date they gave) in your own words, and thank them for that specific thing in one clause. Do NOT restate their message back to them, do NOT list what you will do, and do NOT use phrases like "I appreciate", "I would be grateful", "I am eager", "valuable", "insight", "opportunity", "pursue", "I look forward to". Use plain contractions where natural (I'll, I'm, that's). If they offered a call or Zoom, say what works and propose one concrete next step; if they pointed to a program, say you'll look into it, and name it. If they asked for something the fact sheet cannot answer (availability, resume, schedule), write a bracketed placeholder like [confirm: available weekday afternoons?]. No new claims about his background beyond the fact sheet. Never mention edgar-facts-mcp or any Spotify project. Sign off "Thank you," then "Naresh Rajesh". Do not write a subject line.
Example of the right voice (different situation): "Hi Dr. Lee,\n\nThanks for passing me along to Dr. Park, and for being upfront that the lab is full this summer. I'll email her this week about her group.\n\nThank you,\nNaresh Rajesh"`;

const stripRe = (s: string) => s.replace(/^\s*((re|fwd?):\s*)+/i, "").trim();

type Pending = {
  id: number; email_id: number; lead_id: number; from_addr: string | null; subject: string | null; body: string | null; reply_class: string | null;
  name: string; role: string | null; org: string | null; lead_email: string | null; orig_subject: string; orig_body: string;
};

// Drafts a reply for every inbound message that has none yet (latest message in each thread only).
// Everything lands in Needs review; nothing is ever auto-approved.
export async function draftReplies(opts: { replyId?: number; redo?: boolean } = {}) {
  await migrate();
  if (opts.redo) await sql()`DELETE FROM emails WHERE kind='reply' AND status='review'`;
  const rows = (opts.replyId
    ? await sql()`SELECT r.id, r.email_id, r.lead_id, r.from_addr, r.subject, r.body, r.reply_class, l.name, l.role, l.org, l.email AS lead_email, e.subject AS orig_subject, e.body AS orig_body
        FROM replies r JOIN emails e ON e.id=r.email_id JOIN leads l ON l.id=r.lead_id WHERE r.id=${opts.replyId}`
    : await sql()`SELECT r.id, r.email_id, r.lead_id, r.from_addr, r.subject, r.body, r.reply_class, l.name, l.role, l.org, l.email AS lead_email, e.subject AS orig_subject, e.body AS orig_body
        FROM replies r JOIN emails e ON e.id=r.email_id JOIN leads l ON l.id=r.lead_id
        WHERE e.handled=false
          AND NOT EXISTS (SELECT 1 FROM emails x WHERE x.kind='reply' AND x.parent_id=r.id)
          AND NOT EXISTS (SELECT 1 FROM replies r2 WHERE r2.email_id=r.email_id AND r2.received_at > r.received_at)
        ORDER BY r.received_at LIMIT 10`) as unknown as Pending[];
  const todo = rows.filter((r) => opts.replyId || needsDraft(r.reply_class));
  let made = 0;
  await pool(todo, 2, async (r) => {
    try {
      const earlier = (await sql()`SELECT body, received_at FROM replies WHERE email_id=${r.email_id} AND id<>${r.id} AND received_at < (SELECT received_at FROM replies WHERE id=${r.id}) ORDER BY received_at`) as unknown as { body: string }[];
      const mine = (await sql()`SELECT body FROM emails WHERE kind='reply' AND status='sent' AND lead_id=${r.lead_id} ORDER BY sent_at`) as unknown as { body: string }[];
      const prompt = `Write Naresh Rajesh's reply to ${r.name} (${r.role ?? ""}, ${r.org ?? ""}), who answered his cold email.
Style rules: ${REPLY_STYLE}
Use ONLY these facts about Naresh; invent nothing:
${FACT_SHEET}

His original email:
${r.orig_body}
${earlier.length ? `\nEarlier messages from them:\n${earlier.map((m) => m.body).join("\n---\n")}\n` : ""}${mine.length ? `\nReplies he already sent:\n${mine.map((m) => m.body).join("\n---\n")}\n` : ""}
Their latest message (answer this one):
${(r.body || "").slice(0, 4000)}

Return ONLY JSON: {"body":"..."}`;
      const { text } = await gemini(prompt, { json: true, draft: true });
      const d = parseJson<{ body: string }>(text);
      const flags = FORBIDDEN.filter((f) => f.re.test(d.body)).map((f) => f.why);
      let notes = flags.length ? "Blocked by red-line check: " + flags.join("; ") : "";
      if (!flags.length) {
        const c = await gemini(`You are a strict fact-checker. Facts allowed:\n${FACT_SHEET}\n\nReply email:\n${d.body}\n\nList any claim in the reply that is NOT supported by the facts or that exaggerates. Also flag hype, stock gratitude phrases, or a reply over 100 words. Bracketed [confirm: ...] placeholders are allowed. Return ONLY JSON {"ok":true|false,"problems":["..."]}`, { json: true, draft: true });
        const v = parseJson<{ ok: boolean; problems: string[] }>(c.text);
        notes = v.ok ? "All claims match the fact sheet." : "Checker: " + v.problems.join("; ");
      }
      if (/\[confirm:/i.test(d.body)) notes += " Fill in the [confirm: ...] part before approving.";
      const to = r.from_addr || r.lead_email;
      await sql()`INSERT INTO emails (lead_id, kind, subject, body, status, critic_notes, parent_id, to_addr)
        VALUES (${r.lead_id}, 'reply', ${"Re: " + stripRe(r.subject || r.orig_subject)}, ${d.body}, 'review', ${notes}, ${r.id}, ${to})`;
      made++;
    } catch (e) { await logEvent("error", `Reply draft for ${r.name} failed: ${(e as Error).message.slice(0, 160)}`); }
  });
  if (made) await logEvent("draft", `Reply drafts: ${made} new`);
  return { made, candidates: todo.length };
}
