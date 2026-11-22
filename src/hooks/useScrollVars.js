import { useEffect } from "react";

// Writes scroll progress into CSS variables so CSS can animate with it
// without re-rendering React on every frame.
//   --page : 0 → 1 across the whole page (local to the progress bar)
//   --p    : 0 → 1 while the sticky hero stage is pinned
//
// --p is a registered, non-inherited property and is written only to the
// handful of elements marked with [data-p]. Writing it on the hero instead
// would invalidate the style of the whole city (~200 elements) on every
// scroll frame, which is what makes old phones stutter.
export default function useScrollVars() {
  useEffect(() => {
    const root = document.documentElement;
    const stage = document.querySelector("[data-hero-stage]");
    const hero = stage?.querySelector(".hero") || stage;
    const progress = document.querySelector(".progress");
    const pTargets = hero ? Array.from(hero.querySelectorAll("[data-p]")) : [];

    let maxScroll = 1;
    let heroSpan = 1;
    let lastPage = -1;
    let lastP = -1;
    let finished = false;
    let queued = false;

    const measure = () => {
      maxScroll = Math.max(root.scrollHeight - window.innerHeight, 1);
      heroSpan = stage
        ? Math.max(stage.offsetHeight - window.innerHeight, 1)
        : Math.max(window.innerHeight, 1);
    };

    const writeP = (value) => {
      const p = value.toFixed(4);
      for (let i = 0; i < pTargets.length; i += 1) {
        pTargets[i].style.setProperty("--p", p);
      }
    };

    const update = () => {
      const y = window.scrollY;

      if (progress) {
        const page = maxScroll > 0 ? y / maxScroll : 0;
        if (Math.abs(page - lastPage) > 0.0005) {
          progress.style.setProperty("--page", page.toFixed(4));
          lastPage = page;
        }
      }

      if (hero) {
        const p = Math.min(y / heroSpan, 1);

        // Once the hero has fully collapsed, keep the last frame on screen and
        // skip style writes for the rest of the page.
        if (Math.abs(p - lastP) > 0.0005) {
          writeP(p);
          lastP = p;
        }

        const isFinished = p >= 0.999;
        if (isFinished !== finished) {
          // At this point the hero is solid black, so we can drop the whole
          // city from the render tree (and stop all of its animations).
          hero.toggleAttribute("data-finished", isFinished);
          finished = isFinished;
        }
      }

      queued = false;
    };

    const onScroll = () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(update);
      }
    };

    const onResize = () => {
      measure();
      onScroll();
    };

    measure();
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    // Catch page-height changes (images loading, admin edits) without reading
    // layout on every scroll frame.
    let observer;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(onResize);
      observer.observe(document.body);
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      observer?.disconnect();
    };
  }, []);
}
