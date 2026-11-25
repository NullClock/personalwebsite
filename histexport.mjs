#!/usr/bin/env node
// Dumps the server's in-memory now-playing history to a JSON file WITHOUT restarting it.
// It only uses the public, read-only GET /api/nowplaying/history endpoint (no PIN needed).
//
// Usage:
//   node export-history.mjs                                  # uses http://localhost:$PORT/api (PORT or 5000)
//   node export-history.mjs https://cli.4helio.xyz/api       # or any API base URL
//   node export-history.mjs http://localhost:5000/api out.json
//
// Output: a JSON array, OLDEST first (the same order the server keeps), one object per play.

import fs from "node:fs";

const base = (process.argv[2] || `http://localhost:${process.env.PORT || 5000}/api`).replace(/\/+$/, "");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outFile = process.argv[3] || `history-backup-${stamp}.json`;
const PAGE = 100; // the server caps limit at 100

async function getPage(before) {
  const qs = new URLSearchParams({ limit: String(PAGE) });
  if (before !== undefined) qs.set("before", String(before));
  const res = await fetch(`${base}/nowplaying/history?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${base}/nowplaying/history`);
  return res.json();
}

try {
  const pages = [];
  let before; // undefined = start from the newest entry
  let firstTotal = null;

  for (;;) {
    const page = await getPage(before);
    if (firstTotal === null) firstTotal = page.total;
    pages.push(page.items); // each page is newest-first
    if (!page.hasMore) break;
    before = page.nextBefore;
  }

  // Pages were fetched newest -> oldest; flip to oldest -> newest and drop the paging-only field.
  const entries = pages
    .reverse()
    .flatMap((items) => items.slice().reverse())
    .map(({ historyId, ...entry }) => entry);

  if (entries.length < firstTotal) {
    throw new Error(
      `Only collected ${entries.length} of ${firstTotal} entries (history changed while exporting). Not writing a partial file; run it again.`
    );
  }

  // Write to a temp file and rename so a crash can't leave a half-written backup.
  const tmp = `${outFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(entries, null, 2));
  fs.renameSync(tmp, outFile);
  console.log(`Saved ${entries.length} entries to ${outFile}`);
} catch (err) {
  console.error(`Export failed: ${err.message}`);
  process.exit(1);
}