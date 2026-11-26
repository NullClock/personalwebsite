// Collapses the many variants of a song ("- Slowed", "(feat. X)", "- 2022 Remaster",
// "Artist • Recommended for you", ...) into one canonical key so plays can be counted together.
// Pure module (no imports): usable from the client and from server.js.

const TITLE = "android.media.metadata.TITLE";
const ARTIST = "android.media.metadata.ARTIST";
const ADVERT = "android.media.metadata.ADVERTISEMENT";
const SUBTITLE = "android.media.metadata.DISPLAY_SUBTITLE";

// Artist names that contain a comma, so splitting on "," doesn't cut them in half.
const COMMA_ARTISTS = ["Tyler, The Creator"];

// Manual overrides for cases no rule can solve. Format: "artist|title" -> "artist|title",
// both sides already folded (see fold()). Add to this as the review pass turns things up.
const ALIASES = {
  "lexiee|dreiton": "c418|dreiton", // "Dreiton - Best Part Looped Slower Reverb" is a loop of C418's Dreiton
  // "luvsdepth|calm night": "kino|спокоиная ночь",
};

// A trailing segment is "noise" (safe to drop) if it contains one of these words...
const STRONG = /\b(slowed|slower|sped up|speed(?:ed)? up|reverb|loop(?:ed)?|nightcore|remaster(?:ed)?)\b/i;
// ...or is, in its entirety, one of these.
const SIMPLE = /^(?:bonus(?: track)?|(?:radio |single |album |extended )?edit|(?:single|album) version|deluxe(?: edition| version)?|explicit|clean|mono|stereo)$/i;
// Judgment calls: only dropped when mergeOptional is true.
const OPTIONAL = /\b(?:live|ao vivo|demo|remix|acoustic|instrumental|strings? version|session)\b/i;

// Lowercase, strip accents, unify quotes, drop punctuation. Used for keys only, never for display.
function fold(s) {
  return String(s ?? "")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/ı/g, "i") // dotless i (e.g. "Lexıee") doesn't fold on its own
    .replace(/[’‘`´]/g, "'")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// "Dominic Fike • Recommended for you" -> "Dominic Fike"; "Daniel Caesar, Syd" -> "Daniel Caesar".
function primaryArtist(rawArtist) {
  let a = String(rawArtist ?? "").split("•")[0].trim();
  for (const name of COMMA_ARTISTS) {
    if (a.toLowerCase().startsWith(name.toLowerCase())) return name;
  }
  return a.split(",")[0].trim();
}

function isNoise(segment, { multiArtist, mergeOptional }) {
  const s = segment.trim();
  if (!s) return false;
  if (/^(?:feat\.?|ft\.?|featuring)\s/i.test(s)) return true;
  if (multiArtist && /^with\s/i.test(s)) return true; // "(with Mustafa)", but not "(With You)" on a solo song
  if (STRONG.test(s) || SIMPLE.test(s)) return true;
  return mergeOptional && OPTIONAL.test(s);
}

// Repeatedly peels noise off the END of the title: a trailing "(...)" or a trailing " - ...".
// Never touches the middle, and never returns an empty string (so "(dream)" stays "(dream)").
function cleanTitle(raw, opts) {
  let t = String(raw ?? "").trim();
  for (;;) {
    const before = t;
    const paren = t.match(/^(.*\S)\s*[(\[]([^()\[\]]*)[)\]]\s*$/);
    if (paren && isNoise(paren[2], opts)) {
      t = paren[1].trim();
    } else {
      const dash = t.match(/^(.*\S)\s+[-–—]\s+(.+)$/);
      if (dash && isNoise(dash[2], opts)) t = dash[1].trim();
    }
    if (t === before) return t;
  }
}

// Entries that aren't songs: Spotify ads, generic "YouTube" titles, live streams, web videos,
// and half-loaded snapshots with no artist yet.
export function isSong(entry) {
  if (!entry || typeof entry !== "object") return false;
  const title = String(entry[TITLE] ?? "").trim();
  const artist = String(entry[ARTIST] ?? "").trim();
  if (!title || !artist) return false;
  if (entry[ADVERT] === 1) return false;
  if (/^(?:advertisement|youtube)$/i.test(title)) return false;
  if (/\blive\b/i.test(String(entry[SUBTITLE] ?? ""))) return false;
  if (/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(artist)) return false; // artist is a domain, e.g. "wsj.com"
  return true;
}

// -> { key, title, artist, aliased }. Count plays by `key`; show `title`/`artist` from the group's entries.
export function songKey(entry, { mergeOptional = false } = {}) {
  const rawArtist = String(entry?.[ARTIST] ?? "");
  const opts = { multiArtist: rawArtist.includes(","), mergeOptional };
  const title = cleanTitle(entry?.[TITLE], opts);
  const artist = primaryArtist(rawArtist);
  const natural = `${fold(artist)}|${fold(title)}`;
  const key = ALIASES[natural] ?? natural;
  // `aliased` marks entries that were folded into another song by ALIASES, so callers can prefer
  // the original song's own title/artist/art when choosing what to display for the group.
  return { key, title, artist, aliased: key !== natural };
}
