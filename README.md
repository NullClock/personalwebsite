# Personal Website
This is my ultra minimalistic and animation-heavy personal website with a now playing feature that shows what I'm currently listening to,
an admin panel that lets you dynamically change content on the page and manage history + featured songs and social links,
and SEO optimizations to ensure maximum outreach.

### Performance?
Not so good on older/cheaper devices and clients. The website is animation heavy and it's also written in React so it's pretty heavy
on the client it's running on. There's no lag or performance overhead on newer machines though (not even my budget Chromebook struggles!)

## How does the now playing feature work?
It uses a custom Tasker workflow on the phone that detects media events/changes and sends them to the server. There's very little to no battery
drain or performance overhead since it's just Tasker and also isn't a constant streaming connection to the server, but rather a single HTTP
request (either POST or DELETE) when a song starts or stops.

## Most played this week
The History drawer has a "Most played" tab: your top songs from the last 7 days, ranked by play count. Variants of the same
song are merged into one row (`- Slowed`, `(feat. X)`, `- 2022 Remaster`, `Artist • Recommended for you`, ...), and ads, generic
"YouTube" entries and live streams are ignored. The merge rules live in `src/songKey.js`: add one-off fixes to its `ALIASES` table.
Incoming tracks are cleaned with those same rules before they're logged, so the live display and history use the same names as the ranking.

- The drawer has a "This week" / "All time" switcher above the list; all time uses `days=0` (no date cutoff).
- `GET /api/nowplaying/top?days=7&limit=10` returns the ranked list (public, read-only); `days=0` returns all time.
- Every logged play is stamped with `playedAt`. History from before that was added has no timestamp, so it can't count toward "this week".

## Why an admin panel?
To change things that would be inconvenient to go into the code every time a change was needed. For example:
  - Easier to manage song history (delete entries or clear history)
  - Easier to manage featured songs (just use the visual search instead of manually going in the db)
  - Easier to manage social links (just use the form instead of manually updating the code with your new socials)
  - AND MORE! Add what you need to add! You can do anything.

## Known quirks
Not much, but:
  - VERY slow on really cheap or really old devices.
  - If your phone goes down before Tasker can fire the DELETE request the song gets stuck
    - All you need to do in this situation is just play a song for 5 seconds when the phone comes back up and pause it it'll flush out
  - I don't know if the security is 100% airtight (I think so though)
  - The original code was taken and completely refactored into a modular system by AI. It was messy, unorganized, hard to read, and sloppy,
    so I just used AI to fix it and add a few features. If you're not okay with that... well, idk what to tell you.
