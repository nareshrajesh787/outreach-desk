import Link from "next/link";
import { getLeads, getEmails, getEvents, getSettings } from "@/lib/db";
import { setEmailStatus } from "@/lib/actions";
export const dynamic = "force-dynamic";
const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
export default async function Today() {
  const [leads, emails, events, s] = await Promise.all([getLeads(), getEmails(), getEvents(), getSettings()]);
  const c = (f: (e: (typeof emails)[number]) => boolean) => emails.filter(f).length;
  const needs = emails.filter((e) => e.status === "review" || (e.status === "replied" && !e.handled));
  const queued = emails.filter((e) => e.status === "queued");
  const tiles: [string, number][] = [
    ["Leads found", leads.length], ["Researched", leads.filter((l) => ["researched", "drafted", "contacted", "replied"].includes(l.status)).length],
    ["Queued to send", queued.length], ["Sent", c((e) => ["sent", "replied", "bounced"].includes(e.status))],
    ["Replies", c((e) => e.status === "replied")], ["Bounced", c((e) => e.status === "bounced")],
  ];
  return (<>
    <h1>Today</h1><p className="sub">{s.paused ? s.pause_reason : "Sending is live. Queued emails go out at the evening send time unless you hold them."}</p>
    <div className="grid">{tiles.map(([l, n]) => <div className="card" key={l}><div className="n">{n}</div><div className="l">{l}</div></div>)}</div>
    <h2>Needs you ({needs.length})</h2>
    {needs.length === 0 ? <p className="mute">Nothing waiting.</p> : <table><tbody>{needs.map((e) => (
      <tr key={e.id}><td><b>{e.lead_name}</b><div className="mute">{e.lead_org}</div></td>
        <td>{e.status === "review" ? <><span className="pill warn">Needs review</span><div className="mute">{e.critic_notes}</div></> : <><span className="pill ok">Reply: {e.reply_class}</span><div className="mute">{e.reply_summary}</div></>}</td>
        <td><Link className="btn" href={e.status === "review" ? "/outreach" : "/replies"}>Open</Link></td></tr>))}</tbody></table>}
    <h2>Going out next ({queued.length})</h2>
    {queued.length === 0 ? <p className="mute">Nothing queued.</p> : <table><tbody>{queued.map((e) => (
      <tr key={e.id}><td><b>{e.lead_name}</b><div className="mute">{e.subject}</div></td><td className="mute">{fmt(e.scheduled_send_at)}</td>
        <td><form className="inline" action={setEmailStatus}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="held" /><button>Hold</button></form></td></tr>))}</tbody></table>}
    <h2>Activity</h2>
    <table><tbody>{events.map((v, i) => <tr key={i}><td className="mute" style={{ width: 150 }}>{fmt(v.at)}</td><td>{v.message}</td></tr>)}</tbody></table>
  </>);
}
