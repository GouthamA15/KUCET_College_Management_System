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
   * Queries the currently active browser tab.
   * @returns {Promise<Object|null>}
   */
  async getActiveTab() {
    if (!this.capabilities.tabs) return null;
    try {
      const tabs = await this.env.chrome.tabs.query({ active: true, currentWindow: true });
      return tabs && tabs.length > 0 ? tabs[0] : null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Sends a message to a specific tab context.
   * @param {number} tabId 
   * @param {Object} message 
   * @returns {Promise<any>}
   */
  async sendMessageToTab(tabId, message) {
    if (!this.capabilities.tabs || !tabId) {
      throw new Error('Tabs API not available or invalid tabId');
    }
    return await this.env.chrome.tabs.sendMessage(tabId, message);
  }

  /**
   * Opens the sidepanel interface or safely falls back to a companion window / popup.
   * @param {string} [path='sidepanel.html']
   * @returns {Promise<{ mode: 'sidePanel'|'window'|'tab'|'unsupported', success: boolean, id?: any }>}
   */
  async openBridgeInterface(path = 'sidepanel.html') {
    // 1. Try sidePanel if supported
    if (this.capabilities.sidePanel && typeof this.env.chrome.sidePanel.open === 'function') {
      try {
        const activeTab = await this.getActiveTab();
        if (activeTab?.id) {
          await this.env.chrome.sidePanel.open({ tabId: activeTab.id });
          return { mode: 'sidePanel', success: true };
        }
      } catch (_sidePanelErr) {
        // Fall through to window fallback
      }
    }

    // 2. Fallback to companion popup window (e.g. Opera, Vivaldi, or standalone)
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
        // Fall through to tab fallback
      }
    }

    // 3. Fallback to extension tab
    if (this.capabilities.tabs && typeof this.env.chrome.tabs.create === 'function') {
      try {
        const tab = await this.env.chrome.tabs.create({ url: path, active: true });
        return { mode: 'tab', success: true, id: tab.id };
      } catch (_tabErr) {
        // Unable to open tab
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
