"use client";
import { useEffect, useState } from "react";

// Counts up from 0 to n once when the page loads.
export default function Count({ n }: { n: number }) {
  const [v, setV] = useState(n);
  useEffect(() => {
    if (n === 0 || matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(n); return; }
    setV(0);
    const t0 = performance.now(), D = 900;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / D);
      setV(Math.round(n * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [n]);
  return <>{v}</>;
}
