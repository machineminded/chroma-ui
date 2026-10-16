// localStorage helpers. Storage can be unavailable or throw (private windows,
// blocked site data, quota), so every access is guarded and falls back quietly.

export function loadJSON(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Best-effort — the in-memory state is still correct
  }
}
