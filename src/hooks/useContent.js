import { useEffect, useState } from "react";
import { content as localContent, REMOTE_CONTENT_URL } from "../data/content";
import { readContentOverride } from "../data/contentStore";

const withOverride = (base) => ({ ...base, ...(readContentOverride() || {}) });

// Returns local content immediately, then swaps in remote content if a URL is set.
// Admin edits (stored locally) always win, so saved changes show up on the next render.
export default function useContent() {
  const [content, setContent] = useState(() => withOverride(localContent));

  useEffect(() => {
    const onAdminUpdate = () => setContent(withOverride(localContent));
    window.addEventListener("portfolio:content", onAdminUpdate);
    return () => window.removeEventListener("portfolio:content", onAdminUpdate);
  }, []);

  useEffect(() => {
    if (!REMOTE_CONTENT_URL) return;
    fetch(REMOTE_CONTENT_URL)
      .then((res) => res.json())
      .then((remote) => setContent(withOverride({ ...localContent, ...remote })))
      .catch(() => {}); // keep local content if the request fails
  }, []);

  return content;
}
