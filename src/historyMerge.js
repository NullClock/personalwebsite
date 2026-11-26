// Pure helper for the song-history list. It has no React or browser imports on purpose,
// so it can be tested in plain Node.

// Folds a freshly fetched NEWEST page into the list we already have, without throwing away
// the older pages the user has scrolled through and loaded.
//
// Both lists are newest-first, and every item has a stable numeric `id` (its index in the
// server's append-only history). The fresh page replaces the top of the list (so new plays
// show up and anything changed in that window is corrected), and everything older than that
// page is kept exactly as it is.
export function mergeNewest(prev, fresh) {
  // The newest page is only empty when the server's history is empty (e.g. it was cleared).
  if (!fresh.length) return [];
  const oldestFreshId = fresh[fresh.length - 1].id;
  return [...fresh, ...prev.filter((item) => item.id < oldestFreshId)];
}

// True when so many tracks arrived since the last refresh (laptop asleep with the drawer
// open, say) that the fresh page no longer touches what we have. Merging would leave a hole,
// so the caller should start over from the fresh page instead.
export function hasGap(prevNewestId, fresh) {
  if (prevNewestId == null || !fresh.length) return false;
  return prevNewestId < fresh[fresh.length - 1].id - 1;
}
