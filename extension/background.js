/* global chrome */
/**
 * Background Service Worker for KUCET Admission Bridge Chrome Extension.
 * Handles side-panel behavior, origin messaging, and download mediation.
 */

// Configure side panel to open on action toolbar icon click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.warn('[AdmissionBridge] Error setting panel behavior:', error));

// Message routing
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs && tabs.length > 0 ? tabs[0] : null;
      sendResponse({ tab: activeTab });
    });
    return true; // Keep channel open for async response
  }

  if (request.action === 'DOWNLOAD_FILE') {
    const { url, filename } = request;
    if (!url || !filename) {
      sendResponse({ success: false, error: 'URL and filename are required for download' });
      return;
    }

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
});
