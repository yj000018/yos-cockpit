# Y-OS Cockpit for Manus

Transform [manus.im](https://manus.im) into a Y-OS cognitive cockpit.  
Two clients, one shared core, zero redundancy.

**Version:** 0.2.0 | **Author:** Yannick Jolliet / Y-OS

---

## Architecture v0.2

```
manus-enhancer/
├── shared/
│   └── yos-core.js          ← Shared: config, webhooks, response analysis, branding
├── extension/               ← Brave / Dia (Mac) — Full cockpit with Side Panel
│   ├── manifest.json
│   ├── background.js
│   ├── content_script.js
│   ├── yos_branding.css
│   ├── side_panel/
│   │   ├── index.html       ← 4-tab cockpit UI
│   │   └── panel.js
│   └── icons/
└── userscript/              ← Mobile / Gear — TM userscript
    └── yos-mobile.user.js   ← @require shared/yos-core.js from GitHub Raw
```

---

## 🖥 Mac / Brave / Dia — Extension

### What it does
- **Branding CSS** : Y-OS colors (violet/cyan), dark theme, Y-OS logo replacing Manus logo
- **Logo menu** : click Y-OS logo → contextual menu (Memorize, Task, Archive, Nav links)
- **Side Panel** — 4 tabs:
  - ⚡ **Smart** : auto-analysis of each Manus response — summary, numbered choices as clickable buttons, suggested actions, content flags
  - 🎯 **Actions** : permanent Y-OS action buttons (Memory → Mem0/Notion, Task → Todoist, Issue → Linear, Archive session, Copy, Notion)
  - 🗺 **Nav** : direct links to Notion, Linear, n8n, GitHub, Manus Projects
  - ⚙️ **Settings** : n8n webhook URLs, feature toggles

### Install (2 min, one-time)
1. Clone or download this repo
2. Brave → `brave://extensions/` → enable **Developer mode**
3. **Load unpacked** → select the `extension/` folder
4. Go to `manus.im` → click Y-OS icon → Side Panel opens

---

## 📱 Mobile / Gear — Tampermonkey Userscript

### What it does
- **Branding CSS** : Y-OS dark theme
- **Y-OS logo** + contextual menu (tap logo)
- **Action bar** (bottom) : Memory 🧠 / Task ✅ / Choices 🔢 / Archive 📦
- **Choices panel** : when Manus proposes numbered options → tap 🔢 → panel with clickable buttons → injects choice into prompt
- **Settings panel** : configure n8n webhook URLs (stored in TM storage)
- Uses `GM_xmlhttpRequest` for CORS-free webhook calls

### Install (1 click)
**[→ Install Y-OS Mobile Userscript](https://raw.githubusercontent.com/yj000018/manus-enhancer/main/userscript/yos-mobile.user.js)**

In Gear browser: open the link above → Tampermonkey will prompt to install.

---

## Shared Core — `shared/yos-core.js`

Single source of truth for both clients:

| Export | Description |
|---|---|
| `YOS_CONFIG` | Webhooks, feature flags, DOM selectors |
| `YOS_LINKS` | Navigation links (Notion, Linear, n8n, GitHub) |
| `YOS_BRANDING` | Colors, logo SVG |
| `yosAnalyzeResponse(text)` | Detects numbered choices, suggested actions, content flags |
| `yosCallWebhook(url, payload)` | POST to n8n webhook |
| `yosShowToast(message)` | Lightweight in-page notification |
| `yosInjectPrompt(text)` | Injects text into Manus prompt input |
| `yosQueryFirst/All(selectors)` | Robust multi-selector DOM query |

**To update config** (webhooks, links, selectors) : edit `shared/yos-core.js` → both clients update automatically.

---

## Connecting n8n Webhooks

Payload format sent to all webhooks:
```json
{
  "action": "memorize",
  "text": "Last Manus response...",
  "timestamp": "2026-05-11T12:00:00.000Z",
  "yos_version": "0.2.0"
}
```

**Extension** : Side Panel → ⚙️ Settings tab  
**Mobile TM** : tap Y-OS logo → ⚙️ Y-OS Settings

---

## Roadmap

- [ ] Inspect real Manus DOM → refine CSS selectors in `yos-core.js`
- [ ] Connect n8n webhooks (Memory → Mem0, Task → Todoist, Archive → session-synthesizer)
- [ ] Keyboard shortcuts in Extension (Alt+M = Memorize, Alt+T = Task)
- [ ] Read active project name from Manus URL → display in Side Panel header
- [ ] Session history in Side Panel (via Manus API v2)

---

## Legacy — v1.x Tampermonkey Script

The original `manus-enhancer.user.js` (reaction buttons, steps collapse) is preserved at the repo root.

👉 [Install legacy v1 script](https://raw.githubusercontent.com/yj000018/manus-enhancer/main/manus-enhancer.user.js)

---

*Part of the Y-OS ecosystem — [yj000018](https://github.com/yj000018)*
