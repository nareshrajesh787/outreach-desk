import { getLeads } from "@/lib/db";
import { addLead, setLeadStatus } from "@/lib/actions";
export const dynamic = "force-dynamic";
export default async function Leads({ searchParams }: { searchParams: Promise<{ track?: string }> }) {
  const { track } = await searchParams;
  const all = await getLeads();
  const leads = track ? all.filter((l) => l.track === track) : all;
  return (<>
    <h1>Leads</h1>
    <p className="sub">Everyone the research job finds, ranked by fit. <a href="/leads">All</a> · <a href="/leads?track=academia">Academia</a> · <a href="/leads?track=corporate">Corporate</a></p>
    <table><thead><tr><th>Who</th><th>Track</th><th>Pay / where</th><th>Fit</th><th>Status</th><th>Research</th></tr></thead><tbody>
      {leads.map((l) => (<tr key={l.id}>
        <td><b>{l.name}</b>{l.warm && <span className="pill ok" style={{ marginLeft: 6 }}>warm</span>}<div className="mute">{l.role}{l.role && l.org ? ", " : ""}{l.org}</div>{l.email && <div className="mute">{l.email}</div>}</td>
        <td>{l.track}</td><td>{l.paid}<div className="mute">{l.location}{l.remote ? " · remote ok" : ""}</div></td><td>{l.fit}</td>
        <td><form action={setLeadStatus} className="row"><input type="hidden" name="id" value={l.id} />
          <select name="status" defaultValue={l.status} style={{ width: 120 }}>{["found","researched","drafted","contacted","replied","closed","rejected"].map((s) => <option key={s}>{s}</option>)}</select><button>Set</button></form></td>
        <td style={{ maxWidth: 320 }}>{l.dossier ? <details><summary>Dossier</summary><pre>{l.dossier}</pre>{l.sources.map((u) => <div key={u}><a href={u}>{u.slice(0, 60)}</a></div>)}</details> : <span className="mute">Not yet</span>}</td>
      </tr>))}</tbody></table>
    <h2>Add a lead by hand</h2>
    <form action={addLead} className="card" style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
      <select name="track"><option>academia</option><option>corporate</option></select>
      <input name="name" placeholder="Name" required /><input name="role" placeholder="Role" /><input name="org" placeholder="Organization" />
      <input name="email" placeholder="Email" /><input name="url" placeholder="Link" /><input name="field" placeholder="Field" />
      <select name="paid"><option>unknown</option><option>paid</option><option>unpaid</option></select>
      <label className="row"><input type="checkbox" name="warm" style={{ width: "auto" }} /> Warm intro</label>
      <input name="notes" placeholder="Notes" /><button className="primary">Add</button>
    </form>
  </>);
}
