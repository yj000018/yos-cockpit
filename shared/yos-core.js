// ============================================================
// Y-OS CORE — shared/yos-core.js
// Partagé entre : Extension Brave + TM Userscript Mobile
// Chargé via @require (TM) ou bundlé directement (Extension)
//
// Contient :
//   - YOS_CONFIG    : paramètres centraux (webhooks, flags)
//   - YOS_LINKS     : navigation Y-OS
//   - YOS_BRANDING  : couleurs, logo SVG
//   - analyzeResponse() : détection choix/actions dans les réponses
//   - callWebhook() : appel n8n
//   - showToast()   : notification légère
// ============================================================

const YOS_VERSION = '0.2.0';

// ── CONFIG CENTRALE ──────────────────────────────────────────
// Modifier ici = mis à jour partout (Extension + TM)
const YOS_CONFIG = {
  // Webhooks n8n — remplacer par les vraies URLs
  webhooks: {
    memory:  '',   // POST { action, text, timestamp } → Mem0 + Notion
    task:    '',   // POST { action, text, timestamp } → Todoist
    issue:   '',   // POST { action, text, timestamp } → Linear
    archive: '',   // POST { action, text, timestamp } → session-synthesizer
  },

  // Feature flags
  features: {
    branding:     true,   // Override CSS Y-OS
    logo:         true,   // Remplacer logo Manus par Y-OS
    autoAnalyze:  true,   // Analyser chaque réponse automatiquement
    toastNotif:   true,   // Notifications toast légères
  },

  // Sélecteurs DOM Manus (à affiner après inspection F12)
  selectors: {
    // Messages de l'assistant — plusieurs variantes pour robustesse
    assistantMessages: [
      '[data-role="assistant"]',
      '[class*="assistant-message"]',
      '[class*="AssistantMessage"]',
      '[class*="agent-message"]',
      '[class*="AgentMessage"]',
    ],
    // Container principal du chat
    chatContainer: [
      '[class*="message-list"]',
      '[class*="MessageList"]',
      '[class*="chat-container"]',
      '[class*="ChatContainer"]',
      'main',
    ],
    // Zone de saisie du prompt
    promptInput: [
      'textarea[placeholder*="message"]',
      'textarea[placeholder*="Message"]',
      'textarea[placeholder*="prompt"]',
      '[contenteditable="true"]',
      'textarea',
    ],
    // Logo Manus
    logo: [
      'a[href="/"] img[alt*="Manus"]',
      'a[href="/"] img[alt*="manus"]',
      'header img',
      'nav img',
      '[class*="logo"] img',
      '[class*="Logo"] img',
    ],
  },
};

// ── NAVIGATION Y-OS ──────────────────────────────────────────
const YOS_LINKS = [
  { icon: '📓', label: 'Notion — Projects',    url: 'https://notion.so',                    group: 'yos' },
  { icon: '📐', label: 'Linear — Issues',       url: 'https://linear.app',                   group: 'yos' },
  { icon: '⚙️', label: 'n8n — Workflows',       url: 'https://app.n8n.cloud',                group: 'yos' },
  { icon: '🐙', label: 'GitHub',                url: 'https://github.com/yj000018',          group: 'yos' },
  { icon: '📁', label: 'Manus — Projects',      url: 'https://manus.im/projects',            group: 'manus' },
  { icon: '📋', label: 'Manus — Tasks',         url: 'https://manus.im/tasks',               group: 'manus' },
];

// ── BRANDING ─────────────────────────────────────────────────
const YOS_BRANDING = {
  colors: {
    primary:    '#6C63FF',
    primaryDark:'#4A42CC',
    accent:     '#00D4AA',
    bg:         '#0D0D1A',
    bgPanel:    '#12122A',
    bgCard:     '#1A1A35',
    text:       '#E8E8F0',
    textMuted:  '#8888AA',
    border:     'rgba(108, 99, 255, 0.2)',
  },

  // Logo Y-OS SVG inline (utilisé dans la page et dans le panel)
  logoSVG: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="11" stroke="url(#yg)" stroke-width="2"/>
    <path d="M7 8L12 14L17 8" stroke="url(#yg)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M12 14V18" stroke="#00D4AA" stroke-width="2" stroke-linecap="round"/>
    <defs>
      <linearGradient id="yg" x1="7" y1="8" x2="17" y2="18" gradientUnits="userSpaceOnUse">
        <stop stop-color="#6C63FF"/>
        <stop offset="1" stop-color="#00D4AA"/>
      </linearGradient>
    </defs>
  </svg>`,
};

// ── ANALYSE DE RÉPONSE ────────────────────────────────────────
// Détecte les choix numérotés, actions suggérées, type de contenu
// Utilisé identiquement par Extension et TM
function yosAnalyzeResponse(text) {
  if (!text || text.length < 10) return null;

  const analysis = {
    raw:        text,
    timestamp:  Date.now(),
    choices:    [],
    actions:    [],
    hasCode:    false,
    hasTable:   false,
    hasMarkdown:false,
    summary:    '',
  };

  // Choix numérotés : "1. texte", "1) texte", "**1.**", "Option 1:"
  const choicePatterns = [
    /^[\s]*[1-9][.)]\s+(.+)$/gm,
    /^[\s]*Option\s+[1-9][.:]\s+(.+)$/gim,
    /^[\s]*\*\*[1-9][.)]\*\*\s+(.+)$/gm,
    /^[\s]*[1-9️⃣]\s+(.+)$/gm,
  ];

  const seen = new Set();
  for (const pat of choicePatterns) {
    let m;
    while ((m = pat.exec(text)) !== null) {
      const t = m[1].replace(/\*\*/g, '').trim().substring(0, 90);
      if (t && !seen.has(t)) { seen.add(t); analysis.choices.push(t); }
      if (analysis.choices.length >= 7) break;
    }
    if (analysis.choices.length >= 7) break;
  }

  // Actions suggérées (questions / verbes d'action)
  const actionPat = /(?:je peux|tu peux|on peut|voulez-vous|souhaitez-vous|dois-je|should I|want me to)\s+(.{10,70})\s*[?]/gi;
  let m;
  while ((m = actionPat.exec(text)) !== null) {
    analysis.actions.push(m[1].trim().substring(0, 70));
    if (analysis.actions.length >= 3) break;
  }

  // Flags de contenu
  analysis.hasCode     = /```/.test(text);
  analysis.hasTable    = /\|.+\|.+\|/.test(text);
  analysis.hasMarkdown = /#{1,3}\s/.test(text) || /\*\*/.test(text);

  // Résumé : première phrase significative
  const sentences = text.split(/[.!?\n]+/);
  analysis.summary = sentences.find(s => s.trim().length > 25)?.trim().substring(0, 130) || text.substring(0, 130);

  return analysis;
}

// ── WEBHOOK n8n ───────────────────────────────────────────────
async function yosCallWebhook(url, payload) {
  if (!url) return false;
  try {
    const r = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...payload, yos_version: YOS_VERSION }),
    });
    return r.ok;
  } catch (e) {
    console.warn('[Y-OS] Webhook error:', e.message);
    return false;
  }
}

// ── TOAST NOTIFICATION ────────────────────────────────────────
// Injecte un toast léger dans la page (utilisé par TM et Extension content script)
function yosShowToast(message, duration = 2500) {
  if (!YOS_CONFIG.features.toastNotif) return;

  let toast = document.getElementById('yos-toast-global');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'yos-toast-global';
    toast.style.cssText = `
      position:fixed;bottom:20px;left:50%;transform:translateX(-50%) translateY(10px);
      background:#1A1A35;border:1px solid rgba(0,212,170,0.4);border-radius:20px;
      padding:7px 16px;font-size:13px;color:#00D4AA;font-family:system-ui,sans-serif;
      opacity:0;transition:all 0.25s;pointer-events:none;z-index:999999;
      white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,0.4);
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(10px)';
  }, duration);
}

// ── SÉLECTEUR DOM ROBUSTE ─────────────────────────────────────
// Essaie plusieurs sélecteurs, retourne le premier qui matche
function yosQueryFirst(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function yosQueryAll(selectors) {
  for (const sel of selectors) {
    const els = document.querySelectorAll(sel);
    if (els.length > 0) return Array.from(els);
  }
  return [];
}

// ── INJECT PROMPT DANS MANUS ──────────────────────────────────
// Injecte du texte dans la zone de saisie et soumet
function yosInjectPrompt(text) {
  const input = yosQueryFirst(YOS_CONFIG.selectors.promptInput);
  if (!input) {
    yosShowToast('⚠️ Zone de saisie introuvable');
    return false;
  }

  // React / contenteditable compatible
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
  )?.set;

  if (nativeInputValueSetter && input.tagName === 'TEXTAREA') {
    nativeInputValueSetter.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    input.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, text);
  }

  // Soumettre après un court délai
  setTimeout(() => {
    const submitBtn = document.querySelector('button[type="submit"], button[aria-label*="send"], button[aria-label*="Send"]');
    if (submitBtn) {
      submitBtn.click();
    } else {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }
  }, 150);

  return true;
}

// Export pour usage dans les modules (Extension)
if (typeof module !== 'undefined') {
  module.exports = {
    YOS_VERSION, YOS_CONFIG, YOS_LINKS, YOS_BRANDING,
    yosAnalyzeResponse, yosCallWebhook, yosShowToast,
    yosQueryFirst, yosQueryAll, yosInjectPrompt,
  };
}
