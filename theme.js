(() => {
  const storageKey = "travel-log-appearance";
  const allowedThemes = new Set(["light", "dark", "system"]);

  function normalize(theme) {
    return allowedThemes.has(theme) ? theme : "system";
  }

  function readStoredTheme() {
    try { return normalize(localStorage.getItem(storageKey)); }
    catch { return "system"; }
  }

  function apply(theme, persist = true) {
    const normalized = normalize(theme);
    document.documentElement.dataset.theme = normalized;
    document.documentElement.style.colorScheme = normalized === "system" ? "light dark" : normalized;
    if (persist) {
      try { localStorage.setItem(storageKey, normalized); } catch { /* The theme still applies for this page. */ }
    }
    return normalized;
  }

  apply(readStoredTheme(), false);
  window.TravelLogTheme = { apply, normalize, readStoredTheme, storageKey };
})();
