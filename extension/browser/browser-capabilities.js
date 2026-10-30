/**
 * KUCET Admission Bridge — Browser Capability Detection Engine (Extension Runtime)
 * Provides pure feature detection for Chromium browser extension APIs.
 */

(function() {
  'use strict';

  function hasSidePanel(env = typeof globalThis !== 'undefined' ? globalThis : {}) {
    const c = env.chrome;
    return Boolean(
      c &&
      typeof c.sidePanel === 'object' &&
      c.sidePanel !== null &&
      typeof c.sidePanel.setPanelBehavior === 'function'
    );
  }

  function hasStorage(env = typeof globalThis !== 'undefined' ? globalThis : {}) {
    const c = env.chrome;
    return Boolean(
      c &&
      typeof c.storage === 'object' &&
      c.storage !== null &&
      typeof c.storage.local === 'object' &&
      c.storage.local !== null &&
      typeof c.storage.local.get === 'function'
    );
  }

  function hasTabs(env = typeof globalThis !== 'undefined' ? globalThis : {}) {
    const c = env.chrome;
    return Boolean(
      c &&
      typeof c.tabs === 'object' &&
      c.tabs !== null &&
      typeof c.tabs.query === 'function' &&
      typeof c.tabs.sendMessage === 'function'
    );
  }

  function hasDownloads(env = typeof globalThis !== 'undefined' ? globalThis : {}) {
    const c = env.chrome;
    return Boolean(
      c &&
      typeof c.downloads === 'object' &&
      c.downloads !== null &&
      typeof c.downloads.download === 'function'
    );
  }

  function hasWindows(env = typeof globalThis !== 'undefined' ? globalThis : {}) {
    const c = env.chrome;
    return Boolean(
      c &&
      typeof c.windows === 'object' &&
      c.windows !== null &&
      typeof c.windows.create === 'function'
    );
  }

  function getBrowserCapabilities(env = typeof globalThis !== 'undefined' ? globalThis : {}) {
    return {
      sidePanel: hasSidePanel(env),
      storage: hasStorage(env),
      tabs: hasTabs(env),
      downloads: hasDownloads(env),
      windows: hasWindows(env),
    };
  }

  function detectBrowserBrand(
    userAgent = (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
    env = (typeof globalThis !== 'undefined' ? globalThis : {})
  ) {
    const ua = String(userAgent || '');
    if (env.navigator?.brave && typeof env.navigator.brave.isBrave === 'function') {
      return 'Brave';
    }
    if (ua.includes('Edg/')) return 'Microsoft Edge';
    if (ua.includes('OPR/') || ua.includes('Opera/')) return 'Opera';
    if (ua.includes('Vivaldi/')) return 'Vivaldi';
    if (ua.includes('Chrome/')) return 'Google Chrome';
    return 'Chromium';
  }

  const capabilitiesApi = {
    hasSidePanel,
    hasStorage,
    hasTabs,
    hasDownloads,
    hasWindows,
    getBrowserCapabilities,
    detectBrowserBrand,
  };

  if (typeof window !== 'undefined') {
    window.KUCET_CAPABILITIES = capabilitiesApi;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = capabilitiesApi;
  }
})();
