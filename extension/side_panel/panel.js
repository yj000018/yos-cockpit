// ============================================================
// Y-OS Side Panel — panel.js
// Logique : tabs, réception des réponses Manus, affichage dynamique,
// boutons d'action, settings persistants
// ============================================================

// ── État global ──────────────────────────────────────────────
let currentAnalysis = null;
let settings = {
  autoAnalyze: true,
  branding: true,
  logo: true,
  webhookMemory: '',
  webhookTask: ''
};

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  initTabs();
  initSettingsUI();
  listenForMessages();
  setStatus('waiting', 'En attente');
});

// ── Tabs ─────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${target}`)?.classList.add('active');
    });
  });
}

// ── Réception des messages depuis le content_script ──────────
function listenForMessages() {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'PANEL_UPDATE' && message.data) {
      handleResponseUpdate(message.data);
    }
    if (message.type === 'ACTION_TRIGGER') {
      triggerAction(message.action);
    }
  });
}

// ── Traitement d'une nouvelle réponse Manus ──────────────────
function handleResponseUpdate(data) {
  if (!settings.autoAnalyze) return;

  const { analysis } = data;
  if (!analysis) return;

  currentAnalysis = analysis;
  setStatus('active', 'Réponse reçue');

  // Mettre à jour le résumé
  const summaryEl = document.getElementById('response-summary');
  if (summaryEl) {
    summaryEl.textContent = analysis.summary || analysis.raw?.substring(0, 120) || '...';
    summaryEl.classList.remove('empty');
  }

  // Afficher les choix détectés
  renderChoices(analysis.choices || []);

  // Afficher les actions suggérées
  renderSuggestedActions(analysis.actions || []);

  // Afficher les flags de contenu
  renderContentFlags(analysis);

  // Switcher automatiquement sur l'onglet Smart si on reçoit des choix
  if ((analysis.choices?.length > 0) && isTabActive('actions')) {
    // Ne pas changer d'onglet si l'utilisateur est sur Actions
  } else if (analysis.choices?.length > 0) {
    switchTab('smart');
  }

  // Reset status après 3 secondes
  setTimeout(() => setStatus('waiting', 'En attente'), 3000);
}

// ── Rendu des choix numérotés ────────────────────────────────
function renderChoices(choices) {
  const card = document.getElementById('choices-card');
  const container = document.getElementById('choices-container');
  if (!card || !container) return;

  if (!choices || choices.length === 0) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  container.innerHTML = '';

  choices.forEach((choice, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.innerHTML = `
      <span class="choice-num">${i + 1}</span>
      <span>${escapeHtml(choice)}</span>
    `;
    btn.addEventListener('click', () => {
      sendChoiceToManus(i + 1, choice);
    });
    container.appendChild(btn);
  });
}

// ── Rendu des actions suggérées ──────────────────────────────
function renderSuggestedActions(actions) {
  const card = document.getElementById('actions-card');
  const container = document.getElementById('actions-container');
  if (!card || !container) return;

  if (!actions || actions.length === 0) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  container.innerHTML = '';

  actions.forEach((action, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.innerHTML = `
      <span class="choice-num" style="background:var(--accent)">⚡</span>
      <span>${escapeHtml(action)}</span>
    `;
    btn.addEventListener('click', () => {
      sendChoiceToManus(null, action);
    });
    container.appendChild(btn);
  });
}

// ── Flags de contenu ─────────────────────────────────────────
function renderContentFlags(analysis) {
  const card = document.getElementById('content-flags');
  const container = document.getElementById('flags-container');
  if (!card || !container) return;

  const flags = [];
  if (analysis.hasCode) flags.push({ icon: '💻', label: 'Code' });
  if (analysis.hasMarkdown) flags.push({ icon: '📝', label: 'Markdown' });
  if (analysis.choices?.length > 0) flags.push({ icon: '🔢', label: `${analysis.choices.length} choix` });

  if (flags.length === 0) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  container.innerHTML = flags.map(f =>
    `<span style="
      display:inline-flex;align-items:center;gap:4px;
      padding:3px 8px;border-radius:12px;
      background:rgba(108,99,255,0.12);
      border:1px solid var(--border);
      font-size:11px;color:var(--text-muted);
    ">${f.icon} ${f.label}</span>`
  ).join('');
}

// ── Envoyer un choix à Manus (via le content_script) ─────────
function sendChoiceToManus(num, text) {
  // Envoyer au content_script pour injecter dans le prompt de Manus
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'INJECT_PROMPT',
      payload: { num, text }
    });
    showToast(num ? `Option ${num} envoyée` : 'Action envoyée');
  });
}

// ── Actions Y-OS ─────────────────────────────────────────────
function triggerAction(action) {
  const responseText = currentAnalysis?.raw || '';

  switch (action) {
    case 'memorize':
    case 'memorize-key':
      if (settings.webhookMemory) {
        callWebhook(settings.webhookMemory, {
          action,
          text: responseText,
          timestamp: new Date().toISOString()
        });
        showToast('✅ Mémorisé dans Y-OS');
      } else {
        // Copier dans le presse-papier comme fallback
        navigator.clipboard.writeText(responseText).then(() => {
          showToast('📋 Copié (configure le webhook Mémoire)');
        });
      }
      break;

    case 'create-task':
    case 'create-issue':
      if (settings.webhookTask) {
        callWebhook(settings.webhookTask, {
          action,
          text: responseText.substring(0, 500),
          timestamp: new Date().toISOString()
        });
        showToast('✅ Tâche créée');
      } else {
        navigator.clipboard.writeText(responseText.substring(0, 500)).then(() => {
          showToast('📋 Copié (configure le webhook Tâche)');
        });
      }
      break;

    case 'copy-response':
      navigator.clipboard.writeText(responseText).then(() => {
        showToast('📋 Réponse copiée');
      });
      break;

    case 'archive-session':
      showToast('📦 Archivage en cours...');
      // À connecter au skill session-synthesizer via webhook
      break;

    case 'follow-up':
      showToast('🔄 Follow-up noté');
      break;

    case 'share-notion':
      if (settings.webhookMemory) {
        callWebhook(settings.webhookMemory, {
          action: 'notion-page',
          text: responseText,
          timestamp: new Date().toISOString()
        });
        showToast('📓 Envoyé vers Notion');
      } else {
        showToast('⚠️ Configure le webhook Mémoire');
      }
      break;
  }
}

// ── Appel webhook n8n ────────────────────────────────────────
async function callWebhook(url, payload) {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    showToast('⚠️ Erreur webhook');
    console.error('[Y-OS] Webhook error:', e);
  }
}

// ── Settings ─────────────────────────────────────────────────
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['yos_settings'], (result) => {
      if (result.yos_settings) {
        settings = { ...settings, ...result.yos_settings };
      }
      resolve();
    });
  });
}

function initSettingsUI() {
  const autoAnalyze = document.getElementById('toggle-auto-analyze');
  const branding = document.getElementById('toggle-branding');
  const logo = document.getElementById('toggle-logo');
  const webhookMemory = document.getElementById('webhook-memory');
  const webhookTask = document.getElementById('webhook-task');

  if (autoAnalyze) autoAnalyze.checked = settings.autoAnalyze;
  if (branding) branding.checked = settings.branding;
  if (logo) logo.checked = settings.logo;
  if (webhookMemory) webhookMemory.value = settings.webhookMemory || '';
  if (webhookTask) webhookTask.value = settings.webhookTask || '';
}

function saveSettings() {
  settings.autoAnalyze = document.getElementById('toggle-auto-analyze')?.checked ?? true;
  settings.branding = document.getElementById('toggle-branding')?.checked ?? true;
  settings.logo = document.getElementById('toggle-logo')?.checked ?? true;
  settings.webhookMemory = document.getElementById('webhook-memory')?.value || '';
  settings.webhookTask = document.getElementById('webhook-task')?.value || '';

  chrome.storage.sync.set({ yos_settings: settings }, () => {
    showToast('✅ Paramètres sauvegardés');
  });
}

// ── Helpers ──────────────────────────────────────────────────
function setStatus(type, text) {
  const dot = document.getElementById('status-dot');
  const label = document.getElementById('status-text');
  if (dot) {
    dot.className = 'status-dot';
    if (type === 'active') dot.classList.add('active');
    if (type === 'waiting') dot.classList.add('waiting');
  }
  if (label) label.textContent = text;
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function switchTab(tabName) {
  const tab = document.querySelector(`[data-tab="${tabName}"]`);
  if (tab) tab.click();
}

function isTabActive(tabName) {
  return document.querySelector(`[data-tab="${tabName}"]`)?.classList.contains('active');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

// Exposer triggerAction globalement (appelé depuis les onclick HTML)
window.triggerAction = triggerAction;
window.saveSettings = saveSettings;
