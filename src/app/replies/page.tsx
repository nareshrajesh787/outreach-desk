import { getEmails } from "@/lib/db";
import { markHandled } from "@/lib/actions";
export const dynamic = "force-dynamic";
export default async function Replies() {
  const rs = (await getEmails()).filter((e) => e.status === "replied" || e.status === "bounced");
  return (<>
    <h1>Replies</h1>
    <p className="sub">Replies and bounces found by the evening inbox check, each with a suggested response.</p>
    {rs.length === 0 && <div className="card"><p className="mute" style={{ margin: 0 }}>No replies yet. When someone writes back, it shows up here.</p></div>}
    <div style={{ display: "grid", gap: 12 }}>{rs.map((e) => (<div className="card" key={e.id}>
      <div className="row" style={{ justifyContent: "space-between" }}><div><b>{e.lead_name}</b> <span className="mute">{e.lead_org}</span></div><span className={"pill " + (e.status === "bounced" ? "bad" : "ok")}>{e.reply_class ?? e.status}</span></div>
      <p>{e.reply_summary}</p>
      {!e.handled && <form action={markHandled}><input type="hidden" name="id" value={e.id} /><button>Mark handled</button></form>}
    </div>))}</div>
  </>);
}
