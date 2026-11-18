import { useEffect, useMemo, useRef, useState } from "react";
import useMusic from "../hooks/useMusic";
import "../styles/NowPlaying.css";

function Art({ src, small = false }) {
  return (
    <span className={`np-art${small ? " np-art--small" : ""}`} aria-hidden="true">
      <span className="np-art-fallback" />
      {src && <img key={src} src={src} alt="" width={small ? 40 : 52} height={small ? 40 : 52} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
    </span>
  );
}

// Collapse runs of the same song (newest first) so repeated plays read as one row.
function groupHistory(items) {
  const groups = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.key === item.key) last.count += 1;
    else groups.push({ id: item.id, item, count: 1 });
  }
  return groups;
}

function HistoryRow({ item, count }) {
  return (
    <li className="np-history-row">
      <Art src={item.art} small />
      <span className="np-history-meta">
        <span className="np-history-title" title={item.title}>{item.title}</span>
        <span className="np-history-artist" title={item.artist}>{item.artist || "Unknown artist"}</span>
      </span>
      {item.album && <span className="np-history-album" title={item.album}>{item.album}</span>}
      {count > 1 && <span className="np-count">×{count}</span>}
    </li>
  );
}

export default function NowPlayingBar() {
  const { track, history, hasMore, loadingHistory, historyError, refreshHistory, loadMore } = useMusic();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  const groups = useMemo(() => groupHistory(history), [history]);

  // Keep the list fresh while it's visible.
  useEffect(() => {
    if (!open) return undefined;
    refreshHistory();
    const id = setInterval(refreshHistory, 20000);
    return () => clearInterval(id);
  }, [open, refreshHistory]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e) => {
      if (panelRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <>
      {open && (
        <div className="np-history" role="dialog" aria-label="Song history" ref={panelRef}>
          <div className="np-history-head">
            <span>Song history</span>
            <span>{history.length} {history.length === 1 ? "track" : "tracks"}</span>
          </div>

          {groups.length ? (
            <ol className="np-history-list">
              {groups.map(({ id, item, count }) => (
                <HistoryRow key={id ?? item.key} item={item} count={count} />
              ))}
            </ol>
          ) : (
            <p className="np-empty">{historyError ? "History unavailable" : "Nothing here yet"}</p>
          )}

          {hasMore && (
            <button className="np-more" type="button" onClick={loadMore} disabled={loadingHistory}>
              {loadingHistory ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}

      <div className="np-bar">
        <div className="np-inner">
          <div className="np-current">
            <Art src={track.art} />
            <div className="np-meta">
              <span className="np-title" title={track.enabled ? track.title : undefined}>
                {track.enabled ? track.title : "Nothing playing"}
              </span>
              <span className="np-sub">
                <i className={`np-dot${track.enabled ? " is-live" : ""}`} aria-hidden="true" />
                <span>{track.enabled ? "Now playing" : "Offline"}</span>
                {track.artist && <span className="np-artist" title={track.artist}>/ {track.artist}</span>}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="np-toggle"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            ref={buttonRef}
          >
            <span>{open ? "Close" : "History"}</span>
            <span className={`np-chevron${open ? " is-open" : ""}`} aria-hidden="true">↑</span>
          </button>
        </div>
      </div>
    </>
  );
}
