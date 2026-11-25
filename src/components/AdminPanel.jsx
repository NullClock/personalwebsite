import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { apiJson } from "../api";
import { searchSongs } from "../trackMedia";
import { notifyContentChanged } from "../data/contentStore";
import useSecretTrigger from "../hooks/useSecretTrigger";
import "../styles/AdminPanel.css";

const TABS = ["Songs", "Socials", "Projects", "History"];

const blankSocial = () => ({
  id: `soc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  name: "",
  handle: "",
  href: "https://",
  disabled: false,
});

const blankProject = () => ({
  id: `proj-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  title: "",
  category: "Software",
  status: "",
  description: "",
  tags: [],
  link: "https://",
});

export default function AdminPanel() {
  const [open, setOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [db, setDb] = useState(null);
  const [tab, setTab] = useState(TABS[0]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const pinRef = useRef("");
  const scrollRef = useRef(null);

  useSecretTrigger(() => {
    if (!open) setOpen(true);
  });

  const close = () => {
    setOpen(false);
    setUnlocked(false);
    setDb(null);
    setPin("");
    setAuthError("");
    setStatus("");
    pinRef.current = "";
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const verify = async (event) => {
    event.preventDefault();
    setAuthError("");
    setVerifying(true);
    try {
      await apiJson("/admin/verify", { method: "POST", body: JSON.stringify({ pin }) });
      const data = await apiJson("/data");
      pinRef.current = pin;
      setDb(data);
      setUnlocked(true);
      setPin("");
    } catch {
      setAuthError("Incorrect passcode.");
    } finally {
      setVerifying(false);
    }
  };

  const setList = (key, next) => setDb((prev) => ({ ...prev, [key]: next }));
  const patchItem = (key, index, patch) =>
    setDb((prev) => ({
      ...prev,
      [key]: prev[key].map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));

  const save = async () => {
    if (!db) return;
    setSaving(true);
    setStatus("");
    try {
      await apiJson("/db", {
        method: "PUT",
        headers: { "x-admin-pin": pinRef.current },
        body: JSON.stringify(db),
      });
      notifyContentChanged();
      setStatus("Saved.");
    } catch {
      setStatus("Save failed — check the connection and passcode.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <a
        className="admin-mobile-link"
        href="#admin"
        onClick={(event) => {
          event.preventDefault();
          if (!open) setOpen(true);
        }}
      >
        admin
      </a>

      {open && (
        <div className="admin-shell" role="dialog" aria-modal="true" aria-label="Admin panel">
          <header className="admin-head">
            <span>Admin</span>
            <button type="button" className="admin-close" onClick={close} aria-label="Close admin panel">×</button>
          </header>
    
          {!unlocked ? (
            <form className="admin-gate" onSubmit={verify}>
              <p className="admin-label">Passcode</p>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                aria-label="Server passcode"
              />
              <button type="submit" disabled={verifying || !pin}>
                {verifying ? "Checking…" : "Unlock"}
              </button>
              {authError && <p className="admin-error">{authError}</p>}
            </form>
          ) : (
            <div className="admin-body">
              <nav className="admin-tabs" aria-label="Admin sections">
                {TABS.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={tab === name ? "is-active" : ""}
                    onClick={() => setTab(name)}
                  >
                    {name}
                  </button>
                ))}
              </nav>
    
              <div className="admin-scroll" ref={scrollRef}>
                {tab === "Songs" && <SongsEditor db={db} setList={setList} patchItem={patchItem} />}
                {tab === "Socials" && <SocialsEditor db={db} setList={setList} patchItem={patchItem} />}
                {tab === "Projects" && <ProjectsEditor db={db} setList={setList} patchItem={patchItem} />}
            {tab === "History" && <HistoryEditor pinRef={pinRef} scrollRef={scrollRef} />}
              </div>
    
              <footer className="admin-actions">
                <button type="button" className="admin-save" onClick={save} disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
                {status && <span className="admin-status">{status}</span>}
              </footer>
            </div>
          )}
        </div>
        )}
    </>
  );
}

/* Songs ------------------------------------------------------------------ */

function SongsEditor({ db, setList }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const search = async (event) => {
    event.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    try {
      setResults(await searchSongs(query.trim(), 8));
    } catch {
      setError("Search failed. Try again.");
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const add = (song) => {
    if (db.songs.some((item) => item.id === song.id)) return;
    setList("songs", [...db.songs, { ...song, note: song.note || "Added via Admin" }]);
  };

  const remove = (index) => setList("songs", db.songs.filter((_, i) => i !== index));

  return (
    <div className="admin-panel">
      <p className="admin-label">Featured songs</p>
      <ul className="admin-list">
        {db.songs.map((song, i) => (
          <li key={song.id || i} className="admin-item">
            {song.albumArt && <img src={song.albumArt} alt="" loading="lazy" decoding="async" />}
            <span className="admin-item-main">
              <strong>{song.title}</strong>
              <small>{song.artist}</small>
            </span>
            <button type="button" className="admin-mini" onClick={() => remove(i)} aria-label={`Remove ${song.title}`}>Remove</button>
          </li>
        ))}
        {!db.songs.length && <li className="admin-empty">No songs yet.</li>}
      </ul>

      <form className="admin-search" onSubmit={search}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search iTunes for a song…" aria-label="Search iTunes" />
        <button type="submit" disabled={searching || !query.trim()}>{searching ? "Searching…" : "Search"}</button>
      </form>
      {error && <p className="admin-error">{error}</p>}

      {results.length > 0 && (
        <ul className="admin-list admin-results">
          {results.map((song) => (
            <li key={song.id} className="admin-item">
              {song.albumArt && <img src={song.albumArt} alt="" loading="lazy" decoding="async" />}
              <span className="admin-item-main">
                <strong>{song.title}</strong>
                <small>{song.artist}</small>
              </span>
              <button
                type="button"
                className="admin-mini"
                onClick={() => add(song)}
                disabled={db.songs.some((item) => item.id === song.id)}
              >
                {db.songs.some((item) => item.id === song.id) ? "Added" : "Add"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* Socials ---------------------------------------------------------------- */

function SocialsEditor({ db, setList, patchItem }) {
  return (
    <div className="admin-panel">
      <p className="admin-label">Social links</p>
      <ul className="admin-list admin-edit-list">
        {db.socials.map((social, i) => (
          <li key={social.id || i} className="admin-edit-item">
            <div className="admin-fields">
              <label>Name<input value={social.name || ""} onChange={(e) => patchItem("socials", i, { name: e.target.value })} /></label>
              <label>Handle<input value={social.handle || ""} onChange={(e) => patchItem("socials", i, { handle: e.target.value })} /></label>
              <label>URL<input value={social.href || ""} onChange={(e) => patchItem("socials", i, { href: e.target.value })} /></label>
              <label className="admin-check">
                <input type="checkbox" checked={Boolean(social.disabled)} onChange={(e) => patchItem("socials", i, { disabled: e.target.checked })} />
                Disabled
              </label>
            </div>
            <button type="button" className="admin-mini" onClick={() => setList("socials", db.socials.filter((_, index) => index !== i))}>Remove</button>
          </li>
        ))}
      </ul>
      <button type="button" className="admin-add" onClick={() => setList("socials", [...db.socials, blankSocial()])}>+ Add social link</button>
    </div>
  );
}

/* Projects --------------------------------------------------------------- */

function ProjectsEditor({ db, setList, patchItem }) {
  const setTags = (index, value) =>
    patchItem("projects", index, { tags: value.split(",").map((tag) => tag.trim()).filter(Boolean) });

  return (
    <div className="admin-panel">
      <p className="admin-label">Projects</p>
      <ul className="admin-list admin-edit-list">
        {db.projects.map((project, i) => (
          <li key={project.id || i} className="admin-edit-item">
            <div className="admin-fields">
              <label>Title<input value={project.title || ""} onChange={(e) => patchItem("projects", i, { title: e.target.value })} /></label>
              <label>Category<input value={project.category || ""} onChange={(e) => patchItem("projects", i, { category: e.target.value })} /></label>
              <label>Status<input value={project.status || ""} onChange={(e) => patchItem("projects", i, { status: e.target.value })} /></label>
              <label>Description<textarea rows="3" value={project.description || ""} onChange={(e) => patchItem("projects", i, { description: e.target.value })} /></label>
              <label>Tags<input value={(project.tags || []).join(", ")} onChange={(e) => setTags(i, e.target.value)} /></label>
              <label>Link<input value={project.link || ""} onChange={(e) => patchItem("projects", i, { link: e.target.value })} /></label>
            </div>
            <button type="button" className="admin-mini" onClick={() => setList("projects", db.projects.filter((_, index) => index !== i))}>Remove</button>
          </li>
        ))}
      </ul>
      <button type="button" className="admin-add" onClick={() => setList("projects", [...db.projects, blankProject()])}>+ Add project</button>
    </div>
  );
}

/* History ---------------------------------------------------------------- */

const HISTORY_LIMIT = 30;
const HISTORY_KEYS = {
  title: "android.media.metadata.TITLE",
  artist: "android.media.metadata.ARTIST",
  album: "android.media.metadata.ALBUM",
  art: ["android.media.metadata.ALBUM_ART_URI", "android.media.metadata.ART_URI"],
};

function historyArt(item) {
  return HISTORY_KEYS.art.map((key) => item[key]).find((url) => /^https?:\/\//i.test(url || "")) || "";
}

function HistoryEditor({ pinRef, scrollRef }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async ({ reset = false } = {}) => {
    if (loading) return;
    if (!reset && cursor === null) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: String(HISTORY_LIMIT) });
      if (!reset && cursor !== null) params.set("before", String(cursor));
      const data = await apiJson(`/nowplaying/history?${params}`);
      const fresh = Array.isArray(data?.items) ? data.items : [];
      setItems((prev) => (reset ? fresh : [...prev, ...fresh]));
      setTotal(Number(data?.total) || 0);
      setHasMore(Boolean(data?.hasMore));
      setCursor(data?.hasMore ? data.nextBefore : null);
    } catch {
      setError("Could not load history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load({ reset: true });
    // Only load once when the tab mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const authHeaders = { "x-admin-pin": pinRef.current };

  const remove = async (item) => {
    const deletedIndex = Number(item.historyId);
    if (!Number.isInteger(deletedIndex)) return;

    // Remember the row's geometry so removing it doesn't yank the page around.
    const container = scrollRef.current;
    const row = container?.querySelector(`[data-history-id="${deletedIndex}"]`);
    let scrollTopBefore = 0;
    let rowHeight = 0;
    let rowOffsetTop = 0;
    if (container && row) {
      scrollTopBefore = container.scrollTop;
      const rowRect = row.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      rowOffsetTop = rowRect.top - containerRect.top + scrollTopBefore;
      rowHeight = rowRect.height;
    }
    const rowIsVisible = row && rowOffsetTop < scrollTopBefore + (container?.clientHeight || 0);

    setBusy(true);
    setError("");
    try {
      await apiJson(`/nowplaying/history/single?index=${encodeURIComponent(deletedIndex)}`, {
        method: "DELETE",
        headers: authHeaders,
      });

      // The server splices the array, so every later index shifts down by one.
      // Patch the loaded rows and the paging cursor locally instead of refetching.
      const nextCursor = cursor === null ? null : deletedIndex < cursor ? cursor - 1 : cursor;
      flushSync(() => {
        setItems((prev) =>
          prev
            .filter((entry) => Number(entry.historyId) !== deletedIndex)
            .map((entry) =>
              Number(entry.historyId) > deletedIndex
                ? { ...entry, historyId: Number(entry.historyId) - 1 }
                : entry
            )
        );
        setTotal((prev) => Math.max(0, prev - 1));
        setCursor(nextCursor);
        setHasMore(hasMore && nextCursor !== null && nextCursor > 0);
      });

      if (rowIsVisible && container) {
        container.scrollTop = Math.max(0, scrollTopBefore - rowHeight);
      }
    } catch {
      setError("Could not delete that entry.");
    } finally {
      setBusy(false);
    }
  };

  const clearAll = async () => {
    if (!window.confirm("Clear the entire song history?")) return;
    setBusy(true);
    setError("");
    try {
      await apiJson("/nowplaying/history", { method: "DELETE", headers: authHeaders });
      setItems([]);
      setTotal(0);
      setCursor(null);
      setHasMore(false);
    } catch {
      setError("Could not clear history.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-panel">
      <p className="admin-label">Listening history</p>

      <div className="admin-history-toolbar">
        <button type="button" className="admin-mini" onClick={() => load({ reset: true })} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
        <button type="button" className="admin-mini" onClick={clearAll} disabled={busy || !items.length}>
          Clear all
        </button>
        <span className="admin-count">{total} played</span>
      </div>

      {error && <p className="admin-error">{error}</p>}

      <ul className="admin-list">
        {items.map((item, i) => {
          const title = item[HISTORY_KEYS.title] || "Untitled";
          const artist = item[HISTORY_KEYS.artist] || "";
          const album = item[HISTORY_KEYS.album] || "";
          const art = historyArt(item);
          return (
            <li key={item.historyId ?? i} data-history-id={item.historyId} className="admin-item">
              {art && <img src={art} alt="" loading="lazy" decoding="async" />}
              <span className="admin-item-main">
                <strong>{title}</strong>
                <small>{artist}</small>
                <span className="admin-history-id">#{item.historyId}{album ? ` · ${album}` : ""}</span>
              </span>
              <button
                type="button"
                className="admin-mini"
                onClick={() => remove(item)}
                disabled={busy}
              >
                Delete
              </button>
            </li>
          );
        })}
        {!items.length && !loading && <li className="admin-empty">No history yet.</li>}
      </ul>

      {hasMore && (
        <button type="button" className="admin-add" onClick={() => load()} disabled={loading}>
          Load more
        </button>
      )}
    </div>
  );
}
