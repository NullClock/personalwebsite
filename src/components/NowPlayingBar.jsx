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

function TopRow({ rank, song }) {
  return (
    <li className="np-history-row">
      <span className="np-rank" aria-hidden="true">{rank}</span>
      <Art src={song.art} small />
      <span className="np-history-meta">
        <span className="np-history-title" title={song.title}>{song.title}</span>
        <span className="np-history-artist" title={song.artist}>{song.artist || "Unknown artist"}</span>
      </span>
      <span className="np-count">{song.plays} {song.plays === 1 ? "play" : "plays"}</span>
    </li>
  );
}

export default function NowPlayingBar() {
  const {
    track, history, hasMore, loadingHistory, historyError, resetHistory, refreshHistory, loadMore,
    top, topLoaded, topError, loadTop,
  } = useMusic();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("recent"); // "recent" | "top"
  const [topRange, setTopRange] = useState("week"); // "week" | "all"
  const panelRef = useRef(null);
  const actionsRef = useRef(null);

  const groups = useMemo(() => groupHistory(history), [history]);

  // Load a fresh list when the drawer opens, then keep the newest tracks up to date while it's
  // visible. The periodic refresh only merges new tracks in, so it never wipes the pages you've
  // loaded or moves your scroll position.
  useEffect(() => {
    if (!open) return undefined;
    resetHistory();
    const id = setInterval(refreshHistory, 20000);
    return () => clearInterval(id);
  }, [open, resetHistory, refreshHistory]);

  // Most played: load when that tab is showing, then keep it fresh while it's visible.
  useEffect(() => {
    if (!open || tab !== "top") return undefined;
    loadTop(topRange);
    const id = setInterval(() => loadTop(topRange), 20000);
    return () => clearInterval(id);
  }, [open, tab, topRange, loadTop]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e) => {
      if (panelRef.current?.contains(e.target) || actionsRef.current?.contains(e.target)) return;
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
        <div id="np-history-panel" className="np-history" role="dialog" aria-label="Song history" ref={panelRef}>
          <div className="np-history-head">
            <div className="np-tabs">
              <button type="button" className={`np-tab${tab === "recent" ? " is-active" : ""}`} aria-pressed={tab === "recent"} onClick={() => setTab("recent")}>
                History
              </button>
              <button type="button" className={`np-tab${tab === "top" ? " is-active" : ""}`} aria-pressed={tab === "top"} onClick={() => setTab("top")}>
                Most played
              </button>
            </div>
            <span>
              {tab === "recent"
                ? `${history.length} ${history.length === 1 ? "track" : "tracks"}`
                : topRange === "all" ? "All time" : "This week"}
            </span>
          </div>

          {tab === "recent" ? (
            <>
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
            </>
          ) : (
            <>
              <div className="np-range" role="group" aria-label="Most played time range">
                <button type="button" className={topRange === "week" ? "is-active" : ""} aria-pressed={topRange === "week"} onClick={() => setTopRange("week")}>
                  This week
                </button>
                <button type="button" className={topRange === "all" ? "is-active" : ""} aria-pressed={topRange === "all"} onClick={() => setTopRange("all")}>
                  All time
                </button>
              </div>
              {top.length ? (
                <ol className="np-history-list">
                  {top.map((song, i) => (
                    <TopRow key={song.id} rank={i + 1} song={song} />
                  ))}
                </ol>
              ) : (
                <p className="np-empty">
                  {topError ? "Most played unavailable" : topLoaded ? "Nothing played yet" : "Loading…"}
                </p>
              )}
            </>
          )}
        </div>
      )}

      <div className="np-bar">
        <div className="np-inner">
          <div className="np-current">
            <Art src={track.art} />
            <div className="np-meta">
              <span className="np-sub">
                <i className={`np-dot${track.enabled ? " is-live" : ""}`} aria-hidden="true" />
                <span>{track.enabled ? "Currently Listening" : "Offline"}</span>
                {/* {track.artist && <span className="np-artist" title={track.artist}>/ {track.artist}</span>} */}
              </span>
              <span className="np-title" title={track.enabled ? track.title : undefined}>
                {track.enabled ? track.title : "Nothing playing"}
              </span>
              <span className="np-sub">
                {/* <i className={`np-dot${track.enabled ? " is-live" : ""}`} aria-hidden="true" /> */}
                {/* <span>{track.enabled ? "Currently Listening" : "Offline"}</span> */}
                {track.artist && <span className="np-artist" title={track.artist}>/ {track.artist}</span>}
              </span>
            </div>
          </div>

          <div className="np-actions" ref={actionsRef}>
            <button
              type="button"
              className="np-toggle"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls="np-history-panel"
            >
              <span>{open ? "Close" : "History"}</span>
              <span className={`np-chevron${open ? " is-open" : ""}`} aria-hidden="true">↑</span>
            </button>
            <a
              className="np-top-link"
              href="#most-played"
              onClick={(e) => {
                e.preventDefault();
                setTab("top");
                setOpen(true);
              }}
            >
              Most played this week ↗
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
