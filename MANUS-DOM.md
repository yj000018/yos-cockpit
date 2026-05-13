# Manus.im — DOM Reference
> Inspecté le 2026-05-13 — Source de vérité pour l'extension Y-OS Cockpit
> Mémorisé dans Mem0 (user_id: yannick) — récupérable via query "data-event-id nav simplebar"

---

## Layout global

```
body
└── div.flex.w-full.h-full.overflow-hidden   ← Root container (440×742 mobile)
    ├── nav                                   ← Sidebar gauche (sessions list)
    └── main / div                            ← Zone centrale (chat + input)
```

**Viewport mesuré :** 440px × 742px (mobile Manus web)

---

## Sélecteurs validés

### Sidebar (panel gauche — navigation sessions)

| Élément | Sélecteur | Notes |
|---|---|---|
| Sidebar container | `nav` | Élément natif HTML |
| Background color | CSS var `--background-nav` | Override direct via `:root` ou `nav` |
| Texte désactivé | CSS var `--text-disable` | |
| Texte tertiaire | CSS var `--text-tertiary` | |
| Scrollbar sessions | `.simplebar-scrollbar::before` | SimpleBar library |
| Scrollbar track | `.simplebar-track.simplebar-vertical` | |

### Messages (chat central)

| Élément | Sélecteur | Notes |
|---|---|---|
| Tous les turns | `[data-event-id]` | Attribut stable — ne change pas entre versions |
| Turn utilisateur | `[data-event-id][class*="items-end"][class*="w-full"]` | Aligné à droite |
| Turn assistant | `[data-event-id][class*="gap-2"][class*="w-full"][class*="group"]` | Aligné à gauche |
| Texte utilisateur | `[class*="rounded-br-none"] span` | Bulle arrondie |
| Texte assistant | `div[class*="whitespace-pre-wrap"]` | Texte principal |
| Texte assistant (alt) | `div[class*="py-[3px]"]` | Variante selon le type de message |

### Input (zone de saisie)

| Élément | Sélecteur | Notes |
|---|---|---|
| Textarea | `textarea` | Élément natif |
| Container input | `textarea` → `parentElement` × 3-4 | Remonter le DOM pour le fond |

---

## CSS Variables Manus (thème)

Manus utilise TailwindCSS + CSS custom properties. Les variables suivantes sont surchargeables via `:root` ou directement sur l'élément :

| Variable | Usage |
|---|---|
| `--background-nav` | Fond de la sidebar |
| `--text-disable` | Texte désactivé |
| `--text-tertiary` | Texte secondaire |

**Note :** Les classes Tailwind générées (ex: `css-1x2y3z`) sont instables et changent à chaque build. Ne jamais cibler ces classes directement.

---

## Librairies détectées

| Librairie | Usage dans Manus |
|---|---|
| **TailwindCSS** | Toutes les classes utilitaires (`flex`, `w-full`, `gap-2`, etc.) |
| **SimpleBar** | Scrollbar personnalisée dans la sidebar |
| **React/Next.js** | Framework UI (classes dynamiques) |

---

## Stratégie de sélection robuste

**Ordre de préférence (du plus stable au moins stable) :**

1. Attributs `data-*` → `[data-event-id]` ✅ Très stable
2. Éléments HTML natifs → `nav`, `textarea`, `main` ✅ Stable
3. CSS Variables → `--background-nav` ✅ Stable
4. Classes Tailwind sémantiques → `items-end`, `w-full`, `gap-2` ⚠️ Stable si Tailwind reste
5. Classes générées → `.css-1x2y3z` ❌ Instable — à éviter absolument

---

## Données brutes (console output 2026-05-13)

```json
{
  "nav": "flex flex-col h-full bg-[--background-nav] ...",
  "bodyKids": [
    {
      "tag": "DIV",
      "cls": "flex w-full h-full overflow-hidden",
      "w": 440,
      "h": 742
    }
  ],
  "scroll": [
    {
      "cls": "simplebar-content-wrapper ...",
      "w": 220,
      "h": 742
    },
    {
      "cls": "flex flex-col overflow-y-auto ...",
      "w": 220,
      "h": 742
    }
  ],
  "ta": "w-full resize-none bg-transparent ...",
  "taChain": [
    "relative flex items-end ...",
    "flex flex-col w-full ...",
    "flex items-end gap-2 px-4 pb-4 ...",
    "flex flex-col flex-1 overflow-hidden ..."
  ]
}
```

---

## Mise à jour de ce document

À chaque changement majeur de l'interface Manus, ré-inspecter via la console Brave :

```javascript
const r = {};
const nav = document.querySelector('nav');
r.nav = nav ? nav.className.substring(0,300) : 'NOT FOUND';
r.bodyKids = [...document.body.children].slice(0,4).map(el=>({tag:el.tagName,cls:el.className.substring(0,200),w:el.offsetWidth,h:el.offsetHeight}));
r.scroll = [...document.querySelectorAll('div')].filter(el=>{const s=window.getComputedStyle(el);return(s.overflowY==='auto'||s.overflowY==='scroll')&&el.offsetHeight>300;}).slice(0,4).map(el=>({cls:el.className.substring(0,200),w:el.offsetWidth,h:el.offsetHeight}));
const ta=document.querySelector('textarea');
if(ta){r.ta=ta.className.substring(0,200);let p=ta.parentElement;r.taChain=[];for(let i=0;i<6;i++){if(!p)break;r.taChain.push(p.className.substring(0,150));p=p.parentElement;}}
console.log(JSON.stringify(r,null,2));
```

Mettre à jour ce fichier + re-mémoriser dans Mem0 (`user_id: yannick`).
