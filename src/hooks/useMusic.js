import { useCallback, useEffect, useRef, useState } from "react";
import { apiJson } from "../api";

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
  const loading = useRef(false);

  const loadHistory = useCallback(async ({ reset = false } = {}) => {
    if (loading.current) return;
    if (!reset && nextBefore.current === null) return;

    loading.current = true;
    setLoadingHistory(true);
    setHistoryError(false);

    try {
      const query = new URLSearchParams({ limit: String(HISTORY_LIMIT) });
      if (!reset && nextBefore.current !== null) query.set("before", String(nextBefore.current));

      const data = await apiJson(`/nowplaying/history?${query}`);
      const items = (Array.isArray(data.items) ? data.items : []).map(normalizeHistoryItem);

      setHistory((prev) => {
        if (reset) return items;
        const ids = new Set(prev.map((item) => item.id));
        return [...prev, ...items.filter((item) => !ids.has(item.id))];
      });
      setHasMore(Boolean(data.hasMore));
      nextBefore.current = data.hasMore ? data.nextBefore : null;
    } catch {
      setHistoryError(true);
    } finally {
      loading.current = false;
      setLoadingHistory(false);
    }
  }, []);

  const refreshHistory = useCallback(() => loadHistory({ reset: true }), [loadHistory]);
  const loadMore = useCallback(() => loadHistory(), [loadHistory]);

  return {
    track,
    history,
    hasMore,
    loadingHistory,
    historyError,
    refreshHistory,
    loadMore,
  };
}
