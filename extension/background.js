// ============================================================
// Y-OS Extension — background.js (Service Worker)
// Gère : ouverture du Side Panel, relay des messages
//        content_script ↔ side_panel
// ============================================================

// Ouvrir le Side Panel sur manus.im automatiquement
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('manus.im')) {
    chrome.sidePanel.setOptions({ tabId, path: 'side_panel/index.html', enabled: true });
  }
});

// Ouvrir le Side Panel au clic sur l'icône de l'extension
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Relay : content_script → side_panel
// Le content_script envoie MANUS_RESPONSE_UPDATE au background
// Le background le forward au side_panel via storage (méthode fiable)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === 'MANUS_RESPONSE_UPDATE') {
    // Stocker dans chrome.storage.session pour que le panel puisse lire
    chrome.storage.session.set({
      yos_last_response: message.data,
      yos_last_update: Date.now()
    });
    // Broadcaster à tous les panels ouverts
    chrome.runtime.sendMessage({ type: 'PANEL_UPDATE', data: message.data }).catch(() => {});
    sendResponse({ ok: true });
  }

  if (message.type === 'OPEN_SIDE_PANEL') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) chrome.sidePanel.open({ tabId: tabs[0].id });
    });
  }

  if (message.type === 'ACTION_TRIGGER') {
    // Forward au panel
    chrome.runtime.sendMessage({ type: 'ACTION_TRIGGER', action: message.action }).catch(() => {});
  }

  if (message.type === 'INJECT_PROMPT') {
    // Forward au content_script de l'onglet actif
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'INJECT_PROMPT',
          payload: message.payload
        });
      }
    });
  }

  return true; // async response
});
