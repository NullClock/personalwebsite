// The public site ships with hardcoded content in content.js. Admin edits are cached
// locally and dispatched to useContent, so the site stays static unless someone edits it.

export const OVERRIDE_KEY = "portfolio-admin-content-v1";

export function readContentOverride() {
  try {
    return JSON.parse(window.localStorage.getItem(OVERRIDE_KEY)) || null;
  } catch {
    return null;
  }
}

export function writeContentOverride({ socials = [], songs = [], projects = [] }) {
  const payload = {
    socials: toSiteSocials(socials),
    songs: toSiteSongs(songs),
    projects: toSiteProjects(projects),
  };
  window.localStorage.setItem(OVERRIDE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new Event("portfolio:content"));
  return payload;
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
