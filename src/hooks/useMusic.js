import { useCallback, useEffect, useRef, useState } from "react";
import { apiJson } from "../api";
import { hasGap, mergeNewest } from "../historyMerge";

// Metadata keys posted by Tasker / the phone.
const TITLE_KEY = "android.media.metadata.TITLE";
const ARTIST_KEY = "android.media.metadata.ARTIST";
const ALBUM_KEY = "android.media.metadata.ALBUM";
const ART_KEYS = [
  "android.media.metadata.ALBUM_ART_URI",
  "android.media.metadata.ART_URI",
];

const POLL_MS = 4000;
const HISTORY_LIMIT = 30;
const TOP_DAYS = 7;
const TOP_ALL_DAYS = 0; // API sentinel: no date cutoff
const TOP_LIMIT = 10;

const EMPTY_TRACK = { enabled: false, key: "", title: "", artist: "", album: "", art: "" };

function isWebUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

// The API also sends a content:// Tasker URI, which a browser can't load.
// Only keep http(s) ones.
function pickArt(data) {
  if (!data) return "";
  return ART_KEYS.map((key) => data[key]).find(isWebUrl) || "";
}

function normalizeTrack(data) {
  if (!data || data.enabled === false || !data[TITLE_KEY]) return EMPTY_TRACK;
  const title = data[TITLE_KEY];
  const artist = data[ARTIST_KEY] || "";
  return {
    enabled: true,
    key: `${title}|${artist}`,
    title,
    artist,
    album: data[ALBUM_KEY] || "",
    art: pickArt(data),
  };
}

function normalizeHistoryItem(item) {
  return { ...normalizeTrack({ ...item, enabled: item.enabled !== false }), id: item.historyId };
}

// One row of "most played this week", already merged/ranked by the server.
function normalizeTopItem(item) {
  return {
    id: item.key,
    title: item.title || "",
    artist: item.artist || "",
    art: isWebUrl(item.art) ? item.art : "",
    plays: Number(item.plays) || 0,
  };
}

/**
 * Reads (never writes) the user's listening status from the backend.
 * The UI is display-only: there is no audio element and no progress tracking.
 */
export default function useMusic() {
  const [track, setTrack] = useState(EMPTY_TRACK);
  const [history, setHistory] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [top, setTop] = useState([]);
  const [topLoaded, setTopLoaded] = useState(false);
  const [topError, setTopError] = useState(false);

  // Poll the current track. Pauses while the tab is hidden and never overlaps requests.
  useEffect(() => {
    let cancelled = false;
    let timer = null;
    let running = false;
    let controller = null;

    const poll = async () => {
      if (cancelled || running) return;
      running = true;
      if (!document.hidden) {
        controller = new AbortController();
        try {
          const data = await apiJson("/nowplaying", { signal: controller.signal });
          if (!cancelled) setTrack(normalizeTrack(data));
        } catch (err) {
          if (err?.name !== "AbortError" && !cancelled) setTrack(EMPTY_TRACK);
        }
      }
      running = false;
      if (!cancelled) timer = setTimeout(poll, POLL_MS);
    };

    const onVisibilityChange = () => {
      if (!document.hidden && !cancelled && !running) poll();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  // History is paged newest-first with a stable `before` cursor.
  const nextBefore = useRef(null);
  const loading = useRef(false); // a reset or "load more" is in flight
  const refreshing = useRef(false); // a background refresh is in flight
  const newestId = useRef(null); // id of the newest track currently in the list

  useEffect(() => {
    newestId.current = history.length ? history[0].id : null;
  }, [history]);

  const fetchPage = useCallback(async (before) => {
    const query = new URLSearchParams({ limit: String(HISTORY_LIMIT) });
    if (before !== null && before !== undefined) query.set("before", String(before));
    const data = await apiJson(`/nowplaying/history?${query}`);
    return {
      items: (Array.isArray(data.items) ? data.items : []).map(normalizeHistoryItem),
      hasMore: Boolean(data.hasMore),
      nextBefore: data.hasMore ? data.nextBefore : null,
    };
  }, []);

  // Start over from the newest page. Used when the drawer opens.
  const resetHistory = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    setLoadingHistory(true);
    setHistoryError(false);
    try {
      const page = await fetchPage(null);
      setHistory(page.items);
      setHasMore(page.hasMore);
      nextBefore.current = page.nextBefore;
    } catch {
      setHistoryError(true);
    } finally {
      loading.current = false;
      setLoadingHistory(false);
    }
  }, [fetchPage]);

  // Append the next older page. Used by the "Load more" button.
  const loadMore = useCallback(async () => {
    if (loading.current || nextBefore.current === null) return;
    loading.current = true;
    setLoadingHistory(true);
    setHistoryError(false);
    try {
      const page = await fetchPage(nextBefore.current);
      setHistory((prev) => {
        const ids = new Set(prev.map((item) => item.id));
        return [...prev, ...page.items.filter((item) => !ids.has(item.id))];
      });
      setHasMore(page.hasMore);
      nextBefore.current = page.nextBefore;
    } catch {
      setHistoryError(true);
    } finally {
      loading.current = false;
      setLoadingHistory(false);
    }
  }, [fetchPage]);

  // Background refresh while the drawer is open. It only folds in the newest tracks and never
  // shrinks the list, so the pages you've loaded and your scroll position are left alone.
  // It is silent: no loading state, and a failed refresh just keeps what's on screen.
  const refreshHistory = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const page = await fetchPage(null);
      if (hasGap(newestId.current, page.items)) {
        // Too much happened to merge cleanly: start over from the fresh page.
        setHistory(page.items);
        setHasMore(page.hasMore);
        nextBefore.current = page.nextBefore;
      } else {
        // hasMore / nextBefore are deliberately untouched: they track how far you've paged.
        setHistory((prev) => mergeNewest(prev, page.items));
      }
    } catch {
      /* keep the current list */
    } finally {
      refreshing.current = false;
    }
  }, [fetchPage]);

  // "Most played this week". The server does the ranking and merges variants of the same song
  // (slowed, remasters, feat. credits, ...). The list is short and replaced wholesale, so a
  // background reload can't disturb scroll position the way a growing history list could.
  const loadTop = useCallback(async (range = "week") => {
    try {
      const days = range === "all" ? TOP_ALL_DAYS : TOP_DAYS;
      const data = await apiJson(`/nowplaying/top?days=${days}&limit=${TOP_LIMIT}`);
      setTop((Array.isArray(data.items) ? data.items : []).map(normalizeTopItem));
      setTopLoaded(true);
      setTopError(false);
    } catch {
      setTopError(true); // keep whatever is already shown
    }
  }, []);

  return {
    track,
    history,
    hasMore,
    loadingHistory,
    historyError,
    resetHistory,
    refreshHistory,
    loadMore,
    top,
    topLoaded,
    topError,
    loadTop,
  };
}
