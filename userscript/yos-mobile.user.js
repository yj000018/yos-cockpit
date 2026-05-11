// ==UserScript==
// @name         Y-OS Mobile Cockpit
// @namespace    https://github.com/yj000018/manus-enhancer
// @version      0.2.0
// @description  Y-OS Cognitive Cockpit for Manus on Mobile (Gear browser) — Branding + Smart Actions + Response Analysis
// @author       yj000018
// @match        https://manus.im/*
// @match        https://*.manus.im/*
// @require      https://raw.githubusercontent.com/yj000018/manus-enhancer/main/shared/yos-core.js
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ── CHARGER LA CONFIG SAUVEGARDÉE ────────────────────────────
  // Surcharger les webhooks depuis le stockage TM si configurés
  const savedWebhooks = {
    memory:  GM_getValue('yos_webhook_memory', ''),
    task:    GM_getValue('yos_webhook_task', ''),
    archive: GM_getValue('yos_webhook_archive', ''),
  };
  Object.assign(YOS_CONFIG.webhooks, savedWebhooks);

  // ── CSS MOBILE Y-OS ──────────────────────────────────────────
  GM_addStyle(`
    /* Fond global */
    body,
    [class*="layout"], [class*="Layout"],
    [class*="app-container"], [class*="AppContainer"] {
      background-color: #0D0D1A !important;
      color: #E8E8F0 !important;
    }

    /* Panels */
    [class*="sidebar"], [class*="Sidebar"], aside,
    header, [class*="header"], [class*="Header"],
    [class*="topbar"], [class*="Topbar"] {
      background-color: #12122A !important;
      border-color: rgba(108,99,255,0.2) !important;
    }

    /* Messages assistant */
    [class*="assistant-message"], [class*="AssistantMessage"],
    [data-role="assistant"] {
      background-color: #1A1A35 !important;
      border: 1px solid rgba(108,99,255,0.2) !important;
      border-radius: 12px !important;
    }

    /* H1/H2/H3 dans les réponses */
    [data-role="assistant"] h1, [class*="assistant-message"] h1 { color: #6C63FF !important; }
    [data-role="assistant"] h2, [class*="assistant-message"] h2 { color: #00D4AA !important; }
    [data-role="assistant"] h3, [class*="assistant-message"] h3 { color: #A8A0FF !important; }

    /* Code */
    [data-role="assistant"] code, [class*="assistant-message"] code {
      background: rgba(0,212,170,0.08) !important;
      color: #00D4AA !important;
      border-radius: 4px !important;
      padding: 1px 5px !important;
    }

    /* Input */
    textarea, [contenteditable="true"] {
      background-color: #1A1A35 !important;
      color: #E8E8F0 !important;
      border: 1px solid rgba(108,99,255,0.3) !important;
      border-radius: 12px !important;
    }

    /* Scrollbars */
    ::-webkit-scrollbar { width: 3px; }
    ::-webkit-scrollbar-thumb { background: #6C63FF; border-radius: 3px; }

    /* ── Logo Y-OS ── */
    #yos-logo-btn {
      display: inline-flex !important;
      align-items: center !important;
      gap: 5px !important;
      background: transparent !important;
      border: none !important;
      cursor: pointer !important;
      padding: 4px 8px !important;
      border-radius: 8px !important;
      -webkit-tap-highlight-color: transparent !important;
    }
    .yos-logo-label {
      font-size: 14px !important;
      font-weight: 700 !important;
      background: linear-gradient(135deg, #6C63FF, #00D4AA) !important;
      -webkit-background-clip: text !important;
      -webkit-text-fill-color: transparent !important;
    }

    /* ── Menu contextuel ── */
    #yos-ctx-menu {
      position: fixed !important;
      z-index: 999998 !important;
      background: #12122A !important;
      border: 1px solid rgba(108,99,255,0.3) !important;
      border-radius: 14px !important;
      padding: 8px !important;
      min-width: 240px !important;
      box-shadow: 0 12px 40px rgba(0,0,0,0.6) !important;
      display: none !important;
      font-family: system-ui, sans-serif !important;
    }
    #yos-ctx-menu.visible { display: block !important; }
    .yos-menu-item {
      display: flex !important;
      align-items: center !important;
      gap: 12px !important;
      padding: 12px 14px !important;
      border-radius: 8px !important;
      font-size: 14px !important;
      color: #E8E8F0 !important;
      cursor: pointer !important;
      -webkit-tap-highlight-color: transparent !important;
    }
    .yos-menu-item:active { background: rgba(108,99,255,0.2) !important; }
    .yos-menu-sep { height: 1px !important; background: rgba(108,99,255,0.2) !important; margin: 4px 8px !important; }

    /* ── Action Bar mobile (barre en bas) ── */
    #yos-action-bar {
      position: fixed !important;
      bottom: 0 !important;
      left: 0 !important;
      right: 0 !important;
      z-index: 999997 !important;
      background: #12122A !important;
      border-top: 1px solid rgba(108,99,255,0.3) !important;
      display: flex !important;
      align-items: center !important;
      padding: 8px 12px !important;
      gap: 8px !important;
      font-family: system-ui, sans-serif !important;
      transform: translateY(100%) !important;
      transition: transform 0.3s ease !important;
    }
    #yos-action-bar.visible { transform: translateY(0) !important; }

    .yos-action-btn {
      flex: 1 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      gap: 3px !important;
      padding: 8px 4px !important;
      background: #1A1A35 !important;
      border: 1px solid rgba(108,99,255,0.2) !important;
      border-radius: 10px !important;
      color: #E8E8F0 !important;
      font-size: 11px !important;
      cursor: pointer !important;
      -webkit-tap-highlight-color: transparent !important;
    }
    .yos-action-btn:active { background: rgba(108,99,255,0.2) !important; }
    .yos-action-btn .ab-icon { font-size: 18px !important; }

    /* ── Choices panel (analyse réponse) ── */
    #yos-choices-panel {
      position: fixed !important;
      bottom: 70px !important;
      left: 12px !important;
      right: 12px !important;
      z-index: 999996 !important;
      background: #12122A !important;
      border: 1px solid rgba(108,99,255,0.3) !important;
      border-radius: 14px !important;
      padding: 12px !important;
      display: none !important;
      font-family: system-ui, sans-serif !important;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.4) !important;
    }
    #yos-choices-panel.visible { display: block !important; }
    .yos-panel-title {
      font-size: 11px !important;
      font-weight: 600 !important;
      color: #8888AA !important;
      text-transform: uppercase !important;
      letter-spacing: 0.08em !important;
      margin-bottom: 8px !important;
    }
    .yos-choice-btn {
      display: flex !important;
      align-items: flex-start !important;
      gap: 10px !important;
      padding: 10px 12px !important;
      background: #1A1A35 !important;
      border: 1px solid rgba(108,99,255,0.2) !important;
      border-radius: 8px !important;
      color: #E8E8F0 !important;
      font-size: 13px !important;
      cursor: pointer !important;
      margin-bottom: 6px !important;
      text-align: left !important;
      width: 100% !important;
      -webkit-tap-highlight-color: transparent !important;
    }
    .yos-choice-btn:active { background: rgba(108,99,255,0.2) !important; }
    .yos-choice-num {
      flex-shrink: 0 !important;
      width: 22px !important; height: 22px !important;
      border-radius: 50% !important;
      background: #6C63FF !important;
      color: #fff !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    }
    #yos-choices-close {
      width: 100% !important;
      padding: 8px !important;
      background: transparent !important;
      border: 1px solid rgba(108,99,255,0.2) !important;
      border-radius: 8px !important;
      color: #8888AA !important;
      font-size: 12px !important;
      cursor: pointer !important;
      margin-top: 4px !important;
    }

    /* ── Settings panel ── */
    #yos-settings-panel {
      position: fixed !important;
      inset: 0 !important;
      z-index: 999999 !important;
      background: #0D0D1A !important;
      padding: 20px !important;
      display: none !important;
      flex-direction: column !important;
      gap: 16px !important;
      font-family: system-ui, sans-serif !important;
      overflow-y: auto !important;
    }
    #yos-settings-panel.visible { display: flex !important; }
    .yos-settings-title {
      font-size: 18px !important;
      font-weight: 700 !important;
      background: linear-gradient(135deg, #6C63FF, #00D4AA) !important;
      -webkit-background-clip: text !important;
      -webkit-text-fill-color: transparent !important;
    }
    .yos-settings-label { font-size: 13px !important; color: #E8E8F0 !important; margin-bottom: 4px !important; }
    .yos-settings-input {
      width: 100% !important;
      padding: 10px 12px !important;
      background: #1A1A35 !important;
      border: 1px solid rgba(108,99,255,0.3) !important;
      border-radius: 8px !important;
      color: #E8E8F0 !important;
      font-size: 13px !important;
    }
    .yos-settings-save {
      padding: 12px !important;
      background: linear-gradient(135deg, #6C63FF, #00D4AA) !important;
      border: none !important;
      border-radius: 10px !important;
      color: #fff !important;
      font-size: 14px !important;
      font-weight: 600 !important;
      cursor: pointer !important;
    }
    .yos-settings-close {
      padding: 10px !important;
      background: transparent !important;
      border: 1px solid rgba(108,99,255,0.2) !important;
      border-radius: 10px !important;
      color: #8888AA !important;
      font-size: 13px !important;
      cursor: pointer !important;
    }
  `);

  // ── ÉTAT ─────────────────────────────────────────────────────
  let lastText = '';
  let currentAnalysis = null;
  let observerActive = false;

  // ── LOGO + MENU ───────────────────────────────────────────────
  function injectLogo() {
    if (document.getElementById('yos-logo-btn')) return;
    const logoEl = yosQueryFirst(YOS_CONFIG.selectors.logo);
    if (!logoEl) return;
    const container = logoEl.closest('a') || logoEl.parentElement;
    if (!container) return;
    logoEl.style.cssText = 'display:none!important';

    const btn = document.createElement('button');
    btn.id = 'yos-logo-btn';
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
      { icon: '🧠', label: 'Memorize response',  action: 'memorize' },
      { icon: '✅', label: 'Create task',          action: 'create-task' },
      { icon: '📦', label: 'Archive session',      action: 'archive' },
      { sep: true },
      { icon: '🔢', label: 'Show choices',         action: 'show-choices' },
      { sep: true },
      ...YOS_LINKS.map(l => ({ icon: l.icon, label: l.label, url: l.url })),
      { sep: true },
      { icon: '⚙️', label: 'Y-OS Settings',        action: 'settings' },
    ];

    items.forEach(item => {
      if (item.sep) {
        const s = document.createElement('div'); s.className = 'yos-menu-sep'; menu.appendChild(s); return;
      }
      const el = document.createElement('div');
      el.className = 'yos-menu-item';
      el.innerHTML = `<span>${item.icon}</span><span>${item.label}</span>`;
      el.addEventListener('click', () => {
        closeMenu();
        if (item.url) { window.open(item.url, '_blank'); return; }
        handleAction(item.action);
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
    if (m.classList.contains('visible')) { closeMenu(); return; }
    const btn = document.getElementById('yos-logo-btn');
    const r = btn.getBoundingClientRect();
    m.style.top  = (r.bottom + 8) + 'px';
    m.style.left = Math.max(8, r.left) + 'px';
    m.classList.add('visible');
  }
  function closeMenu() { document.getElementById('yos-ctx-menu')?.classList.remove('visible'); }

  // ── ACTION BAR MOBILE (barre du bas) ─────────────────────────
  function buildActionBar() {
    if (document.getElementById('yos-action-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'yos-action-bar';

    const btns = [
      { icon: '🧠', label: 'Memory',   action: 'memorize' },
      { icon: '✅', label: 'Task',      action: 'create-task' },
      { icon: '🔢', label: 'Choices',  action: 'show-choices' },
      { icon: '📦', label: 'Archive',  action: 'archive' },
    ];

    btns.forEach(b => {
      const btn = document.createElement('button');
      btn.className = 'yos-action-btn';
      btn.innerHTML = `<span class="ab-icon">${b.icon}</span><span>${b.label}</span>`;
      btn.addEventListener('click', () => handleAction(b.action));
      bar.appendChild(btn);
    });

    document.body.appendChild(bar);

    // Afficher la barre quand une réponse arrive
    // (elle reste visible après la première réponse)
  }

  function showActionBar() {
    document.getElementById('yos-action-bar')?.classList.add('visible');
  }

  // ── CHOICES PANEL ─────────────────────────────────────────────
  function buildChoicesPanel() {
    if (document.getElementById('yos-choices-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'yos-choices-panel';
    panel.innerHTML = `
      <div class="yos-panel-title">🔢 Detected choices</div>
      <div id="yos-choices-list"></div>
      <button id="yos-choices-close">Close</button>
    `;
    panel.querySelector('#yos-choices-close').addEventListener('click', () => {
      panel.classList.remove('visible');
    });
    document.body.appendChild(panel);
  }

  function renderChoices(choices) {
    const list = document.getElementById('yos-choices-list');
    if (!list) return;
    list.innerHTML = '';
    if (!choices || choices.length === 0) {
      list.innerHTML = '<div style="color:#8888AA;font-size:12px;padding:8px">No numbered choices detected in this response.</div>';
      return;
    }
    choices.forEach((c, i) => {
      const btn = document.createElement('button');
      btn.className = 'yos-choice-btn';
      btn.innerHTML = `<span class="yos-choice-num">${i + 1}</span><span>${escHtml(c)}</span>`;
      btn.addEventListener('click', () => {
        yosInjectPrompt(String(i + 1));
        document.getElementById('yos-choices-panel')?.classList.remove('visible');
        yosShowToast(`⚡ Option ${i + 1} sent`);
      });
      list.appendChild(btn);
    });
  }

  // ── SETTINGS PANEL ────────────────────────────────────────────
  function buildSettingsPanel() {
    if (document.getElementById('yos-settings-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'yos-settings-panel';
    panel.innerHTML = `
      <div class="yos-settings-title">⚙️ Y-OS Settings</div>
      <div>
        <div class="yos-settings-label">Webhook — Memory (n8n)</div>
        <input class="yos-settings-input" id="yos-wh-memory" type="url" placeholder="https://n8n.../webhook/memory" value="${GM_getValue('yos_webhook_memory', '')}">
      </div>
      <div>
        <div class="yos-settings-label">Webhook — Task (n8n)</div>
        <input class="yos-settings-input" id="yos-wh-task" type="url" placeholder="https://n8n.../webhook/task" value="${GM_getValue('yos_webhook_task', '')}">
      </div>
      <div>
        <div class="yos-settings-label">Webhook — Archive (n8n)</div>
        <input class="yos-settings-input" id="yos-wh-archive" type="url" placeholder="https://n8n.../webhook/archive" value="${GM_getValue('yos_webhook_archive', '')}">
      </div>
      <button class="yos-settings-save" id="yos-settings-save-btn">💾 Save</button>
      <button class="yos-settings-close" id="yos-settings-close-btn">Cancel</button>
    `;
    panel.querySelector('#yos-settings-save-btn').addEventListener('click', () => {
      const wm = panel.querySelector('#yos-wh-memory').value.trim();
      const wt = panel.querySelector('#yos-wh-task').value.trim();
      const wa = panel.querySelector('#yos-wh-archive').value.trim();
      GM_setValue('yos_webhook_memory', wm);
      GM_setValue('yos_webhook_task', wt);
      GM_setValue('yos_webhook_archive', wa);
      YOS_CONFIG.webhooks.memory  = wm;
      YOS_CONFIG.webhooks.task    = wt;
      YOS_CONFIG.webhooks.archive = wa;
      panel.classList.remove('visible');
      yosShowToast('✅ Settings saved');
    });
    panel.querySelector('#yos-settings-close-btn').addEventListener('click', () => {
      panel.classList.remove('visible');
    });
    document.body.appendChild(panel);
  }

  // ── ACTIONS ───────────────────────────────────────────────────
  function handleAction(action) {
    const text = getLastResponseText();
    switch (action) {
      case 'memorize':
        triggerWebhook('memory', text, 'memorize');
        break;
      case 'create-task':
        triggerWebhook('task', text, 'create-task');
        break;
      case 'archive':
        triggerWebhook('archive', document.title, 'archive-session');
        break;
      case 'show-choices':
        renderChoices(currentAnalysis?.choices || []);
        document.getElementById('yos-choices-panel')?.classList.add('visible');
        break;
      case 'settings':
        document.getElementById('yos-settings-panel')?.classList.add('visible');
        break;
    }
  }

  function triggerWebhook(type, text, actionName) {
    const url = YOS_CONFIG.webhooks[type];
    if (url) {
      // Utiliser GM_xmlhttpRequest pour contourner les restrictions CORS mobile
      GM_xmlhttpRequest({
        method: 'POST',
        url,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({ action: actionName, text: text.substring(0, 1000), timestamp: new Date().toISOString(), yos_version: YOS_VERSION }),
        onload: () => yosShowToast('✅ ' + actionName + ' → n8n'),
        onerror: () => yosShowToast('⚠️ Webhook error'),
      });
    } else {
      // Fallback : copier dans le presse-papier
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text.substring(0, 1000)).then(() => {
          yosShowToast('📋 Copied (set webhook in ⚙️ Settings)');
        });
      } else {
        yosShowToast('⚙️ Configure webhook in Settings');
      }
    }
  }

  // ── OBSERVER ──────────────────────────────────────────────────
  function getLastResponseText() {
    const els = yosQueryAll(YOS_CONFIG.selectors.assistantMessages);
    return els.length ? (els[els.length - 1].innerText || '') : '';
  }

  function startObserver() {
    if (observerActive) return;
    const target = yosQueryFirst(YOS_CONFIG.selectors.chatContainer);
    if (!target) { setTimeout(startObserver, 2000); return; }

    new MutationObserver(() => {
      clearTimeout(window._yosMobileDebounce);
      window._yosMobileDebounce = setTimeout(() => {
        const text = getLastResponseText();
        if (!text || text === lastText) return;
        lastText = text;
        currentAnalysis = yosAnalyzeResponse(text);
        showActionBar();
        // Pré-charger les choix silencieusement
        if (currentAnalysis?.choices?.length > 0) {
          renderChoices(currentAnalysis.choices);
          yosShowToast(`🔢 ${currentAnalysis.choices.length} choices detected`);
        }
      }, 900);
    }).observe(target, { childList: true, subtree: true });

    observerActive = true;
  }

  // ── HELPERS ───────────────────────────────────────────────────
  function escHtml(t) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(t));
    return d.innerHTML;
  }

  // ── INIT ──────────────────────────────────────────────────────
  function init() {
    injectLogo();
    buildActionBar();
    buildChoicesPanel();
    buildSettingsPanel();
    startObserver();
    console.log(`[Y-OS Mobile] v${YOS_VERSION} ready on ${location.hostname}`);
  }

  // SPA re-inject
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
