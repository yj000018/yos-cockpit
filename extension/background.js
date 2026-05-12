// Y-OS Cockpit v2 — background.js
// Opens Side Panel on manus.im, relays messages between content_script and panel

chrome.action.onClicked.addListener((tab) => {
  if (tab.url && tab.url.includes('manus.im')) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && tab.url.includes('manus.im')) {
    chrome.sidePanel.setOptions({
      tabId,
      path: 'side_panel/index.html',
      enabled: true
    });
  }
});

// Relay messages from content_script → side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === 'panel') {
    chrome.runtime.sendMessage(message).catch(() => {});
  }
  if (message.target === 'content') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, message).catch(() => {});
      }
    });
  }
  sendResponse({ ok: true });
  return true;
});
