/* global chrome */
/**
 * Background Service Worker for KUCET Admission Bridge Chrome Extension.
 * Handles cross-browser side-panel behavior, companion window fallback,
 * download mediation, active portal tab resolution, idempotent content-script injection,
 * and robust message routing between Side Panel and KU Online portal.
 * 
 * Communication Architecture:
 * Side Panel → Background Service Worker → Active University Tab → Content Script → University DOM
 */

const PORTAL_URL_PATTERNS = [
  '*://kuonline.co.in/BTechsql/Btechreg.aspx*',
  '*://kuonline.co.in/btechsql/btechreg.aspx*',
  '*://www.kuonline.co.in/BTechsql/Btechreg.aspx*',
  '*://www.kuonline.co.in/btechsql/btechreg.aspx*',
  '*://*.kuonline.co.in/BTechsql/Btechreg.aspx*',
  '*://*.kuonline.co.in/btechsql/btechreg.aspx*',
];
const PORTAL_URL_LOWER = 'btechreg.aspx';

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

// 2. Helper: Find the University Portal Tab
async function findPortalTab() {
  if (!chrome.tabs) return null;

  // 1. Check active tab in last focused window first
  try {
    const focusedTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (focusedTabs && focusedTabs.length > 0) {
      const activeTab = focusedTabs[0];
      if (activeTab.url && activeTab.url.toLowerCase().includes(PORTAL_URL_LOWER)) {
        return activeTab;
      }
    }
  } catch (_) {}

  // 2. Check active tab in current window
  try {
    const currentTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (currentTabs && currentTabs.length > 0) {
      const activeTab = currentTabs[0];
      if (activeTab.url && activeTab.url.toLowerCase().includes(PORTAL_URL_LOWER)) {
        return activeTab;
      }
    }
  } catch (_) {}

  // 3. Search all open tabs across all portal patterns
  for (const pattern of PORTAL_URL_PATTERNS) {
    try {
      const matchTabs = await chrome.tabs.query({ url: pattern });
      if (matchTabs && matchTabs.length > 0) {
        // Prefer active or first matching tab
        const activeMatch = matchTabs.find((t) => t.active);
        return activeMatch || matchTabs[0];
      }
    } catch (_) {}
  }

  // 4. Fallback search by scanning tabs
  try {
    const allTabs = await chrome.tabs.query({});
    for (const t of allTabs) {
      if (t.url && t.url.toLowerCase().includes(PORTAL_URL_LOWER)) {
        return t;
      }
    }
  } catch (_) {}

  return null;
}

// 3. Helper: Ping tab with timeout
function pingTab(tabId, timeoutMs = 1500) {
  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({ success: false, reason: 'TIMEOUT' });
      }
    }, timeoutMs);

    try {
      chrome.tabs.sendMessage(tabId, { action: 'PORTAL_CHECK_READY' }, (response) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          resolve({ success: false, reason: chrome.runtime.lastError.message });
        } else if (response && response.ready) {
          resolve({ success: true, response });
        } else {
          resolve({ success: false, reason: 'INVALID_RESPONSE' });
        }
      });
    } catch (err) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve({ success: false, reason: err.message });
      }
    }
  });
}

// 4. Helper: Ensure content script is injected and ready (idempotent)
async function ensureContentScriptReady(tabId) {
  // Query tab URL for diagnostic context
  let tabUrl = '';
  if (chrome.tabs && typeof chrome.tabs.get === 'function') {
    try {
      const tabObj = await chrome.tabs.get(tabId);
      tabUrl = tabObj?.url || '';
    } catch (_) {}
  }

  // Validate URL is a university registration page
  if (tabUrl && !tabUrl.toLowerCase().includes(PORTAL_URL_LOWER)) {
    return {
      success: false,
      errorCode: 'PORTAL_URL_UNSUPPORTED',
      message: `Active tab is at "${tabUrl}". Please navigate to the KU Online registration portal (https://kuonline.co.in/BTechsql/Btechreg.aspx).`,
    };
  }

  // First, perform lightweight readiness handshake
  const ping = await pingTab(tabId, 800);
  if (ping.success) {
    if (ping.response?.isSessionExpired) {
      return {
        success: false,
        errorCode: 'PORTAL_SESSION_EXPIRED',
        message: 'University portal session has expired. Please log in to KU Online again.',
        tabId,
        state: ping.response,
      };
    }
    return { success: true, tabId, state: ping.response };
  }

  // Not responding; attempt programmatic injection via chrome.scripting
  if (!chrome.scripting || typeof chrome.scripting.executeScript !== 'function') {
    return {
      success: false,
      errorCode: 'SCRIPTING_API_UNAVAILABLE',
      message: 'chrome.scripting API is not available in this browser runtime.',
    };
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      files: ['content.js'],
    });
  } catch (injectErr) {
    const errText = injectErr?.message || '';
    if (errText.toLowerCase().includes('permission') || errText.toLowerCase().includes('cannot access contents')) {
      let host = 'kuonline.co.in';
      try {
        if (tabUrl) host = new URL(tabUrl).hostname;
      } catch (_) {}
      return {
        success: false,
        errorCode: 'HOST_PERMISSION_MISSING',
        message: `Missing host permission for "${host}". Please reload the KUCET Admission Bridge extension in chrome://extensions to update permissions.`,
        details: errText,
      };
    }
    return {
      success: false,
      errorCode: 'CONTENT_SCRIPT_INJECTION_FAILED',
      message: `Failed to inject content script into tab ${tabId}: ${errText}`,
      details: errText,
    };
  }

  // Retry readiness handshake with slightly longer timeout
  const postInjectPing = await pingTab(tabId, 2000);
  if (postInjectPing.success) {
    if (postInjectPing.response?.isSessionExpired) {
      return {
        success: false,
        errorCode: 'PORTAL_SESSION_EXPIRED',
        message: 'University portal session has expired. Please log in to KU Online again.',
        tabId,
        state: postInjectPing.response,
      };
    }
    return { success: true, tabId, state: postInjectPing.response };
  }

  return {
    success: false,
    errorCode: 'CONTENT_SCRIPT_NOT_READY',
    message: 'Content script was injected but did not respond to the readiness handshake. Please refresh the university portal tab (F5).',
  };
}

// 5. Message Routing & Relay
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const action = request.action || '';

  // Tab & Portal discovery
  if (action === 'GET_ACTIVE_TAB' || action === 'FIND_PORTAL_TAB') {
    (async () => {
      const portalTab = await findPortalTab();
      if (portalTab) {
        sendResponse({ success: true, tab: portalTab, isPortal: true });
        return;
      }
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        const activeTab = tabs && tabs.length > 0 ? tabs[0] : null;
        sendResponse({
          success: Boolean(activeTab),
          tab: activeTab,
          isPortal: Boolean(activeTab?.url && activeTab.url.toLowerCase().includes(PORTAL_URL_LOWER)),
        });
      });
    })();
    return true;
  }

  // Portal connection readiness handshake
  if (action === 'PORTAL_CHECK_READY' || action === 'CHECK_PORTAL_CONNECTION') {
    (async () => {
      const targetTab = request.tabId ? { id: request.tabId } : await findPortalTab();
      if (!targetTab || !targetTab.id) {
        sendResponse({
          success: false,
          errorCode: 'PORTAL_TAB_NOT_FOUND',
          message: 'University portal tab (Btechreg.aspx) is not open. Please open https://kuonline.co.in/BTechsql/Btechreg.aspx and log in.',
        });
        return;
      }

      const readiness = await ensureContentScriptReady(targetTab.id);
      sendResponse(readiness);
    })();
    return true;
  }

  // Relay messages from Side Panel directly to portal tab with automatic injection
  if (
    action === 'PORTAL_POPULATE_ADMISSION_INFO' ||
    action === 'PORTAL_POPULATE_PRIMARY_DETAILS' ||
    action === 'PORTAL_GET_PAGE_STATE' ||
    action === 'RELAY_TO_PORTAL'
  ) {
    (async () => {
      try {
        const targetTab = request.tabId ? { id: request.tabId } : await findPortalTab();
        if (!targetTab || !targetTab.id) {
          sendResponse({
            success: false,
            errorCode: 'PORTAL_TAB_NOT_FOUND',
            message: 'University portal tab (Btechreg.aspx) not found. Please open and activate the KU Online registration page.',
          });
          return;
        }

        const readyResult = await ensureContentScriptReady(targetTab.id);
        if (!readyResult.success) {
          sendResponse(readyResult);
          return;
        }

        const messagePayload = action === 'RELAY_TO_PORTAL' ? request.portalMessage : request;

        chrome.tabs.sendMessage(targetTab.id, messagePayload, (portalResponse) => {
          if (chrome.runtime.lastError) {
            sendResponse({
              success: false,
              errorCode: 'DISPATCH_ERROR',
              message: chrome.runtime.lastError.message,
            });
          } else {
            sendResponse(portalResponse || { success: true });
          }
        });
      } catch (err) {
        sendResponse({
          success: false,
          errorCode: 'UNHANDLED_BACKGROUND_ERROR',
          message: err.message,
        });
      }
    })();
    return true;
  }

  // Open Side Panel or Companion Window
  if (action === 'OPEN_BRIDGE_INTERFACE') {
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

  // File Download Mediation
  if (action === 'DOWNLOAD_FILE') {
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
