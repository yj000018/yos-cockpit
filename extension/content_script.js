// ============================================================
// Y-OS Extension — content_script.js
// Injecté sur manus.im — utilise yos-core.js (chargé avant)
// Responsabilités :
//   1. Branding : logo Y-OS + menu contextuel
//   2. MutationObserver : détecter les nouvelles réponses
//   3. Analyser via yosAnalyzeResponse() (shared core)
//   4. Envoyer au background → side panel
//   5. Recevoir INJECT_PROMPT du panel → injecter dans Manus
// ============================================================

(function () {
  'use strict';

  let observerActive = false;
  let lastText = '';

  // ── 1. LOGO Y-OS + MENU ──────────────────────────────────────
  function injectLogo() {
    if (document.getElementById('yos-logo-btn')) return;

    const logoEl = yosQueryFirst(YOS_CONFIG.selectors.logo);
    if (!logoEl) return;

    const container = logoEl.closest('a') || logoEl.parentElement;
    if (!container) return;

    // Masquer l'original
    logoEl.style.cssText = 'display:none!important';

    // Créer le bouton logo Y-OS
    const btn = document.createElement('button');
    btn.id = 'yos-logo-btn';
    btn.title = 'Y-OS Cockpit';
    btn.innerHTML = YOS_BRANDING.logoSVG + '<span class="yos-logo-label">Y-OS</span>';
    btn.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(); });
    container.insertBefore(btn, container.firstChild);

    buildMenu();
  }

  function buildMenu() {
    if (document.getElementById('yos-ctx-menu')) return;

    const menu = document.createElement('div');
    menu.id = 'yos-ctx-menu';

    const items = [
      { icon: '⚡', label: 'Open Y-OS Cockpit',    action: 'open-panel' },
      { sep: true },
      { icon: '🧠', label: 'Memorize response',     action: 'memorize' },
      { icon: '✅', label: 'Create task',            action: 'create-task' },
      { icon: '📦', label: 'Archive session',        action: 'archive-session' },
      { sep: true },
      ...YOS_LINKS.map(l => ({ icon: l.icon, label: l.label, url: l.url })),
    ];

    items.forEach(item => {
      if (item.sep) {
        const sep = document.createElement('div');
        sep.className = 'yos-menu-sep';
        menu.appendChild(sep);
        return;
      }
      const el = document.createElement('div');
      el.className = 'yos-menu-item';
      el.innerHTML = `<span>${item.icon}</span><span>${item.label}</span>`;
      el.addEventListener('click', () => {
        closeMenu();
        if (item.url) { window.open(item.url, '_blank'); return; }
        handleMenuAction(item.action);
      });
      menu.appendChild(el);
    });

    document.body.appendChild(menu);
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#yos-ctx-menu') && !e.target.closest('#yos-logo-btn')) closeMenu();
    });
  }

  function toggleMenu() {
    const m = document.getElementById('yos-ctx-menu');
    if (!m) return;
    const btn = document.getElementById('yos-logo-btn');
    if (m.classList.contains('visible')) {
      closeMenu();
    } else {
      const r = btn.getBoundingClientRect();
      m.style.top  = (r.bottom + 6) + 'px';
      m.style.left = r.left + 'px';
      m.classList.add('visible');
    }
  }

  function closeMenu() {
    document.getElementById('yos-ctx-menu')?.classList.remove('visible');
  }

  function handleMenuAction(action) {
    switch (action) {
      case 'open-panel':
        chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
        break;
      case 'memorize':
        dispatchAction('memorize', getLastResponseText());
        break;
      case 'create-task':
        dispatchAction('create-task', getLastResponseText());
        break;
      case 'archive-session':
        dispatchAction('archive-session', document.title);
        break;
    }
  }

  // ── 2. LIRE LA DERNIÈRE RÉPONSE ──────────────────────────────
  function getLastResponseText() {
    const els = yosQueryAll(YOS_CONFIG.selectors.assistantMessages);
    if (!els.length) return '';
    return els[els.length - 1].innerText || '';
  }

  // ── 3. OBSERVER + ANALYSE ────────────────────────────────────
  function startObserver() {
    if (observerActive) return;

    const target = yosQueryFirst(YOS_CONFIG.selectors.chatContainer);
    if (!target) { setTimeout(startObserver, 2000); return; }

    const obs = new MutationObserver(() => {
      clearTimeout(window._yosDebounce);
      window._yosDebounce = setTimeout(processLatestResponse, 900);
    });

    obs.observe(target, { childList: true, subtree: true });
    observerActive = true;
  }

  function processLatestResponse() {
    if (!YOS_CONFIG.features.autoAnalyze) return;

    const text = getLastResponseText();
    if (!text || text === lastText) return;
    lastText = text;

    const analysis = yosAnalyzeResponse(text);
    if (!analysis) return;

    chrome.runtime.sendMessage({
      type: 'MANUS_RESPONSE_UPDATE',
      data: { analysis, url: location.href, title: document.title }
    }).catch(() => {});
  }

  // ── 4. DISPATCH ACTION ───────────────────────────────────────
  function dispatchAction(action, text) {
    const webhookMap = {
      'memorize':       YOS_CONFIG.webhooks.memory,
      'create-task':    YOS_CONFIG.webhooks.task,
      'archive-session':YOS_CONFIG.webhooks.archive,
    };
    const url = webhookMap[action];
    if (url) {
      yosCallWebhook(url, { action, text, timestamp: new Date().toISOString() });
      yosShowToast('✅ ' + action + ' sent to n8n');
    } else {
      navigator.clipboard.writeText(text).catch(() => {});
      yosShowToast('📋 Copied (configure webhook in settings)');
    }
  }

  // ── 5. RECEVOIR INJECT_PROMPT DU PANEL ───────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'INJECT_PROMPT' && msg.payload) {
      const { num, text } = msg.payload;
      const prompt = num ? `${num}` : text;
      const ok = yosInjectPrompt(prompt);
      if (ok) yosShowToast(`⚡ Option ${num || ''} sent`);
    }
  });

  // ── 6. INIT + SPA RE-INJECT ──────────────────────────────────
  function init() {
    injectLogo();
    startObserver();
  }

  // Gérer les navigations SPA (React Router)
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      observerActive = false;
      setTimeout(init, 1200);
    }
  }).observe(document, { subtree: true, childList: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
