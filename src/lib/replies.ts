import { sql, logEvent, migrate } from "@/lib/db";
import { gemini, parseJson } from "@/lib/gemini";
import { FACT_SHEET, FORBIDDEN } from "@/lib/facts";
import { pool } from "@/lib/pool";

// Replies that need no answer: declines, out-of-office / auto replies, bounces.
const NO_DRAFT = /(declin|reject|^no\b|not[_ -]?interested|auto|out[_ -]?of[_ -]?office|bounce|unsubscribe)/i;
export const needsDraft = (cls?: string | null) => !NO_DRAFT.test(cls ?? "");
export const isDecline = (cls?: string | null) => /(declin|reject|^no\b|not[_ -]?interested)/i.test(cls ?? "");

const REPLY_STYLE = `Warm, brief and plain, like a thoughtful high school student writing to a busy professional. 40 to 110 words. Thank them for replying. Answer exactly what they asked and nothing more. If they offered a call, a form, or a pointer to another person, accept and propose one concrete next step. If they ask for something the fact sheet cannot answer (specific availability dates, a resume, a transcript, a schedule), write a bracketed placeholder such as [confirm: available weekday afternoons?] instead of guessing. No hype, no flattery, no buzzwords, no new claims about his background beyond the fact sheet. Never mention edgar-facts-mcp or any Spotify project. Sign off "Thank you," then "Naresh Rajesh". Do not write a subject line.`;

const stripRe = (s: string) => s.replace(/^\s*((re|fwd?):\s*)+/i, "").trim();

type Pending = {
  id: number; email_id: number; lead_id: number; from_addr: string | null; subject: string | null; body: string | null; reply_class: string | null;
  name: string; role: string | null; org: string | null; lead_email: string | null; orig_subject: string; orig_body: string;
};

// Drafts a reply for every inbound message that has none yet (latest message in each thread only).
// Everything lands in Needs review; nothing is ever auto-approved.
export async function draftReplies(opts: { replyId?: number } = {}) {
  await migrate();
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
        const c = await gemini(`You are a strict fact-checker. Facts allowed:\n${FACT_SHEET}\n\nReply email:\n${d.body}\n\nList any claim in the reply that is NOT supported by the facts or that exaggerates. Also flag hype or a reply over 130 words. Bracketed [confirm: ...] placeholders are allowed. Return ONLY JSON {"ok":true|false,"problems":["..."]}`, { json: true, draft: true });
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
