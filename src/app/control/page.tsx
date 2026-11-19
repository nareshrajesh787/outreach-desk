import { getSettings } from "@/lib/db";
import { saveControl, togglePause, signOut } from "@/lib/actions";
export const dynamic = "force-dynamic";
export default async function Control() {
  const s = await getSettings();
  return (<>
    <h1>Control</h1>
    <p className="sub">The master switch and daily limits. Every job checks the switch first.</p>
    <div className="todo" style={{ marginBottom: 16, borderLeftColor: s.paused ? "var(--warn)" : "var(--ok)" }}>
      <div><b style={{ fontSize: 18 }}>{s.paused ? "Sending is paused" : "Sending is live"}</b><p>{s.pause_reason || "Approved emails go out the next weekday morning."}</p></div>
      <form action={togglePause} style={{ marginLeft: "auto" }}><input type="hidden" name="pause" value={s.paused ? "0" : "1"} /><button className={s.paused ? "primary" : ""}>{s.paused ? "Resume sending" : "Pause sending"}</button></form>
    </div>
    <form action={saveControl} className="card" style={{ display: "grid", gap: 14, maxWidth: 420 }}>
      <label>Academia emails per day<input type="number" name="cap_academia" defaultValue={s.cap_academia} min={0} max={40} /></label>
      <label>Corporate emails per day<input type="number" name="cap_corporate" defaultValue={s.cap_corporate} min={0} max={40} /></label>
      <label>Hold window for auto-approved emails (hours)<input type="number" name="veto_hours" defaultValue={s.veto_hours} min={0} max={24} /></label>
      <button className="primary" style={{ justifyContent: "center" }}>Save limits</button>
    </form>
    <h2>Rules in force</h2>
    <ul className="mute" style={{ maxWidth: "64ch", paddingLeft: 20 }}><li>Weekdays only, one email per person, at most two follow-ups about a week apart.</li><li>The first 20 emails per lane need your approval before they send.</li><li>If the computer is off on a send morning, the next run sends the missed day's emails too, up to 3 days' worth.</li><li>Sending pauses itself on a sign-in problem, a bounce rate above 5%, or two failed sends.</li><li>Sargassum Forecast is the flagship project: drafts lead with it for ML, data, forecasting and ocean or climate contacts, and never claim it predicts accurately.</li><li>Never mentioned: the EDGAR project, the Spotify model, user counts, or workshops that were held.</li></ul>
    <form action={signOut} style={{ marginTop: 22 }}><button>Sign out</button></form>
  </>);
}
