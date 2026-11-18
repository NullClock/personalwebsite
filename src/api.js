// Single place for the backend base URL, so every API call uses the same one.
// VITE_API_URL comes from the environment (see .env.example); VITE_ values are
// public by design and end up in the client bundle, so never put secrets here.
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

if (!API_BASE) {
  throw new Error("VITE_API_URL is required. Copy .env.example to .env and set it.");
}

export { API_BASE };

export async function apiJson(path, { signal, headers, ...options } = {}) {
  const hasBody = options.body !== undefined;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    signal,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  // Some admin endpoints reply with a plain 200 "OK" rather than JSON.
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
