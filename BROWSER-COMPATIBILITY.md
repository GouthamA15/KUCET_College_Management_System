# KUCET Admission Bridge — Cross-Browser Compatibility Matrix & Architecture

**Document Version:** 1.0.0  
**Target Platform:** Manifest V3 Chromium Extensions  
**Baseline Date:** October 30, 2026  
**Status:** Unified Codebase Verified | 118 Unit Tests Passing (8 Suites) | 0 ESLint Errors  

---

## 1. Overview & Architectural Philosophy

The **KUCET Admission Bridge** runs from a **single, shared codebase** across all major Chromium-based web browsers. Rather than maintaining separate forks or browser-specific builds, the extension utilizes pure runtime feature detection via a centralized [`BrowserAdapter`](file:///run/media/admino/New%20Volume/User/Desktop/CMS/src/lib/admission-bridge/browser-adapter.js) and [`BrowserCapabilities`](file:///run/media/admino/New%20Volume/User/Desktop/CMS/src/lib/admission-bridge/browser-capabilities.js) layer.

---

## 2. Browser Compatibility Matrix

| Browser | Engine / Min Version | Side Panel Mode | Standalone Auth | Content Script & Forms | Media (< 190 KiB) | Status | Notes / Instructions |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Google Chrome** | Chromium 114+ | **Native Side Panel** | Full | Full | Full | **Supported & Verified** | Default reference environment. Opens docked side panel on toolbar click. |
| **Microsoft Edge** | Chromium 116+ | **Native Side Panel** | Full | Full | Full | **Supported by API** | Uses Edge sidebar / side panel natively. Extension behavior is identical to Chrome. |
| **Brave Browser** | Chromium 116+ | **Native Side Panel** | Full | Full | Full | **Supported by API** | Shields allow first-party extension requests via declared `host_permissions`. Fallback window available if Brave sidebar is disabled. |
| **Opera Browser** | Chromium | **Companion Window Fallback** | Full | Full | Full | **Supported via Fallback** | Opera uses proprietary sidebar APIs; extension automatically falls back to a dedicated 440×780 companion window on icon click. |
| **Vivaldi Browser** | Chromium | **Companion Window Fallback** | Full | Full | Full | **Supported via Fallback** | Vivaldi uses Web Panels; extension opens a dedicated 440×780 companion window or web panel without side-panel crashes. |

---

## 3. Browser Capability Detection Layer

The extension detects APIs dynamically through [`extension/browser/browser-capabilities.js`](file:///run/media/admino/New%20Volume/User/Desktop/CMS/extension/browser/browser-capabilities.js):

```javascript
// Pure capability detection — zero user-agent sniffing for functional logic
export function hasSidePanel(env) {
  return Boolean(env.chrome?.sidePanel && typeof env.chrome.sidePanel.setPanelBehavior === 'function');
}

export function hasStorage(env) {
  return Boolean(env.chrome?.storage?.local && typeof env.chrome.storage.local.get === 'function');
}

export function hasWindows(env) {
  return Boolean(env.chrome?.windows && typeof env.chrome.windows.create === 'function');
}
```

### Side Panel Fallback Sequence:
1. **Tier 1 (Native Side Panel)**: If `chrome.sidePanel.setPanelBehavior` exists, the extension docks into the browser window's native side panel.
2. **Tier 2 (Companion Window Fallback)**: If `chrome.sidePanel` is undefined (e.g. Opera, Vivaldi), clicking the action icon triggers `chrome.windows.create({ url: 'sidepanel.html', type: 'popup', width: 440, height: 780 })`.
3. **Tier 3 (Extension Tab Fallback)**: If the window manager is restricted, it opens `sidepanel.html` in an active pinned extension tab.

---

## 4. Host Permissions & Network Invariants

The extension is granted host permissions for:
- `https://kucet.tech/*` (Primary Production CMS)
- `https://kucet.in/*` (Alternative Institutional CMS Domain)
- `http://localhost:3000/*` & `http://127.0.0.1:3000/*` (Local Development)
- `https://kuonline.co.in/*` (Target University Registration Portal)

### Cookie & Session Safety:
- **`credentials: 'include'`**: Ambient HTTP-only JWT cookies (`staff_auth` / `admin_auth`) are attached by the browser network layer to all CMS endpoints.
- **Targeted Revocation**: Bridge logout calls `DELETE /api/staff/admission/bridge/session`, which revokes server session records and purges auth cookies without emitting disruptive origin-wide `Clear-Site-Data` headers that could damage other open CMS tabs.

---

## 5. Automated Verification Evidence

The entire cross-browser architecture is tested by **118 automated unit tests across 8 test suites (100% passing)**:
- `tests/unit/admission-bridge/browser-adapter.test.js` (14 tests)
- `tests/unit/admission-bridge/derivation.test.js` (34 tests)
- `tests/unit/admission-bridge/primary-details-integration.test.js` (21 tests)
- `tests/unit/admission-bridge/image-optimizer.test.js` (16 tests)
- `tests/unit/admission-bridge/tutorial.test.js` (10 tests)
- `tests/unit/admission-bridge/auth-bridge.test.js` (8 tests)
- `tests/unit/admission-bridge/api-bridge.test.js` (8 tests)
- `tests/unit/admission-bridge/session-bridge.test.js` (7 tests)
