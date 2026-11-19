import Link from "next/link";
import { getEmails } from "@/lib/db";
import { approveEmail, holdEmail, skipEmail, saveEmail } from "@/lib/actions";
export const dynamic = "force-dynamic";
const TABS: [string, string, string[]][] = [["review", "Needs review", ["review"]], ["queued", "Approved", ["queued"]], ["held", "Held", ["held", "skipped"]], ["sent", "Sent", ["sent", "bounced"]], ["all", "All", []]];
const tone = (s: string) => (s === "review" || s === "held" ? "warn" : s === "bounced" ? "bad" : s === "queued" || s === "sent" ? "ok" : "");
const label = (s: string) => (s === "queued" ? "approved" : s);
export default async function Outreach({ searchParams }: { searchParams: Promise<{ tab?: string; id?: string; saved?: string }> }) {
  const sp = await searchParams;
  const all = (await getEmails()).filter((e) => e.status !== "replied");
  const cur = TABS.find((t) => t[0] === sp.tab) ?? TABS[0];
  const list = cur[2].length ? all.filter((e) => cur[2].includes(e.status)) : all;
  const sel = list.find((e) => e.id === Number(sp.id)) ?? list[0];
  const count = (t: string[]) => (t.length ? all.filter((e) => t.includes(e.status)).length : all.length);
  const editable = sel && !["sent", "bounced"].includes(sel.status);
  return (<>
    <h1>Outreach</h1>
    <p className="sub">Review at night. Approved emails and replies send the next weekday morning, and you can still hold one until then.</p>
    <div className="chips">{TABS.map(([k, name, st]) => <Link key={k} className={"chip" + (cur[0] === k ? " on" : "")} href={`/outreach?tab=${k}`}>{name} {count(st)}</Link>)}</div>
    {!sel ? <div className="card"><p className="mute" style={{ margin: 0 }}>{cur[0] === "review" ? "Nothing to review. New drafts show up here after the morning draft run." : "No emails here yet."}</p></div> :
    <div className="split">
      <nav className="list" aria-label="Emails">
        {list.map((e) => (
          <Link key={e.id} href={`/outreach?tab=${cur[0]}&id=${e.id}`} className={"item" + (e.id === sel.id ? " on" : "")}>
            <b>{e.lead_name}</b><small>{e.lead_org}</small><small>{e.subject}</small>
            <span className="meta"><span className={"pill " + tone(e.status)}>{label(e.status)}</span><small style={{ flex: "none" }}>{e.kind === "initial" ? "first email" : e.kind === "reply" ? "reply" : "follow-up"}</small></span>
          </Link>))}
      </nav>
      <form key={sel.id} action={saveEmail} className="editor">
        <input type="hidden" name="id" value={sel.id} /><input type="hidden" name="tab" value={cur[0]} />
        <div className="to"><div><h3>{sel.lead_name}</h3><span className="mute">{sel.lead_org}</span></div><span className={"pill " + tone(sel.status)}>{label(sel.status)}</span></div>
        {sel.critic_notes && <div className={"note" + (sel.status === "review" && /Checker|Blocked/.test(sel.critic_notes) ? " flag" : "")}>{sel.critic_notes}</div>}
        <input className="subject" name="subject" defaultValue={sel.subject} aria-label="Subject" readOnly={!editable} />
        <textarea name="body" defaultValue={sel.body} aria-label="Email body" readOnly={!editable} />
        {editable ? <div className="bar">
          <button type="submit" className="primary" formAction={approveEmail}>Approve for morning</button>
          <button type="submit" formAction={holdEmail}>Hold</button>
          <button type="submit" className="danger" formAction={skipEmail}>Skip</button>
          <button type="submit" formAction={saveEmail}>Save edits</button>
          {sp.saved && <span className="saved">Saved</span>}
          <span className="count">{sel.body.trim().split(/\s+/).length} words</span>
        </div> : <div className="bar"><span className="count" style={{ marginLeft: 0 }}>Sent emails can't be edited.</span></div>}
      </form>
    </div>}
  </>);
}
