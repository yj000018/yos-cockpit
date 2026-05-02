# Manus Enhancer — Y-OS

> Tampermonkey userscript that enriches the [Manus](https://manus.im) interface with quick-reaction buttons and step-collapse controls.

**Version:** 1.2.0 | **Author:** Yannick Jolliet / Y-OS

---

## Features

| Feature | Description |
|---|---|
| **Reaction buttons** | 👌 OK / ✅ Do it / 📋 Copy / 🚫 No / ✏️ Edit / 🔁 Retry — appear on hover over any message |
| **Copy** | Copies full message text to clipboard |
| **OK / Do it / No / Retry** | Pre-fills the input with a quick response (press Enter to send) |
| **Steps toggle** | Floating button — cycles 3 modes: All / Collapsed / Hidden |
| **Phase collapse** | Click any phase title to expand/collapse its micro-steps |
| **Persistence** | Steps mode saved between sessions via GM_setValue |

---

## Installation

### 1. Install Tampermonkey

- Chrome: [Tampermonkey on Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- Firefox: [Tampermonkey on AMO](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)

### 2. Install the script

**Option A — Direct install (recommended):**

Click the raw script link → Tampermonkey will prompt to install automatically:

👉 [Install manus-enhancer.user.js](https://raw.githubusercontent.com/yj000018/manus-enhancer/main/manus-enhancer.user.js)

**Option B — Manual:**

1. Open Tampermonkey → Create new script
2. Delete default content, paste the content of `manus-enhancer.user.js`
3. `Ctrl+S` to save

### 3. Use it

Navigate to `https://manus.im/app` — the script activates automatically.

---

## Auto-update

The script includes `@updateURL` pointing to this repo. Tampermonkey will check for updates automatically.

To force update: Tampermonkey dashboard → script → check for updates.

---

## Usage

**Reaction buttons**
- Hover over any message (user or Manus)
- Button bar appears at the bottom of the message
- Click → action executed + toast confirmation

**Steps control (floating button, top-right)**
- `👁 Steps: all` — normal display
- `⊟ Steps: collapsed` — micro-steps collapsed (default on load)
- `🙈 Steps: hidden` — micro-steps invisible

**Individual collapse**
- Click any phase title (e.g. "Analyzing interface...") to expand/collapse its steps

---

## Technical notes

- **Selectors:** Based on Manus v1.6 Tailwind classes — may need update if Manus changes its DOM
- **Compatibility:** Chrome + Firefox + Edge with Tampermonkey ≥ 5.x
- **Server verbosity:** Not modifiable (API-side). The script hides/collapses DOM-side only.
- **MutationObserver:** Watches for new messages in real time

---

## Maintenance

This repo is the single source of truth for the script. To update:

1. Edit `manus-enhancer.user.js`
2. Increment `@version`
3. Commit and push to `main`
4. Tampermonkey auto-updates on next check

---

*Part of the Y-OS ecosystem — [yannick-jolliet](https://github.com/yj000018)*
