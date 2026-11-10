export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <div style={{ maxWidth: 340, margin: "80px auto" }}>
      <h1>Outreach Desk</h1><p className="sub">Private dashboard</p>
      <form method="post" action="/api/login" className="row" style={{ flexDirection: "column", alignItems: "stretch" }}>
        <input type="password" name="password" placeholder="Password" autoFocus required />
        {e && <span className="pill bad">Wrong password</span>}
        <button className="primary">Sign in</button>
      </form>
    </div>
  );
}
