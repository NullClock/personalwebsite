import { useEffect } from "react";

// Writes scroll progress into CSS variables so CSS can animate with it
// without re-rendering React on every frame.
//   --page : 0 → 1 across the whole page
//   --hero : 0 → 1 across the first screen
export default function useScrollVars() {
  useEffect(() => {
    const root = document.documentElement;
    let queued = false;

    const update = () => {
      const max = root.scrollHeight - window.innerHeight;
      root.style.setProperty("--page", max > 0 ? window.scrollY / max : 0);
      root.style.setProperty("--hero", Math.min(window.scrollY / window.innerHeight, 1));
      queued = false;
    };

    const onScroll = () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
}
