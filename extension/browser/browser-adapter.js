/**
 * KUCET Admission Bridge — Unified Browser Compatibility Adapter (Extension Runtime)
 * Works seamlessly across Chrome, Edge, Brave, Opera, and Vivaldi.
 */

(function() {
  'use strict';

  class BrowserAdapter {
    constructor(env = typeof globalThis !== 'undefined' ? globalThis : {}) {
      this.env = env;
      const caps = (env.KUCET_CAPABILITIES || (typeof window !== 'undefined' ? window.KUCET_CAPABILITIES : null));
      this.capabilities = caps ? caps.getBrowserCapabilities(env) : {
        sidePanel: Boolean(env.chrome?.sidePanel?.setPanelBehavior),
        storage: Boolean(env.chrome?.storage?.local),
        tabs: Boolean(env.chrome?.tabs?.query),
        downloads: Boolean(env.chrome?.downloads?.download),
        windows: Boolean(env.chrome?.windows?.create),
      };
      this.brand = caps ? caps.detectBrowserBrand(env.navigator?.userAgent, env) : 'Chromium';
    }

    async getStorage(key) {
      if (this.capabilities.storage) {
        try {
          const res = await this.env.chrome.storage.local.get(key);
          return res ? res[key] : null;
        } catch (_err) {
          // Fall through to localStorage
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

    async setStorage(key, value) {
      if (this.capabilities.storage) {
        try {
          await this.env.chrome.storage.local.set({ [key]: value });
          return true;
        } catch (_err) {
          // Fall through to localStorage
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

    async getActiveTab() {
      if (!this.capabilities.tabs) return null;
      try {
        const tabs = await this.env.chrome.tabs.query({ active: true, currentWindow: true });
        return tabs && tabs.length > 0 ? tabs[0] : null;
      } catch (_) {
        return null;
      }
    }

    async sendMessageToTab(tabId, message) {
      if (!this.capabilities.tabs || !tabId) {
        throw new Error('Tabs API not available or invalid tabId');
      }
      return await this.env.chrome.tabs.sendMessage(tabId, message);
    }

    async openBridgeInterface(path = 'sidepanel.html') {
      if (this.capabilities.sidePanel && typeof this.env.chrome.sidePanel?.open === 'function') {
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

  function createBrowserAdapter(env = typeof globalThis !== 'undefined' ? globalThis : {}) {
    return new BrowserAdapter(env);
  }

  const adapterApi = {
    BrowserAdapter,
    createBrowserAdapter,
  };

  if (typeof window !== 'undefined') {
    window.KUCET_ADAPTER = adapterApi;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = adapterApi;
  }
})();
