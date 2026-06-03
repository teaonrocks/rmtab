import {
  DEFAULT_SETTINGS,
  getSettings,
  urlToPattern,
  formatRelativeTime,
} from "./lib.js";

const $ = (id) => document.getElementById(id);

async function saveSettings(partial) {
  await chrome.storage.sync.set(partial);
}

async function loadUI() {
  const settings = await getSettings();
  $("enabled").checked = settings.enabled;
  $("timeoutHours").value = settings.timeoutHours;
  $("skipPinned").checked = settings.skipPinned;
  $("skipAudible").checked = settings.skipAudible;
  renderPatterns(settings.excludedPatterns);
  await refreshPreview();
}

function renderPatterns(patterns) {
  const list = $("patternList");
  list.innerHTML = "";
  if (!patterns.length) {
    list.innerHTML = '<li class="empty">No excluded sites yet</li>';
    return;
  }
  for (const pattern of patterns) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${escapeHtml(pattern)}</span>`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Remove";
    btn.addEventListener("click", async () => {
      const settings = await getSettings();
      await saveSettings({
        excludedPatterns: settings.excludedPatterns.filter((p) => p !== pattern),
      });
      loadUI();
    });
    li.appendChild(btn);
    list.appendChild(li);
  }
}

function renderStaleList(stale) {
  const list = $("staleList");
  list.innerHTML = "";
  if (!stale.length) {
    list.innerHTML = '<li class="empty">No stale tabs right now</li>';
    return;
  }
  for (const tab of stale) {
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="meta">
        <div class="title">${escapeHtml(tab.title)}</div>
        <div class="url">${escapeHtml(tab.url)}</div>
        <div class="url">${formatRelativeTime(tab.lastAccessed)}</div>
      </div>
    `;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Exclude";
    btn.addEventListener("click", async () => {
      await chrome.storage.session.set({ [`excludedTab:${tab.id}`]: true });
      refreshPreview();
    });
    li.appendChild(btn);
    list.appendChild(li);
  }
}

async function refreshPreview() {
  const { stale, settings } = await chrome.runtime.sendMessage({
    type: "preview",
  });
  const hours = settings.timeoutHours;
  $("previewSummary").textContent =
    stale.length === 0
      ? `No tabs inactive for more than ${hours}h.`
      : `${stale.length} tab${stale.length === 1 ? "" : "s"} would be closed.`;
  renderStaleList(stale);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

$("enabled").addEventListener("change", (e) => {
  saveSettings({ enabled: e.target.checked });
});

$("timeoutHours").addEventListener("change", (e) => {
  const value = Math.max(0.25, Math.min(720, Number(e.target.value) || 12));
  e.target.value = value;
  saveSettings({ timeoutHours: value });
  refreshPreview();
});

$("skipPinned").addEventListener("change", (e) => {
  saveSettings({ skipPinned: e.target.checked });
  refreshPreview();
});

$("skipAudible").addEventListener("change", (e) => {
  saveSettings({ skipAudible: e.target.checked });
  refreshPreview();
});

$("addPattern").addEventListener("click", async () => {
  const input = $("newPattern");
  const raw = input.value.trim().toLowerCase();
  if (!raw) return;
  const pattern = raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const settings = await getSettings();
  if (settings.excludedPatterns.includes(pattern)) return;
  await saveSettings({
    excludedPatterns: [...settings.excludedPatterns, pattern],
  });
  input.value = "";
  loadUI();
});

$("excludeCurrent").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  await chrome.storage.session.set({ [`excludedTab:${tab.id}`]: true });
  refreshPreview();
});

$("excludeCurrentSite").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const pattern = tab?.url ? urlToPattern(tab.url) : null;
  if (!pattern) return;
  const settings = await getSettings();
  if (settings.excludedPatterns.includes(pattern)) return;
  await saveSettings({
    excludedPatterns: [...settings.excludedPatterns, pattern],
  });
  loadUI();
});

$("refreshPreview").addEventListener("click", refreshPreview);
$("cleanupNow").addEventListener("click", async () => {
  const result = await chrome.runtime.sendMessage({ type: "cleanup" });
  await refreshPreview();
  if (result?.closed > 0) {
    $("previewSummary").textContent = `Closed ${result.closed} tab${result.closed === 1 ? "" : "s"}.`;
  }
});

loadUI();
