import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { topSongs } from './src/topSongs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the project root. Variables already set in the real environment win.
dotenv.config({ path: path.join(__dirname, '.env') });

/* ------------------------------------------------------------------ *
 *  Now-playing history file  (+ `--recover`)
 * ------------------------------------------------------------------ */

// The history lives in memory for speed, but is mirrored to this JSON file on every change and
// reloaded on startup, so a restart or crash no longer wipes it. Set HISTORY_FILE to put it
// elsewhere (e.g. a mounted Docker volume). Staging (ENVIRONMENT=dev) gets its own default file
// so it can never clobber production's history.
const isDevEnv = ['dev', 'development'].includes((process.env.ENVIRONMENT || '').toLowerCase());
const HISTORY_FILE = path.resolve(
  process.env.HISTORY_FILE || path.join(__dirname, isDevEnv ? 'history.dev.json' : 'history.json')
);

// Accepts the JSON array this server writes (or export-history.mjs produces), oldest first.
// Drops `historyId`, which is a paging-only field added by the HTTP endpoint.
function parseHistory(text) {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error('expected a JSON array of history entries');
  const bad = data.findIndex((e) => !e || typeof e !== 'object' || Array.isArray(e));
  if (bad !== -1) throw new Error(`entry #${bad} is not an object`);
  return data.map(({ historyId, ...entry }) => entry);
}

// Write to a temp file and rename, so a crash mid-write can't leave a truncated history file.
function writeHistoryFile(entries) {
  const tmp = `${HISTORY_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(entries, null, 2));
  fs.renameSync(tmp, HISTORY_FILE);
}

// `node server.js --recover <file.json>` (or --recover=<file.json>) loads a history backup into
// the history file and exits WITHOUT starting the server. It runs before the env-var check below
// on purpose: recovering needs no PORT, ADMIN_PIN, etc.
const recoverIdx = process.argv.findIndex((a) => a === '--recover' || a.startsWith('--recover='));
if (recoverIdx !== -1) {
  const arg = process.argv[recoverIdx];
  const src = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : process.argv[recoverIdx + 1];
  if (!src || src.startsWith('--')) {
    console.error('Usage: node server.js --recover <history-backup.json>');
    process.exit(1);
  }
  try {
    const srcPath = path.resolve(src);
    if (srcPath === HISTORY_FILE) throw new Error('that is already the live history file');
    const entries = parseHistory(fs.readFileSync(srcPath, 'utf8'));
    if (fs.existsSync(HISTORY_FILE) && fs.statSync(HISTORY_FILE).size > 0) {
      const bak = `${HISTORY_FILE}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      fs.copyFileSync(HISTORY_FILE, bak);
      console.log(`Existing history kept as ${bak}`);
    }
    writeHistoryFile(entries);
    console.log(`Recovered ${entries.length} entries into ${HISTORY_FILE}`);
    console.log('Server NOT started. Start it normally to load them. (If a server is already running,');
    console.log('stop it first: it holds its own copy in memory and would overwrite this file.)');
    process.exit(0);
  } catch (err) {
    console.error(`Recover failed: ${err.message}`);
    process.exit(1);
  }
}

const app = express();
const DB_FILE = path.join(__dirname, 'db.json');

// All environment-specific values come from the environment (see .env.example).
// Nothing sensitive is ever stored in source or in the repo history.
const PORT = process.env.PORT;
const ADMIN_PIN = process.env.ADMIN_PIN;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;
const UPSTREAM_NOWPLAYING_URL = process.env.UPSTREAM_NOWPLAYING_URL;
const ENVIRONMENT = process.env.ENVIRONMENT;

const requiredEnv = { PORT, ADMIN_PIN, ALLOWED_ORIGIN, UPSTREAM_NOWPLAYING_URL, ENVIRONMENT };
const missingEnv = Object.entries(requiredEnv).filter(([, value]) => !value).map(([key]) => key);
if (missingEnv.length) {
  console.error(`Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

// NOTE: album art / preview lookups (iTunes, lrc.red) happen in the browser, not here, so this
// server never makes those requests and can't get its (Oracle Cloud) IP rate limited by them.
// See src/trackMedia.js on the client.

function log(level, tag, msg, data) {
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${tag}] ${msg}`;
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (data === undefined) out(line);
  else out(line, typeof data === 'string' ? data : JSON.stringify(data));
}

/* ------------------------------------------------------------------ *
 *  Setup
 * ------------------------------------------------------------------ */

const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // Limit: 100MB
});

const corsOptions = {
  origin: [
    ALLOWED_ORIGIN,
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-admin-pin'],
  credentials: true
};

// cors() already answers OPTIONS preflights, so the extra `app.options('*', ...)` was
// redundant (and `'*'` throws at startup on Express 5).
app.use(cors(corsOptions));
app.use(express.json());

const DEFAULT_DB = {
  "hero": {
    "name": "Helio M. Leles",
    "status": "%bdaystr 🎂",
    "location": "Philadelphia, PA",
    "bio": "Hey, I'm Helio! I build basic software, small tools, and firmwares, (although I struggle to focus on projects long term) I mess around with microcontrollers, wire up custom electronics, and I'm curious about how everything works. I'm the type who sees a website or device and immediately wonder how and why everything works, and how the business model is structured. I am currently a student at Northeast High School (PhilaSD)\nMy full name is Helio Meira de Souza Leles or Helio Meira Leles / Helio M. Leles.",
    "avatarUrl": "https://pxdrop.online/raw/dbhoicq81qec73aqu00g",
    "avatarBadge": "HELIO.JPG",
    "bullets": [
      "Coding since childhood",
      "Heavy tinkerer",
      "Android AND iOS"
    ]
  },
  "banner": {
    "enabled": false,
    "text": "🔧 WORK IN PROGESS - The website is currently being redesigned. Visual glitches may be present.",
    "linkText": "OK",
    "linkUrl": "javascript:alert(\"I'm gald you understand―that button doesn't do anything yet though 😆\");"
  },
  "socials": [
    {
      "id": "soc-3",
      "name": "TikTok",
      "handle": "@unt3thered",
      "href": "https://tiktok.com/@unt3thered"
    },
    {
      "id": "soc-4",
      "name": "GitHub",
      "handle": "NullClock",
      "href": "https://github.com/NullClock"
    },
    {
      "id": "soc-5",
      "name": "WhatsApp",
      "handle": "+12154105236",
      "href": "https://wa.me/12154105236"
    },
    {
      "id": "soc-1",
      "name": "Instagram",
      "handle": "@hissinterlude",
      "href": "https://instagram.com/hissinterlude",
      "disabled": false
    },
    {
      "id": "soc-2",
      "name": "Threads",
      "handle": "@hissinterlude",
      "href": "https://threads.net/hissinterlude",
      "disabled": false
    }
  ],
  "songs": [
    {
      "id": "itunes-1799080913",
      "title": "Transform (feat. Charlotte Day Wilson)",
      "artist": "Daniel Caesar",
      "albumArt": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b6/cd/1a/b6cd1a5b-83af-a1e2-0ad7-ea530fcf2522/859722261219.jpg/600x600bb.jpg",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/12/82/4b/12824bb3-0045-356d-98cc-0d516ecd6121/mzaf_4685624648406533826.plus.aac.p.m4a",
      "note": "Added via Admin"
    },
    {
      "id": "itunes-663098051",
      "title": "No. 1 Party Anthem",
      "artist": "Arctic Monkeys",
      "albumArt": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/9c/b5/699cb5d6-115c-ff73-9d26-e57ea4350d72/887828031795.png/600x600bb.jpg",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/ea/32/b4/ea32b4ce-8211-8e63-024e-cf18c42e2eda/mzaf_15252909301723072031.plus.aac.p.m4a",
      "note": "Added via Admin"
    },
    {
      "id": "itunes-1623929243",
      "title": "It Almost Worked",
      "artist": "TV Girl",
      "albumArt": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/a8/f5/83/a8f58339-b12e-92fa-3806-4ab338a18b5f/195079449864_cover.jpg/600x600bb.jpg",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/14/da/b9/14dab93e-3237-7f9e-0596-7bad52aaf422/mzaf_2336865796597875041.plus.aac.p.m4a",
      "note": "Added via Admin"
    },
    {
      "id": "itunes-1658650510",
      "title": "Ghost in the Machine (feat. Phoebe Bridgers)",
      "artist": "SZA",
      "albumArt": "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/62/93/13/6293132e-20ff-67ab-3d1f-96bb6797a6ba/196589564955.jpg/600x600bb.jpg",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/09/04/f1/0904f1a1-d161-a125-2478-0d311e1e9481/mzaf_2980651849116308896.plus.aac.p.m4a",
      "note": "Added via Admin"
    },
    {
      "id": "itunes-1671667137",
      "title": "Ocho Rios",
      "artist": "Daniel Caesar",
      "albumArt": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/24/4f/ec/244fec58-ea20-e0b0-eea6-e06c6aff948b/23UMGIM14483.rgb.jpg/600x600bb.jpg",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/1a/2e/05/1a2e059f-ca6d-9ce3-929b-bdbc20aa389a/mzaf_10133831189667990104.plus.aac.p.m4a",
      "note": "Added via Admin"
    },
    {
      "id": "itunes-1681332245",
      "title": "Please Do Not Lean (feat. BADBADNOTGOOD) [Bonus]",
      "artist": "Daniel Caesar",
      "albumArt": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/1d/b6/d4/1db6d4e1-fda4-65b9-842d-e6a4c4debc6d/23UMGIM38673.rgb.jpg/600x600bb.jpg",
      "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/7d/1d/dd/7d1ddd87-f3d7-4c91-8ae3-51e18ab13a89/mzaf_15690910273171720138.plus.aac.p.m4a",
      "note": "Added via Admin"
    }
  ],
  "featuredSong": {
    "enabled": true,
    "id": "itunes-1615499233",
    "title": "Evergreen (You Didn’t Deserve Me At All)",
    "artist": "Omar Apollo",
    "albumArt": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/e9/4f/74/e94f74ed-156e-a145-e822-2745c9126726/093624870579.jpg/600x600bb.jpg",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/3c/08/e5/3c08e587-1161-81be-ba8a-fc32dec39a83/mzaf_3179736070239285042.plus.aac.p.m4a",
    "note": "Added via Admin"
  },
  "projects": [
    {
      "id": "proj-1793291906304",
      "title": "Memblu Music",
      "category": "Software",
      "status": "In Progress",
      "description": "Memblu Music is a free-forever, self-hosted ad-free music streaming platform with offline song downloads and local playlists.",
      "tags": [
        "Music",
        "Streaming",
        "Simple",
        "Web",
        "JavaScript"
      ],
      "link": "https://github.com/Memblu/MembluMusic"
    },
    {
      "id": "proj-1791773372089",
      "title": "IntervalMessages",
      "category": "Software",
      "status": "Complete",
      "description": "IntervalMessages is a Minecraft plugin that sends a random message from a catalog, which is defined in the configuration, in intervals of [x] amount of seconds and continuously sends random messages from the catalog every [x] amount seconds. IntervalMessages is compatible with any Bukkit, Paper, Spigot, Purpur, or Folia server with a version higher than 1.7.3.",
      "tags": [
        "Minecraft",
        "Java",
        "Plugin",
        "Fun"
      ],
      "link": "https://github.com/NullClock/IntervalMessages"
    },
    {
      "id": "proj-1789756227700",
      "title": "Attennda",
      "category": "Software",
      "status": "In Progress",
      "description": "Ultra-simplified minimalistic attendance software designed for special events or for logging optional visitors. Attennda is not designed for classrooms or educational institutions.",
      "tags": [
        "Web",
        "Svelte",
        "Utility"
      ],
      "link": "https://github.com/columnlabs/Attennda"
    }
  ],
  "logs": [
    {
      "id": "log-1791871528408",
      "date": "2026-10-13",
      "entry": "Spent the night working on an Eaglercraft packet translation layer."
    },
    {
      "id": "log-1789275970191",
      "date": "2026-09-11",
      "entry": "Never forget."
    },
    {
      "id": "log-1786297165018",
      "date": "2026-08-09",
      "entry": "Fixed Currently Playing \"always playing\" bug"
    }
  ]
};

// Anything other than an explicit dev value is treated as prod, so a value like
// ENVIRONMENT=production can't fall through both branches of the /api/nowplaying handler.
const rawEnvironment = ENVIRONMENT.toLowerCase();
const environment = rawEnvironment === 'dev' || rawEnvironment === 'development' ? 'dev' : 'prod';
const isDev = environment === 'dev';

/* ------------------------------------------------------------------ *
 *  DB
 * ------------------------------------------------------------------ */

// Reads DB and automatically backfills missing schema properties
function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2));
    return DEFAULT_DB;
  }
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

    // Schema migration / fallback merge
    const merged = {
      hero: { ...DEFAULT_DB.hero, ...(data.hero || {}) },
      banner: { ...DEFAULT_DB.banner, ...(data.banner || {}) },
      socials: Array.isArray(data.socials) ? data.socials : DEFAULT_DB.socials,
      songs: Array.isArray(data.songs) ? data.songs : DEFAULT_DB.songs,
      featuredSong: data.featuredSong ? data.featuredSong : DEFAULT_DB.featuredSong,
      projects: Array.isArray(data.projects) ? data.projects : DEFAULT_DB.projects,
      logs: Array.isArray(data.logs) ? data.logs : DEFAULT_DB.logs,
    };
    return merged;
  } catch (err) {
    // Previously swallowed silently, which hid a corrupt db.json behind the default content.
    log('error', 'db', `failed to read/parse db.json, serving DEFAULT_DB: ${err?.message}`);
    return DEFAULT_DB;
  }
}

// Write to a temp file and rename, so a crash mid-write can't leave a truncated db.json.
function writeDB(data) {
  const tmp = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

/* ------------------------------------------------------------------ *
 *  Auth
 * ------------------------------------------------------------------ */

function pinMatches(candidate) {
  if (typeof candidate !== 'string') return false;
  const a = crypto.createHash('sha256').update(candidate).digest();
  const b = crypto.createHash('sha256').update(ADMIN_PIN).digest();
  return crypto.timingSafeEqual(a, b);
}

const authGuard = (req, res, next) => {
  if (pinMatches(req.headers['x-admin-pin'])) {
    next();
  } else {
    log('warn', 'auth', `rejected ${req.method} ${req.originalUrl} from ${req.ip}`);
    res.status(401).json({ error: 'Unauthorized PIN' });
  }
};

/* ------------------------------------------------------------------ *
 *  Routes
 * ------------------------------------------------------------------ */

app.get('/', (req, res) => {
  res.json({ status: 'active', service: '4helio\'s portfolio backend', primaryEndpoint: '/api/data' });
});

app.get('/api/data', (req, res) => {
  res.json(readDB());
});

app.post('/api/admin/verify', (req, res) => {
  const { pin } = req.body || {};
  if (pinMatches(pin)) {
    res.json({ success: true });
  } else {
    log('warn', 'auth', `invalid PIN on /api/admin/verify from ${req.ip}`);
    res.status(401).json({ error: 'Invalid PIN' });
  }
});

app.put('/api/db', authGuard, (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Expected a JSON object' });
  }
  writeDB(req.body);
  res.json({ success: true, db: req.body });
});

/* ---- Now playing (just relays what the phone posts; the browser looks up art/previews) ---- */

// Oldest first. Append-only, so an entry's index is a stable id (used as the paging cursor).
function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  try {
    const entries = parseHistory(fs.readFileSync(HISTORY_FILE, 'utf8'));
    log('info', 'history', `loaded ${entries.length} entries from ${HISTORY_FILE}`);
    return entries;
  } catch (err) {
    // Never overwrite a file we couldn't read: move it aside so it can be inspected or recovered.
    const aside = `${HISTORY_FILE}.corrupt-${Date.now()}`;
    try { fs.renameSync(HISTORY_FILE, aside); } catch { /* nothing more we can do */ }
    log('error', 'history', `could not read ${HISTORY_FILE} (${err.message}); moved it to ${aside}, starting empty`);
    return [];
  }
}

let NOWPLAYING_HISTORY = loadHistory();

// Saves are coalesced (500ms) so a burst of changes is one write; shutdown flushes immediately.
let historySaveTimer = null;
function saveHistoryNow() {
  if (historySaveTimer) {
    clearTimeout(historySaveTimer);
    historySaveTimer = null;
  }
  try {
    writeHistoryFile(NOWPLAYING_HISTORY);
  } catch (err) {
    log('error', 'history', `failed to save history to ${HISTORY_FILE}: ${err.message}`);
  }
}
function saveHistory() {
  if (!historySaveTimer) historySaveTimer = setTimeout(saveHistoryNow, 500);
}

// A track only counts as "played" once it has been the current track for this long.
// Anything replaced (or cleared) before that is treated as a skip and never reaches the history.
const MIN_PLAY_MS = 30 * 1000;

const TITLE_KEY = 'android.media.metadata.TITLE';
const ARTIST_KEY = 'android.media.metadata.ARTIST';
const trackKey = (t) => `${t[TITLE_KEY]}|${t[ARTIST_KEY]}`;

async function sendPurgeRequest(url) {
  // const url = 'https://example.com';

  try {
    const response = await fetch(url, {
      method: 'PURGE'
    });

    console.log('Status Code:', response.status);
    const text = await response.text();
    console.log('Response:', text);
  } catch (error) {
    console.error('Error sending PURGE request:', error);
  }
}

let nowplaying = { enabled: false };

// The track waiting out its MIN_PLAY_MS. Only one can be pending at a time.
let historyTimer = null;
let pendingEntry = null;

function startHistoryTimer(entry) {
  const key = trackKey(entry);
  pendingEntry = entry;
  historyTimer = setTimeout(() => {
    historyTimer = null;
    pendingEntry = null;
    // Still the current track after MIN_PLAY_MS -> it wasn't skipped, so log it.
    if (nowplaying.enabled && trackKey(nowplaying) === key) {
      // playedAt lets us answer "what did I play this week?". Entries from before this existed have none.
      NOWPLAYING_HISTORY.push({ ...entry, playedAt: Date.now() });
      saveHistory();
      log('info', 'history', `logged: "${entry[TITLE_KEY]}" (#${NOWPLAYING_HISTORY.length})`);
    }
  }, MIN_PLAY_MS);
}

function cancelHistoryTimer() {
  if (!historyTimer) return;
  clearTimeout(historyTimer);
  log('info', 'history',
    `skipped (played < ${MIN_PLAY_MS / 1000}s), not logged: "${pendingEntry?.[TITLE_KEY]}"`);
  historyTimer = null;
  pendingEntry = null;
}

app.post('/api/nowplaying', authGuard, (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    log('warn', 'nowplaying', 'rejected POST: body is not a JSON object');
    return res.status(400).json({ error: 'Expected a JSON object' });
  }

  const albumArt = body['android.media.metadata.ALBUM_ART'];
  if (albumArt && !String(albumArt).startsWith('content://net.dinglisch.android.tasker')) {
    log('info', 'nowplaying', 'ignored POST: ALBUM_ART is not a Tasker URI');
    return res.sendStatus(200);
  }

  log('info', 'nowplaying',
    `now playing: "${body[TITLE_KEY]}" by "${body[ARTIST_KEY]}"`);

  // A repeat POST for the track that's already playing is a metadata update, not a new play:
  // it must not restart the 15s clock or log the same play twice.
  const isSameTrack = nowplaying.enabled && trackKey(nowplaying) === trackKey(body);
  nowplaying = { ...body, enabled: true };

  if (!isSameTrack) {
    cancelHistoryTimer(); // the previous track was replaced before MIN_PLAY_MS -> skipped
    startHistoryTimer(nowplaying);
  }

  sendPurgeRequest("https://camo.githubusercontent.com/daea7939ad44250f9c33a5edbddd8db02d71a865bca8f64256b8488691ea3ea9/68747470733a2f2f6d656d626c752e75732e746f2f68656c696f736e6f77706c6179696e672e706e67");

  res.sendStatus(200);
});

// Paged, newest first.
//   GET /api/nowplaying/history?limit=30            -> the newest 30
//   GET /api/nowplaying/history?limit=30&before=N   -> the 30 just older than cursor N
// `before` is an index into the append-only history, so entries added between requests
// can't shift a page (no duplicates / gaps). Each item carries its index as `historyId`.
app.get('/api/nowplaying/history', (req, res) => {
  res.set('Cache-Control', 'no-store');

  const total = NOWPLAYING_HISTORY.length;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);

  let before = parseInt(req.query.before, 10);
  if (!Number.isInteger(before) || before > total) before = total;
  if (before < 0) before = 0;

  const start = Math.max(before - limit, 0);
  const items = NOWPLAYING_HISTORY
    .slice(start, before)
    .map((entry, i) => ({ ...entry, historyId: start + i }))
    .reverse();

  res.json({ items, total, nextBefore: start, hasMore: start > 0 });
});

// Most played songs over the last N days (default 7), with variants of the same song merged
// ("- Slowed", "(feat. X)", "- 2022 Remaster", ...). See src/songKey.js for the merge rules.
//   GET /api/nowplaying/top?days=7&limit=10   (last week)
//   GET /api/nowplaying/top?days=0&limit=10   (all time; days=0 skips the date cutoff)
// Only plays logged since timestamps were added count; older history entries have no `playedAt`.
app.get('/api/nowplaying/top', (req, res) => {
  res.set('Cache-Control', 'no-store');

  const requestedDays = parseInt(req.query.days, 10);
  const days = requestedDays === 0 ? 0 : Math.min(Math.max(requestedDays || 7, 1), 90);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
  const now = Date.now();
  const since = days === 0 ? 0 : now - days * 24 * 60 * 60 * 1000;

  res.json({ days, since, items: topSongs(NOWPLAYING_HISTORY, { sinceMs: since, limit, now }) });
});

app.delete('/api/nowplaying/history/single', authGuard, (req, res) => {
  const {index} = req.query;
  if (!index || index == "")
    return res.sendStatus(400);

  if (index == "z")
    NOWPLAYING_HISTORY.pop()
  else
    NOWPLAYING_HISTORY.splice(index, 1);
  saveHistory();

  res.sendStatus(200);

  log('info', 'nowplaying', 'single deletion from history, song at index ' + index);
});

app.delete('/api/nowplaying/history', authGuard, (req, res) => {
  log('info', 'nowplaying', 'cleared history');
  NOWPLAYING_HISTORY = [];
  saveHistory();
  res.sendStatus(200);
});

app.delete('/api/nowplaying', authGuard, (req, res) => {
  log('info', 'nowplaying', 'cleared');
  cancelHistoryTimer(); // cleared before MIN_PLAY_MS -> not logged
  nowplaying = { enabled: false };
  res.sendStatus(200);
});

app.get('/api/nowplaying', async (req, res) => {
  // Polled every second by every visitor: make sure nothing in between caches it.
  res.set('Cache-Control', 'no-store');

  if (nowplaying.enabled) return res.json(nowplaying);

  if (!isDev) return res.sendStatus(503);

  // dev: nothing local, so mirror what production is playing
  try {
    const up = await fetch(UPSTREAM_NOWPLAYING_URL, { signal: AbortSignal.timeout(5000) });
    if (!up.ok) return res.sendStatus(503);
    return res.json(await up.json());
  } catch (e) {
    log('warn', 'nowplaying', `dev proxy to ${UPSTREAM_NOWPLAYING_URL} failed: ${e?.message || e}`);
    return res.sendStatus(503);
  }
});

app.post("/api/admin/heroPhoto/upload", authGuard, upload.single('file'), (req, res) => {
  if (!req.file)
    return res.status(400).json({ "error": "Please attach a file." });

  res.status(200).json({
    message: 'File uploaded successfully',
    fileDetails: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    }
  });
});

// Flush any pending save when the process is stopped (Ctrl+C, systemd, docker stop, pm2 restart).
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    saveHistoryNow();
    process.exit(0);
  });
}

app.listen(PORT, '0.0.0.0', () => {
  log('info', 'server', `Backend API running on port ${PORT} (${environment})`);
});