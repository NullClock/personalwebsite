// Mappers from the server (db.json) shape to the shape the public components use.
// The server is the only source of truth for projects, songs and socials. Nothing is cached
// in localStorage, so there is no per-browser copy that can drift from what other devices see.

export const CONTENT_EVENT = "portfolio:content";

// Called after a successful admin save so the open page refetches from the server.
export function notifyContentChanged() {
  window.dispatchEvent(new Event(CONTENT_EVENT));
}

/* Server (db.json) shape -> shape used by the public components. */

export function toSiteProjects(items = []) {
  return items.map((item) => ({
    id: item.id,
    title: item.title || "",
    tag: item.category || "Software",
    status: item.status || "",
    description: item.description || "",
    tags: item.tags || [],
    href: item.link || "",
  }));
}

export function toSiteSongs(items = []) {
  return items.map((item) => ({
    id: item.id,
    title: item.title || "",
    artist: item.artist || "",
    albumArt: item.albumArt || "",
    previewUrl: item.previewUrl || "",
    note: item.note || "",
  }));
}

export function toSiteSocials(items = []) {
  return items.map((item) => ({
    id: item.id,
    name: item.name || "",
    handle: item.handle || "",
    href: item.href || "",
    disabled: Boolean(item.disabled),
  }));
}