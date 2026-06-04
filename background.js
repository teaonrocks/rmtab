import {
  DEFAULT_SETTINGS,
  getSettings,
  getLastAccessed,
  incrementClosedTabsCount,
  isTabExcluded,
  isTabProtected,
  urlToPattern,
} from "./lib.js";

const ALARM_NAME = "cleanup";
const CHECK_INTERVAL_MINUTES = 15;

async function closeStaleTabs() {
  const settings = await getSettings();
  if (!settings.enabled) return { closed: 0, skipped: 0 };

  const timeoutMs = settings.timeoutHours * 60 * 60 * 1000;
  const cutoff = Date.now() - timeoutMs;
  const tabs = await chrome.tabs.query({});
  let closed = 0;

  for (const tab of tabs) {
    if (!tab.id) continue;
    if (isTabProtected(tab, settings)) continue;
    if (await isTabExcluded(tab, settings)) continue;

    const lastAccessed = await getLastAccessed(tab);
    if (lastAccessed === null || lastAccessed > cutoff) continue;

    try {
      await chrome.tabs.remove(tab.id);
      closed++;
    } catch {
      // Tab may already be gone or not closable
    }
  }

  if (closed > 0) {
    await incrementClosedTabsCount(closed);
  }

  return { closed };
}

async function scheduleAlarm() {
  const settings = await getSettings();
  await chrome.alarms.clear(ALARM_NAME);
  if (!settings.enabled) return;
  await chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: CHECK_INTERVAL_MINUTES,
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    closeStaleTabs();
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && (changes.enabled || changes.timeoutHours)) {
    scheduleAlarm();
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get(null);
  if (!existing.timeoutHours) {
    await chrome.storage.sync.set(DEFAULT_SETTINGS);
  }

  chrome.contextMenus.create({
    id: "exclude-url",
    title: "Never auto-close this site",
    contexts: ["page", "frame"],
  });

  await scheduleAlarm();
  await closeStaleTabs();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleAlarm();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "exclude-url" || !tab?.url) return;
  const settings = await getSettings();
  const pattern = urlToPattern(tab.url);
  if (!pattern || settings.excludedPatterns.includes(pattern)) return;
  await chrome.storage.sync.set({
    excludedPatterns: [...settings.excludedPatterns, pattern],
  });
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await chrome.storage.local.set({
    [`lastAccessed:${activeInfo.tabId}`]: Date.now(),
  });
});

chrome.tabs.onCreated.addListener(async (tab) => {
  if (!tab.id) return;
  const ts = tab.lastAccessed ?? Date.now();
  await chrome.storage.local.set({ [`lastAccessed:${tab.id}`]: ts });
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await chrome.storage.local.remove(`lastAccessed:${tabId}`);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "cleanup") {
    closeStaleTabs().then(sendResponse);
    return true;
  }
  if (message.type === "preview") {
    previewStaleTabs().then(sendResponse);
    return true;
  }
});

async function previewStaleTabs() {
  const settings = await getSettings();
  const timeoutMs = settings.timeoutHours * 60 * 60 * 1000;
  const cutoff = Date.now() - timeoutMs;
  const tabs = await chrome.tabs.query({});
  const stale = [];

  for (const tab of tabs) {
    if (!tab.id) continue;
    if (isTabProtected(tab, settings)) continue;
    if (await isTabExcluded(tab, settings)) continue;

    const lastAccessed = await getLastAccessed(tab);
    if (lastAccessed === null || lastAccessed > cutoff) continue;

    stale.push({
      id: tab.id,
      title: tab.title || "Untitled",
      url: tab.url || "",
      lastAccessed,
    });
  }

  return { stale, settings };
}

export { closeStaleTabs, scheduleAlarm };
