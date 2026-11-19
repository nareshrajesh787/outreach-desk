import Link from "next/link";
import { getEmails } from "@/lib/db";
import { getThreads } from "@/lib/threads";
import { needsDraft } from "@/lib/replies";
import { approveEmail, holdEmail, skipEmail, saveEmail, markHandled, draftReplyNow } from "@/lib/actions";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const tone = (s: string) => (s === "review" || s === "held" ? "warn" : s === "bounced" ? "bad" : s === "queued" || s === "sent" ? "ok" : "");
const label = (s: string) => (s === "queued" ? "approved" : s);
const when = (t: string) => new Date(t).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const clsTone = (c: string | null) => (/declin|reject|^no\b/i.test(c ?? "") ? "bad" : /interest|referral|question/i.test(c ?? "") ? "ok" : "");

export default async function Replies({ searchParams }: { searchParams: Promise<{ id?: string; saved?: string }> }) {
  const sp = await searchParams;
  const threads = await getThreads();
  const bounces = (await getEmails()).filter((e) => e.status === "bounced" && e.kind !== "reply");
  const sel = threads.find((t) => t.id === Number(sp.id)) ?? threads[0];
  const waiting = (t: (typeof threads)[number]) => !t.handled && (t.draft ? ["review", "held"].includes(t.draft.status) : !!t.latestReply && needsDraft(t.latestReply.reply_class));
  return (<>
    <h1>Replies</h1>
    <p className="sub">Every conversation with someone who wrote back. Drafted answers wait here for your approval and send the next weekday morning, like first emails.</p>
    {threads.length === 0 ? <div className="card"><p className="mute" style={{ margin: 0 }}>No replies yet. When someone writes back, the whole conversation shows up here after the evening inbox check.</p></div> :
    <div className="split">
      <nav className="list" aria-label="Conversations">
        {threads.map((t) => (
          <Link key={t.id} href={`/replies?id=${t.id}`} className={"item" + (sel && t.id === sel.id ? " on" : "")}>
            <b>{t.name}</b><small>{t.org}</small><small>{t.reply_summary ? t.reply_summary.slice(0, 90) : t.subject}</small>
            <span className="meta">
              <span className={"pill " + clsTone(t.reply_class)}>{t.reply_class ?? "reply"}</span>
              {t.handled ? <span className="pill">done</span> : t.draft ? <span className={"pill " + tone(t.draft.status)}>reply {label(t.draft.status)}</span> : waiting(t) ? <span className="pill warn">needs reply</span> : null}
            </span>
          </Link>))}
      </nav>
      {sel && <div className="editor">
        <div className="to"><div><h3>{sel.name}</h3><span className="mute">{sel.org}{sel.email ? ` · ${sel.email}` : ""}</span></div><span className={"pill " + clsTone(sel.reply_class)}>{sel.reply_class ?? "reply"}</span></div>
        <div style={{ display: "grid", gap: 10 }}>
          {sel.items.map((it, i) => it.type === "draft" ? null : (
            <div key={i} className="card" style={{ margin: 0, borderLeft: it.type === "in" ? "3px solid var(--accent, #3b7)" : undefined }}>
              <div className="row" style={{ justifyContent: "space-between" }}><b>{it.type === "out" ? "You" : sel.name}</b><small className="mute">{when(it.at)}</small></div>
              {it.type === "out" && <><div className="mute">{it.subject}</div><pre style={{ whiteSpace: "pre-wrap", margin: "8px 0 0", font: "inherit" }}>{it.body}</pre></>}
              {it.type === "in" && (it.summaryOnly
                ? <p className="mute" style={{ margin: "8px 0 0" }}>Summary only: {it.summary || "no summary saved"}. The full message appears after the next inbox check.</p>
                : <><pre style={{ whiteSpace: "pre-wrap", margin: "8px 0 0", font: "inherit" }}>{it.body}</pre>{it.summary && <p className="mute" style={{ margin: "8px 0 0" }}>{it.summary}</p>}</>)}
            </div>))}
          {sel.items.filter((it) => it.type === "draft" && it.email.status === "sent").map((it, i) => it.type === "draft" && (
            <div key={"s" + i} className="card" style={{ margin: 0 }}>
              <div className="row" style={{ justifyContent: "space-between" }}><b>You (reply sent)</b><small className="mute">{when(it.at)}</small></div>
              <pre style={{ whiteSpace: "pre-wrap", margin: "8px 0 0", font: "inherit" }}>{it.email.body}</pre>
            </div>))}
        </div>
        {sel.draft && sel.draft.status !== "sent" ? (
          <form key={sel.draft.id} action={saveEmail} style={{ display: "grid", gap: 10, marginTop: 14 }}>
            <input type="hidden" name="id" value={sel.draft.id} /><input type="hidden" name="tab" value="replies" /><input type="hidden" name="thread" value={sel.id} />
            <div className="to"><h3 style={{ margin: 0 }}>Your reply</h3><span className={"pill " + tone(sel.draft.status)}>{label(sel.draft.status)}</span></div>
            {sel.draft.critic_notes && <div className={"note" + (/Checker|Blocked|confirm:/.test(sel.draft.critic_notes) ? " flag" : "")}>{sel.draft.critic_notes}</div>}
            <input className="subject" name="subject" defaultValue={sel.draft.subject} aria-label="Subject" />
            <textarea name="body" defaultValue={sel.draft.body} aria-label="Reply body" />
            <div className="bar">
              <button type="submit" className="primary" formAction={approveEmail}>Approve for morning</button>
              <button type="submit" formAction={holdEmail}>Hold</button>
              <button type="submit" className="danger" formAction={skipEmail}>Skip</button>
              <button type="submit" formAction={saveEmail}>Save edits</button>
              {sp.saved && <span className="saved">Saved</span>}
              <span className="count">sends to {sel.draft.to_addr ?? sel.email}</span>
            </div>
          </form>
        ) : (
          <div className="bar" style={{ marginTop: 14 }}>
            {sel.latestReply && (!sel.draft || sel.draft.status === "sent") && !sel.handled && (
              <form action={draftReplyNow}><input type="hidden" name="reply_id" value={sel.latestReply.id} /><input type="hidden" name="thread" value={sel.id} />
                <button className="primary">{needsDraft(sel.latestReply.reply_class) ? "Draft a reply" : "Draft a reply anyway"}</button></form>)}
            {!sel.handled && <form action={markHandled}><input type="hidden" name="id" value={sel.id} /><button>Mark done, no reply needed</button></form>}
            {sel.latestReply && !needsDraft(sel.latestReply.reply_class) && <span className="count" style={{ marginLeft: 0 }}>This looks like a decline or automatic reply, so nothing was drafted.</span>}
          </div>
        )}
      </div>}
    </div>}
    {bounces.length > 0 && <>
      <h2>Bounces</h2>
      <div className="card"><p className="mute" style={{ margin: 0 }}>{bounces.map((b) => `${b.lead_name} (${b.lead_org ?? ""})`).join(" · ")}</p></div>
    </>}
  </>);
}
