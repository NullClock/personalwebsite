// One source of truth for metadata. index.html ships a static version for crawlers;
// this keeps it in sync when content changes (including admin edits).

const FALLBACK_NAME = "Helio Leles";
const FALLBACK_SUBTITLE = "Embedded Hardware & Software Developer";
const FALLBACK_LOCATION = "Philadelphia";
const SITE_NAME = "4helio.xyz";
const IMAGE_ALT = "Helio Leles — embedded hardware and software developer";
const DATE_MODIFIED = "2026-11-18";

const configuredSiteUrl = (import.meta.env.VITE_SITE_URL || "").replace(/\/+$/, "");

if (!configuredSiteUrl) {
  throw new Error("VITE_SITE_URL is required. Copy .env.example to .env and set it.");
}

export const SITE_URL = configuredSiteUrl + "/";

const absolute = (path = "") => `${SITE_URL}${String(path).replace(/^\/+/, "")}`;
const id = (hash) => `${SITE_URL}${hash}`;

function meta(attribute, key, value) {
  if (value == null || value === "") return;
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", String(value));
}

function link(attribute, key, value) {
  let element = document.head.querySelector(`link[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("link");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("href", value);
}

function alternate(hreflang, href) {
  let element = document.head.querySelector(`link[rel="alternate"][hreflang="${hreflang}"]`);
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "alternate");
    element.setAttribute("hreflang", hreflang);
    document.head.appendChild(element);
  }
  element.setAttribute("href", href);
}

const cleanList = (items) =>
  [...new Set((items || []).map((item) => String(item || "").trim()).filter(Boolean))];

export function buildSeo(content = {}) {
  const hero = content.hero || {};
  const about = content.about || {};
  const story = content.story || {};
  const names = content.names || {};
  const footer = content.footer || {};
  const projects = Array.isArray(content.projects) ? content.projects : [];
  const songs = Array.isArray(content.songs) ? content.songs : [];
  const socials = (Array.isArray(content.socials) ? content.socials : []).filter(
    (social) => !social.disabled && /^https?:\/\//i.test(social.href || "")
  );

  const name = hero.name || FALLBACK_NAME;
  const subtitle = hero.subtitle || FALLBACK_SUBTITLE;
  const location = footer.location || FALLBACK_LOCATION;
  const title = `${name} — ${subtitle}`;
  const description = `Live workbench and portfolio of ${name}: embedded systems, ESP32 hardware builds, web apps, and creative tech projects. Based in ${location}.`;
  const personDescription =
    [about.text, about.muted, ...((Array.isArray(story.paragraphs) ? story.paragraphs : []).slice(0, 1))]
      .filter(Boolean)
      .join(" ") || description;
  const knownNames = cleanList([name, ...(Array.isArray(names.items) ? names.items : [])]);
  const image = absolute("uploads/og-image.png");
  const url = SITE_URL;

  const keywords = cleanList([
    ...knownNames,
    subtitle,
    location,
    "portfolio",
    "workbench",
    "embedded systems",
    "ESP32",
    "web apps",
    ...(Array.isArray(content.marquee) ? content.marquee : []),
    ...projects.map((project) => project.tag),
    ...projects.flatMap((project) => project.tags || []),
  ]).join(", ");

  const graph = [
    {
      "@type": "Person",
      "@id": id("#person"),
      name,
      alternateName: knownNames.filter((alias) => alias !== name),
      nationality: { "@type": "Country", name: "Brazil" },
      url,
      jobTitle: subtitle,
      description: personDescription,
      knowsAbout: cleanList([
        ...(Array.isArray(content.marquee) ? content.marquee : []),
        projects.map((project) => project.tag),
      ].flat()),
      sameAs: socials.map((social) => social.href),
    },
    {
      "@type": "WebSite",
      "@id": id("#website"),
      url,
      name: SITE_NAME,
      description,
      publisher: { "@id": id("#person") },
      inLanguage: "en-US",
    },
    {
      "@type": ["WebPage", "ProfilePage"],
      "@id": id("#webpage"),
      url,
      name: title,
      description,
      isPartOf: { "@id": id("#website") },
      about: { "@id": id("#person") },
      mainEntity: { "@id": id("#person") },
      inLanguage: "en-US",
      dateModified: DATE_MODIFIED,
      primaryImageOfPage: {
        "@type": "ImageObject",
        url: image,
        width: 1000,
        height: 1399,
      },
    },
    {
      "@type": "ItemList",
      "@id": id("#work"),
      name: "Selected work",
      numberOfItems: projects.length,
      itemListElement: projects.map((project, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "CreativeWork",
          name: project.title,
          description: project.description,
          genre: project.tag,
          ...(project.href ? { url: project.href } : {}),
        },
      })),
    },
    {
      "@type": "ItemList",
      "@id": id("#music"),
      name: "Featured songs",
      numberOfItems: songs.length,
      itemListElement: songs.map((song, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "MusicRecording",
          name: song.title,
          byArtist: { "@type": "MusicGroup", name: song.artist },
          ...(song.albumArt ? { image: song.albumArt } : {}),
        },
      })),
    },
  ];

  return { title, description, keywords, author: name, url, image, imageAlt: IMAGE_ALT, siteName: SITE_NAME, graph };
}

export function applySeo(seo) {
  document.documentElement.lang = "en";
  document.title = seo.title;

  meta("name", "description", seo.description);
  meta("name", "keywords", seo.keywords);
  meta("name", "author", seo.author);
  meta("name", "creator", seo.author);
  meta("name", "publisher", seo.author);

  meta("property", "og:type", "website");
  meta("property", "og:site_name", seo.siteName);
  meta("property", "og:locale", "en_US");
  meta("property", "og:url", seo.url);
  meta("property", "og:title", seo.title);
  meta("property", "og:description", seo.description);
  meta("property", "og:image", seo.image);
  meta("property", "og:image:secure_url", seo.image);
  meta("property", "og:image:type", "image/png");
  meta("property", "og:image:width", 1000);
  meta("property", "og:image:height", 1399);
  meta("property", "og:image:alt", seo.imageAlt);

  meta("name", "twitter:card", "summary_large_image");
  meta("name", "twitter:url", seo.url);
  meta("name", "twitter:title", seo.title);
  meta("name", "twitter:description", seo.description);
  meta("name", "twitter:image", seo.image);
  meta("name", "twitter:image:alt", seo.imageAlt);

  link("rel", "canonical", seo.url);
  alternate("en", seo.url);
  alternate("x-default", seo.url);

  let script = document.getElementById("seo-json-ld");
  if (!script) {
    script = document.createElement("script");
    script.id = "seo-json-ld";
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }
  // Prevent content containing "</script>" from breaking out of the JSON-LD block.
  script.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": seo.graph }).replace(/</g, "\\u003c");
}
