# Y-OS Cockpit — Procédure Dev Extension Brave
> Procédure optimale validée — à réutiliser pour TOUT développement d'extension Brave/Chrome

---

## Setup Initial (une seule fois)

| Étape | Action |
|---|---|
| 1 | Installer [GitHub Desktop](https://desktop.github.com/) sur Mac |
| 2 | Cloner `yj000018/yos-cockpit` dans un dossier local (ex: `~/Dev/yos-cockpit`) |
| 3 | Brave → `brave://extensions/` → activer **Mode développeur** |
| 4 | **Load unpacked** → pointer sur `~/Dev/yos-cockpit/extension/` |
| 5 | Aller sur `manus.im` → cliquer l'icône Y-OS → Side Panel s'ouvre |

---

## Workflow de Mise à Jour (quotidien)

```
Manus pousse un commit sur GitHub (branche v2)
        ↓
Cliquer le badge version dans le panel (ex: "v2.3 🔄")
        ↓
① GitHub Desktop s'ouvre → cliquer PULL
        ↓
② brave://extensions/ s'ouvre → cliquer RELOAD sur l'extension Y-OS
        ↓
Recharger manus.im → nouvelle version active
```

**Total : 2 clics après avoir cliqué le badge.**

---

## Règles de Versioning

| Format | Signification |
|---|---|
| `v2.x` | Patch mineur (bug fix, ajout UI) |
| `v3.0` | Refactoring majeur ou nouveau tab |
| `vX.Y-beta` | Expérimental, ne pas utiliser en prod |

Le numéro de version est affiché dans le header du panel.
Le tooltip au survol rappelle les 2 actions à faire.

---

## Structure du Repo

```
yos-cockpit/
├── extension/              ← Source de vérité (pointer Brave ici)
│   ├── manifest.json       ← Permissions, version
│   ├── background.js       ← Service worker
│   ├── content_script.js   ← Injection DOM Manus
│   ├── yos-core.js         ← Config + fonctions communes
│   ├── yos_branding.css    ← Override CSS Manus
│   └── side_panel/
│       ├── index.html      ← UI du cockpit (6 tabs)
│       └── panel.js        ← Logique complète
├── userscript/
│   └── yos-mobile.user.js  ← TM Mobile/Gear
├── DEV-WORKFLOW.md         ← Ce fichier
└── README.md
```

---

## Sélecteurs DOM Manus (validés 2026-05-13)

> Mémorisés dans Mem0 — récupérables via `mem0.search("Manus DOM selectors")`

| Élément | Sélecteur | Notes |
|---|---|---|
| Tous les turns | `[data-event-id]` | Stable |
| Turn utilisateur | `[data-event-id]` + classe `items-end` | |
| Turn assistant | `[data-event-id]` + classe `group` | |
| Texte utilisateur | `[class*="rounded-br-none"] span` | |
| Texte assistant | `div[class*="whitespace-pre-wrap"]` | |
| Sidebar background | CSS var `--background-nav` | Override direct |
| Root container | `div.flex.w-full.h-full.overflow-hidden` | |
| Scrollbar sessions | `.simplebar-scrollbar::before` | |

---

## Permissions Manifest V3 requises

```json
"permissions": ["sidePanel", "storage", "scripting", "activeTab", "tabs"]
```

**Règle absolue :** zéro `onclick` inline dans le HTML — utiliser `data-action` + `addEventListener` dans le JS.

---

## Principes à respecter

1. **Dégradation gracieuse** — si un sélecteur CSS casse après une mise à jour Manus, l'interface reste fonctionnelle (juste sans branding)
2. **Shared core** — toute logique commune entre extension et TM userscript va dans `yos-core.js`
3. **Pas de dépendances externes** — vanilla JS uniquement, zéro npm, zéro build step
4. **Sélecteurs DOM** — toujours inspecter le DOM réel avant de coder, jamais deviner les classes
