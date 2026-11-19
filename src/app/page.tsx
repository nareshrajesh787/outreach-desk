import Link from "next/link";
import { getLeads, getEmails, getEvents, getSettings } from "@/lib/db";
import { setEmailStatus } from "@/lib/actions";
import Count from "./count";
export const dynamic = "force-dynamic";
const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
export default async function Today() {
  const [leads, emails, events, s] = await Promise.all([getLeads(), getEmails(), getEvents(12), getSettings()]);
  const n = (f: (e: (typeof emails)[number]) => boolean) => emails.filter(f).length;
  const review = n((e) => e.status === "review");
  const replies = emails.filter((e) => e.status === "replied" && !e.handled);
  const queued = emails.filter((e) => e.status === "queued");
  const researched = leads.filter((l) => ["researched", "drafted", "contacted", "replied"].includes(l.status)).length;
  const stages: [string, number][] = [
    ["Leads found", leads.length], ["Researched", researched], ["Drafted", emails.length],
    ["Approved", queued.length], ["Sent", n((e) => ["sent", "replied", "bounced"].includes(e.status))], ["Replies", n((e) => e.status === "replied")],
  ];
  const top = Math.max(1, stages[0][1]);
  return (<>
    <h1>Today</h1>
    <p className="sub">{s.paused ? s.pause_reason : "Sending is live. Approve emails at night and they go out the next weekday morning. If a morning is missed, the next run catches up."}</p>

    <section className="pipe" aria-label="Pipeline">
      {stages.map(([label, v], i) => (
        <div className="stage" key={label} style={{ "--i": i } as React.CSSProperties}>
          <b><Count n={v} /></b><span>{label}</span>
          <i style={{ "--w": `${Math.max(v ? 3 : 0, Math.round((v / top) * 100))}%` } as React.CSSProperties} />
        </div>))}
    </section>

    <h2>Your queue</h2>
    <div className={"todo" + (review + replies.length === 0 ? " clear" : "")}>
      {review + replies.length === 0 ? <p>Nothing needs you right now.</p> : <>
        <div className="big">{review}</div><p>{review === 1 ? "draft is" : "drafts are"} waiting for your review{replies.length ? `, and ${replies.length} ${replies.length === 1 ? "reply needs" : "replies need"} a look` : ""}.</p>
        <Link className="btn primary" href={review ? "/outreach?tab=review" : "/replies"}>{review ? "Start review" : "Open replies"}</Link></>}
    </div>

    <h2>Sends next morning <span className="c">{queued.length}</span></h2>
    {queued.length === 0 ? <p className="mute">Nothing approved yet.</p> : <table><tbody>{queued.map((e) => (
      <tr key={e.id}><td><b>{e.lead_name}</b><div className="mute">{e.subject}</div></td><td className="mute">{e.lead_org}</td>
        <td style={{ textAlign: "right" }}><form className="inline" action={setEmailStatus}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="held" /><button>Hold</button></form></td></tr>))}</tbody></table>}

    <h2>Activity</h2>
    <div className="timeline">{events.map((v, i) => <div key={i}><time>{fmt(v.at)}</time>{v.message}</div>)}</div>
  </>);
}
