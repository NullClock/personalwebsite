import { useEffect, useRef, useState } from 'react';
import { npLog, makeTrackKey, peekTrackMedia, canLookup, resolveTrackMedia } from './trackMedia';

/**
 * useNowPlaying(apiBase, { onTrackChange })
 *
 * Polls `${apiBase}/nowplaying` and returns the current song:
 *   { enabled, key, title, artist, albumArt, previewUrl }
 * albumArt / previewUrl are null until the lookup in trackMedia.js finishes.
 *
 * - Polls with a self-scheduling timeout (never overlapping requests).
 * - Slows down on metered / data-saver connections, pauses while the tab is hidden.
 * - Lookups only start when the track changes (or a cached entry expires), never per poll.
 * - onTrackChange fires whenever the song changes or disappears (used to stop the preview).
 */

export const FALLBACK_ART = '/uploads/ic.png';
export const NOW_PLAYING_ID = 'nwp';

const TITLE_KEY = 'android.media.metadata.TITLE';
const ARTIST_KEY = 'android.media.metadata.ARTIST';
const POLL_MS = 1000;
const POLL_METERED_MS = 10500;

const NO_SONG = { enabled: false, key: '', title: 'No Song', artist: 'N/A', albumArt: null, previewUrl: null };

function readIsMetered() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  // `type` is only exposed by some browsers; Safari has no navigator.connection at all.
  return conn ? Boolean(conn.saveData || conn.type === 'cellular') : false;
}

function useIsMetered() {
  const [isMetered, setIsMetered] = useState(readIsMetered);
  useEffect(() => {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return undefined;
    const update = () => setIsMetered(readIsMetered());
    conn.addEventListener('change', update);
    return () => conn.removeEventListener('change', update);
  }, []);
  return isMetered;
}

export function useNowPlaying(apiBase, { onTrackChange } = {}) {
  const [song, setSong] = useState(NO_SONG);
  const isMetered = useIsMetered();

  const onTrackChangeRef = useRef(onTrackChange);
  useEffect(() => {
    onTrackChangeRef.current = onTrackChange;
  });

  useEffect(() => {
    let cancelled = false;
    let timer = null;
    let running = false;
    let controller = null;

    let currentKey = '';     // track we are currently showing
    let appliedEntry = null; // last cache entry applied to the UI for that track

    const notifyTrackChange = () => {
      if (onTrackChangeRef.current) onTrackChangeRef.current();
    };

    const clearSong = () => {
      if (currentKey) {
        npLog('info', 'poll', 'no song playing');
        currentKey = '';
        appliedEntry = null;
        notifyTrackChange();
      }
      setSong((prev) => (prev.enabled ? NO_SONG : prev));
    };

    const applyMedia = (key, entry) => {
      if (cancelled || key !== currentKey || entry === appliedEntry) return;
      appliedEntry = entry;
      setSong((prev) =>
        prev.key === key ? { ...prev, albumArt: entry.albumArt, previewUrl: entry.previewUrl } : prev
      );
    };

    const fetchOnce = async (signal) => {
      const res = await fetch(`${apiBase}/nowplaying`, { signal });
      if (!res.ok) {
        clearSong();
        return;
      }

      const data = await res.json();
      const title = data[TITLE_KEY];
      const artist = data[ARTIST_KEY] || '';
      if (data.enabled === false || !title) {
        clearSong();
        return;
      }

      const key = makeTrackKey(title, artist);
      if (key !== currentKey) {
        npLog('info', 'poll', `track changed: "${title}" by "${artist}"`);
        currentKey = key;
        notifyTrackChange();
        const cached = peekTrackMedia(key);
        appliedEntry = cached;
        setSong({
          enabled: true,
          key,
          title,
          artist,
          albumArt: cached ? cached.albumArt : null,
          previewUrl: cached ? cached.previewUrl : null,
        });
      }

      const cached = peekTrackMedia(key);
      if (cached) {
        applyMedia(key, cached);
      } else if (canLookup(key)) {
        resolveTrackMedia(title, artist).then((entry) => {
          if (entry) applyMedia(key, entry);
        });
      }
    };

    const poll = async () => {
      if (cancelled || running) return;
      running = true;
      if (!document.hidden) {
        controller = new AbortController();
        try {
          await fetchOnce(controller.signal);
        } catch (err) {
          if (err?.name !== 'AbortError') {
            npLog('warn', 'poll', `request failed: ${err?.name}: ${err?.message}`);
            clearSong();
          }
        }
      }
      running = false;
      if (!cancelled) timer = setTimeout(poll, isMetered ? POLL_METERED_MS : POLL_MS);
    };

    const onVisibilityChange = () => {
      if (!document.hidden && !cancelled) {
        clearTimeout(timer);
        poll();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (controller) controller.abort();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [apiBase, isMetered]);

  return song;
}