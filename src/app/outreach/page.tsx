import { getEmails } from "@/lib/db";
import { setEmailStatus, editEmail } from "@/lib/actions";
export const dynamic = "force-dynamic";
const tone = (s: string) => (s === "review" || s === "held" ? "warn" : s === "bounced" ? "bad" : s === "queued" || s === "sent" ? "ok" : "");
export default async function Outreach() {
  const emails = (await getEmails()).filter((e) => !["replied"].includes(e.status));
  return (<>
    <h1>Outreach</h1><p className="sub">Every email, from draft to sent. Queued emails send at the evening time unless you hold or edit them.</p>
    {emails.length === 0 && <p className="mute">No emails yet. The draft job fills this in once leads are researched.</p>}
    {emails.map((e) => (
      <details key={e.id} className="card" style={{ marginBottom: 10 }} open={e.status === "review"}>
        <summary><b>{e.lead_name}</b> <span className="mute">· {e.lead_org} · {e.kind}</span> <span className={"pill " + tone(e.status)}>{e.status}</span></summary>
        {e.critic_notes && <p className="mute">Checker: {e.critic_notes}</p>}
        <form action={editEmail} style={{ display: "grid", gap: 8 }}>
          <input type="hidden" name="id" value={e.id} />
          <input name="subject" defaultValue={e.subject} /><textarea name="body" rows={9} defaultValue={e.body} />
          <div className="row"><button>Save edits</button></div>
        </form>
        <div className="row" style={{ marginTop: 8 }}>
          {[["queued", e.status === "queued" ? "Re-queue" : "Approve & queue"], ["held", "Hold"], ["skipped", "Skip"]].map(([s, l]) => (
            <form className="inline" action={setEmailStatus} key={s}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value={s} /><button className={s === "queued" ? "primary" : ""}>{l}</button></form>))}
        </div>
      </details>))}
  </>);
}
