"use client";
import { useEffect, useRef } from "react";

// Slow drifting dots joined by faint lines; dots near the cursor drift away from it.
export default function Particles() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mouse = { x: -999, y: -999 };
    type P = { x: number; y: number; vx: number; vy: number; r: number };
    let ps: P[] = [];
    let w = 0, h = 0, raf = 0;
    const readColor = () => getComputedStyle(document.documentElement).getPropertyValue("--acc").trim() || "#4cc9f0";
    let col = readColor();
    const LINK = 130 * 130;

    const resize = () => {
      w = window.innerWidth; h = window.innerHeight;
      c.width = w * dpr; c.height = h * dpr; c.style.width = w + "px"; c.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(90, (w * h) / 15000));
      ps = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28, r: Math.random() * 1.4 + 0.6 }));
      draw();
    };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 1;
      for (const p of ps) {
        if (!reduce) {
          p.x += p.vx; p.y += p.vy;
          const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < 14400) { const d = Math.sqrt(d2) || 1, f = (1 - d / 120) * 0.9; p.x += (dx / d) * f; p.y += (dy / d) * f; }
          if (p.x < 0) p.x = w; else if (p.x > w) p.x = 0;
          if (p.y < 0) p.y = h; else if (p.y > h) p.y = 0;
        }
        ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const a = ps[i], b = ps[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 < LINK) { ctx.globalAlpha = (1 - d2 / LINK) * 0.2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        }
      }
      if (!reduce && !document.hidden) raf = requestAnimationFrame(draw);
    };
    const move = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const leave = () => { mouse.x = -999; mouse.y = -999; };
    const vis = () => { cancelAnimationFrame(raf); if (!document.hidden) draw(); };
    const scheme = matchMedia("(prefers-color-scheme: light)");
    const recolor = () => { col = readColor(); };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", move);
    document.addEventListener("mouseleave", leave);
    document.addEventListener("visibilitychange", vis);
    scheme.addEventListener("change", recolor);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", move);
      document.removeEventListener("mouseleave", leave);
      document.removeEventListener("visibilitychange", vis);
      scheme.removeEventListener("change", recolor);
    };
  }, []);
  return <canvas ref={ref} className="fx" aria-hidden="true" />;
}
