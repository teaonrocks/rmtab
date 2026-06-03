export const DEFAULT_SETTINGS = {
  enabled: true,
  timeoutHours: 12,
  skipPinned: true,
  skipAudible: true,
  excludedPatterns: [],
};

export function urlToPattern(url) {
  try {
    const { hostname } = new URL(url);
    if (!hostname || hostname === "newtab") return null;
    return hostname;
  } catch {
    return null;
  }
}

export function tabMatchesPattern(url, pattern) {
  if (!url || !pattern) return false;
  try {
    const { hostname, href } = new URL(url);
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(1);
      return hostname.endsWith(suffix) || hostname === pattern.slice(2);
    }
    if (pattern.includes("://")) {
      return href.startsWith(pattern) || href === pattern;
    }
    return hostname === pattern || hostname.endsWith(`.${pattern}`);
  } catch {
    return url.includes(pattern);
  }
}

export async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    excludedPatterns: stored.excludedPatterns ?? [],
    timeoutHours: Number(stored.timeoutHours) || DEFAULT_SETTINGS.timeoutHours,
  };
}

export async function getLastAccessed(tab) {
  if (tab.lastAccessed && tab.lastAccessed > 0) {
    return tab.lastAccessed;
  }
  if (!tab.id) return null;
  const key = `lastAccessed:${tab.id}`;
  const result = await chrome.storage.local.get(key);
  return result[key] ?? null;
}

export function isTabProtected(tab, settings) {
  if (tab.active) return true;
  if (settings.skipPinned && tab.pinned) return true;
  if (settings.skipAudible && tab.audible) return true;
  if (!tab.url) return true;
  if (tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) {
    return true;
  }
  return false;
}

export async function isTabExcluded(tab, settings) {
  const url = tab.url || "";
  for (const pattern of settings.excludedPatterns) {
    if (tabMatchesPattern(url, pattern)) return true;
  }
  if (!tab.id) return false;
  const sessionKey = `excludedTab:${tab.id}`;
  const session = await chrome.storage.session.get(sessionKey);
  return Boolean(session[sessionKey]);
}

export function formatRelativeTime(ms) {
  const diff = Date.now() - ms;
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours < 1) {
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes}m ago`;
  }
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
