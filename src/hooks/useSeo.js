import { useEffect } from "react";
import { applySeo, buildSeo } from "../seo";

// Keeps <title>, social cards, canonical URLs and JSON-LD in sync with the content.
export default function useSeo(content) {
  useEffect(() => {
    applySeo(buildSeo(content));
  }, [content]);
}
