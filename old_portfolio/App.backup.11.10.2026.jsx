import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal, Cpu, Music, Radio, Wrench, Lock, Unlock,
  Trash2, Plus, Search, ExternalLink, Play, Pause, X,
  Check, RefreshCw, Sliders, Shield, Activity, Disc,
  ArrowUpRight, Share2, Image as ImageIcon, Save, LogOut, FileText, Menu, Link,
  ChevronDown, Repeat
} from 'lucide-react';

import { DEBUG, npLog, searchSongs } from './trackMedia';
import { useNowPlaying, FALLBACK_ART, NOW_PLAYING_ID } from './useNowPlaying';

const API_BASE = import.meta.env.VITE_API_URL || 'https://cli.4helio.xyz/api';

// How many history entries are fetched per page (each uncached one may trigger an iTunes lookup).
const HISTORY_PAGE_SIZE = 30;

/* ------------------------------------------------------------------ *
 *  Preview audio player (shared by the Now Playing card and the song list)
 * ------------------------------------------------------------------ */

function usePreviewPlayer() {
  const audioRef = useRef(null);
  const currentIdRef = useRef(null); // mirrors currentSongId so callbacks never read stale state
  const [currentSongId, setCurrentSongId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const setCurrent = (id) => {
    currentIdRef.current = id;
    setCurrentSongId(id);
  };

  const stop = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
    }
    audioRef.current = null;
    setCurrent(null);
    setIsPlaying(false);
  };

  // Called from a click handler, so play() happens inside the user gesture (required on iOS).
  const toggle = (song) => {
    if (!song || !song.previewUrl) return;

    const audio = audioRef.current;
    if (audio && currentIdRef.current === song.id) {
      if (!audio.paused) {
        audio.pause();
        setIsPlaying(false);
      } else {
        audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      }
      return;
    }

    stop();
    const next = new Audio(song.previewUrl);
    next.onended = () => setIsPlaying(false);
    next.onerror = () => {
      npLog('warn', 'audio', `preview failed to load: ${song.previewUrl}`, next.error);
      setIsPlaying(false);
    };
    audioRef.current = next;
    setCurrent(song.id);
    next.play().then(() => setIsPlaying(true)).catch((err) => {
      npLog('warn', 'audio', `play() was rejected: ${err?.name}: ${err?.message}`);
      setIsPlaying(false);
    });
  };

  const stopIfPlaying = (id) => {
    if (currentIdRef.current === id) stop();
  };

  useEffect(() => () => {
    if (audioRef.current) audioRef.current.pause();
  }, []);

  return { currentSongId, isPlaying, toggle, stopIfPlaying };
}

/* ------------------------------------------------------------------ *
 *  Small presentational pieces
 * ------------------------------------------------------------------ */

function PlayButton({ active, playing, onClick }) {
  const showPause = active && playing;
  return (
    <button
      onClick={onClick}
      aria-label={showPause ? 'Pause preview' : 'Play preview'}
      className="absolute inset-0 bg-black/40 flex items-center justify-center hover:bg-black/60 transition-colors"
    >
      {showPause
        ? <Pause className="w-5 h-5 text-white fill-current" />
        : <Play className="w-5 h-5 text-white fill-current ml-0.5" />}
    </button>
  );
}

// If an art URL fails to load, swap in the fallback once (no error loop).
function swapToFallbackArt(e) {
  const img = e.currentTarget;
  if (img.dataset.fallback) return;
  img.dataset.fallback = '1';
  img.src = FALLBACK_ART;
}

// Defined at module level (not inside App) so React keeps the same component identity across
// renders: the spinning cover and its image don't get remounted on every now-playing update.
function NowPlayingCard({ song, active, playing, onToggle, onShowHistory }) {
  const art = song.albumArt || FALLBACK_ART;
  return (
    <div
      className={`p-3 rounded border transition-all flex flex-col justify-between h-fit min-w-0 ${active
        ? 'bg-black border-neutral-400'
        : 'bg-black/40 border-neutral-800 hover:border-neutral-700'
        }`}
    >
      {/* min-w-0 on the flex row so the text column below can actually shrink/truncate */}
      <div className="flex gap-3 items-center w-full min-w-0">
        <div className="w-14 h-14 rounded-full animate-[spin_5s_linear_infinite] bg-neutral-950 overflow-hidden relative border border-neutral-800 shrink-0">
          <img key={art} src={art} alt="" onError={swapToFallbackArt} className="w-full h-full object-cover" />
          {song.previewUrl && <PlayButton active={active} playing={playing} onClick={onToggle} />}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-bold text-xs text-neutral-200 mb-2 truncate">{song.title}</h4>
          <p className="text-[11px] text-neutral-400 truncate">{song.artist}</p>
        </div>
        <div className="mx-auto text-center">
          <span className="text-base text-neutral-400 text-center font-bold">Currently Playing</span>
          <br />
          <span className="text-[12px] text-neutral-400 text-center">Live from Helio's Phone</span>
          <br />
          <button
            className="text-[12px] text-neutral-400 text-center underline bg-transparent border-none p-0"
            onClick={onShowHistory}
          >
            History
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Now Playing history popup pieces
 * ------------------------------------------------------------------ */

const historyArtCache = new Map(); // "title|artist" -> url | null

const historyKey = (item) =>
  `${item['android.media.metadata.TITLE']}|${item['android.media.metadata.ARTIST']}`;

// Collapses runs of the same song that are directly adjacent (newest-first order).
// A different song in between starts a new group, so A, B, A stays as three cards.
function groupConsecutive(items) {
  const groups = [];
  for (const item of items) {
    const key = historyKey(item);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.count += 1;
    } else {
      groups.push({ key, item, count: 1 });
    }
  }
  return groups;
}

function HistoryItem({ item, count = 1 }) {
  const title = item['android.media.metadata.TITLE'];
  const artist = item['android.media.metadata.ARTIST'];
  const key = historyKey(item);
  const repeated = count > 1;

  const direct = [
    item['android.media.metadata.ALBUM_ART_URI'],
    item['android.media.metadata.ART_URI'],
  ].find((u) => typeof u === 'string' && /^https?:/.test(u));

  const [art, setArt] = useState(direct || historyArtCache.get(key) || null);

  useEffect(() => {
    if (art) return;
    if (historyArtCache.has(key)) {
      setArt(historyArtCache.get(key));
      return;
    }
    let cancelled = false;
    searchSongs(`${title} ${artist}`, 1)
      .then((r) => {
        const url = r?.[0]?.albumArt || null;
        historyArtCache.set(key, url);
        if (!cancelled) setArt(url);
      })
      .catch(() => { });
    return () => { cancelled = true; };
  }, [key]);

  return (
    // mb-2 leaves room for the stack layers peeking out below the card
    <div className={`relative ${repeated ? 'mb-2' : ''}`}>
      {repeated && (
        <>
          <div className="absolute inset-x-3 -bottom-2 h-full rounded bg-neutral-800/60 border border-neutral-700/60" />
          <div className="absolute inset-x-1.5 -bottom-1 h-full rounded bg-neutral-800 border border-neutral-700" />
        </>
      )}
      <div className={`relative p-2 bg-neutral-900 rounded flex items-center gap-3 ${repeated ? 'border border-neutral-700' : ''}`}>
        <img
          src={art || FALLBACK_ART}
          alt=""
          onError={swapToFallbackArt}
          className="w-12 h-12 rounded object-cover shrink-0 bg-neutral-950"
        />
        <div className="min-w-0 flex-1">
          <p className="font-bold truncate">{title}</p>
          <p className="text-xs text-neutral-400 truncate">{artist}</p>
        </div>
        {repeated && (
          <div className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full bg-black border border-neutral-700 text-[10px] font-mono font-bold text-neutral-300">
            <Repeat className="w-3 h-3" />
            REPEATED {count}X
          </div>
        )}
      </div>
    </div>
  );
}


function HistoryList({ items, hasMore, loading, onLoadMore }) {
  const ref = useRef(null);
  const [canScroll, setCanScroll] = useState(false);
  const [atBottom, setAtBottom] = useState(false);

  const groups = React.useMemo(() => groupConsecutive(items), [items]);

  const update = () => {
    const el = ref.current;
    if (!el) return;
    setCanScroll(el.scrollHeight > el.clientHeight + 1);
    setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 4);
  };
  useEffect(() => { update(); }, [items.length, hasMore]);

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={update}
        className="max-h-96 overflow-y-scroll space-y-2 pr-2
          [scrollbar-width:thin] [scrollbar-color:#737373_#171717]
          [&::-webkit-scrollbar]:w-2
          [&::-webkit-scrollbar-track]:bg-neutral-900
          [&::-webkit-scrollbar-thumb]:bg-neutral-600
          [&::-webkit-scrollbar-thumb]:rounded"
      >
        {groups.map((g, i) => (
          <HistoryItem key={g.item.historyId ?? i} item={g.item} count={g.count} />
        ))}

        {hasMore && (
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="w-full py-2 rounded border border-neutral-700 bg-black text-neutral-300 text-xs hover:border-white disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-1.5"
          >
            {loading && <RefreshCw className="w-3 h-3 animate-spin" />}
            {loading ? 'Loading...' : 'Load more'}
          </button>
        )}
      </div>

      {canScroll && !atBottom && (
        <>
          <div className="pointer-events-none absolute bottom-0 left-0 right-2 h-16 bg-gradient-to-t from-neutral-950 to-transparent" />
          <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-800 border border-neutral-600 text-[11px] text-neutral-200 shadow animate-bounce">
            <ChevronDown className="w-3 h-3" /> Scroll for more
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function App() {
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Mobile Menu Drawer State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Admin Auth & Fullscreen Modal
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinErr, setPinErr] = useState(false);
  const [adminTab, setAdminTab] = useState('hero');

  // Editable Form Data in Admin
  const [editDb, setEditDb] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Admin song search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Audio preview + live "Currently Playing" (see usePreviewPlayer / useNowPlaying)
  const player = usePreviewPlayer();
  const nowPlaying = useNowPlaying(API_BASE, {
    onTrackChange: () => player.stopIfPlaying(NOW_PLAYING_ID),
  });
  const nowPlayingCard = { ...nowPlaying, id: NOW_PLAYING_ID };

  // Now Playing history popup
  const [showNowPlayingHistoryPopUp, setShowNowPlayingHistoryPopUp] = useState(false);
  const [nowPlayingHistory, setNowPlayingHistory] = useState([]);
  const [historyCursor, setHistoryCursor] = useState(null); // server index to page "before"
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const historyTokenRef = useRef(0); // lets a newer request supersede a stale in-flight one

  // ?debug in the URL loads the eruda on-page console (useful on iOS) and turns on [np] logs.
  useEffect(() => {
    if (!DEBUG) return;
    import('eruda')
      .then((eruda) => eruda.default.init())
      .catch((err) => console.warn('Could not load eruda', err));
  }, []);

  const fetchData = async () => {
    try {
      setErrorMsg('');
      const res = await fetch(`${API_BASE}/data`);
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const data = await res.json();
      setDb(data);
      setEditDb(JSON.parse(JSON.stringify(data)));
    } catch (e) {
      console.error("Failed to fetch data", e);
      setErrorMsg(e.message || 'Failed to reach API server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleVerifyPin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/admin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: adminPin })
      });
      if (res.ok) {
        setIsUnlocked(true);
        setPinErr(false);
      } else {
        setPinErr(true);
      }
    } catch (err) {
      setPinErr(true);
    }
  };

  const saveAllChanges = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/db`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': adminPin
        },
        body: JSON.stringify(editDb)
      });
      if (res.ok) {
        setDb(JSON.parse(JSON.stringify(editDb)));
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } else {
        alert("Save failed. Check Admin PIN.");
      }
    } catch (err) {
      alert("Error saving data to server.");
    } finally {
      setSaving(false);
    }
  };

  const searchITunes = async (e) => {
    e.preventDefault();
    const term = searchQuery.trim();
    if (!term) return;
    setIsSearching(true);
    try {
      setSearchResults(await searchSongs(term, 8));
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const getDateInYYYYMMDD = () => {
    const date = new Date();

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const dd = String(date.getDate()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}`;
  };

  function getYearsBetween(date1, date2) {
    const start = new Date(date1);
    const end = new Date(date2);

    // 1. Get the difference in calendar years
    let years = end.getFullYear() - start.getFullYear();

    // 2. Adjust if the anniversary hasn't occurred yet in the final year
    const monthDiff = end.getMonth() - start.getMonth();
    const dayDiff = end.getDate() - start.getDate();

    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      years--;
    }

    return years;
  }

  function clearNowPlayingAdmin() {
    fetch(`${API_BASE}/nowplaying`, {
      method: "DELETE",
      headers: {
        "x-admin-pin": adminPin
      }
    }).catch((err) => console.error('Failed to clear now playing', err));
  }

  useEffect(() => {
    if (!db) return;
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Person",
      "name": db.hero?.name,
      "url": "https://4helio.xyz",
      "jobTitle": "Software & Hardware Developer",
      "sameAs": (db.socials || []).filter(s => !s.disabled).map(s => s.href)
    });
    document.head.appendChild(script);
    return () => document.head.removeChild(script);
  }, [db]);

  // Newest-first, paged by a server-side cursor (`before`), so entries added while the popup
  // is open can't shift pages and cause duplicates.
  const loadHistory = async (reset = false) => {
    const token = ++historyTokenRef.current;
    setHistoryLoading(true);
    setHistoryError(false);
    try {
      const params = new URLSearchParams({ limit: String(HISTORY_PAGE_SIZE) });
      if (!reset && historyCursor !== null) params.set('before', String(historyCursor));
      const res = await fetch(`${API_BASE}/nowplaying/history?${params}`);
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const data = await res.json();
      if (token !== historyTokenRef.current) return;

      // Guard: never let an unexpected response shape reach .map() and blank the page.
      const items = Array.isArray(data?.items) ? data.items : [];
      setNowPlayingHistory((prev) => (reset ? items : [...prev, ...items]));
      setHistoryCursor(typeof data?.nextBefore === 'number' ? data.nextBefore : null);
      setHistoryHasMore(Boolean(data?.hasMore));
      setHistoryTotal(Number(data?.total) || 0);
    } catch (err) {
      if (token !== historyTokenRef.current) return;
      console.error('Failed to fetch now playing history:', err);
      setHistoryError(true);
    } finally {
      if (token === historyTokenRef.current) setHistoryLoading(false);
    }
  };

  // Fetch fresh on every open so the popup always starts at the newest entry.
  const openHistory = () => {
    setShowNowPlayingHistoryPopUp(true);
    loadHistory(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-400 font-mono flex items-center justify-center text-xs">
        <Activity className="w-4 h-4 animate-spin text-white mr-2" />
        connecting to super integrated portfolio engine...
      </div>
    );
  }

  if (errorMsg || !db) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-400 font-mono flex flex-col items-center justify-center text-xs p-6 gap-3">
        <div className="p-3 bg-red-950/40 border border-red-800/80 rounded text-red-400 text-center max-w-sm">
          <p className="font-bold mb-1">Connection Error</p>
          <p className="text-[11px] text-neutral-400">{'Could not load data from portfolio engine.'}</p>
        </div>
        <button onClick={fetchData} className="px-3 py-1.5 bg-black text-neutral-200 rounded border border-neutral-700 hover:border-white">
          Retry Connection
        </button>
      </div>
    );
  }

  // Safe destructuring fallbacks
  const hero = db.hero || {};
  const banner = db.banner || {};
  const socials = Array.isArray(db.socials) ? db.socials : [];
  const projects = Array.isArray(db.projects) ? db.projects : [];
  const songs = Array.isArray(db.songs) ? db.songs : [];
  const logs = Array.isArray(db.logs) ? db.logs : [];

  return (
    <div className="min-h-screen bg-[#000000] text-neutral-200 font-sans selection:bg-white selection:text-black">
      {showNowPlayingHistoryPopUp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-neutral-950 p-6 rounded border border-neutral-800 max-w-lg w-full">
            <h2 className="font-bold text-lg mb-4">
              Now Playing History{historyTotal > 0 ? ` (${historyTotal})` : ''}
            </h2>
            {nowPlayingHistory.length === 0 ? (
              <p className="text-xs text-neutral-400 py-6 text-center">
                {historyLoading ? 'Loading...' : historyError ? "Couldn't load history." : 'Nothing played yet.'}
              </p>
            ) : (
              <HistoryList
                items={nowPlayingHistory}
                hasMore={historyHasMore}
                loading={historyLoading}
                onLoadMore={() => loadHistory(false)}
              />
            )}
            {historyError && nowPlayingHistory.length > 0 && (
              <p className="mt-2 text-xs text-red-400">Couldn't load more. Try again.</p>
            )}
            <button
              onClick={() => setShowNowPlayingHistoryPopUp(false)}
              className="mt-4 px-3 py-1.5 bg-black text-neutral-200 rounded border border-neutral-700 hover:border-white"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Announcement Banner */}
      {banner.enabled && (
        <div className="bg-red-400 text-neutral-950 px-4 py-2 text-xs w-full font-mono font-bold flex items-center justify-between border-b border-red-500">
          <div className="md:flex text-center md:justify-between md:gap-2 md:max-w-4xl mx-auto md:px-6 overflow-hidden w-full">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="inline-block w-2 h-2 ml-2 bg-black animate-ping rounded-full shrink-0"></span>
              <span className="truncate">{banner.text}</span>
            </div>
            {banner.linkUrl && (
              <a href={banner.linkUrl} className="underline hover:text-white shrink-0 ml-4">
                {banner.linkText || 'Open'} →
              </a>
            )}
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-4xl mx-auto px-6 py-6 md:py-10 space-y-10 md:space-y-12 overflow-hidden">

        {/* Top Header Navigation */}
        <header className="border-b border-neutral-800 pb-4 md:pb-6 relative">
          <div className="flex items-center justify-between">
            {/* Branding */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-black border border-neutral-700 flex items-center justify-center font-mono font-bold text-white text-sm">
                HL
              </div>
              <div>
                <h1 className="font-bold text-sm text-neutral-100 tracking-wide">{hero.name}</h1>
                <p className="text-xs text-neutral-500 font-mono">{hero.location}</p>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-4 text-xs font-mono">
              <a href="#workbench" className="text-neutral-400 hover:text-white transition-colors">/workbench</a>
              <a href="#tapes" className="text-neutral-400 hover:text-white transition-colors">/audio</a>
              <a href="#logs" className="text-neutral-400 hover:text-white transition-colors">/logs</a>
              <button
                onClick={() => {
                  setEditDb(JSON.parse(JSON.stringify(db)));
                  setIsAdminOpen(true);
                }}
                className="px-2.5 py-1 rounded bg-black border border-neutral-700 hover:border-white text-neutral-300 text-xs font-mono flex items-center gap-1.5 transition-all shadow"
              >
                <Wrench className="w-3 h-3 text-neutral-400 hover:text-white" />
                {/* <span></span> */}
              </button>
            </div>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg bg-black border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700 transition-colors"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Mobile Navigation Dropdown Drawer */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pt-4 border-t border-neutral-800/80 flex flex-col space-y-3 font-mono text-xs bg-neutral-950 p-4 rounded-lg border border-neutral-800 shadow-xl">
              <a
                href="#workbench"
                onClick={() => setMobileMenuOpen(false)}
                className="text-neutral-300 hover:text-white py-1 flex items-center gap-2"
              >
                <Cpu className="w-3.5 h-3.5 text-neutral-400" /> /workbench
              </a>
              <a
                href="#tapes"
                onClick={() => setMobileMenuOpen(false)}
                className="text-neutral-300 hover:text-white py-1 flex items-center gap-2"
              >
                <Disc className="w-3.5 h-3.5 text-neutral-400" /> /audio
              </a>
              <a
                href="#logs"
                onClick={() => setMobileMenuOpen(false)}
                className="text-neutral-300 hover:text-white py-1 flex items-center gap-2"
              >
                <Terminal className="w-3.5 h-3.5 text-neutral-400" /> /logs
              </a>
              <div className="pt-2 border-t border-neutral-800">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setEditDb(JSON.parse(JSON.stringify(db)));
                    setIsAdminOpen(true);
                  }}
                  className="w-full py-2 px-3 rounded bg-neutral-500/10 border border-neutral-500/30 text-white text-xs font-mono font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <Wrench className="w-3.5 h-3.5" /> Open Admin Portal
                </button>
              </div>
            </div>
          )}
        </header>

        {/* HERO / STATUS SECTION */}
        <section className="grid md:grid-cols-3 gap-8 items-start">
          <div className="md:col-span-2 space-y-4">
            <h2 className="text-2xl md:text-3xl font-extrabold text-neutral-100 tracking-tight leading-snug">
              {hero.name}
            </h2>

            <div className="inline-flex items-center mr-2 gap-2 px-2.5 py-1 rounded bg-green-500/10 border border-green-500/20 text-white font-mono text-xs">
              <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-white animate-pulse"></span>
              Current Show: Sword Art Online
            </div>

            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-neutral-500/10 border border-neutral-500/20 text-neutral-400 font-mono text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-pulse"></span>
              {hero.status.replace("%bdaystr", `June 3, 2012 - ${getYearsBetween("2012-06-03", getDateInYYYYMMDD())} years ago`)}
            </div>

            <p className="text-neutral-400 text-sm leading-relaxed">
              {hero.bio}
            </p>

            {/* Social Links */}
            <div className="pt-2 flex flex-wrap gap-2 text-xs font-mono">
              {socials.map((s, idx) => (
                <a
                  key={s.id || idx}
                  href={s.disabled ? "javascript:void(0);" : s.href}
                  target={s.disabled ? "" : "_blank"}
                  rel="noreferrer"
                  className=
                  {
                    s.disabled ?
                      "line-through px-2.5 py-1 rounded bg-black border border-neutral-800 text-neutral-400/70 transition-all flex items-center gap-1" :
                      "px-2.5 py-1 rounded bg-black/80 border border-neutral-800 text-neutral-300 hover:border-neutral-600 hover:text-white transition-all flex items-center gap-1"}
                >
                  <span><Link className={
                    s.disabled ?
                      "w-4 h-4 text-neutral-400/70 shrink-0" :
                      "w-4 h-4 text-white shrink-0"
                  } /></span>
                  <span>{s.name}</span>
                  <span className="text-neutral-500">{s.handle}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Avatar Profile Card (min-w-0 so this column can shrink instead of forcing a wider layout) */}
          <div className="bg-black border border-neutral-800 space-y-3 min-w-0 w-full sm:w-auto">
            <div className="aspect-square bg-neutral-950 overflow-hidden relative border border-neutral-800">
              <img
                src={hero.avatarUrl}
                alt={hero.name}
                className="w-full h-full object-cover filter grayscale hover:grayscale-0 transition-all duration-500"
              />
              <div className="md:hidden absolute bottom-2 left-2 bg-black/80 px-2 py-0.5 text-[10px] font-mono text-neutral-400 border border-neutral-800">
                {'TAP FOR COLOR'}
              </div>

              <div className="hidden md:flex absolute bottom-2 left-2 bg-black/80 px-2 py-0.5 text-[10px] font-mono text-neutral-400 border border-neutral-800">
                {'HOVER FOR COLOR'}
              </div>
            </div>
            <div className="text-[11px] font-mono text-neutral-500 space-y-1 p-3">
              {(hero.bullets || []).map((b, i) => (
                <p key={i}>• {b}</p>
              ))}

              {/* <br /> */}
            </div>
          </div>

          <div className="col-span-1 md:col-span-3 -mt-2.5 md:-mt-4">
            <NowPlayingCard
              song={nowPlayingCard}
              active={player.currentSongId === NOW_PLAYING_ID}
              playing={player.isPlaying}
              onToggle={() => player.toggle(nowPlayingCard)}
              onShowHistory={openHistory}
            />
          </div>
        </section>

        {/* WORKBENCH PROJECTS */}
        <section id="workbench" className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <h3 className="text-sm font-mono font-bold text-neutral-300 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-neutral-400" />
              <span>My Projects</span>
            </h3>
            <span className="text-xs font-mono text-neutral-600">{projects.length} PROJECTS</span>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {projects.map((p, idx) => (
              <div key={p.id || idx} className="p-4 rounded bg-black/50 border border-neutral-800 hover:border-neutral-700 transition-all space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black text-neutral-400 border border-neutral-700">
                      {p.category}
                    </span>
                    <h4 className="font-bold text-sm text-neutral-200 mt-2">{p.title}</h4>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-500">{p.status}</span>
                </div>

                <p className="text-xs text-neutral-400 leading-relaxed">{p.description}</p>

                <div className="flex items-center justify-between pt-2 text-xs font-mono border-t border-neutral-800/60">
                  <div className="flex gap-1 flex-wrap">
                    {(p.tags || []).map((t, i) => (
                      <span key={i} className="text-[10px] text-neutral-500">#{t}</span>
                    ))}
                  </div>
                  {p.link && (
                    <a href={p.link} target="_blank" rel="noreferrer" className={
                      p.link == "javascript:void(0);" ?
                        "line-through text-neutral-400/70 hover:underline flex items-center gap-0.5" :
                        "text-neutral-400 hover:underline flex items-center gap-0.5"
                    }>
                      Repo <ArrowUpRight className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* MUSIC TAPES */}
        <section id="tapes" className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <h3 className="text-sm font-mono font-bold text-neutral-300 flex items-center gap-2">
              <Disc className="w-4 h-4 text-neutral-400" />
              <span>Featured Songs</span>
            </h3>
            <span className="text-xs font-mono text-neutral-600">LIVE PREVIEWS</span>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {songs.map((song, idx) => {
              const active = player.currentSongId === song.id;
              return (
                <div
                  key={song.id || idx}
                  className={`p-3 rounded border transition-all flex flex-col justify-between min-w-0 ${active
                    ? 'bg-black border-neutral-400'
                    : 'bg-black/40 border-neutral-800 hover:border-neutral-700'
                    }`}
                >
                  <div className="flex gap-3 items-center min-w-0">
                    <div className="w-14 h-14 rounded bg-neutral-950 overflow-hidden relative border border-neutral-800 shrink-0">
                      <img src={song.albumArt} alt="" className="w-full h-full object-cover" />
                      <PlayButton active={active} playing={player.isPlaying} onClick={() => player.toggle(song)} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-xs text-neutral-200 truncate">{song.title}</h4>
                      <p className="text-[11px] text-neutral-400 truncate">{song.artist}</p>
                      <p className="text-[10px] font-mono text-neutral-500 truncate mt-1">"{song.note}"</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section id="logs" className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <h3 className="text-sm font-mono font-bold text-neutral-300 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-neutral-400" />
              <span>Logs</span>
            </h3>
          </div>

          <div className="bg-neutral-950 border border-neutral-800 rounded p-4 font-mono text-xs space-y-2">
            {logs.map((l, i) => (
              <div key={l.id || i} className="flex gap-3 text-neutral-400">
                <span className="text-neutral-600 shrink-0">[{l.date}]</span>
                <span className="text-neutral-300">{l.entry}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-8 border-t border-neutral-800 text-xs font-mono text-neutral-600 flex flex-col md:flex-row gap-2 justify-between">
          <span>Helio Leles // Dynamic Deeply Connected Portfolio Engine</span>
          <span>Album artwork, song previews, and related metadata are provided via the iTunes Search API and are the property of Apple Inc. and/or the respective content owners. This site is not affiliated with, endorsed by, or sponsored by Apple Inc.</span>
          <span>This site uses the iTunes Search API to display album artwork, song previews, and metadata. All such content is © Apple Inc. and/or the applicable rights holders and is provided for informational/preview purposes only. iTunes and Apple are trademarks of Apple Inc. This site is not affiliated with or endorsed by Apple.</span>
        </footer>

      </div>

      {/* FULL-SCREEN ADMIN MANAGEMENT DASHBOARD */}
      {isAdminOpen && editDb && (
        <div className="fixed inset-0 bg-[#0c0c0b] z-50 overflow-y-auto font-mono text-xs text-neutral-200 flex flex-col">

          {/* Top Admin Workstation Bar */}
          <div className="p-4 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 bg-neutral-400 rounded text-black flex items-center justify-center font-bold">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-neutral-100 text-sm">WORKSTATION_ADMIN // FULL_CONTROL</h3>
                <p className="text-[11px] text-neutral-500">Live sync target: {API_BASE}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isUnlocked && (
                <button
                  onClick={saveAllChanges}
                  disabled={saving}
                  className="px-4 py-2 bg-neutral-400 hover:bg-neutral-300 text-black font-bold rounded flex items-center gap-1.5 transition-colors shadow"
                >
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {saveSuccess ? 'SAVED TO DB!' : 'SAVE EVERYTHING'}
                </button>
              )}
              <button
                onClick={() => setIsAdminOpen(false)}
                className="px-3 py-2 bg-black border border-neutral-700 hover:bg-black rounded text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Authentication Barrier */}
          {!isUnlocked ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <div className="w-full max-w-sm bg-black border border-neutral-800 rounded-lg p-6 text-center space-y-4 shadow-2xl">
                <Lock className="w-8 h-8 text-neutral-400 mx-auto" />
                <h4 className="font-bold text-neutral-200 text-base">ADMIN PORTALLLLLLL</h4>
                <p className="text-neutral-400 text-xs">Enter your PIN to unlock.</p>
                <form onSubmit={handleVerifyPin} className="space-y-3">
                  <input
                    type="password"
                    placeholder="ENTER PIN..."
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    className="w-full text-center py-2.5 bg-neutral-950 border border-neutral-700 rounded text-neutral-400 text-lg tracking-widest outline-none focus:border-neutral-500"
                  />
                  {pinErr && <p className="text-red-400 text-[11px]">Wrong PIN.</p>}
                  <button type="submit" className="w-full py-2 bg-neutral-400 hover:bg-neutral-300 text-black font-bold rounded">
                    Unlock
                  </button>
                </form>
              </div>
            </div>
          ) : (
            /* Full Control Editor Tabs */
            <div className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 grid md:grid-cols-4 gap-6 items-start">

              {/* Sidebar Tabs */}
              <div className="bg-black border border-neutral-800 rounded-lg p-3 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
                {[
                  { id: 'hero', label: 'Hero & Images', icon: ImageIcon },
                  { id: 'socials', label: 'Social Handles', icon: Share2 },
                  { id: 'projects', label: 'Workbench Projects', icon: Cpu },
                  { id: 'songs', label: 'Music & iTunes', icon: Music },
                  { id: 'logs', label: 'System Logs', icon: FileText },
                  { id: 'banner', label: 'Top Banner', icon: Radio },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setAdminTab(t.id)}
                    className={`whitespace-nowrap md:w-full text-left px-3 py-2.5 rounded flex items-center gap-2 font-bold transition-colors ${adminTab === t.id
                      ? 'bg-neutral-400 text-black'
                      : 'text-neutral-400 hover:bg-black hover:text-white'
                      }`}
                  >
                    <t.icon className="w-4 h-4 shrink-0" />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Editor Workspace */}
              <div className="md:col-span-3 bg-black border border-neutral-800 rounded-lg p-4 md:p-6 space-y-6">

                {/* 1. HERO & IMAGES */}
                {adminTab === 'hero' && (
                  <div className="space-y-4">
                    <h4 className="font-bold text-neutral-400 uppercase">Profile Info & Image URL Settings</h4>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-neutral-400 mb-1">Display Name</label>
                        <input
                          type="text"
                          value={editDb.hero?.name || ''}
                          onChange={(e) => setEditDb({ ...editDb, hero: { ...editDb.hero, name: e.target.value } })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200"
                        />
                      </div>
                      <div>
                        <label className="block text-neutral-400 mb-1">Location</label>
                        <input
                          type="text"
                          value={editDb.hero?.location || ''}
                          onChange={(e) => setEditDb({ ...editDb, hero: { ...editDb.hero, location: e.target.value } })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-neutral-400 mb-1">Status Badge Text</label>
                      <input
                        type="text"
                        value={editDb.hero?.status || ''}
                        onChange={(e) => setEditDb({ ...editDb, hero: { ...editDb.hero, status: e.target.value } })}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 mb-1">Bio Text</label>
                      <textarea
                        rows={3}
                        value={editDb.hero?.bio || ''}
                        onChange={(e) => setEditDb({ ...editDb, hero: { ...editDb.hero, bio: e.target.value } })}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 mb-1">Avatar Profile Picture URL</label>
                      <input
                        type="text"
                        value={editDb.hero?.avatarUrl || ''}
                        onChange={(e) => setEditDb({ ...editDb, hero: { ...editDb.hero, avatarUrl: e.target.value } })}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 mb-1">Avatar Image Badge Overlay</label>
                      <input
                        type="text"
                        value={editDb.hero?.avatarBadge || ''}
                        onChange={(e) => setEditDb({ ...editDb, hero: { ...editDb.hero, avatarBadge: e.target.value } })}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200"
                      />
                    </div>
                  </div>
                )}

                {/* 2. SOCIAL HANDLES */}
                {adminTab === 'socials' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-amber-500 uppercase">Manage Social Handles & Links</h4>
                      <button
                        onClick={() => {
                          const newSoc = { id: `soc-${Date.now()}`, name: "New Social", handle: "@user", href: "https://" };
                          setEditDb({ ...editDb, socials: [...(editDb.socials || []), newSoc] });
                        }}
                        className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Handle
                      </button>
                    </div>

                    <div className="space-y-3">
                      {(editDb.socials || []).map((soc, idx) => (
                        <div key={soc.id || idx} className="p-3 bg-neutral-950 border border-neutral-800 rounded grid sm:grid-cols-4 gap-2 items-center">
                          <input
                            type="text"
                            placeholder="Platform Name"
                            value={soc.name}
                            onChange={(e) => {
                              const copy = [...editDb.socials];
                              copy[idx].name = e.target.value;
                              setEditDb({ ...editDb, socials: copy });
                            }}
                            className="bg-black border border-neutral-800 rounded p-1.5 text-neutral-200"
                          />
                          <input
                            type="text"
                            placeholder="@username"
                            value={soc.handle}
                            onChange={(e) => {
                              const copy = [...editDb.socials];
                              copy[idx].handle = e.target.value;
                              setEditDb({ ...editDb, socials: copy });
                            }}
                            className="bg-black border border-neutral-800 rounded p-1.5 text-neutral-200"
                          />
                          <input
                            type="text"
                            placeholder="https://..."
                            value={soc.href}
                            onChange={(e) => {
                              const copy = [...editDb.socials];
                              copy[idx].href = e.target.value;
                              setEditDb({ ...editDb, socials: copy });
                            }}
                            className="bg-black border border-neutral-800 rounded p-1.5 text-neutral-200"
                          />
                          <button
                            onClick={() => {
                              const copy = editDb.socials.filter((_, i) => i !== idx);
                              setEditDb({ ...editDb, socials: copy });
                            }}
                            className="text-red-400 hover:text-red-300 justify-self-end p-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. WORKBENCH PROJECTS */}
                {adminTab === 'projects' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-amber-500 uppercase">Workbench Hardware & Software Projects</h4>
                      <button
                        onClick={() => {
                          const newProj = {
                            id: `proj-${Date.now()}`,
                            title: "New Lab Experiment",
                            category: "Hardware",
                            status: "Prototype",
                            description: "Description of build...",
                            tags: ["ESP32", "C++"],
                            link: "https://github.com/NullClock/"
                          };
                          setEditDb({ ...editDb, projects: [newProj, ...(editDb.projects || [])] });
                        }}
                        className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Project
                      </button>
                    </div>

                    <div className="space-y-4">
                      {(editDb.projects || []).map((proj, idx) => (
                        <div key={proj.id || idx} className="p-4 bg-neutral-950 border border-neutral-800 rounded space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-neutral-500">PROJECT #{idx + 1}</span>
                            <button
                              onClick={() => {
                                const copy = editDb.projects.filter((_, i) => i !== idx);
                                setEditDb({ ...editDb, projects: copy });
                              }}
                              className="text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="grid sm:grid-cols-3 gap-2">
                            <input
                              type="text"
                              placeholder="Title"
                              value={proj.title}
                              onChange={(e) => {
                                const copy = [...editDb.projects];
                                copy[idx].title = e.target.value;
                                setEditDb({ ...editDb, projects: copy });
                              }}
                              className="bg-black border border-neutral-800 rounded p-2 text-neutral-200"
                            />
                            <input
                              type="text"
                              placeholder="Category"
                              value={proj.category}
                              onChange={(e) => {
                                const copy = [...editDb.projects];
                                copy[idx].category = e.target.value;
                                setEditDb({ ...editDb, projects: copy });
                              }}
                              className="bg-black border border-neutral-800 rounded p-2 text-neutral-200"
                            />
                            <input
                              type="text"
                              placeholder="Status Badge"
                              value={proj.status}
                              onChange={(e) => {
                                const copy = [...editDb.projects];
                                copy[idx].status = e.target.value;
                                setEditDb({ ...editDb, projects: copy });
                              }}
                              className="bg-black border border-neutral-800 rounded p-2 text-neutral-200"
                            />
                          </div>
                          <textarea
                            rows={2}
                            placeholder="Description"
                            value={proj.description}
                            onChange={(e) => {
                              const copy = [...editDb.projects];
                              copy[idx].description = e.target.value;
                              setEditDb({ ...editDb, projects: copy });
                            }}
                            className="w-full bg-black border border-neutral-800 rounded p-2 text-neutral-200"
                          />
                          <div className="grid sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Tags (comma separated)"
                              value={proj.tags?.join(', ') || ''}
                              onChange={(e) => {
                                const copy = [...editDb.projects];
                                copy[idx].tags = e.target.value.split(',').map(t => t.trim());
                                setEditDb({ ...editDb, projects: copy });
                              }}
                              className="bg-black border border-neutral-800 rounded p-2 text-neutral-200"
                            />
                            <input
                              type="text"
                              placeholder="Repo URL"
                              value={proj.link || ''}
                              onChange={(e) => {
                                const copy = [...editDb.projects];
                                copy[idx].link = e.target.value;
                                setEditDb({ ...editDb, projects: copy });
                              }}
                              className="bg-black border border-neutral-800 rounded p-2 text-neutral-200"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. MUSIC & ITUNES SEARCH */}
                {adminTab === 'songs' && (
                  <div className="space-y-4">
                    <h4 className="font-bold text-amber-500 uppercase">Search & Add Songs from iTunes API</h4>
                    <form onSubmit={searchITunes} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Search track title or artist..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200"
                      />
                      <button type="submit" disabled={isSearching} className="px-3 py-2 bg-amber-500 text-black rounded font-bold flex items-center gap-1">
                        {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                        Search API
                      </button>
                    </form>

                    <button className="px-3 py-2 w-full text-center bg-amber-500 text-black rounded font-bold" onClick={clearNowPlayingAdmin}>
                      Clear Now Playing
                    </button>

                    {searchResults.length > 0 && (
                      <div className="max-h-48 overflow-y-auto space-y-1 bg-neutral-950 p-2 rounded border border-neutral-800">
                        {searchResults.map((s) => (
                          <div key={s.id} className="flex items-center justify-between p-2 hover:bg-black rounded">
                            <div className="flex items-center gap-2">
                              <img src={s.albumArt} alt="" className="w-8 h-8 rounded object-cover" />
                              <span className="truncate max-w-[280px]">{s.title} - {s.artist}</span>
                            </div>
                            <button
                              onClick={() => {
                                const existingSongs = editDb.songs || [];
                                if (!existingSongs.some(existing => existing.id === s.id)) {
                                  setEditDb({ ...editDb, songs: [s, ...existingSongs] });
                                }
                              }}
                              className="text-amber-400 hover:underline text-xs"
                            >
                              + Add Track
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2 pt-2">
                      <h5 className="font-bold text-neutral-400">Current Songs ({(editDb.songs || []).length})</h5>
                      {(editDb.songs || []).map((song, idx) => (
                        <div key={song.id || idx} className="p-3 bg-neutral-950 border border-neutral-800 rounded flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <img src={song.albumArt} alt="" className="w-10 h-10 rounded object-cover" />
                            <div>
                              <p className="font-bold text-neutral-200">{song.title}</p>
                              <p className="text-neutral-500 text-[11px]">{song.artist}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const copy = editDb.songs.filter((_, i) => i !== idx);
                              setEditDb({ ...editDb, songs: copy });
                            }}
                            className="text-red-400 p-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. SYSTEM LOGS */}
                {adminTab === 'logs' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-amber-500 uppercase">System Logs</h4>
                      <button
                        onClick={() => {
                          const newLog = {
                            id: `log-${Date.now()}`,
                            date: new Date().toISOString().split('T')[0],
                            entry: "New workbench log entry..."
                          };
                          setEditDb({ ...editDb, logs: [newLog, ...(editDb.logs || [])] });
                        }}
                        className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Log
                      </button>
                    </div>

                    <div className="space-y-2">
                      {(editDb.logs || []).map((log, idx) => (
                        <div key={log.id || idx} className="p-3 bg-neutral-950 border border-neutral-800 rounded flex items-center gap-3">
                          <input
                            type="text"
                            value={log.date}
                            onChange={(e) => {
                              const copy = [...editDb.logs];
                              copy[idx].date = e.target.value;
                              setEditDb({ ...editDb, logs: copy });
                            }}
                            className="w-28 bg-black border border-neutral-800 rounded p-1.5 text-neutral-400 font-mono text-center"
                          />
                          <input
                            type="text"
                            value={log.entry}
                            onChange={(e) => {
                              const copy = [...editDb.logs];
                              copy[idx].entry = e.target.value;
                              setEditDb({ ...editDb, logs: copy });
                            }}
                            className="flex-1 bg-black border border-neutral-800 rounded p-1.5 text-neutral-200"
                          />
                          <button
                            onClick={() => {
                              const copy = editDb.logs.filter((_, i) => i !== idx);
                              setEditDb({ ...editDb, logs: copy });
                            }}
                            className="text-red-400 p-1.5"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. BANNER SETTINGS */}
                {adminTab === 'banner' && (
                  <div className="space-y-4">
                    <h4 className="font-bold text-amber-500 uppercase">Top Announcement Banner Configuration</h4>
                    <div className="flex items-center gap-3 p-3 bg-neutral-950 border border-neutral-800 rounded">
                      <input
                        type="checkbox"
                        checked={Boolean(editDb.banner?.enabled)}
                        onChange={(e) => setEditDb({ ...editDb, banner: { ...editDb.banner, enabled: e.target.checked } })}
                        className="w-4 h-4 accent-amber-500"
                      />
                      <label className="text-neutral-300 font-bold">Banner Enabled on Website</label>
                    </div>
                    <div>
                      <label className="block text-neutral-400 mb-1">Banner Announcement Text</label>
                      <input
                        type="text"
                        value={editDb.banner?.text || ''}
                        onChange={(e) => setEditDb({ ...editDb, banner: { ...editDb.banner, text: e.target.value } })}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200"
                      />
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-neutral-400 mb-1">Link Button Label</label>
                        <input
                          type="text"
                          value={editDb.banner?.linkText || ''}
                          onChange={(e) => setEditDb({ ...editDb, banner: { ...editDb.banner, linkText: e.target.value } })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200"
                        />
                      </div>
                      <div>
                        <label className="block text-neutral-400 mb-1">Destination URL / Anchor</label>
                        <input
                          type="text"
                          value={editDb.banner?.linkUrl || ''}
                          onChange={(e) => setEditDb({ ...editDb, banner: { ...editDb.banner, linkUrl: e.target.value } })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200"
                        />
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}