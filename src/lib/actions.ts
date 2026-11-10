"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { sql, hasDb, saveSettings, logEvent } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
const guard = async () => { if (!(await isAuthed()) && (process.env.APP_PASSWORD || process.env.NODE_ENV === "production")) throw new Error("auth"); if (!hasDb()) throw new Error("no db"); };

export async function setEmailStatus(fd: FormData) {
  await guard();
  const id = Number(fd.get("id")), status = String(fd.get("status"));
  const when = status === "queued" ? new Date() : null;
  await sql()`UPDATE emails SET status=${status}, scheduled_send_at = COALESCE(${when}, scheduled_send_at) WHERE id=${id}`;
  await logEvent("email", `Email ${id} set to ${status}`);
  revalidatePath("/", "layout");
}
export async function editEmail(fd: FormData) {
  await guard();
  await sql()`UPDATE emails SET subject=${String(fd.get("subject"))}, body=${String(fd.get("body"))} WHERE id=${Number(fd.get("id"))}`;
  revalidatePath("/", "layout");
}
export async function markHandled(fd: FormData) {
  await guard();
  await sql()`UPDATE emails SET handled=true WHERE id=${Number(fd.get("id"))}`;
  revalidatePath("/", "layout");
}
export async function addLead(fd: FormData) {
  await guard();
  const g = (k: string) => String(fd.get(k) ?? "").trim();
  await sql()`INSERT INTO leads (track,name,role,org,email,url,field,paid,warm,status,fit,notes)
    VALUES (${g("track")},${g("name")},${g("role")},${g("org")},${g("email") || null},${g("url") || null},${g("field") || null},${g("paid") || "unknown"},${fd.get("warm") === "on"},'found',${fd.get("warm") === "on" ? 90 : 50},${g("notes") || null})
    ON CONFLICT (name, org) DO NOTHING`;
  revalidatePath("/", "layout");
}
export async function setLeadStatus(fd: FormData) {
  await guard();
  await sql()`UPDATE leads SET status=${String(fd.get("status"))} WHERE id=${Number(fd.get("id"))}`;
  revalidatePath("/", "layout");
}
export async function addProgram(fd: FormData) {
  await guard();
  const g = (k: string) => String(fd.get(k) ?? "").trim();
  await sql()`INSERT INTO programs (name,org,url,deadline,paid,notes) VALUES (${g("name")},${g("org")},${g("url") || null},${g("deadline") || null},${g("paid") || "unknown"},${g("notes") || null})`;
  revalidatePath("/programs");
}
export async function saveControl(fd: FormData) {
  await guard();
  await saveSettings({
    cap_academia: Number(fd.get("cap_academia")), cap_corporate: Number(fd.get("cap_corporate")), veto_hours: Number(fd.get("veto_hours")),
  });
  revalidatePath("/", "layout");
}
export async function togglePause(fd: FormData) {
  await guard();
  const pause = fd.get("pause") === "1";
  await saveSettings({ paused: pause, pause_reason: pause ? "Paused manually." : "" });
  await logEvent("control", pause ? "Sending paused" : "Sending resumed");
  revalidatePath("/", "layout");
}
export async function signOut() { (await cookies()).delete("od"); redirect("/login"); }
