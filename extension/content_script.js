// Y-OS Cockpit v2 — content_script.js
// MutationObserver, turn capture, fixed nav bar, text selection actions, branding
// ============================================================

(function () {
  'use strict';

  // ── State ────────────────────────────────────────────────────
  const state = {
    turns: [],        // [{type:'user'|'assistant', el, text, index, ts}]
    bookmarks: [],    // [{index, title, ts}]
    sessionStart: Date.now(),
    lastResponseText: '',
    observer: null
  };

  // ── Wait for DOM ready ────────────────────────────────────────
  function waitFor(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const obs = new MutationObserver(() => {
        const found = document.querySelector(selector);
        if (found) { obs.disconnect(); resolve(found); }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); reject(new Error('Timeout: ' + selector)); }, timeout);
    });
  }

  // ── Detect message nodes ─────────────────────────────────────
  // DOM Manus (May 2026) — sélecteurs stables basés sur data-event-id
  // User turn:     [data-event-id] avec classe contenant 'items-end'
  // Assistant turn:[data-event-id] avec classe contenant 'gap-2 w-full'
  // Mémorisé dans Mem0 (yannick-jolliet / yos-cockpit / dom-structure)

  function classifyTurnEl(el) {
    const cls = el.className || '';
    // User: flex w-full flex-col items-end justify-end group mt-3
    if (cls.includes('items-end') && cls.includes('w-full')) return 'user';
    // Assistant: flex flex-col gap-2 w-full group mt-3
    if (cls.includes('gap-2') && cls.includes('w-full') && cls.includes('group')) return 'assistant';
    // Fallback: chercher dans les enfants si la bulle est à droite (items-end)
    if (el.querySelector('[class*="rounded-br-none"]')) return 'user';
    if (el.querySelector('[class*="whitespace-pre-wrap"]')) return 'assistant';
    return null;
  }

  function extractTurnText(el, type) {
    if (type === 'user') {
      // Bulle utilisateur: SPAN.whitespace-pre-wrap dans .rounded-br-none
      const span = el.querySelector('.ltr\\:rounded-br-none span, [class*="rounded-br-none"] span');
      if (span) return span.innerText?.trim() || '';
      // Fallback: premier span avec du texte
      const spans = el.querySelectorAll('span');
      for (const s of spans) {
        const t = s.innerText?.trim();
        if (t && t.length > 3) return t;
      }
    } else {
      // Réponse assistant: DIV.py-[3px].whitespace-pre-wrap
      const divs = el.querySelectorAll('div');
      for (const d of divs) {
        const cls = d.className || '';
        if (cls.includes('whitespace-pre-wrap') || cls.includes('py-[3px]')) {
          const t = d.innerText?.trim();
          if (t && t.length > 3) return t;
        }
      }
      // Fallback: innerText du conteneur entier (sans les boutons)
      const clone = el.cloneNode(true);
      clone.querySelectorAll('button, [role="button"], svg').forEach(n => n.remove());
      return clone.innerText?.trim() || '';
    }
    return el.innerText?.trim() || '';
  }

  function detectTurns() {
    // Sélecteur principal: tous les [data-event-id] dans le chat
    const turnEls = document.querySelectorAll('[data-event-id]');
    if (!turnEls.length) return;

    const newTurns = [];
    turnEls.forEach((el) => {
      const type = classifyTurnEl(el);
      if (!type) return;

      const text = extractTurnText(el, type);
      if (!text || text.length < 3) return;

      newTurns.push({
        type,
        el,
        text: text.slice(0, 3000),
        index: newTurns.length,
        ts: Date.now()
      });
    });

    if (newTurns.length !== state.turns.length) {
      state.turns = newTurns;
      const last = newTurns[newTurns.length - 1];
      if (last && last.type === 'assistant') {
        state.lastResponseText = last.text;
        notifyPanel({ type: 'TURNS_UPDATE', turns: serializeTurns(), lastResponse: last.text });
      } else {
        notifyPanel({ type: 'TURNS_UPDATE', turns: serializeTurns() });
      }
    }
  }

  function serializeTurns() {
    return state.turns.map(t => ({
      type: t.type,
      text: t.text.slice(0, 300),
      index: t.index,
      ts: t.ts
    }));
  }

  // ── MutationObserver ─────────────────────────────────────────
  function startObserver() {
    if (state.observer) state.observer.disconnect();
    state.observer = new MutationObserver(() => detectTurns());
    state.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    detectTurns();
  }

  // ── Navigation helpers ────────────────────────────────────────
  function scrollToTurn(index) {
    const turn = state.turns[index];
    if (turn?.el) {
      turn.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function scrollToBottom() {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  function getCurrentTurnIndex() {
    // Find the turn closest to the current viewport center
    const mid = window.scrollY + window.innerHeight / 2;
    let closest = 0, minDist = Infinity;
    state.turns.forEach((t, i) => {
      if (!t.el) return;
      const rect = t.el.getBoundingClientRect();
      const absTop = rect.top + window.scrollY;
      const dist = Math.abs(absTop - mid);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    return closest;
  }

  function navPrevQuestion() {
    const cur = getCurrentTurnIndex();
    for (let i = cur - 1; i >= 0; i--) {
      if (state.turns[i].type === 'user') { scrollToTurn(i); return; }
    }
    scrollToTop();
  }

  function navNextQuestion() {
    const cur = getCurrentTurnIndex();
    for (let i = cur + 1; i < state.turns.length; i++) {
      if (state.turns[i].type === 'user') { scrollToTurn(i); return; }
    }
  }

  function navPrevResponse() {
    const cur = getCurrentTurnIndex();
    for (let i = cur - 1; i >= 0; i--) {
      if (state.turns[i].type === 'assistant') { scrollToTurn(i); return; }
    }
  }

  function navNextResponse() {
    const cur = getCurrentTurnIndex();
    for (let i = cur + 1; i < state.turns.length; i++) {
      if (state.turns[i].type === 'assistant') { scrollToTurn(i); return; }
    }
  }

  // ── Bookmark ─────────────────────────────────────────────────
  function addBookmark() {
    const cur = getCurrentTurnIndex();
    const turn = state.turns[cur];
    if (!turn) return;
    const title = turn.text.slice(0, 60).replace(/\n/g, ' ');
    const bm = { index: cur, title, ts: Date.now(), type: turn.type };
    state.bookmarks.push(bm);
    saveBookmarks();
    notifyPanel({ type: 'BOOKMARK_ADDED', bookmark: bm, bookmarks: state.bookmarks });
    showToast('🔖 Bookmark ajouté : ' + title.slice(0, 40));
  }

  function removeBookmark(ts) {
    state.bookmarks = state.bookmarks.filter(b => b.ts !== ts);
    saveBookmarks();
    notifyPanel({ type: 'BOOKMARKS_UPDATE', bookmarks: state.bookmarks });
  }

  async function saveBookmarks() {
    await YOS.save('yos_bookmarks', state.bookmarks);
  }

  async function loadBookmarks() {
    state.bookmarks = await YOS.load('yos_bookmarks', []);
    notifyPanel({ type: 'BOOKMARKS_UPDATE', bookmarks: state.bookmarks });
  }

  // ── Inject text into input ────────────────────────────────────
  function injectIntoInput(text) {
    const input = document.querySelector(YOS.selectors.inputBox);
    if (!input) return;
    const current = input.value || input.innerText || '';
    const separator = current.trim() ? '\n\n' : '';
    if (input.tagName === 'TEXTAREA') {
      const pos = input.selectionStart || input.value.length;
      input.value = input.value.slice(0, pos) + separator + text + input.value.slice(pos);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (input.contentEditable === 'true') {
      input.focus();
      document.execCommand('insertText', false, separator + text);
    }
    input.focus();
  }

  // ── Fixed Navigation Bar ──────────────────────────────────────
  function createNavBar() {
    if (document.getElementById('yos-nav-bar')) return;

    const bar = document.createElement('div');
    bar.id = 'yos-nav-bar';
    bar.innerHTML = `
      <button data-nav="top" title="Début du chat">⏫</button>
      <button data-nav="prev-q" title="Question précédente">⬆Q</button>
      <button data-nav="prev-r" title="Réponse précédente">⬆R</button>
      <button data-nav="next-r" title="Réponse suivante">⬇R</button>
      <button data-nav="next-q" title="Question suivante">⬇Q</button>
      <button data-nav="bottom" title="Fin du chat">⏬</button>
      <button data-nav="bookmark" title="Poser un bookmark ici">🔖</button>
      <button data-nav="panel" title="Ouvrir Y-OS Cockpit">🧠</button>
    `;

    bar.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.nav;
        switch (action) {
          case 'top': scrollToTop(); break;
          case 'bottom': scrollToBottom(); break;
          case 'prev-q': navPrevQuestion(); break;
          case 'next-q': navNextQuestion(); break;
          case 'prev-r': navPrevResponse(); break;
          case 'next-r': navNextResponse(); break;
          case 'bookmark': addBookmark(); break;
          case 'panel': chrome.runtime.sendMessage({ target: 'background', action: 'openPanel' }); break;
        }
      });
    });

    document.body.appendChild(bar);
  }

  // ── Text Selection Context Menu ───────────────────────────────
  let selectionMenu = null;

  function createSelectionMenu() {
    if (selectionMenu) selectionMenu.remove();
    selectionMenu = document.createElement('div');
    selectionMenu.id = 'yos-selection-menu';
    selectionMenu.innerHTML = `
      <button data-sel="inject" title="Copier dans le prompt">📋 Citer</button>
      <button data-sel="ok" title="Valider ce point">✅ OK</button>
      <button data-sel="no" title="Rejeter ce point">❌ Non</button>
      <button data-sel="task" title="Créer une tâche">➕ Tâche</button>
      <button data-sel="memory" title="Mémoriser">💾 Mémo</button>
      <button data-sel="issue" title="Créer un issue">📐 Issue</button>
      <button data-sel="later" title="Traiter plus tard">🕐 Plus tard</button>
    `;

    selectionMenu.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const action = btn.dataset.sel;
        const text = window.getSelection()?.toString()?.trim() || '';
        if (!text) return;
        handleSelectionAction(action, text);
        hideSelectionMenu();
      });
    });

    document.body.appendChild(selectionMenu);
  }

  function showSelectionMenu(x, y) {
    if (!selectionMenu) createSelectionMenu();
    selectionMenu.style.display = 'flex';
    selectionMenu.style.left = Math.min(x, window.innerWidth - 320) + 'px';
    selectionMenu.style.top = (y - 50) + 'px';
  }

  function hideSelectionMenu() {
    if (selectionMenu) selectionMenu.style.display = 'none';
  }

  function handleSelectionAction(action, text) {
    switch (action) {
      case 'inject':
        injectIntoInput(`> "${text}"`);
        break;
      case 'ok':
        injectIntoInput(`> "${text}"\n✅ OK, on continue avec ça.`);
        break;
      case 'no':
        injectIntoInput(`> "${text}"\n❌ Non, on ne fait pas ça.`);
        break;
      case 'task':
        notifyPanel({ type: 'ADD_TASK', text });
        showToast('➕ Tâche ajoutée : ' + text.slice(0, 40));
        break;
      case 'memory':
        notifyPanel({ type: 'ADD_MEMORY', text });
        showToast('💾 Mémorisé : ' + text.slice(0, 40));
        break;
      case 'issue':
        notifyPanel({ type: 'ADD_ISSUE', text });
        showToast('📐 Issue créé : ' + text.slice(0, 40));
        break;
      case 'later':
        notifyPanel({ type: 'ADD_OPEN_ITEM', text });
        showToast('🕐 Parqué pour plus tard : ' + text.slice(0, 40));
        break;
    }
  }

  document.addEventListener('mouseup', (e) => {
    setTimeout(() => {
      const sel = window.getSelection()?.toString()?.trim();
      if (sel && sel.length > 3) {
        showSelectionMenu(e.pageX, e.pageY);
      } else {
        hideSelectionMenu();
      }
    }, 50);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideSelectionMenu();
  });

  // ── Y-OS Logo Branding ────────────────────────────────────────
  function injectLogo() {
    const logoEl = document.querySelector(YOS.selectors.logo);
    if (!logoEl || document.getElementById('yos-logo-injected')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'yos-logo-injected';
    wrapper.innerHTML = `
      <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="yg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#7C3AED"/>
            <stop offset="100%" style="stop-color:#06B6D4"/>
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="15" fill="url(#yg)"/>
        <text x="16" y="21" text-anchor="middle" font-family="system-ui,sans-serif"
              font-weight="900" font-size="14" fill="white">Y</text>
      </svg>
      <span style="font-weight:800;font-size:13px;background:linear-gradient(135deg,#7C3AED,#06B6D4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-left:6px;">Y-OS</span>
    `;
    wrapper.style.cssText = 'display:flex;align-items:center;cursor:pointer;';
    wrapper.addEventListener('click', () => {
      chrome.runtime.sendMessage({ target: 'background', action: 'openPanel' });
    });

    logoEl.parentNode.insertBefore(wrapper, logoEl);
    logoEl.style.display = 'none';
  }

  // ── Toast notifications ───────────────────────────────────────
  function showToast(msg, duration = 2500) {
    let toast = document.getElementById('yos-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'yos-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('visible'), duration);
  }

  // ── Notify panel ──────────────────────────────────────────────
  function notifyPanel(data) {
    chrome.runtime.sendMessage({ target: 'panel', ...data }).catch(() => {});
  }

  // ── Listen for commands from panel ───────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.target !== 'content') return;
    switch (msg.action) {
      case 'scrollToTurn': scrollToTurn(msg.index); break;
      case 'scrollToTop': scrollToTop(); break;
      case 'scrollToBottom': scrollToBottom(); break;
      case 'navPrevQ': navPrevQuestion(); break;
      case 'navNextQ': navNextQuestion(); break;
      case 'navPrevR': navPrevResponse(); break;
      case 'navNextR': navNextResponse(); break;
      case 'addBookmark': addBookmark(); break;
      case 'removeBookmark': removeBookmark(msg.ts); break;
      case 'injectText': injectIntoInput(msg.text); break;
      case 'getTurns': notifyPanel({ type: 'TURNS_UPDATE', turns: serializeTurns(), lastResponse: state.lastResponseText }); break;
      case 'getStats': notifyPanel({ type: 'STATS_UPDATE', stats: getSessionStats() }); break;
    }
  });

  // ── Session stats ─────────────────────────────────────────────
  function getSessionStats() {
    const questions = state.turns.filter(t => t.type === 'user');
    const responses = state.turns.filter(t => t.type === 'assistant');
    const allText = state.turns.map(t => t.text).join(' ');
    const spanMs = Date.now() - state.sessionStart;
    const spanDays = (spanMs / 86400000).toFixed(1);
    return {
      questions: questions.length,
      responses: responses.length,
      totalTurns: state.turns.length,
      wordCount: YOS.utils.wordCount(allText),
      charCount: YOS.utils.charCount(allText),
      a4Pages: YOS.utils.toA4Pages(allText),
      spanDays,
      bookmarks: state.bookmarks.length
    };
  }

  // ── Init ──────────────────────────────────────────────────────
  async function init() {
    await loadBookmarks();
    createNavBar();
    startObserver();
    setTimeout(injectLogo, 2000);
    // Retry logo injection on navigation
    const navObs = new MutationObserver(() => {
      if (!document.getElementById('yos-logo-injected')) injectLogo();
    });
    navObs.observe(document.body, { childList: true, subtree: false });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
