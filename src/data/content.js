// Everything you see on the page lives here.
// Edit text, add or remove projects, reorder things — no component changes needed.
//
// Projects, featured songs and socials are NOT defined here: they live on the server
// (db.json) and are edited from the admin panel. See src/hooks/useContent.js.

export const content = {
  hero: {
    name: "Helio Leles",
    subtitle: "Embedded hardware & software developer",
  },

  about: {
    text: "I build embedded systems, web apps and creative tech.",
    muted: "Self-taught, coding since I was nine.",
  },

  // My story — shown just above the featured songs.
  story: {
    paragraphs: [
      "I'm Brazilian and I've been living in the US for a while now. I got into tech when I was nine, mostly by messing around with computers and wanting to know how they actually worked. Safe to say I never really got bored of it.",
      "By fourteen I was trying to turn it into my actual career/job. I built small things, broke most of them (or never finished them!), and figured out what I needed to fix them (sometimes not...). A lot of it was just me learning as I went  thru.",
      "My dad has been behind me the whole time. He encouraged it even when it was just some kid's hobby or just a boring curious project, and he's supported me through all of it since, both financially and mentally... I don't think I would've started as early as I did without him at all.",
    ],
  },

  // Names I go by. Also mirrored in the Person structured data as alternateName.
  names: {
    subtext: "only adding this here to improve google search lol",
    items: [
      "Helio Souza-Leles",
      "Helio Souza Leles",
      "Helio Souza",
      "Helio Meira de Souza Leles",
      "Helio Meira de Souza-Leles",
      "Helio Meira",
      "Helio Meira Leles",
      "Helio Meira Souza",
      "Helio M. Leles",
      "Helio M.",
      "Helio S.",
      "Helio L.",
    ],
  },

  // Words that scroll across the marquee
  marquee: ["Embedded", "ESP32", "Raspberry Pi", "Web apps", "Creative tech", "Hardware", "🇧🇷"],

  contact: { label: "4helio.xyz", href: "https://4helio.xyz/" },

  footer: { location: "Philadelphia" },
};