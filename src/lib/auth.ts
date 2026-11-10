import { cookies } from "next/headers";
const enc = new TextEncoder();
async function key() {
  return crypto.subtle.importKey("raw", enc.encode(process.env.SESSION_SECRET || "dev-secret-change-me"), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
export async function makeToken() {
  const exp = String(Date.now() + 30 * 864e5);
  return exp + "." + hex(await crypto.subtle.sign("HMAC", await key(), enc.encode(exp)));
}
export async function validToken(t?: string) {
  if (!t) return false;
  const [exp, sig] = t.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return hex(await crypto.subtle.sign("HMAC", await key(), enc.encode(exp))) === sig;
}
export async function isAuthed() { return validToken((await cookies()).get("od")?.value); }
