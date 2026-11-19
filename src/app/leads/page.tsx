import Link from "next/link";
import { getLeads } from "@/lib/db";
import { addLead, setLeadStatus } from "@/lib/actions";
export const dynamic = "force-dynamic";
export default async function Leads({ searchParams }: { searchParams: Promise<{ track?: string }> }) {
  const { track } = await searchParams;
  const everyone = await getLeads();
  const isOut = (s: string) => s === "suppressed";
  const all = everyone.filter((l) => !isOut(l.status));
  const suppressed = everyone.length - all.length;
  const leads = track === "suppressed" ? everyone.filter((l) => isOut(l.status)) : track ? all.filter((l) => l.track === track) : all;
  const chip = (href: string, label: string, on: boolean) => <Link className={"chip" + (on ? " on" : "")} href={href}>{label}</Link>;
  return (<>
    <h1>Leads</h1>
    <p className="sub">Professors, labs and companies the research jobs find, ranked by fit. Fit is a score out of 100 for how well they match your overall profile: whether they take high school students, have a public email, are in Georgia or remote, work in areas close to your computer science, math and software experience, and were active recently. Programs, generic inboxes, people already emailed and organizations that said no are filtered out automatically and kept under Filtered out.</p>
    <div className="chips">{chip("/leads", `All ${all.length}`, !track)}{chip("/leads?track=academia", "Academia", track === "academia")}{chip("/leads?track=corporate", "Corporate", track === "corporate")}{chip("/leads?track=suppressed", `Filtered out ${suppressed}`, track === "suppressed")}</div>
    <table><thead><tr><th>Who</th><th>Pay and place</th><th>Fit</th><th>Status</th><th>Research</th></tr></thead><tbody>
      {leads.map((l) => (<tr key={l.id}>
        <td><b>{l.name}</b>{l.warm && <span className="pill ok" style={{ marginLeft: 8 }}>Warm</span>}<div className="mute">{l.role}{l.role && l.org ? ", " : ""}{l.org}</div>{l.email && <div className="mute">{l.email}</div>}</td>
        <td>{l.paid}<div className="mute">{l.location}{l.remote ? " (remote ok)" : ""}</div></td>
        <td style={{ whiteSpace: "nowrap" }}><span className="meter"><i style={{ width: `${l.fit}%` }} /></span>{l.fit}</td>
        <td><form action={setLeadStatus} className="row"><input type="hidden" name="id" value={l.id} />
          <select name="status" defaultValue={l.status} style={{ width: 118 }}>{["found","researched","drafted","contacted","replied","closed","rejected","suppressed"].map((x) => <option key={x}>{x}</option>)}</select><button>Set</button></form></td>
        <td style={{ maxWidth: 340 }}>{l.dossier ? <details className="fold"><summary>View dossier</summary><pre>{l.dossier}</pre>{l.sources.map((u) => <div key={u}><a href={u}>{u.slice(0, 60)}</a></div>)}</details> : <span className="mute">Not researched yet</span>}</td>
      </tr>))}</tbody></table>
    <h2>Add a lead</h2>
    <details className="fold card"><summary>Add someone you already know</summary>
      <form action={addLead} style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
        <select name="track"><option>academia</option><option>corporate</option></select>
        <input name="name" placeholder="Name" required /><input name="role" placeholder="Role" /><input name="org" placeholder="Organization" />
        <input name="email" placeholder="Email" /><input name="url" placeholder="Link" /><input name="field" placeholder="Field" />
        <select name="paid"><option>unknown</option><option>paid</option><option>unpaid</option></select>
        <label className="row"><input type="checkbox" name="warm" style={{ width: "auto" }} /> Warm intro</label>
        <input name="notes" placeholder="Notes" /><button className="primary" style={{ justifyContent: "center" }}>Add lead</button>
      </form></details>
  </>);
}
