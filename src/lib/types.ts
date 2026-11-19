export type Track = "academia" | "corporate";
export type Lead = {
  id: number; track: Track; name: string; role: string; org: string; email: string | null;
  url: string | null; field: string | null; paid: "paid" | "unpaid" | "unknown"; location: string | null;
  remote: boolean; status: "found" | "researched" | "drafted" | "contacted" | "replied" | "closed" | "rejected" | "suppressed";
  fit: number; warm: boolean; notes: string | null; dossier: string | null; sources: string[]; created_at: string;
};
export type Email = {
  id: number; lead_id: number; kind: "initial" | "fu1" | "fu2" | "reply"; subject: string; body: string;
  status: "draft" | "review" | "queued" | "held" | "sent" | "replied" | "bounced" | "skipped";
  critic_notes: string | null; scheduled_send_at: string | null; sent_at: string | null;
  reply_class: string | null; reply_summary: string | null; handled: boolean;
  created_at?: string; parent_id?: number | null; to_addr?: string | null;
  lead_name?: string; lead_org?: string; track?: Track;
};
export type Program = { id: number; name: string; org: string; url: string | null; deadline: string | null; paid: string; status: string; notes: string | null };
export type Settings = { paused: boolean; pause_reason: string; cap_academia: number; cap_corporate: number; veto_hours: number; last_run?: string };
export type Reply = { id: number; email_id: number; lead_id: number; from_addr: string | null; subject: string | null; body: string | null; received_at: string; reply_class: string | null; summary: string | null };
