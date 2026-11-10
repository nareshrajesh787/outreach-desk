import { getSettings } from "@/lib/db";
import { saveControl, togglePause, signOut } from "@/lib/actions";
export const dynamic = "force-dynamic";
export default async function Control() {
  const s = await getSettings();
  return (<>
    <h1>Control</h1><p className="sub">The master switch and daily limits. Every job checks the switch first.</p>
    <div className="card" style={{ marginBottom: 16 }}>
      <b>{s.paused ? "Sending is paused" : "Sending is live"}</b><p className="mute">{s.pause_reason}</p>
      <form action={togglePause}><input type="hidden" name="pause" value={s.paused ? "0" : "1"} /><button className="primary">{s.paused ? "Resume sending" : "Pause sending"}</button></form>
    </div>
    <form action={saveControl} className="card" style={{ display: "grid", gap: 10, maxWidth: 380 }}>
      <label>Academia per day<input type="number" name="cap_academia" defaultValue={s.cap_academia} min={0} max={40} /></label>
      <label>Corporate per day<input type="number" name="cap_corporate" defaultValue={s.cap_corporate} min={0} max={40} /></label>
      <label>Veto window (hours before send)<input type="number" name="veto_hours" defaultValue={s.veto_hours} min={0} max={24} /></label>
      <button>Save limits</button>
    </form>
    <h2>Rules in force</h2>
    <ul className="mute"><li>Weekdays only, one email per person, at most two follow-ups.</li><li>First 20 emails per lane need your approval before they send.</li><li>Auto-pause on sign-in problems, bounce rate above 5%, or two failed sends.</li><li>Never mentioned: EDGAR project, Spotify model, user counts, held workshops.</li></ul>
    <form action={signOut}><button>Sign out</button></form>
  </>);
}
