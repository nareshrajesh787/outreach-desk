export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <div className="login">
      <div className="card">
        <div className="brand" style={{ padding: "0 0 18px" }}><div className="mark" /><span>Outreach Desk</span></div>
        <form method="post" action="/api/login" style={{ display: "grid", gap: 12 }}>
          <label className="mute" htmlFor="pw">Password</label>
          <input id="pw" type="password" name="password" autoFocus required />
          {e && <span className="pill bad">That password didn't match</span>}
          <button className="primary" style={{ justifyContent: "center" }}>Sign in</button>
        </form>
      </div>
    </div>
  );
}
