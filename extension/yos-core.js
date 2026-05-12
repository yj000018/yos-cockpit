// Y-OS Cockpit v2 — yos-core.js
// Shared config, constants, utilities used by content_script and side panel
// ============================================================

const YOS = {
  version: '2.0.0',

  // ── Webhooks n8n (configure in Settings tab) ─────────────────
  webhooks: {
    archive: '',
    distill: '',
    hydrate: '',
    memory: '',
    task: '',
    issue: ''
  },

  // ── Team agents ──────────────────────────────────────────────
  agents: [
    { id: 'dev', name: 'Dev', icon: '💻', webhook: '' },
    { id: 'design', name: 'Design', icon: '🎨', webhook: '' },
    { id: 'pa', name: 'Assistant', icon: '🤝', webhook: '' },
    { id: 'research', name: 'Research', icon: '🔬', webhook: '' }
  ],

  // ── DOM selectors for manus.im (update after DOM inspection) ─
  selectors: {
    chatContainer: '[class*="chat"], [class*="conversation"], main, [role="main"]',
    userMessage: '[class*="user"], [class*="human"], [data-role="user"]',
    assistantMessage: '[class*="assistant"], [class*="ai"], [data-role="assistant"], [class*="response"]',
    inputBox: 'textarea, [contenteditable="true"], [class*="input"]',
    logo: 'img[alt*="Manus"], img[alt*="manus"], [class*="logo"] img, header img',
    sendButton: 'button[type="submit"], [class*="send"]'
  },

  // ── Regex patterns for Smart analysis ────────────────────────
  patterns: {
    numberedChoice: /^[\s]*(\d+)[.)]\s+(.+)/gm,
    letterChoice: /^[\s]*([A-Z])[.)]\s+(.+)/gm,
    optionKeyword: /\b(option|alternative|choice|approach|solution)\s+(\d+|[A-Z])/gi,
    decision: /\b(on (a |va |décide|choisit|garde|abandonne)|we (decided|chose|will|keep|drop))[^.!?]*/gi,
    task: /\b(à faire|todo|tâche|action|next step|prochaine étape|il faut)[^.!?]*/gi,
    issue: /\b(problème|issue|bug|erreur|bloquer|bloquant|challenge|difficulté)[^.!?]*/gi,
    openItem: /\b(à clarifier|à définir|à confirmer|open question|à valider|pending)[^.!?]*/gi
  },

  // ── Utilities ────────────────────────────────────────────────
  utils: {
    wordCount(text) {
      return text.trim().split(/\s+/).filter(Boolean).length;
    },
    charCount(text) {
      return text.length;
    },
    toA4Pages(text) {
      // ~500 words per A4 page
      return (this.wordCount(text) / 500).toFixed(1);
    },
    truncate(text, maxLen = 80) {
      return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
    },
    timestamp() {
      return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    },
    datestamp() {
      return new Date().toLocaleDateString('fr-FR');
    },
    slugify(text) {
      return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    }
  },

  // ── Extract choices from text (regex, no LLM) ────────────────
  extractChoices(text) {
    const choices = [];
    const lines = text.split('\n');
    for (const line of lines) {
      const m = line.match(/^[\s]*(\d+|[A-Z])[.)]\s+(.+)/);
      if (m) {
        choices.push({ key: m[1], text: m[2].trim().slice(0, 120) });
      }
    }
    return choices;
  },

  // ── Extract decisions/tasks/issues from text ─────────────────
  extractItems(text, type) {
    const pattern = YOS.patterns[type];
    if (!pattern) return [];
    pattern.lastIndex = 0;
    const items = [];
    let m;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((m = re.exec(text)) !== null) {
      items.push(m[0].trim().slice(0, 200));
    }
    return items;
  },

  // ── Webhook caller ───────────────────────────────────────────
  async callWebhook(url, payload) {
    if (!url) return { error: 'No webhook URL configured' };
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return { ok: res.ok, status: res.status };
    } catch (e) {
      return { error: e.message };
    }
  },

  // ── Storage helpers ──────────────────────────────────────────
  async save(key, value) {
    return new Promise(resolve => chrome.storage.local.set({ [key]: value }, resolve));
  },
  async load(key, defaultVal = null) {
    return new Promise(resolve => {
      chrome.storage.local.get([key], (r) => resolve(r[key] ?? defaultVal));
    });
  }
};
