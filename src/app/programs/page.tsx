import { getPrograms } from "@/lib/db";
import { addProgram } from "@/lib/actions";
export const dynamic = "force-dynamic";
export default async function Programs() {
  const ps = await getPrograms();
  return (<>
    <h1>Programs</h1><p className="sub">Formal summer programs and their deadlines, so nothing gets missed while cold emails go out.</p>
    <table><thead><tr><th>Program</th><th>Deadline</th><th>Paid</th><th>Status</th></tr></thead><tbody>
      {ps.map((p) => <tr key={p.id}><td><b>{p.url ? <a href={p.url}>{p.name}</a> : p.name}</b><div className="mute">{p.org}</div></td><td>{p.deadline ? String(p.deadline).slice(0, 10) : "?"}</td><td>{p.paid}</td><td>{p.status}</td></tr>)}
    </tbody></table>
    <h2>Add a program</h2>
    <form action={addProgram} className="card" style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
      <input name="name" placeholder="Name" required /><input name="org" placeholder="Organization" /><input name="url" placeholder="Link" />
      <input type="date" name="deadline" /><select name="paid"><option>unknown</option><option>paid</option><option>unpaid</option></select>
      <input name="notes" placeholder="Notes" /><button className="primary">Add</button>
    </form>
  </>);
}
