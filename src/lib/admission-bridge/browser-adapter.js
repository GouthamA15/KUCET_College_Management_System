/**
 * KUCET Admission Bridge — Unified Browser Compatibility Adapter
 * 
 * Provides a normalized interface for runtime, storage, tabs, messaging, and window fallback.
 * Works seamlessly across Chrome, Edge, Brave, Opera, and Vivaldi.
 */

import { getBrowserCapabilities, detectBrowserBrand } from './browser-capabilities';

export class BrowserAdapter {
  constructor(env = typeof globalThis !== 'undefined' ? globalThis : {}) {
    this.env = env;
    this.capabilities = getBrowserCapabilities(env);
    this.brand = detectBrowserBrand(env.navigator?.userAgent, env);
  }

  /**
   * Retrieves an item from extension storage or fallback.
   * @param {string} key
   * @returns {Promise<any>}
   */
  async getStorage(key) {
    if (this.capabilities.storage) {
      try {
        const res = await this.env.chrome.storage.local.get(key);
        return res ? res[key] : null;
      } catch (_err) {
        // Fall back to localStorage if storage.local throws
      }
    }

    if (this.env.localStorage) {
      try {
        const val = this.env.localStorage.getItem(key);
        try {
          return val ? JSON.parse(val) : val;
        } catch (_) {
          return val;
        }
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  /**
   * Sets an item in extension storage or fallback.
   * @param {string} key 
   * @param {any} value 
   */
  async setStorage(key, value) {
    if (this.capabilities.storage) {
      try {
        await this.env.chrome.storage.local.set({ [key]: value });
        return true;
      } catch (_err) {
        // Fall back to localStorage
      }
    }

    if (this.env.localStorage) {
      try {
        const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
        this.env.localStorage.setItem(key, serialized);
        return true;
      } catch (_) {
        return false;
      }
    }
    return false;
  }

  /**
   * Queries the active browser tab, prioritizing the KU Online portal tab.
   * @param {Object} [query] Optional query filter
   * @returns {Promise<Object|null>}
   */
  async getActiveTab(query = null) {
    if (!this.capabilities.tabs) return null;

    if (query) {
      try {
        const tabs = await this.env.chrome.tabs.query(query);
        return tabs && tabs.length > 0 ? tabs[0] : null;
      } catch (_) {
        return null;
      }
    }

    // 1. Current window active tab
    try {
      const tabs = await this.env.chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs.length > 0) {
        const t = tabs[0];
        if (t.url && t.url.toLowerCase().includes('btechreg.aspx')) {
          return t;
        }
        return t;
      }
    } catch (_) {
      /* ignore */
    }

    // 2. Last focused window active tab
    try {
      const tabs = await this.env.chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tabs && tabs.length > 0) {
        return tabs[0];
      }
    } catch (_) {
      /* ignore */
    }

    // 3. Search across all windows for the university portal tab
    const portalPatterns = [
      '*://kuonline.co.in/BTechsql/Btechreg.aspx*',
      '*://kuonline.co.in/btechsql/btechreg.aspx*',
      '*://www.kuonline.co.in/BTechsql/Btechreg.aspx*',
      '*://www.kuonline.co.in/btechsql/btechreg.aspx*',
      '*://*.kuonline.co.in/BTechsql/Btechreg.aspx*',
      '*://*.kuonline.co.in/btechsql/btechreg.aspx*',
    ];
    for (const pattern of portalPatterns) {
      try {
        const portalTabs = await this.env.chrome.tabs.query({ url: pattern });
        if (portalTabs && portalTabs.length > 0) {
          return portalTabs.find((t) => t.active) || portalTabs[0];
        }
      } catch (_) {
        /* ignore */
      }
    }

    // 4. Scan all open tabs for btechreg.aspx
    try {
      const allTabs = await this.env.chrome.tabs.query({});
      for (const t of allTabs) {
        if (t.url && t.url.toLowerCase().includes('btechreg.aspx')) {
          return t;
        }
      }
    } catch (_) {
      /* ignore */
    }

    return null;
  }

  /**
   * Ensures the content script is injected and ready on the target tab.
   */
  async ensureContentScript(tabId) {
    if (!tabId || !this.env.chrome?.tabs?.sendMessage) return { success: false, error: 'Invalid tabId' };

    // Ping first
    try {
      const ping = await new Promise((resolve) => {
        let done = false;
        try {
          const res = this.env.chrome.tabs.sendMessage(tabId, { action: 'PORTAL_CHECK_READY' }, (cbRes) => {
            if (!done) {
              done = true;
              resolve(this.env.chrome?.runtime?.lastError ? null : cbRes);
            }
          });
          if (res && typeof res.then === 'function') {
            res.then((val) => { if (!done) { done = true; resolve(val); } }).catch(() => { if (!done) { done = true; resolve(null); } });
          }
        } catch (_) {
          if (!done) resolve(null);
        }
      });
      if (ping && ping.ready) {
        return { success: true, tabId, state: ping };
      }
    } catch (_) {
      /* ignore */
    }

    // Attempt injection if scripting API is available
    if (this.capabilities.scripting && this.env.chrome.scripting?.executeScript) {
      try {
        await this.env.chrome.scripting.executeScript({
          target: { tabId, allFrames: false },
          files: ['content.js'],
        });

        const handshake = await new Promise((resolve) => {
          setTimeout(() => {
            let done = false;
            try {
              const res = this.env.chrome.tabs.sendMessage(tabId, { action: 'PORTAL_CHECK_READY' }, (cbRes) => {
                if (!done) {
                  done = true;
                  resolve(this.env.chrome?.runtime?.lastError ? null : cbRes);
                }
              });
              if (res && typeof res.then === 'function') {
                res.then((val) => { if (!done) { done = true; resolve(val); } }).catch(() => { if (!done) { done = true; resolve(null); } });
              }
            } catch (_) {
              if (!done) resolve(null);
            }
          }, 100);
        });

        if (handshake && handshake.ready) {
          return { success: true, tabId, state: handshake };
        }
      } catch (injectErr) {
        const msg = injectErr?.message || '';
        let errorCode = 'CONTENT_SCRIPT_INJECTION_FAILED';
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('cannot access contents')) {
          errorCode = 'HOST_PERMISSION_MISSING';
        }
        return { success: false, errorCode, error: msg };
      }
    }

    return { success: false, errorCode: 'CONTENT_SCRIPT_NOT_READY', error: 'Could not establish connection to university portal tab.' };
  }

  /**
   * Sends a message to a specific tab context, supporting both callback and Promise-based runtimes.
   * @param {number} tabId 
   * @param {Object} message 
   * @returns {Promise<any>}
   */
  async sendMessageToTab(tabId, message) {
    if (!this.capabilities.tabs || !tabId) {
      throw new Error('Tabs API not available or invalid tabId');
    }

    const sendFn = this.env.chrome.tabs.sendMessage;
    if (typeof sendFn !== 'function') {
      throw new Error('chrome.tabs.sendMessage is not a function');
    }

    // Modern Chrome MV3 & promise-based mocks
    try {
      const res = sendFn.call(this.env.chrome.tabs, tabId, message);
      if (res && typeof res.then === 'function') {
        return await res;
      }
    } catch (_) {
      /* ignore */
    }

    // Callback-based fallback
    return new Promise((resolve, reject) => {
      sendFn.call(this.env.chrome.tabs, tabId, message, (response) => {
        if (this.env.chrome?.runtime?.lastError) {
          reject(new Error(this.env.chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Opens the sidepanel interface or safely falls back to a companion window / popup.
   * @param {string} [path='sidepanel.html']
   * @returns {Promise<{ mode: 'sidePanel'|'window'|'tab'|'unsupported', success: boolean, id?: any }>}
   */
  async openBridgeInterface(path = 'sidepanel.html') {
    if (this.capabilities.sidePanel && typeof this.env.chrome.sidePanel.open === 'function') {
      try {
        const activeTab = await this.getActiveTab();
        if (activeTab?.id) {
          await this.env.chrome.sidePanel.open({ tabId: activeTab.id });
          return { mode: 'sidePanel', success: true };
        }
      } catch (_sidePanelErr) {
        // Fall through
      }
    }

    if (this.capabilities.windows) {
      try {
        const win = await this.env.chrome.windows.create({
          url: path,
          type: 'popup',
          width: 440,
          height: 780,
          focused: true,
        });
        return { mode: 'window', success: true, id: win.id };
      } catch (_winErr) {
        // Fall through
      }
    }

    if (this.capabilities.tabs && typeof this.env.chrome.tabs?.create === 'function') {
      try {
        const tab = await this.env.chrome.tabs.create({ url: path, active: true });
        return { mode: 'tab', success: true, id: tab.id };
      } catch (_tabErr) {
        // Fall through
      }
    }

    return { mode: 'unsupported', success: false };
  }
}

/**
 * Singleton factory for browser adapter
 * @param {Object} [env]
 * @returns {BrowserAdapter}
 */
export function createBrowserAdapter(env = typeof globalThis !== 'undefined' ? globalThis : {}) {
  return new BrowserAdapter(env);
}
