// ==UserScript==
// @name         Manus Enhancer — Y-OS
// @namespace    https://yos.manus.im
// @version      1.2.0
// @description  Enrichit l'interface Manus : boutons de réaction rapide + collapse des micro-étapes
// @author       Yannick Jolliet / Y-OS
// @match        https://manus.im/app*
// @match        https://manus.im/app/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @updateURL    https://raw.githubusercontent.com/yj000018/manus-enhancer/main/manus-enhancer.user.js
// @downloadURL   https://raw.githubusercontent.com/yj000018/manus-enhancer/main/manus-enhancer.user.js
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ─────────────────────────────────────────────
  // CONFIG
  // ─────────────────────────────────────────────
  const BUTTONS = [
    { label: '👌 OK',     action: 'ok',      color: '#22c55e' },
    { label: '✅ Do it',  action: 'doit',    color: '#3b82f6' },
    { label: '📋 Copy',   action: 'copy',    color: '#8b5cf6' },
    { label: '🚫 No',     action: 'no',      color: '#ef4444' },
    { label: '✏️ Edit',   action: 'edit',    color: '#f59e0b' },
    { label: '🔁 Retry',  action: 'retry',   color: '#6366f1' },
  ];

  // Sélecteurs DOM identifiés
  const SEL = {
    // Message utilisateur : div avec items-end + data-event-id
    userMsg:    'div.flex.w-full.flex-col.items-end[data-event-id]',
    // Réponse Manus : div avec gap-2 + group + data-event-id (pas items-end)
    manusMsg:   'div.flex.flex-col.gap-2.w-full.group[data-event-id]',
    // Header de phase (titre cliquable)
    phaseHdr:   '.clickable.flex.gap-2.justify-between',
    // Conteneur expandable des micro-étapes
    expandable: '[class*="transition-[max-height"]',
    // Micro-étape individuelle
    microStep:  'div.flex.items-center.group.gap-2.w-full[data-event-id]',
  };

  // ─────────────────────────────────────────────
  // STYLES
  // ─────────────────────────────────────────────
  GM_addStyle(`
    /* Barre de boutons réaction */
    .yos-reaction-bar {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      padding: 6px 0 2px 0;
      opacity: 0;
      transition: opacity 0.2s ease;
      pointer-events: none;
    }
    .yos-msg-wrapper:hover .yos-reaction-bar,
    .yos-reaction-bar:focus-within {
      opacity: 1;
      pointer-events: all;
    }

    /* Bouton individuel */
    .yos-btn {
      font-size: 11px;
      font-family: system-ui, sans-serif;
      padding: 3px 10px;
      border-radius: 20px;
      border: 1px solid rgba(255,255,255,0.15);
      cursor: pointer;
      color: #fff;
      font-weight: 500;
      letter-spacing: 0.02em;
      transition: transform 0.1s, opacity 0.1s, box-shadow 0.1s;
      white-space: nowrap;
      background: var(--yos-btn-color, #555);
      box-shadow: 0 1px 4px rgba(0,0,0,0.25);
    }
    .yos-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 3px 8px rgba(0,0,0,0.35);
      opacity: 0.92;
    }
    .yos-btn:active {
      transform: scale(0.96);
    }
    .yos-btn.yos-flash {
      animation: yos-flash 0.4s ease;
    }
    @keyframes yos-flash {
      0%   { opacity: 1; transform: scale(1.08); }
      100% { opacity: 1; transform: scale(1); }
    }

    /* Toast de feedback */
    #yos-toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: rgba(30,30,30,0.92);
      color: #fff;
      padding: 8px 16px;
      border-radius: 10px;
      font-size: 13px;
      font-family: system-ui, sans-serif;
      z-index: 99999;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.25s, transform 0.25s;
      pointer-events: none;
      backdrop-filter: blur(8px);
    }
    #yos-toast.show {
      opacity: 1;
      transform: translateY(0);
    }

    /* Panneau de contrôle flottant */
    #yos-panel {
      position: fixed;
      top: 60px;
      right: 16px;
      z-index: 99998;
      display: flex;
      flex-direction: column;
      gap: 6px;
      align-items: flex-end;
    }
    .yos-toggle-btn {
      font-size: 11px;
      font-family: system-ui, sans-serif;
      padding: 4px 10px;
      border-radius: 20px;
      border: 1px solid rgba(255,255,255,0.2);
      cursor: pointer;
      color: #fff;
      font-weight: 600;
      background: rgba(40,40,40,0.85);
      backdrop-filter: blur(8px);
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      transition: background 0.2s;
      white-space: nowrap;
    }
    .yos-toggle-btn:hover {
      background: rgba(60,60,60,0.95);
    }
    .yos-toggle-btn.active {
      background: rgba(59,130,246,0.85);
    }

    /* Micro-étapes masquées */
    .yos-steps-hidden .yos-expandable-steps {
      display: none !important;
    }

    /* Micro-étapes collapsées */
    .yos-steps-collapsed .yos-expandable-steps {
      max-height: 0 !important;
      overflow: hidden !important;
      opacity: 0 !important;
      padding-top: 0 !important;
    }

    /* Indicateur de collapse sur header de phase */
    .yos-phase-header {
      cursor: pointer !important;
      user-select: none;
    }
    .yos-phase-header::after {
      content: ' ▾';
      font-size: 10px;
      opacity: 0.5;
      margin-left: 4px;
      transition: transform 0.2s;
    }
    .yos-phase-header.collapsed::after {
      content: ' ▸';
    }
  `);

  // ─────────────────────────────────────────────
  // TOAST
  // ─────────────────────────────────────────────
  const toast = document.createElement('div');
  toast.id = 'yos-toast';
  document.body.appendChild(toast);
  let toastTimer;

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
  }

  // ─────────────────────────────────────────────
  // ÉTAT GLOBAL
  // ─────────────────────────────────────────────
  let stepsMode = GM_getValue('stepsMode', 'collapsed'); // 'visible' | 'collapsed' | 'hidden'

  // ─────────────────────────────────────────────
  // PANNEAU DE CONTRÔLE
  // ─────────────────────────────────────────────
  function buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'yos-panel';

    const btnSteps = document.createElement('button');
    btnSteps.className = 'yos-toggle-btn' + (stepsMode !== 'visible' ? ' active' : '');
    btnSteps.title = 'Basculer affichage des micro-étapes';
    updateStepsBtnLabel(btnSteps);

    btnSteps.addEventListener('click', () => {
      if (stepsMode === 'visible')       stepsMode = 'collapsed';
      else if (stepsMode === 'collapsed') stepsMode = 'hidden';
      else                                stepsMode = 'visible';
      GM_setValue('stepsMode', stepsMode);
      updateStepsBtnLabel(btnSteps);
      btnSteps.classList.toggle('active', stepsMode !== 'visible');
      applyStepsMode();
      showToast('Étapes : ' + stepsMode);
    });

    panel.appendChild(btnSteps);
    document.body.appendChild(panel);
  }

  function updateStepsBtnLabel(btn) {
    const labels = { visible: '👁 Étapes : tout', collapsed: '⊟ Étapes : réduit', hidden: '🙈 Étapes : masqué' };
    btn.textContent = labels[stepsMode] || '⊟ Étapes';
  }

  // ─────────────────────────────────────────────
  // GESTION DES MICRO-ÉTAPES
  // ─────────────────────────────────────────────
  function applyStepsMode() {
    // Appliquer sur tous les conteneurs expandables marqués
    document.querySelectorAll('.yos-expandable-steps').forEach(el => {
      const wrapper = el.closest('.yos-phase-block');
      if (!wrapper) return;
      wrapper.classList.remove('yos-steps-hidden', 'yos-steps-collapsed');
      if (stepsMode === 'hidden')     wrapper.classList.add('yos-steps-hidden');
      if (stepsMode === 'collapsed')  wrapper.classList.add('yos-steps-collapsed');
    });
  }

  function markPhaseBlock(phaseContainer) {
    if (phaseContainer.dataset.yosPhase) return;
    phaseContainer.dataset.yosPhase = '1';
    phaseContainer.classList.add('yos-phase-block');

    // Marquer le header
    const header = phaseContainer.querySelector(SEL.phaseHdr);
    if (header) {
      header.classList.add('yos-phase-header');
      header.addEventListener('click', (e) => {
        // Ne pas interférer avec le comportement natif — juste toggle class
        const expandable = phaseContainer.querySelector('.yos-expandable-steps');
        if (!expandable) return;
        const isCollapsed = expandable.style.maxHeight === '0px';
        if (isCollapsed) {
          expandable.style.maxHeight = '';
          expandable.style.opacity = '';
          expandable.style.paddingTop = '';
          header.classList.remove('collapsed');
        } else {
          expandable.style.maxHeight = '0px';
          expandable.style.overflow = 'hidden';
          expandable.style.opacity = '0';
          expandable.style.paddingTop = '0';
          header.classList.add('collapsed');
        }
      });
    }

    // Marquer le conteneur expandable
    const expandable = phaseContainer.querySelector(SEL.expandable);
    if (expandable) {
      expandable.classList.add('yos-expandable-steps');
    }

    // Appliquer le mode courant
    phaseContainer.classList.remove('yos-steps-hidden', 'yos-steps-collapsed');
    if (stepsMode === 'hidden')     phaseContainer.classList.add('yos-steps-hidden');
    if (stepsMode === 'collapsed')  phaseContainer.classList.add('yos-steps-collapsed');
  }

  // ─────────────────────────────────────────────
  // BOUTONS DE RÉACTION
  // ─────────────────────────────────────────────
  function getMessageText(msgEl) {
    return (msgEl.innerText || '').trim().substring(0, 2000);
  }

  function handleAction(action, msgEl, btn) {
    const text = getMessageText(msgEl);
    btn.classList.add('yos-flash');
    setTimeout(() => btn.classList.remove('yos-flash'), 500);

    switch (action) {
      case 'copy':
        navigator.clipboard.writeText(text).then(() => showToast('📋 Copié !'));
        break;
      case 'ok':
        showToast('👌 OK noté');
        injectUserReply('OK 👌');
        break;
      case 'doit':
        showToast('✅ Do it envoyé');
        injectUserReply('Do it ✅');
        break;
      case 'no':
        showToast('🚫 No envoyé');
        injectUserReply('No 🚫');
        break;
      case 'edit':
        showToast('✏️ Édition...');
        focusInput();
        break;
      case 'retry':
        showToast('🔁 Retry...');
        injectUserReply('Retry 🔁');
        break;
    }
  }

  function injectUserReply(text) {
    // Trouver le textarea / input de la conversation
    const input = document.querySelector('textarea, [contenteditable="true"][class*="input"], [role="textbox"]');
    if (!input) { showToast('Input non trouvé'); return; }
    input.focus();
    // Injecter le texte
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
    if (nativeInputValueSetter && input.tagName === 'TEXTAREA') {
      nativeInputValueSetter.set.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      input.textContent = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    showToast('Prêt à envoyer — appuie sur Entrée');
  }

  function focusInput() {
    const input = document.querySelector('textarea, [contenteditable="true"][role="textbox"]');
    if (input) input.focus();
  }

  function addReactionBar(msgEl, isUser) {
    if (msgEl.dataset.yosReaction) return;
    msgEl.dataset.yosReaction = '1';
    msgEl.classList.add('yos-msg-wrapper');

    const bar = document.createElement('div');
    bar.className = 'yos-reaction-bar';

    BUTTONS.forEach(({ label, action, color }) => {
      const btn = document.createElement('button');
      btn.className = 'yos-btn';
      btn.textContent = label;
      btn.style.setProperty('--yos-btn-color', color);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleAction(action, msgEl, btn);
      });
      bar.appendChild(btn);
    });

    // Pour les messages user : insérer après le contenu (à l'intérieur du wrapper)
    // Pour les messages Manus : insérer après le dernier enfant
    msgEl.appendChild(bar);
  }

  // ─────────────────────────────────────────────
  // OBSERVER — surveille les nouveaux éléments
  // ─────────────────────────────────────────────
  function processNode(node) {
    if (node.nodeType !== 1) return;

    // Messages utilisateur
    if (node.matches && node.matches(SEL.userMsg)) {
      addReactionBar(node, true);
    }
    node.querySelectorAll && node.querySelectorAll(SEL.userMsg).forEach(el => addReactionBar(el, true));

    // Messages Manus
    if (node.matches && node.matches(SEL.manusMsg)) {
      addReactionBar(node, false);
    }
    node.querySelectorAll && node.querySelectorAll(SEL.manusMsg).forEach(el => addReactionBar(el, false));

    // Blocs de phase
    const phaseHeaders = node.querySelectorAll ? node.querySelectorAll(SEL.phaseHdr) : [];
    phaseHeaders.forEach(hdr => {
      const container = hdr.closest('.flex.flex-col');
      if (container) markPhaseBlock(container);
    });
    if (node.matches && node.matches(SEL.phaseHdr)) {
      const container = node.closest('.flex.flex-col');
      if (container) markPhaseBlock(container);
    }
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach(m => {
      m.addedNodes.forEach(n => processNode(n));
      // Aussi re-processer le target si des attributs changent
      if (m.type === 'attributes' && m.target) processNode(m.target);
    });
  });

  // ─────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────
  function init() {
    buildPanel();

    // Traiter les éléments déjà présents
    document.querySelectorAll(SEL.userMsg).forEach(el => addReactionBar(el, true));
    document.querySelectorAll(SEL.manusMsg).forEach(el => addReactionBar(el, false));
    document.querySelectorAll(SEL.phaseHdr).forEach(hdr => {
      const container = hdr.closest('.flex.flex-col');
      if (container) markPhaseBlock(container);
    });

    // Observer les mutations futures
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false
    });

    console.log('[Manus Enhancer Y-OS] v1.2.0 — actif');
  }

  // Attendre que le DOM soit prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Petit délai pour laisser React monter
    setTimeout(init, 1200);
  }

})();
