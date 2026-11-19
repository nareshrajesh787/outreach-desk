"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICON: Record<string, React.ReactNode> = {
  "/": <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  "/leads": <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.3c2 .7 3.5 2.6 3.5 5.7" /></>,
  "/outreach": <path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" />,
  "/replies": <><path d="M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M3 13h5l1 3h6l1-3h5" /></>,
  "/programs": <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  "/control": <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
};
const ITEMS: [string, string][] = [["/", "Today"], ["/leads", "Leads"], ["/outreach", "Outreach"], ["/replies", "Replies"], ["/programs", "Programs"], ["/control", "Control"]];

export default function Nav({ badges }: { badges: Record<string, number> }) {
  const path = usePathname();
  return (
    <>
      {ITEMS.map(([href, label]) => {
        const on = href === "/" ? path === "/" : path.startsWith(href);
        const n = badges[href];
        return (
          <Link key={href} href={href} className={"navlink" + (on ? " on" : "")} aria-current={on ? "page" : undefined}>
            <svg viewBox="0 0 24 24" aria-hidden="true">{ICON[href]}</svg>
            <span>{label}</span>
            {n ? <em className="n" style={{ fontStyle: "normal" }}>{n}</em> : null}
          </Link>
        );
      })}
    </>
  );
}
