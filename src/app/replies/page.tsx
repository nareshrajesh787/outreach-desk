import { getEmails } from "@/lib/db";
import { markHandled } from "@/lib/actions";
export const dynamic = "force-dynamic";
export default async function Replies() {
  const rs = (await getEmails()).filter((e) => e.status === "replied" || e.status === "bounced");
  return (<>
    <h1>Replies</h1><p className="sub">Replies and bounces found by the inbox check, with a suggested response.</p>
    {rs.length === 0 && <p className="mute">No replies yet.</p>}
    {rs.map((e) => (<div className="card" key={e.id} style={{ marginBottom: 10 }}>
      <b>{e.lead_name}</b> <span className="mute">· {e.lead_org}</span> <span className={"pill " + (e.status === "bounced" ? "bad" : "ok")}>{e.reply_class ?? e.status}</span>
      <p>{e.reply_summary}</p>
      {!e.handled && <form action={markHandled}><input type="hidden" name="id" value={e.id} /><button>Mark handled</button></form>}
    </div>))}
  </>);
}
