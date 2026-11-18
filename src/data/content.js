// Everything you see on the page lives here.
// Edit text, add or remove projects, reorder things — no component changes needed.
//
// To load this from your admin panel instead, set REMOTE_CONTENT_URL below.
// The endpoint must return JSON in the same shape as `content` and allow CORS.

export const REMOTE_CONTENT_URL = null; // e.g. "https://4helio.xyz/api/content"

export const content = {
  hero: {
    name: "Helio Leles",
    subtitle: "Embedded hardware & software developer",
  },

  about: {
    text: "I build embedded systems, web apps and creative tech.",
    muted: "Self-taught, coding since I was nine.",
  },

  // Words that scroll across the marquee
  marquee: ["Embedded", "ESP32", "Web apps", "Creative tech", "Hardware"],

  // Add `href` to make a row clickable
  projects: [
    {
      title: "Memblu: Photop Revived",
      tag: "Software",
      status: "Beta, mostly complete.",
      description:
        "Memblu aims to be a full revival of an older, archived version of Exotek's flagship social platform, Photop. It also introduces some extra features to enhance the user experience that did not exist in the original implementation of Photop.",
      href: "https://github.com/Memblu/Memblu",
      tags: ["social network", "Photop", "revival", "open source"],
    },
    {
      title: "Memblu Music",
      tag: "Software",
      status: "In Progress",
      description:
        "Memblu Music is a free-forever, self-hosted ad-free music streaming platform with offline song downloads and local playlists.",
      href: "https://github.com/Memblu/MembluMusic",
      tags: ["music streaming", "self-hosted", "offline", "open source"],
    },
    {
      title: "IntervalMessages",
      tag: "Software",
      status: "Complete",
      description:
        "IntervalMessages is a Minecraft plugin that sends a random message from a catalog, which is defined in the configuration, in intervals of [x] amount of seconds and continuously sends random messages from the catalog every [x] amount seconds. IntervalMessages is compatible with any Bukkit, Paper, Spigot, Purpur, or Folia server with a version higher than 1.7.3.",
      href: "https://github.com/NullClock/IntervalMessages",
      tags: ["Minecraft", "Bukkit", "plugin", "Java"],
    },
    {
      title: "Attennda",
      tag: "Software",
      status: "In Progress",
      description:
        "Ultra-simplified minimalistic attendance software designed for special events or for logging optional visitors. Attennda is not designed for classrooms or educational institutions.",
      href: "https://github.com/columnlabs/Attennda",
      tags: ["attendance", "events", "software", "minimalist"],
    },
  ],

  // Shown in the social links section. `disabled: true` keeps a row but removes the link.
  socials: [
    { name: "TikTok", handle: "@unt3thered", href: "https://tiktok.com/@unt3thered" },
    { name: "GitHub", handle: "NullClock", href: "https://github.com/NullClock" },
    { name: "WhatsApp", handle: "+12154105236", href: "https://wa.me/12154105236" },
    { name: "Instagram", handle: "@heliosinterlude", href: "https://instagram.com/heliosinterlude" },
    { name: "Threads", handle: "@4helio", href: "https://threads.net/4helio" },
    {
      name: "Spotify",
      handle: "Helio L.",
      href: "https://open.spotify.com/user/315oayb37go2arm4g536d6qwaste?si=AUFoqqc1Rju8zRo_1YNnsQ&utm_source=copy-link",
    },
  ],

  // Featured songs. Previews play only when a song is clicked — nothing autoplays.
  songs: [
    {
      title: "My Moon My Man",
      artist: "Feist",
      albumArt: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/cc/f4/46/ccf44641-40d8-018d-1bb2-e86ed8b7beeb/00602547820976.rgb.jpg/600x600bb.jpg",
      previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/33/7d/02/337d02cf-f907-9a04-e132-d86fcbedee2e/mzaf_246558201187652344.plus.aac.p.m4a",
    },
    {
      title: "D>E>A>T>H>M>E>T>A>L",
      artist: "Panchiko",
      albumArt: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/17/5b/3b/175b3b35-50e8-0ea1-4a2b-0586cc1ef22d/5057805565994.png/600x600bb.jpg",
      previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/de/43/b9/de43b986-50df-88d0-aa79-0d04d43524e7/mzaf_14366313128379069706.plus.aac.p.m4a",
    },
    {
      title: "Purple Rain",
      artist: "Prince & The Revolution",
      albumArt: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/c1/b6/79/c1b679f5-d59d-1b3e-62ab-514de20f06c6/093624912002.jpg/600x600bb.jpg",
      previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/4a/70/9b/4a709b41-3c29-626a-ca69-44aa907f4705/mzaf_14388295257133509788.plus.aac.p.m4a",
    },
    {
      title: "Eyes Without a Face",
      artist: "Billy Idol",
      albumArt: "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/18/05/fe/1805fea9-58d8-502a-573b-5711473bd5e4/13UABIM74015.rgb.jpg/600x600bb.jpg",
      previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/61/4d/9b/614d9b3d-82c6-2183-a489-d56df126f690/mzaf_7787246035851715094.plus.aac.p.m4a",
    },
    {
      title: "Deixe Me Ir (Acústico)",
      artist: "1Kilo, Knust & Baviera",
      albumArt: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/23/ec/67/23ec6702-63d6-3de3-c7c0-51a1c385efa1/0.jpg/600x600bb.jpg",
      previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/1e/86/01/1e8601c2-96fa-5f51-f121-96204e2d1616/mzaf_11121955491782347892.plus.aac.p.m4a",
    },
    {
      title: "Another One",
      artist: "Mac DeMarco",
      albumArt: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/d8/68/9b/d8689b2a-f26c-cf97-e6d9-6073cf95b497/cover.jpg/600x600bb.jpg",
      previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/a7/2c/f4/a72cf406-f6b3-850a-7547-53ba33d1f4f0/mzaf_11076555550762957468.plus.aac.p.m4a",
    },
    {
      title: "Lover, You Should've Come Over",
      artist: "Jeff Buckley",
      albumArt: "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/99/d6/ab/99d6abb0-4837-f397-3f56-c7dfd627e23e/886447700778.jpg/600x600bb.jpg",
      previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/df/5e/8c/df5e8cd0-f71f-a45c-7232-f64486186bbd/mzaf_11849133431079042153.plus.aac.p.m4a",
    },
    {
      title: "Transform (feat. Charlotte Day Wilson)",
      artist: "Daniel Caesar",
      albumArt: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b6/cd/1a/b6cd1a5b-83af-a1e2-0ad7-ea530fcf2522/859722261219.jpg/600x600bb.jpg",
      previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/12/82/4b/12824bb3-0045-356d-98cc-0d516ecd6121/mzaf_4685624648406533826.plus.aac.p.m4a",
    },
    {
      title: "No. 1 Party Anthem",
      artist: "Arctic Monkeys",
      albumArt: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/9c/b5/699cb5d6-115c-ff73-9d26-e57ea4350d72/887828031795.png/600x600bb.jpg",
      previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/ea/32/b4/ea32b4ce-8211-8e63-024e-cf18c42e2eda/mzaf_15252909301723072031.plus.aac.p.m4a",
    },
  ],

  contact: { label: "4helio.xyz", href: "https://4helio.xyz/" },

  footer: { location: "Philadelphia" },
};
