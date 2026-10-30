/**
 * KUCET Admission Bridge — Browser Capability Detection Engine
 * 
 * Provides pure feature detection for Chromium browser extension APIs.
 * Avoids user-agent sniffing for behavioral or functional logic.
 */

/**
 * Checks if the chrome.sidePanel API is supported and functional.
 * @param {Object} [env] Environment scope (defaults to globalThis)
 * @returns {boolean}
 */
export function hasSidePanel(env = typeof globalThis !== 'undefined' ? globalThis : {}) {
  const c = env.chrome;
  return Boolean(
    c &&
    typeof c.sidePanel === 'object' &&
    c.sidePanel !== null &&
    typeof c.sidePanel.setPanelBehavior === 'function'
  );
}

/**
 * Checks if chrome.storage.local is supported.
 * @param {Object} [env]
 * @returns {boolean}
 */
export function hasStorage(env = typeof globalThis !== 'undefined' ? globalThis : {}) {
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

/**
 * Checks if chrome.tabs is supported.
 * @param {Object} [env]
 * @returns {boolean}
 */
export function hasTabs(env = typeof globalThis !== 'undefined' ? globalThis : {}) {
  const c = env.chrome;
  return Boolean(
    c &&
    typeof c.tabs === 'object' &&
    c.tabs !== null &&
    typeof c.tabs.query === 'function' &&
    typeof c.tabs.sendMessage === 'function'
  );
}

/**
 * Checks if chrome.downloads is supported.
 * @param {Object} [env]
 * @returns {boolean}
 */
export function hasDownloads(env = typeof globalThis !== 'undefined' ? globalThis : {}) {
  const c = env.chrome;
  return Boolean(
    c &&
    typeof c.downloads === 'object' &&
    c.downloads !== null &&
    typeof c.downloads.download === 'function'
  );
}

/**
 * Checks if chrome.windows is supported for window fallbacks.
 * @param {Object} [env]
 * @returns {boolean}
 */
export function hasWindows(env = typeof globalThis !== 'undefined' ? globalThis : {}) {
  const c = env.chrome;
  return Boolean(
    c &&
    typeof c.windows === 'object' &&
    c.windows !== null &&
    typeof c.windows.create === 'function'
  );
}

/**
 * Returns complete capability profile of the current runtime environment.
 * @param {Object} [env]
 * @returns {Object}
 */
export function getBrowserCapabilities(env = typeof globalThis !== 'undefined' ? globalThis : {}) {
  return {
    sidePanel: hasSidePanel(env),
    storage: hasStorage(env),
    tabs: hasTabs(env),
    downloads: hasDownloads(env),
    windows: hasWindows(env),
  };
}

/**
 * Diagnostic-only browser branding detection.
 * Note: Never use this for feature decisions. Capability detection must govern behavior.
 * @param {string} [userAgent]
 * @param {Object} [env]
 * @returns {'Microsoft Edge'|'Brave'|'Opera'|'Vivaldi'|'Google Chrome'|'Chromium'}
 */
export function detectBrowserBrand(
  userAgent = (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
  env = (typeof globalThis !== 'undefined' ? globalThis : {})
) {
  const ua = String(userAgent || '');
  
  // Brave detection via navigator.brave
  if (env.navigator?.brave && typeof env.navigator.brave.isBrave === 'function') {
    return 'Brave';
  }
  if (ua.includes('Edg/')) {
    return 'Microsoft Edge';
  }
  if (ua.includes('OPR/') || ua.includes('Opera/')) {
    return 'Opera';
  }
  if (ua.includes('Vivaldi/')) {
    return 'Vivaldi';
  }
  if (ua.includes('Chrome/')) {
    return 'Google Chrome';
  }
  return 'Chromium';
}
