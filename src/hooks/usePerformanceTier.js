/**
 * usePerformanceTier
 *
 * Runs a tiny benchmark on the first animation frame after mount to decide
 * whether this device is "lite" (old/slow) or "full" (modern/fast).
 *
 * Detection uses three signals, in order of weight:
 *   1. navigator.deviceMemory  – RAM hint (Chrome/Edge; < 2 GB → lite)
 *   2. navigator.hardwareConcurrency – CPU core count (< 4 → lite)
 *   3. A lightweight JS micro-benchmark – if 10 k iterations of a small
 *      floating-point loop takes > 4 ms on the first idle frame, the
 *      thread is already under pressure and we go lite.
 *
 * Result: adds  data-lite  to <html> when the device is slow.
 * The attribute is set synchronously from a rAF callback so it lands before
 * the first paint in most cases. No React state is involved, so the whole
 * animation system never re-renders — the CSS simply picks up the selector.
 *
 * Full-tier devices: nothing changes, zero overhead after the one-time check.
 */

import { useEffect } from "react";

/** How many micro-benchmark iterations to run. */
const BENCH_ITERS = 10_000;
/** If the loop takes longer than this (ms), mark as lite. */
const BENCH_THRESHOLD_MS = 4;
/** deviceMemory threshold in GB. */
const MEMORY_THRESHOLD_GB = 2;
/** hardwareConcurrency threshold. */
const CORE_THRESHOLD = 4;

function runBenchmark() {
  const start = performance.now();
  let acc = 0;
  for (let i = 0; i < BENCH_ITERS; i++) {
    acc += Math.sqrt(i) * Math.sin(i);
  }
  const elapsed = performance.now() - start;
  // Use acc so the compiler can't optimise the loop away.
  return { elapsed, acc };
}

export default function usePerformanceTier() {
  useEffect(() => {
    // Already decided (e.g. HMR hot reload) — don't re-run.
    if (document.documentElement.hasAttribute("data-lite") ||
        document.documentElement.hasAttribute("data-tier-checked")) {
      return;
    }
    document.documentElement.setAttribute("data-tier-checked", "");

    // Use rAF so we don't block the first paint and the benchmark
    // runs when the browser's event loop is in a known state.
    requestAnimationFrame(() => {
      let lite = false;

      // Signal 1: RAM (only available in Chrome/Edge; undefined elsewhere → skip)
      const mem = navigator.deviceMemory; // undefined | number
      if (typeof mem === "number" && mem < MEMORY_THRESHOLD_GB) {
        lite = true;
      }

      // Signal 2: CPU core count
      const cores = navigator.hardwareConcurrency;
      if (typeof cores === "number" && cores < CORE_THRESHOLD) {
        lite = true;
      }

      // Signal 3: micro-benchmark (always runs; most reliable cross-browser)
      if (!lite) {
        const { elapsed } = runBenchmark();
        if (elapsed > BENCH_THRESHOLD_MS) {
          lite = true;
        }
      }

      if (lite) {
        document.documentElement.setAttribute("data-lite", "");
      }
    });
  }, []);
}
