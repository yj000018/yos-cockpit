// Y-OS Cockpit v2 — panel.js
// Full Side Panel logic: tabs, Smart analysis, Nav, Transform, Session, Memory, Settings
// ============================================================

(function () {
  'use strict';

  // ── State ────────────────────────────────────────────────────
  const state = {
    turns: [],
    bookmarks: [],
    lastResponse: '',
    notebook: [],
    prompts: [],
    decisions: [],
    tasks: [],
    issues: [],
    openItems: [],
    settings: {}
  };

  // ── Toast ─────────────────────────────────────────────────────
  function toast(msg, duration = 2500) {
    const t = document.getElementById('panel-toast');
    t.textContent = msg;
    t.classList.add('visible');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('visible'), duration);
  }

  // ── Tab switching ─────────────────────────────────────────────
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const pane = document.getElementById('pane-' + tab.dataset.tab);
      if (pane) pane.classList.add('active');
    });
  });

  // ── Send command to content script ───────────────────────────
  function sendToContent(action, extra = {}) {
    chrome.runtime.sendMessage({ target: 'content', action, ...extra }).catch(() => {});
  }

  // ── Footer nav bar ────────────────────────────────────────────
  document.querySelectorAll('#footer-nav [data-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      const nav = btn.dataset.nav;
      const map = {
        'top': 'scrollToTop', 'bottom': 'scrollToBottom',
        'prev-q': 'navPrevQ', 'next-q': 'navNextQ',
        'prev-r': 'navPrevR', 'next-r': 'navNextR',
        'bookmark': 'addBookmark'
      };
      if (map[nav]) sendToContent(map[nav]);
    });
  });

  // ── Receive messages from content_script ─────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    switch (msg.type) {
      case 'TURNS_UPDATE':
        state.turns = msg.turns || [];
        if (msg.lastResponse) {
          state.lastResponse = msg.lastResponse;
          if (state.settings.autoAnalyze !== false) analyzeLastResponse();
        }
        renderTurns();
        updateStatusDot(true);
        break;
      case 'BOOKMARKS_UPDATE':
        state.bookmarks = msg.bookmarks || [];
        renderBookmarks();
        break;
      case 'BOOKMARK_ADDED':
        state.bookmarks = msg.bookmarks || [];
        renderBookmarks();
        toast('🔖 ' + (msg.bookmark?.title || 'Bookmark ajouté'));
        break;
      case 'STATS_UPDATE':
        renderStats(msg.stats);
        break;
      case 'ADD_TASK':
        addLogItem('tasks', msg.text);
        toast('➕ Tâche : ' + msg.text.slice(0, 40));
        break;
      case 'ADD_MEMORY':
        addToNotebook(msg.text);
        toast('💾 Mémorisé');
        break;
      case 'ADD_ISSUE':
        addLogItem('issues', msg.text);
        toast('📐 Issue : ' + msg.text.slice(0, 40));
        break;
      case 'ADD_OPEN_ITEM':
        addLogItem('openItems', msg.text);
        toast('🕐 Open item ajouté');
        break;
    }
  });

  // ── Status dot ────────────────────────────────────────────────
  function updateStatusDot(active) {
    const dot = document.getElementById('status-dot');
    dot.className = active ? 'active' : 'waiting';
    setTimeout(() => { dot.className = active ? '' : 'waiting'; }, 3000);
  }

  // ── SMART TAB ────────────────────────────────────────────────

  function analyzeLastResponse() {
    const text = state.lastResponse;
    if (!text) return;

    // Summary: first 200 chars
    const summary = text.slice(0, 250).replace(/\n+/g, ' ').trim();
    document.getElementById('smart-summary').textContent = summary + (text.length > 250 ? '…' : '');

    // Extract choices
    const choices = YOS.extractChoices(text);
    const choicesCard = document.getElementById('choices-card');
    const choicesList = document.getElementById('choices-list');

    if (choices.length > 0) {
      choicesCard.style.display = 'block';
      choicesList.innerHTML = '';
      choices.forEach(c => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.innerHTML = `<span class="choice-key">${c.key}.</span><span class="choice-text">${escHtml(c.text)}</span>`;
        btn.addEventListener('click', () => {
          sendToContent('injectText', { text: `${c.key}. ${c.text} — ✅ OK, on part sur cette option.` });
          toast('✅ Option ' + c.key + ' injectée');
        });
        choicesList.appendChild(btn);
      });
    } else {
      choicesCard.style.display = 'none';
    }
  }

  // Smart action buttons
  document.querySelectorAll('#pane-smart [data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const text = state.lastResponse;
      switch (action) {
        case 'inject-ok':
          sendToContent('injectText', { text: '✅ OK, on continue dans cette direction.' });
          break;
        case 'inject-no':
          sendToContent('injectText', { text: '❌ Non, explorons une autre approche.' });
          break;
        case 'translate-fr':
          sendToContent('injectText', { text: 'Traduis la réponse précédente en français.' });
          break;
        case 'translate-en':
          sendToContent('injectText', { text: 'Translate the previous response to English.' });
          break;
        case 'reformat-list':
          sendToContent('injectText', { text: 'Reformate la réponse précédente sous forme de liste à puces structurée.' });
          break;
        case 'reformat-table':
          sendToContent('injectText', { text: 'Reformate la réponse précédente sous forme de tableau Markdown.' });
          break;
        case 'reformat-mermaid':
          sendToContent('injectText', { text: 'Génère un diagramme Mermaid représentant la structure de la réponse précédente.' });
          break;
        case 'summarize-short':
          sendToContent('injectText', { text: 'Résume la réponse précédente en 3 lignes maximum.' });
          break;
        case 'inject-all-choices':
          const choices = YOS.extractChoices(text);
          const choiceText = choices.map(c => `${c.key}. ${c.text}`).join('\n');
          sendToContent('injectText', { text: 'Voici mes retours sur les options :\n' + choiceText });
          break;
        case 'ask-more':
          sendToContent('injectText', { text: 'Développe davantage chacune des options présentées.' });
          break;
      }
    });
  });

  // ── NAV TAB ──────────────────────────────────────────────────

  function renderTurns(filter = '') {
    const list = document.getElementById('turns-list');
    if (!state.turns.length) {
      list.innerHTML = '<div class="empty">En attente de la conversation…</div>';
      return;
    }
    const filtered = filter
      ? state.turns.filter(t => t.text.toLowerCase().includes(filter.toLowerCase()))
      : state.turns;

    const count = document.getElementById('search-results-count');
    if (filter) {
      count.style.display = 'block';
      count.textContent = `${filtered.length} résultat(s) pour "${filter}"`;
    } else {
      count.style.display = 'none';
    }

    list.innerHTML = '';
    filtered.forEach(turn => {
      const div = document.createElement('div');
      div.className = `turn-item ${turn.type}`;
      const badge = turn.type === 'user' ? 'Q' : 'R';
      const badgeNum = state.turns.filter((t, i) => t.type === turn.type && i <= turn.index).length;
      let displayText = turn.text.slice(0, 80).replace(/\n/g, ' ');
      if (filter) {
        const idx = displayText.toLowerCase().indexOf(filter.toLowerCase());
        if (idx >= 0) {
          displayText = displayText.slice(0, idx)
            + `<span class="highlight">${escHtml(displayText.slice(idx, idx + filter.length))}</span>`
            + displayText.slice(idx + filter.length);
        }
      } else {
        displayText = escHtml(displayText);
      }
      div.innerHTML = `
        <span class="turn-badge ${turn.type}">${badge}${badgeNum}</span>
        <span class="turn-text">${displayText}${turn.text.length > 80 ? '…' : ''}</span>
      `;
      div.addEventListener('click', () => sendToContent('scrollToTurn', { index: turn.index }));
      list.appendChild(div);
    });
  }

  function renderBookmarks() {
    const list = document.getElementById('bookmarks-list');
    if (!state.bookmarks.length) {
      list.innerHTML = '<div class="empty">Aucun bookmark. Cliquez 🔖 dans la barre de navigation.</div>';
      return;
    }
    list.innerHTML = '';
    state.bookmarks.forEach(bm => {
      const div = document.createElement('div');
      div.className = 'bookmark-item';
      div.innerHTML = `
        <span style="font-size:12px;">🔖</span>
        <span class="bookmark-title">${escHtml(bm.title.slice(0, 50))}…</span>
        <span class="bookmark-del" data-ts="${bm.ts}" title="Supprimer">✕</span>
      `;
      div.addEventListener('click', (e) => {
        if (e.target.classList.contains('bookmark-del')) {
          sendToContent('removeBookmark', { ts: bm.ts });
        } else {
          sendToContent('scrollToTurn', { index: bm.index });
        }
      });
      list.appendChild(div);
    });
  }

  // Search
  const searchBox = document.getElementById('search-box');
  let searchTimer;
  searchBox.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => renderTurns(searchBox.value.trim()), 200);
  });

  // ── TRANSFORM TAB ────────────────────────────────────────────

  document.querySelectorAll('#pane-transform [data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const output = document.getElementById('transform-output');
      const mermaidCode = document.getElementById('mermaid-code');
      const mermaidOutput = document.getElementById('mermaid-output');
      const copyBtn = document.getElementById('copy-mermaid-btn');

      switch (action) {
        case 'synth-session': {
          const allText = state.turns.map(t => `[${t.type.toUpperCase()}] ${t.text}`).join('\n\n');
          const decisions = extractItems(allText, 'decision');
          const tasks = extractItems(allText, 'task');
          const issues = extractItems(allText, 'issue');
          output.textContent = [
            `📊 Session — ${state.turns.filter(t=>t.type==='user').length} questions, ${state.turns.filter(t=>t.type==='assistant').length} réponses`,
            '',
            decisions.length ? `✅ DÉCISIONS\n${decisions.map(d=>'• '+d).join('\n')}` : '',
            tasks.length ? `\n📋 TÂCHES\n${tasks.map(t=>'• '+t).join('\n')}` : '',
            issues.length ? `\n🐛 ISSUES\n${issues.map(i=>'• '+i).join('\n')}` : '',
            `\n📈 Stats : ${YOS.utils.wordCount(allText)} mots, ~${YOS.utils.toA4Pages(allText)} pages A4`
          ].filter(Boolean).join('\n');
          break;
        }
        case 'synth-last': {
          const text = state.lastResponse;
          if (!text) { output.textContent = 'Aucune réponse disponible.'; return; }
          const choices = YOS.extractChoices(text);
          output.textContent = [
            '📄 RÉSUMÉ DE LA DERNIÈRE RÉPONSE',
            '',
            text.slice(0, 400) + (text.length > 400 ? '…' : ''),
            choices.length ? `\n🎯 CHOIX DÉTECTÉS (${choices.length})\n${choices.map(c=>`${c.key}. ${c.text}`).join('\n')}` : ''
          ].filter(Boolean).join('\n');
          break;
        }
        case 'gen-mindmap': {
          const text = state.lastResponse || state.turns.map(t=>t.text).join(' ');
          const lines = text.split('\n').filter(l => l.match(/^[\s]*[\d•\-*]+[.)]\s+/)).slice(0, 12);
          let mmd = 'mindmap\n  root((Y-OS Session))\n';
          lines.forEach(l => {
            const clean = l.replace(/^[\s]*[\d•\-*]+[.)]\s+/, '').slice(0, 50);
            mmd += `    ${clean}\n`;
          });
          if (lines.length === 0) {
            const words = text.split(/\s+/).filter(w => w.length > 5).slice(0, 8);
            mmd = 'mindmap\n  root((Session))\n' + words.map(w => `    ${w}`).join('\n');
          }
          mermaidCode.textContent = mmd;
          mermaidOutput.style.display = 'block';
          copyBtn.style.display = 'block';
          toast('🧠 Code Mermaid généré — copiez et collez sur mermaid.live');
          break;
        }
        case 'gen-flow': {
          const turns = state.turns.slice(0, 10);
          let mmd = 'flowchart TD\n';
          turns.forEach((t, i) => {
            const label = t.text.slice(0, 40).replace(/"/g, "'");
            const shape = t.type === 'user' ? `["${label}…"]` : `("${label}…")`;
            mmd += `  T${i}${shape}\n`;
            if (i > 0) mmd += `  T${i-1} --> T${i}\n`;
          });
          mermaidCode.textContent = mmd;
          mermaidOutput.style.display = 'block';
          copyBtn.style.display = 'block';
          toast('➡️ Flow généré — copiez sur mermaid.live');
          break;
        }
        case 'copy-mermaid': {
          const code = document.getElementById('mermaid-code').textContent;
          navigator.clipboard.writeText(code).then(() => toast('📋 Code Mermaid copié !'));
          break;
        }
        case 'export-md': {
          const md = state.turns.map(t => `## ${t.type === 'user' ? '👤 Question' : '🤖 Réponse'}\n\n${t.text}`).join('\n\n---\n\n');
          downloadFile('session.md', md, 'text/markdown');
          toast('📄 Export Markdown téléchargé');
          break;
        }
        case 'export-json': {
          const json = JSON.stringify({ turns: state.turns, bookmarks: state.bookmarks, decisions: state.decisions, tasks: state.tasks, issues: state.issues, openItems: state.openItems, exportedAt: new Date().toISOString() }, null, 2);
          downloadFile('session.json', json, 'application/json');
          toast('📋 Export JSON téléchargé');
          break;
        }
        case 'export-pdf': {
          sendToContent('injectText', { text: '' });
          window.print();
          toast('📑 Impression/PDF lancée');
          break;
        }
        case 'export-sheets': {
          const rows = state.turns.map(t => [t.type, t.text.replace(/\n/g, ' ').slice(0, 300)]);
          const csv = [['Type', 'Texte'], ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
          downloadFile('session.csv', csv, 'text/csv');
          toast('📊 CSV téléchargé (importable dans Google Sheets)');
          break;
        }
      }
    });
  });

  // ── SESSION TAB ──────────────────────────────────────────────

  function extractItems(text, type) {
    return YOS.extractItems(text, type);
  }

  function addLogItem(listKey, text) {
    state[listKey].push({ text, ts: Date.now() });
    renderLogList(listKey);
  }

  function renderLogList(listKey) {
    const map = {
      decisions: { el: 'decisions-list', type: 'decision', label: '✅' },
      tasks: { el: 'tasks-list', type: 'task', label: '📋' },
      issues: { el: 'issues-list', type: 'issue', label: '🐛' },
      openItems: { el: 'open-list', type: 'open', label: '🕐' }
    };
    const cfg = map[listKey];
    const list = document.getElementById(cfg.el);
    const items = state[listKey];
    if (!items.length) {
      list.innerHTML = '<div class="empty">Aucun élément.</div>';
      return;
    }
    list.innerHTML = '';
    items.forEach((item, i) => {
      const div = document.createElement('div');
      div.className = 'log-item';
      div.innerHTML = `
        <span class="log-type ${cfg.type}">${cfg.label}</span>
        <span class="log-text">${escHtml(item.text.slice(0, 150))}</span>
        <span class="log-del" data-idx="${i}" data-list="${listKey}" title="Supprimer">✕</span>
      `;
      list.appendChild(div);
    });
    list.querySelectorAll('.log-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        state[btn.dataset.list].splice(idx, 1);
        renderLogList(btn.dataset.list);
      });
    });
  }

  function renderStats(stats) {
    if (!stats) return;
    document.getElementById('stat-q').textContent = stats.questions ?? '—';
    document.getElementById('stat-r').textContent = stats.responses ?? '—';
    document.getElementById('stat-pages').textContent = stats.a4Pages ?? '—';
    document.getElementById('stat-words').textContent = stats.wordCount ?? '—';
    document.getElementById('stat-span').textContent = stats.spanDays ?? '—';
    document.getElementById('stat-bm').textContent = stats.bookmarks ?? '—';
  }

  document.querySelectorAll('#pane-session [data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      const allText = state.turns.map(t => t.text).join('\n');

      switch (action) {
        case 'extract-decisions':
          state.decisions = extractItems(allText, 'decision').map(t => ({ text: t, ts: Date.now() }));
          renderLogList('decisions');
          toast(`✅ ${state.decisions.length} décision(s) extraite(s)`);
          break;
        case 'extract-tasks':
          state.tasks = extractItems(allText, 'task').map(t => ({ text: t, ts: Date.now() }));
          renderLogList('tasks');
          toast(`📋 ${state.tasks.length} tâche(s) extraite(s)`);
          break;
        case 'extract-issues':
          state.issues = extractItems(allText, 'issue').map(t => ({ text: t, ts: Date.now() }));
          renderLogList('issues');
          toast(`🐛 ${state.issues.length} issue(s) extraite(s)`);
          break;
        case 'extract-open':
          state.openItems = extractItems(allText, 'openItem').map(t => ({ text: t, ts: Date.now() }));
          renderLogList('openItems');
          toast(`🕐 ${state.openItems.length} open item(s) extrait(s)`);
          break;
        case 'refresh-stats':
          sendToContent('getStats');
          break;
        case 'archive-session': {
          const wh = state.settings.webhooks?.archive;
          if (!wh) { toast('⚠️ URL webhook archive non configurée (Settings)'); return; }
          const payload = { turns: state.turns, decisions: state.decisions, tasks: state.tasks, issues: state.issues, openItems: state.openItems, exportedAt: new Date().toISOString() };
          const res = await YOS.callWebhook(wh, payload);
          toast(res.ok ? '📦 Session archivée !' : '❌ Erreur archive : ' + (res.error || res.status));
          break;
        }
        case 'distill-session': {
          const wh = state.settings.webhooks?.distill;
          if (!wh) { toast('⚠️ URL webhook distillation non configurée (Settings)'); return; }
          const res = await YOS.callWebhook(wh, { summary: state.turns.slice(-5).map(t=>t.text).join('\n'), decisions: state.decisions });
          toast(res.ok ? '💎 Distillation lancée !' : '❌ Erreur : ' + (res.error || res.status));
          break;
        }
        case 'hydrate-session': {
          const sel = document.getElementById('hydrate-selector');
          sel.style.display = sel.style.display === 'none' ? 'block' : 'none';
          break;
        }
        case 'hydrate-confirm': {
          const project = document.getElementById('hydrate-project').value.trim();
          if (!project) { toast('⚠️ Indique le nom du projet'); return; }
          const wh = state.settings.webhooks?.hydrate;
          if (!wh) { toast('⚠️ URL webhook hydratation non configurée'); return; }
          const res = await YOS.callWebhook(wh, { project });
          toast(res.ok ? '💧 Hydratation lancée pour : ' + project : '❌ Erreur : ' + (res.error || res.status));
          break;
        }
        case 'rename-session': {
          const name = prompt('Nouveau titre de la session :');
          if (name) {
            sendToContent('injectText', { text: `Renomme cette session : "${name}"` });
            toast('✏️ Demande de renommage envoyée');
          }
          break;
        }
      }
    });
  });

  // ── MEMORY TAB ───────────────────────────────────────────────

  function addToNotebook(text) {
    state.notebook.push({ text, ts: Date.now() });
    renderNotebook();
    YOS.save('yos_notebook', state.notebook);
  }

  function renderNotebook() {
    const list = document.getElementById('notebook-list');
    if (!state.notebook.length) {
      list.innerHTML = '<div class="empty">Aucune note. Sélectionnez du texte → 💾 Mémo.</div>';
      return;
    }
    list.innerHTML = '';
    state.notebook.forEach((item, i) => {
      const div = document.createElement('div');
      div.className = 'memo-item';
      div.innerHTML = `
        <div class="memo-text">${escHtml(item.text.slice(0, 200))}${item.text.length > 200 ? '…' : ''}</div>
        <div class="memo-ts">${new Date(item.ts).toLocaleString('fr-FR')}</div>
      `;
      list.appendChild(div);
    });
  }

  function renderPrompts() {
    const list = document.getElementById('prompts-list');
    if (!state.prompts.length) {
      list.innerHTML = '<div class="empty">Aucun prompt sauvegardé.</div>';
      return;
    }
    list.innerHTML = '';
    state.prompts.forEach((p, i) => {
      const div = document.createElement('div');
      div.className = 'prompt-item';
      div.innerHTML = `<span class="prompt-name">${escHtml(p.name)}</span><span class="prompt-use">▶ Utiliser</span>`;
      div.addEventListener('click', () => {
        sendToContent('injectText', { text: p.text });
        toast('⚡ Prompt injecté : ' + p.name);
      });
      list.appendChild(div);
    });
  }

  document.querySelector('[data-action="add-prompt"]').addEventListener('click', () => {
    const name = document.getElementById('new-prompt-name').value.trim();
    const text = document.getElementById('new-prompt-text').value.trim();
    if (!name || !text) { toast('⚠️ Nom et texte requis'); return; }
    state.prompts.push({ name, text, ts: Date.now() });
    renderPrompts();
    YOS.save('yos_prompts', state.prompts);
    document.getElementById('new-prompt-name').value = '';
    document.getElementById('new-prompt-text').value = '';
    toast('⚡ Prompt sauvegardé : ' + name);
  });

  document.querySelector('[data-action="clear-notebook"]').addEventListener('click', () => {
    if (confirm('Vider le notebook de session ?')) {
      state.notebook = [];
      renderNotebook();
      YOS.save('yos_notebook', []);
      toast('🗑 Notebook vidé');
    }
  });

  // ── SETTINGS TAB ─────────────────────────────────────────────

  async function loadSettings() {
    const s = await YOS.load('yos_settings', {});
    state.settings = s;

    // Webhooks
    const wh = s.webhooks || {};
    ['archive', 'distill', 'hydrate', 'memory', 'task', 'issue'].forEach(k => {
      const el = document.getElementById('wh-' + k);
      if (el && wh[k]) el.value = wh[k];
    });

    // Toggles
    document.getElementById('toggle-branding').checked = s.branding !== false;
    document.getElementById('toggle-logo').checked = s.logo !== false;
    document.getElementById('toggle-navbar').checked = s.navbar !== false;
    document.getElementById('toggle-selection').checked = s.selection !== false;
    document.getElementById('toggle-autoanalyze').checked = s.autoAnalyze !== false;

    // Selectors
    if (s.selectors?.user) document.getElementById('sel-user').value = s.selectors.user;
    if (s.selectors?.assistant) document.getElementById('sel-assistant').value = s.selectors.assistant;
  }

  document.querySelector('[data-action="save-settings"]').addEventListener('click', async () => {
    const wh = {};
    ['archive', 'distill', 'hydrate', 'memory', 'task', 'issue'].forEach(k => {
      const val = document.getElementById('wh-' + k).value.trim();
      if (val) wh[k] = val;
    });
    const s = {
      webhooks: wh,
      branding: document.getElementById('toggle-branding').checked,
      logo: document.getElementById('toggle-logo').checked,
      navbar: document.getElementById('toggle-navbar').checked,
      selection: document.getElementById('toggle-selection').checked,
      autoAnalyze: document.getElementById('toggle-autoanalyze').checked
    };
    state.settings = s;
    // Sync webhooks to YOS core
    Object.assign(YOS.webhooks, wh);
    await YOS.save('yos_settings', s);
    toast('💾 Paramètres sauvegardés');
  });

  document.querySelector('[data-action="save-selectors"]').addEventListener('click', async () => {
    const selectors = {
      user: document.getElementById('sel-user').value.trim(),
      assistant: document.getElementById('sel-assistant').value.trim()
    };
    state.settings.selectors = selectors;
    await YOS.save('yos_settings', state.settings);
    // Send to content script
    sendToContent('updateSelectors', { selectors });
    toast('💾 Sélecteurs sauvegardés');
  });

  // ── Utilities ─────────────────────────────────────────────────

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Init ──────────────────────────────────────────────────────
  async function init() {
    await loadSettings();

    // Load persisted data
    state.notebook = await YOS.load('yos_notebook', []);
    state.prompts = await YOS.load('yos_prompts', []);
    state.bookmarks = await YOS.load('yos_bookmarks', []);

    renderNotebook();
    renderPrompts();
    renderBookmarks();
    renderTurns();

    // Request initial data from content script
    setTimeout(() => {
      sendToContent('getTurns');
      sendToContent('getStats');
    }, 500);
  }

  init();

})();

// ── PATCH v2.1 — Force Reload + Font Size Controls ────────────
// Injected after main IIFE — runs after DOM ready

document.addEventListener('DOMContentLoaded', () => {
  // ── Force Reload ────────────────────────────────────────────
  const reloadBtn = document.getElementById('force-reload-btn');
  const versionBadge = document.getElementById('version-badge');

  function doForceReload() {
    if (versionBadge) versionBadge.classList.add('reloading');
    if (reloadBtn) { reloadBtn.textContent = '⏳ Opening…'; reloadBtn.disabled = true; }

    // Step 1: Open GitHub Desktop so user can Pull
    try { chrome.tabs.create({ url: 'github-mac://openRepo/yos-cockpit', active: false }); } catch(e) {}

    // Step 2: Open brave://extensions/ — user clicks Reload there
    setTimeout(() => {
      try { chrome.tabs.create({ url: 'brave://extensions/', active: true }); } catch(e) {}
      if (versionBadge) versionBadge.classList.remove('reloading');
      if (reloadBtn) { reloadBtn.textContent = '🔄 Force Reload Extension'; reloadBtn.disabled = false; }
    }, 800);

    // Step 3: Reload extension itself (dev/unpacked mode only)
    setTimeout(() => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.reload) {
        chrome.runtime.reload();
      }
    }, 1500);
  }
  if (reloadBtn) reloadBtn.addEventListener('click', doForceReload);
  if (versionBadge) versionBadge.addEventListener('click', doForceReload);

  // ── Font Size Controls ──────────────────────────────────────
  const FONT_KEY = 'yos_font_size';
  const FONT_MIN = 11;
  const FONT_MAX = 18;
  const FONT_STEP = 1;
  const FONT_DEFAULT = 13;

  async function loadFontSize() {
    try {
      const stored = await YOS.load(FONT_KEY, FONT_DEFAULT);
      applyFontSize(stored);
    } catch(e) { applyFontSize(FONT_DEFAULT); }
  }

  function applyFontSize(size) {
    document.documentElement.style.setProperty('--fs', size + 'px');
    document.body.style.fontSize = size + 'px';
  }

  async function changeFontSize(delta) {
    const current = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--fs')) || FONT_DEFAULT;
    const next = Math.min(FONT_MAX, Math.max(FONT_MIN, current + delta));
    applyFontSize(next);
    await YOS.save(FONT_KEY, next);
  }

  const fontPlus  = document.getElementById('font-plus');
  const fontMinus = document.getElementById('font-minus');
  if (fontPlus)  fontPlus.addEventListener('click',  () => changeFontSize(+FONT_STEP));
  if (fontMinus) fontMinus.addEventListener('click', () => changeFontSize(-FONT_STEP));

  loadFontSize();
});
