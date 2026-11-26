// "Most played" aggregation over the now-playing history. Pure (only imports ./songKey.js), so the
// server uses it directly and it can be tested in plain Node.
import { isSong, songKey } from "./songKey.js";

const ART_KEYS = ["android.media.metadata.ALBUM_ART_URI", "android.media.metadata.ART_URI"];
const isWebUrl = (v) => typeof v === "string" && /^https?:\/\//i.test(v);
// Tasker also posts content:// URIs a browser can't load, so only http(s) art is kept.
const pickArt = (entry) => ART_KEYS.map((k) => entry[k]).find(isWebUrl) || "";

const newView = () => ({ titles: new Map(), artists: new Map(), art: "", artAt: 0 });
const mostCommon = (counts) => [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

// history: entries in play order (oldest first). Entries without a numeric `playedAt` are skipped,
// because we can't tell when they were played (everything logged before timestamps existed).
// Returns [{ key, title, artist, art, plays, lastPlayedAt }], most played first;
// ties go to whichever was played most recently.
export function topSongs(history, { sinceMs = 0, limit = 10, now = Date.now(), mergeOptional = false } = {}) {
  const groups = new Map();

  for (const entry of history) {
    const at = entry?.playedAt;
    if (!Number.isFinite(at) || at < sinceMs || at > now) continue;
    if (!isSong(entry)) continue;

    const { key, title, artist, aliased } = songKey(entry, { mergeOptional });
    let g = groups.get(key);
    if (!g) {
      g = { key, plays: 0, lastPlayedAt: 0, own: newView(), all: newView() };
      groups.set(key, g);
    }
    g.plays += 1;
    g.lastPlayedAt = Math.max(g.lastPlayedAt, at);

    // Display data is tallied twice: from every entry, and from only the song's "own" entries
    // (not ones folded in by an alias). Own entries win when there are any, so e.g. a looped
    // re-upload merged into the original is shown under the original's name, artist and cover.
    const art = pickArt(entry);
    for (const view of aliased ? [g.all] : [g.own, g.all]) {
      view.titles.set(title, (view.titles.get(title) || 0) + 1);
      view.artists.set(artist, (view.artists.get(artist) || 0) + 1);
      if (art && at >= view.artAt) {
        view.art = art;
        view.artAt = at;
      }
    }
  }

  return [...groups.values()]
    .sort((a, b) => b.plays - a.plays || b.lastPlayedAt - a.lastPlayedAt)
    .slice(0, limit)
    .map((g) => {
      const view = g.own.titles.size ? g.own : g.all;
      return {
        key: g.key,
        title: mostCommon(view.titles),
        artist: mostCommon(view.artists),
        art: view.art,
        plays: g.plays,
        lastPlayedAt: g.lastPlayedAt,
      };
    });
}
