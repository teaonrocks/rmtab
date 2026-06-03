# RmTab

Chrome extension that closes tabs that have not been accessed within a configurable time limit (default: 12 hours).

## Features

- **Configurable timeout** — set how many hours of inactivity before a tab is closed
- **Exclude sites** — permanently skip hostnames (e.g. `github.com`, `*.google.com`)
- **Exclude current tab** — skip a single tab until you close it (session-only)
- **Context menu** — right-click any page → “Never auto-close this site”
- **Safety** — never closes the active tab, pinned tabs (optional), or tabs playing audio (optional)
- **Manual cleanup** — preview stale tabs and close them immediately from the popup

## Install (unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder

## How it works

- A background alarm runs every 15 minutes and closes tabs whose last access time is older than your timeout
- Last access uses Chrome’s `tab.lastAccessed` when available, with a local fallback when tabs are discarded
- Settings sync across Chrome profiles via `chrome.storage.sync`

## Permissions

| Permission     | Why                                      |
|----------------|------------------------------------------|
| `tabs`         | Query and close tabs                     |
| `storage`      | Save settings and exclusions             |
| `alarms`       | Periodic cleanup                         |
| `contextMenus` | “Never auto-close this site” menu item   |
