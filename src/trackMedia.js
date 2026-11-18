/**
 * trackMedia.js
 *
 * Finds album art + a 30s preview for the "Currently Playing" card. Runs entirely in the
 * visitor's browser (so lookups come from each visitor's IP, not from your server's).
 *
 *   1. iTunes Search  -> album art + preview URL   (JSONP fallback if fetch() is blocked)
 *   2. lrc.red        -> album art only, used when iTunes has no art
 *
 * Every lookup is cached (memory + localStorage), de-duplicated while in flight, and put on a
 * cooldown after a failure, so a track costs at most a couple of requests no matter how often
 * the UI polls.
 *
 * Debug logging: open the site with ?debug in the URL (this also loads the eruda console,
 * handy on iOS without a Mac). Warnings/errors are always logged.
 */

/* ------------------------------------------------------------------ *
 *  Config
 * ------------------------------------------------------------------ */

const ITUNES_URL = 'https://itunes.apple.com/search';
const LRC_URL = 'https://lrc.red/search.json';
const LRC_CLIENT_ID =
  import.meta.env?.VITE_LRC_CLIENT_ID || '4helio.xyz | helioleles@comcast.net | +1 (215) 410-5236';

const REQUEST_TIMEOUT_MS = 8000;
const STORAGE_KEY = 'np-media-v1';
const MAX_PERSISTED = 100;

const TTL = {
  FULL: 24 * 60 * 60 * 1000, // art + preview found
  NONE: 10 * 60 * 1000,      // sources answered but had nothing (or art only)
  PARTIAL: 60 * 1000,        // found something, but a source failed: try again soon
  ERROR: 30 * 1000,          // nothing found and a source failed
  RATE_LIMITED: 60 * 1000,   // HTTP 403/429
};

/* ------------------------------------------------------------------ *
 *  Debug logging
 * ------------------------------------------------------------------ */

export const DEBUG =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');

export function npLog(level, scope, message, data) {
  if (!DEBUG && level !== 'warn' && level !== 'error') return;
  const fn = level === 'warn' ? console.warn : level === 'error' ? console.error : console.log;
  const line = `[np ${new Date().toISOString().slice(11, 23)}] [${scope}] ${message}`;
  if (data === undefined) fn(line);
  else fn(line, data);
}

function describeError(err) {
  if (err instanceof HttpError) return `HTTP ${err.status} from ${err.source}`;
  return `${err?.name || 'Error'}: ${err?.message || err}`;
}

/* ------------------------------------------------------------------ *
 *  Small helpers
 * ------------------------------------------------------------------ */

class HttpError extends Error {
  constructor(status, source) {
    super(`HTTP ${status} from ${source}`);
    this.name = 'HttpError';
    this.status = status;
    this.source = source;
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// iTunes supports `callback=`, which loads the response as a <script> and sidesteps CORS /
// fetch restrictions. Used only when a normal fetch() fails at the network level.
function jsonp(url, timeoutMs = REQUEST_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const cbName = `__npItunes_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const script = document.createElement('script');
    const cleanup = () => {
      clearTimeout(timer);
      delete window[cbName];
      script.remove();
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('JSONP timeout'));
    }, timeoutMs);
    window[cbName] = (data) => {
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error('JSONP script failed to load'));
    };
    script.src = `${url}&callback=${cbName}`;
    document.head.appendChild(script);
  });
}

function normalizeText(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function makeTrackKey(title, artist) {
  return `${title ?? ''} ${artist ?? ''}`.replace(/\s+/g, ' ').trim().toLowerCase();
}

const artwork600 = (url) => (url ? url.replace(/\d+x\d+bb/, '600x600bb') : null);

/* ------------------------------------------------------------------ *
 *  iTunes
 * ------------------------------------------------------------------ */

async function itunesSearch(term, limit = 5) {
  const url =
    `${ITUNES_URL}?term=${encodeURIComponent(term)}` +
    `&media=music&entity=song&limit=${limit}&country=US`;
  const t0 = Date.now();
  npLog('info', 'itunes', `GET ${url}`);

  let data;
  try {
    const res = await fetchWithTimeout(url);
    npLog('debug', 'itunes', `HTTP ${res.status} after ${Date.now() - t0}ms`);
    if (!res.ok) throw new HttpError(res.status, 'iTunes');
    data = await res.json();
  } catch (err) {
    if (err instanceof HttpError) throw err; // don't hammer Apple with a JSONP retry on 403/429
    npLog('warn', 'itunes', `fetch failed (${describeError(err)}), retrying via JSONP`);
    data = await jsonp(url);
    npLog('info', 'itunes', `JSONP fallback succeeded after ${Date.now() - t0}ms`);
  }

  const results = Array.isArray(data?.results) ? data.results : [];
  npLog('info', 'itunes', `${results.length} result(s) for "${term}"`);
  results.forEach((r, i) => {
    npLog('debug', 'itunes',
      `candidate[${i}] "${r.trackName}" by "${r.artistName}" preview=${r.previewUrl ? 'yes' : 'no'} art=${r.artworkUrl100 ? 'yes' : 'no'}`);
  });
  return results;
}

// Scores results: title match (exact > loose) + artist match + has a preview.
// With no title match at all it still falls back to the first result with a preview.
function pickBestResult(results, title, artist) {
  const nTitle = normalizeText(title);
  const nArtist = normalizeText(artist);
  let best = null;

  results.forEach((r, index) => {
    const rTitle = normalizeText(r.trackName);
    const rArtist = normalizeText(r.artistName);
    const titleExact = nTitle !== '' && rTitle === nTitle;
    const titleLoose = !titleExact && nTitle !== '' && rTitle !== '' &&
      (rTitle.includes(nTitle) || nTitle.includes(rTitle));
    const artistMatch = nArtist !== '' && rArtist !== '' &&
      (rArtist.includes(nArtist) || nArtist.includes(rArtist));
    const hasPreview = Boolean(r.previewUrl);

    const score = (titleExact ? 4 : titleLoose ? 2 : 0) + (artistMatch ? 2 : 0) + (hasPreview ? 1 : 0);
    if (!best || score > best.score) {
      best = {
        hit: r,
        index,
        score,
        titleMatched: titleExact || titleLoose,
        reason: `score=${score} title=${titleExact ? 'exact' : titleLoose ? 'loose' : 'none'} artist=${artistMatch ? 'match' : 'no'} preview=${hasPreview ? 'yes' : 'no'}`,
      };
    }
  });
  return best;
}

/* ------------------------------------------------------------------ *
 *  lrc.red (album art fallback)
 * ------------------------------------------------------------------ */

async function lrcCover(title, artist) {
  const url = `${LRC_URL}?q=${encodeURIComponent(`${title} ${artist}`.trim())}`;
  const t0 = Date.now();
  npLog('info', 'lrc.red', `GET ${url}`);

  const res = await fetchWithTimeout(url, { headers: { 'X-Client-ID': LRC_CLIENT_ID } });
  npLog('debug', 'lrc.red', `HTTP ${res.status} after ${Date.now() - t0}ms`);
  if (!res.ok) throw new HttpError(res.status, 'lrc.red');

  const data = await res.json();
  const hits = Array.isArray(data?.hits) ? data.hits : [];
  const cover = hits[0]?.cover || null;
  npLog('info', 'lrc.red', `${hits.length} hit(s), cover ${cover ? 'found' : 'missing'}`);
  return cover;
}

/* ------------------------------------------------------------------ *
 *  Cache (memory + localStorage)
 * ------------------------------------------------------------------ */

// key -> { status: 'ok'|'none', albumArt, previewUrl, sources, matched, exp, persist }
const memory = new Map();
const inflight = new Map();      // key -> Promise
const cooldownUntil = new Map(); // key -> timestamp (after a failed lookup)
let persistedLoaded = false;

function loadPersisted() {
  if (persistedLoaded) return;
  persistedLoaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const now = Date.now();
    let n = 0;
    for (const [key, entry] of Object.entries(JSON.parse(raw))) {
      if (entry && entry.exp > now) {
        memory.set(key, entry);
        n++;
      }
    }
    npLog('debug', 'cache', `loaded ${n} persisted entr${n === 1 ? 'y' : 'ies'}`);
  } catch (err) {
    npLog('warn', 'cache', `could not read localStorage (${describeError(err)})`);
  }
}

function persist() {
  try {
    const now = Date.now();
    const entries = [...memory].filter(([, e]) => e.persist && e.exp > now).slice(-MAX_PERSISTED);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch (err) {
    // Safari private mode / storage full / storage disabled: the memory cache still works.
    npLog('debug', 'cache', `could not write localStorage (${describeError(err)})`);
  }
}

/** Returns the fresh cached entry for a track key, or null. */
export function peekTrackMedia(key) {
  loadPersisted();
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.exp <= Date.now()) {
    npLog('debug', 'cache', `expired "${key}"`);
    memory.delete(key);
    return null;
  }
  return entry;
}

/** True if a lookup for this key may start now (not running, not cooling down after a failure). */
export function canLookup(key) {
  return !inflight.has(key) && Date.now() >= (cooldownUntil.get(key) || 0);
}

/* ------------------------------------------------------------------ *
 *  Public API
 * ------------------------------------------------------------------ */

/**
 * Resolves to a cache entry ({ albumArt, previewUrl, ... }) or null if every source failed
 * (the track then sits on a short cooldown). Safe to call repeatedly: cached and in-flight
 * lookups are reused.
 */
export function resolveTrackMedia(title, artist) {
  const key = makeTrackKey(title, artist);
  const cached = peekTrackMedia(key);
  if (cached) return Promise.resolve(cached);
  if (inflight.has(key)) return inflight.get(key);
  if (!canLookup(key)) {
    npLog('debug', 'lookup', `"${key}" is cooling down after a failure, skipping`);
    return Promise.resolve(null);
  }

  const promise = runLookup(key, title, artist).finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

async function runLookup(key, title, artist) {
  const t0 = Date.now();
  const term = `${title} ${artist}`.replace(/\s+/g, ' ').trim();
  npLog('info', 'lookup', `start "${term}"`);

  let albumArt = null;
  let previewUrl = null;
  let matched = null;
  const sources = [];
  let failed = false;
  let rateLimited = false;

  try {
    const results = await itunesSearch(term, 5);
    const pick = pickBestResult(results, title, artist);
    if (pick) {
      albumArt = artwork600(pick.hit.artworkUrl100);
      previewUrl = pick.hit.previewUrl || null;
      matched = `${pick.hit.trackName} - ${pick.hit.artistName}`;
      sources.push('itunes');
      npLog(pick.titleMatched ? 'info' : 'warn', 'lookup',
        `${pick.titleMatched ? 'matched' : 'LOW-CONFIDENCE match'} "${matched}" (${pick.reason})`);
    } else {
      npLog('info', 'lookup', 'iTunes returned no results');
    }
  } catch (err) {
    failed = true;
    rateLimited = err instanceof HttpError && (err.status === 403 || err.status === 429);
    npLog('warn', 'lookup', `iTunes failed: ${describeError(err)}`);
  }

  if (!albumArt) {
    try {
      const cover = await lrcCover(title, artist);
      if (cover) {
        albumArt = cover;
        sources.push('lrc.red');
      }
    } catch (err) {
      failed = true;
      rateLimited = rateLimited || (err instanceof HttpError && (err.status === 403 || err.status === 429));
      npLog('warn', 'lookup', `lrc.red failed: ${describeError(err)}`);
    }
  }

  const found = Boolean(albumArt || previewUrl);
  if (!found && failed) {
    const wait = rateLimited ? TTL.RATE_LIMITED : TTL.ERROR;
    cooldownUntil.set(key, Date.now() + wait);
    npLog('warn', 'lookup', `nothing found and a source failed; cooling down ${wait / 1000}s`);
    return null;
  }

  const ttl = failed ? TTL.PARTIAL : previewUrl ? TTL.FULL : TTL.NONE;
  const entry = {
    status: found ? 'ok' : 'none',
    albumArt,
    previewUrl,
    sources,
    matched,
    exp: Date.now() + ttl,
    persist: ttl === TTL.FULL,
  };
  memory.set(key, entry);
  if (entry.persist) persist();

  npLog('info', 'lookup',
    `done in ${Date.now() - t0}ms: status=${entry.status} art=${albumArt ? 'yes' : 'no'} preview=${previewUrl ? 'yes' : 'no'} sources=[${sources.join(', ')}] cached ${Math.round(ttl / 1000)}s`);
  return entry;
}

/** Admin song search (same iTunes code path, so it also gets the JSONP fallback). */
export async function searchSongs(term, limit = 8) {
  const results = await itunesSearch(term, limit);
  return results.map((item) => ({
    id: `itunes-${item.trackId}`,
    title: item.trackName,
    artist: item.artistName,
    albumArt: artwork600(item.artworkUrl100) || '',
    previewUrl: item.previewUrl,
    note: 'Added via Admin',
  }));
}