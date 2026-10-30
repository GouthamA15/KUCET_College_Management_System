/* global chrome */
/**
 * Background Service Worker for KUCET Admission Bridge Chrome Extension.
 * Handles cross-browser side-panel behavior, companion window fallback, and download mediation.
 * Compatible across Google Chrome, Microsoft Edge, Brave, Opera, and Vivaldi.
 */

// 1. Guarded Side Panel Initialization with Graceful Fallback
if (typeof chrome !== 'undefined' && chrome.sidePanel && typeof chrome.sidePanel.setPanelBehavior === 'function') {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.warn('[AdmissionBridge] Error setting panel behavior:', error));
} else if (typeof chrome !== 'undefined' && chrome.action && typeof chrome.action.onClicked?.addListener === 'function') {
  // Fallback for browsers lacking chrome.sidePanel (e.g. Opera, Vivaldi, older Chromium builds)
  chrome.action.onClicked.addListener(async () => {
    if (chrome.windows && typeof chrome.windows.create === 'function') {
      try {
        await chrome.windows.create({
          url: 'sidepanel.html',
          type: 'popup',
          width: 440,
          height: 780,
          focused: true,
        });
        return;
      } catch (_winErr) {
        // Fall back to tab creation
      }
    }

    if (chrome.tabs && typeof chrome.tabs.create === 'function') {
      chrome.tabs.create({ url: 'sidepanel.html', active: true }).catch(() => {});
    }
  });
}

// 2. Message routing
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs && tabs.length > 0 ? tabs[0] : null;
      sendResponse({ tab: activeTab });
    });
    return true; // Keep channel open for async response
  }

  if (request.action === 'OPEN_BRIDGE_INTERFACE') {
    if (chrome.windows && typeof chrome.windows.create === 'function') {
      chrome.windows.create({
        url: 'sidepanel.html',
        type: 'popup',
        width: 440,
        height: 780,
        focused: true,
      }).then((win) => {
        sendResponse({ success: true, mode: 'window', id: win.id });
      }).catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }

    if (chrome.tabs && typeof chrome.tabs.create === 'function') {
      chrome.tabs.create({ url: 'sidepanel.html', active: true }).then((tab) => {
        sendResponse({ success: true, mode: 'tab', id: tab.id });
      }).catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }

    sendResponse({ success: false, error: 'Cannot open bridge interface' });
    return false;
  }

  if (request.action === 'DOWNLOAD_FILE') {
    const { url, filename } = request;
    if (!url || !filename) {
      sendResponse({ success: false, error: 'URL and filename are required for download' });
      return false;
    }

    if (chrome.downloads && typeof chrome.downloads.download === 'function') {
      chrome.downloads.download(
        {
          url: url,
          filename: filename,
          saveAs: false,
          conflictAction: 'overwrite',
        },
        (downloadId) => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ success: true, downloadId });
          }
        }
      );
      return true;
    }

    sendResponse({ success: false, error: 'Downloads API not supported' });
    return false;
  }

  return false;
});
