import { useEffect, useState } from "react";
import { content as staticContent } from "../data/content";
import { apiJson } from "../api";
import {
  CONTENT_EVENT,
  toSiteProjects,
  toSiteSongs,
  toSiteSocials,
} from "../data/contentStore";

// Projects, featured songs and socials come ONLY from the server (db.json via GET /api/data).
// Nothing is cached in the browser, so every device shows exactly what the admin panel saved.
// Until the first response arrives those three sections are empty rather than showing stale
// hardcoded data. Everything else (hero text, story, etc.) still comes from content.js.
const EMPTY_SERVER_CONTENT = { projects: [], songs: [], socials: [] };

export default function useContent() {
  const [serverContent, setServerContent] = useState(EMPTY_SERVER_CONTENT);

  useEffect(() => {
    let controller = null;

    const load = async () => {
      controller?.abort();
      controller = new AbortController();
      try {
        const db = await apiJson("/data", {
          signal: controller.signal,
          cache: "no-store",
        });
        setServerContent({
          projects: toSiteProjects(db?.projects),
          songs: toSiteSongs(db?.songs),
          socials: toSiteSocials(db?.socials),
        });
      } catch (err) {
        // Keep whatever is already on screen if the server can't be reached.
        if (err?.name !== "AbortError") console.error("Failed to load site content:", err);
      }
    };

    load();
    // The admin panel fires this after a successful save so the open tab refetches from the server.
    window.addEventListener(CONTENT_EVENT, load);
    return () => {
      controller?.abort();
      window.removeEventListener(CONTENT_EVENT, load);
    };
  }, []);

  return { ...staticContent, ...serverContent };
}