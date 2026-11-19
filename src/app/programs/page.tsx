import { getPrograms } from "@/lib/db";
import { addProgram } from "@/lib/actions";
export const dynamic = "force-dynamic";
export default async function Programs() {
  const ps = await getPrograms();
  return (<>
    <h1>Programs</h1>
    <p className="sub">Formal summer programs and their deadlines, found automatically twice a week. Check eligibility yourself: many high school programs exclude students who have already graduated.</p>
    {ps.length === 0 ? <div className="card"><p className="mute" style={{ margin: 0 }}>No programs yet. The first search runs Monday or Thursday morning.</p></div> :
    <table><thead><tr><th>Program</th><th>Deadline</th><th>Pay</th><th>Status</th><th>Notes</th></tr></thead><tbody>
      {ps.map((p) => <tr key={p.id}><td><b>{p.url ? <a href={p.url}>{p.name}</a> : p.name}</b><div className="mute">{p.org}</div></td><td>{p.deadline ? String(p.deadline).slice(0, 10) : "Not listed"}</td><td>{p.paid}</td><td>{p.status}</td><td className="mute" style={{ maxWidth: 380 }}>{p.notes}</td></tr>)}
    </tbody></table>}
    <h2>Add a program</h2>
    <details className="fold card"><summary>Add one you found yourself</summary>
      <form action={addProgram} style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
        <input name="name" placeholder="Name" required /><input name="org" placeholder="Organization" /><input name="url" placeholder="Link" />
        <input type="date" name="deadline" /><select name="paid"><option>unknown</option><option>paid</option><option>unpaid</option></select>
        <input name="notes" placeholder="Notes" /><button className="primary" style={{ justifyContent: "center" }}>Add program</button>
      </form></details>
  </>);
}
