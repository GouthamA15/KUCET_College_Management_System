# KUCET Admission Bridge — Cross-Browser Compatibility Architecture Investigation Report

**Document Version:** 1.0.0 (Chromium Cross-Browser Compatibility)  
**Target Environments:** Google Chrome, Microsoft Edge, Brave, Opera, Vivaldi, and other Chromium-based browsers  
**Repository Branch:** `testvanilla`  
**Date:** October 30, 2026  
**Author:** Antigravity AI Engineering Team  
**Status:** Completed Investigation (Stage 1) — Ready for Controlled Implementation  

---

## 1. Executive Summary & Objective

The **KUCET Admission Bridge Chrome Extension** currently enables admission personnel to transfer confirmed student registration details and optimized photographs/signatures from the KUCET College Management System (CMS) into the Kakatiya University Online portal (`https://kuonline.co.in/BTechsql/Btechreg.aspx`).

The objective is to upgrade this extension to function seamlessly across all modern **Chromium-based browsers** (Google Chrome, Microsoft Edge, Brave, Opera, Vivaldi) from a **single, shared codebase**, preserving 100% of existing capabilities:
- Standalone CMS-backed authentication and RBAC.
- Eight-step interactive tutorial with fake mock data isolation.
- Five-tier lower-boundary income mapping (`50000`, `100001`, `250001`, `500001`, `800001`).
- Conservative 190 KiB (`194,560` bytes) image optimization ceiling.
- UTC-safe three-dropdown Date of Birth parsing.
- Permanent address copy via the same-address checkbox.
- Mandatory email exclusion.
- Strict human-in-the-loop verification (zero auto-submission).
- All 104 existing automated tests passing without regression.

---

## 2. Current Extension Architecture & API Inventory

The current extension source is organized under `extension/`:

```text
extension/
├── manifest.json       # Manifest V3 configuration
├── background.js       # Background Service Worker
├── sidepanel.html      # Unified User Interface (Auth, Tutorial, Workspace)
├── sidepanel.js        # Controller & Image Optimization Pipeline
├── tutorial.js         # 8-step Interactive Tutorial Engine & Mock Data
├── content.js          # DOM Automation Script for KU Online Portal
└── icons/              # 16px, 48px, 128px Kakatiya University branding icons
```

### Complete Inventory of Browser APIs Currently Utilized:

| Browser API | Location | Usage Purpose | Cross-Browser Compatibility Risk |
| :--- | :--- | :--- | :--- |
| `chrome.sidePanel.setPanelBehavior` | `background.js` (L8) | Configures the side panel to open on action click | **HIGH RISK**: `chrome.sidePanel` is undefined in Opera, Vivaldi, and older Chromium builds. Calling it crashes the service worker. |
| `chrome.runtime.onMessage` | `background.js`, `content.js` | Inter-context messaging between sidepanel, background, and content script | **LOW RISK**: Universally supported across all Chromium browsers. |
| `chrome.tabs.query` | `background.js`, `sidepanel.js` | Detects active tab and finds the KU Online portal tab (`Btechreg.aspx`) | **LOW RISK**: Universally supported across all Chromium browsers. |
| `chrome.tabs.sendMessage` | `sidepanel.js` | Sends form population payloads to `content.js` | **LOW RISK**: Universally supported across all Chromium browsers. |
| `chrome.tabs.onActivated` | `sidepanel.js` (L135) | Re-evaluates KU Online tab presence on tab switch | **LOW RISK**: Standard in all Chromium engines. |
| `chrome.tabs.onUpdated` | `sidepanel.js` (L138) | Re-evaluates KU Online tab presence on URL navigation | **LOW RISK**: Standard in all Chromium engines. |
| `chrome.storage.local` | `sidepanel.js`, `tutorial.js` | Persists non-sensitive flag `kucet_bridge_tutorial_completed` | **LOW RISK**: Fully supported across Chromium; graceful fallback to `localStorage` already in place. |
| `chrome.downloads.download` | `background.js` (L29) | Allows manual download of optimized JPEG images | **LOW RISK**: Supported across Chromium; fallback to DOM `<a>` download already implemented in UI. |
| `fetch` with `credentials: 'include'` | `sidepanel.js` | Authenticates and accesses CMS endpoints with ambient HTTP-only cookies | **MEDIUM RISK**: Brave Shields or strict third-party cookie blocking may affect cross-origin cookies unless host permissions are explicitly declared and verified. |

---

## 3. Browser-by-Browser Capability Matrix

| Chromium Browser | Manifest V3 Engine | `chrome.sidePanel` Native Support | Side Panel Behavior / Fallback Needed | Brave Shields / Privacy Impact | Overall Support Status |
| :--- | :---: | :---: | :--- | :--- | :---: |
| **Google Chrome** (114+) | Supported | **Yes** (Native) | Native side panel opens docked to the browser window. | Standard Chromium cookie behavior. | **Fully Supported** |
| **Microsoft Edge** (116+) | Supported | **Yes** (Native) | Opens in the Edge sidebar / side panel natively. | Standard Chromium cookie behavior. | **Fully Supported** |
| **Brave Browser** (1.58+) | Supported | **Yes** (Chromium 116+) | Native side panel supported. If Brave sidebar is hidden, fallback popup/window ensures access. | Shields may block third-party cookies if host permissions are not explicitly declared. | **Fully Supported (with host permissions)** |
| **Opera Browser** | Supported | **No / Inconsistent** | Opera uses a proprietary sidebar API (`opera.sidebarAction`). `chrome.sidePanel` is undefined or inactive. | Requires companion popup / window fallback. | **Supported via Fallback** |
| **Vivaldi Browser** | Supported | **Partial / Inconsistent** | Vivaldi uses Web Panels. `chrome.sidePanel` is not reliably exposed. | Requires companion popup / window fallback. | **Supported via Fallback** |

---

## 4. Key Cross-Browser Challenges & Identified Incompatibilities

### A. The `chrome.sidePanel` Crash Hazard (Service Worker Startup)
In `extension/background.js`:
```javascript
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.warn('[AdmissionBridge] Error setting panel behavior:', error));
```
**Forensics:** In Opera or Vivaldi where `chrome.sidePanel` is `undefined`, executing this unconditionally throws an unhandled `TypeError: Cannot read properties of undefined (reading 'setPanelBehavior')`. In Manifest V3 service workers, this halts script evaluation, leaving the extension broken upon installation.

**Correction:**
1. Wrap API invocation in a capability check:
   ```javascript
   if (typeof chrome !== 'undefined' && chrome.sidePanel && typeof chrome.sidePanel.setPanelBehavior === 'function') {
     chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(...);
   }
   ```
2. When `chrome.sidePanel` is absent, attach a fallback listener to `chrome.action.onClicked` that opens `sidepanel.html` as a companion window (`chrome.windows.create({ url: 'sidepanel.html', type: 'popup', width: 440, height: 780 })`).

### B. Missing Alternative CMS Host Permission
`extension/manifest.json` currently declares:
```json
"host_permissions": [
  "https://kucet.tech/*",
  "http://localhost:3000/*",
  "http://127.0.0.1:3000/*",
  "https://kuonline.co.in/*"
]
```
The institutional domain `https://kucet.in/*` is an active alternative domain for the college. If staff access CMS through `kucet.in`, requests made from the extension side panel will be blocked by the browser's cross-origin sandbox unless `"https://kucet.in/*"` is explicitly included in `host_permissions`.

### C. Targeted Session Revocation vs. `Clear-Site-Data`
In `src/app/api/staff/admission/bridge/session/route.js`:
```javascript
const response = apiResponse({
  success: true,
  message: 'Admission Bridge session terminated successfully'
}, 200, { 'Clear-Site-Data': '"cache", "storage"' });
```
**Forensics:** Sending `Clear-Site-Data: "cache", "storage"` on an endpoint of `https://kucet.tech` instructs the browser to purge all origin cache and Web Storage (`localStorage`) for the entire domain. If a staff member has the KUCET CMS dashboard open in another tab, this header may unexpectedly wipe their active dashboard UI state.
**Correction:** The bridge logout should clear all authentication cookies via `clearAllAuthCookies(response)` and revoke server session records via `handleLogoutRevocation()`, without emitting origin-wide `Clear-Site-Data` cache/storage destruction.

### D. Brave Shields & Cookie Preservation
Brave includes aggressive tracker and cookie blocking. However, because Chromium extensions with explicit `host_permissions` for a domain are granted direct API access, session cookies set on `https://kucet.tech` persist across extension requests provided `SameSite=Lax` and `Secure` attributes are honored.

---

## 5. Proposed Cross-Browser Architecture

We will implement a clean, lightweight compatibility layer under `extension/browser/`:

```text
extension/
├── browser/
│   ├── browser-capabilities.js   # Pure capability detection (zero user-agent guessing)
│   └── browser-adapter.js        # Normalized facade for tabs, storage, runtime, sidePanel
```

### Key Responsibilities of `BrowserAdapter`:
1. **Capability Detection (`browser-capabilities.js`)**:
   - `hasSidePanel()`: Checks whether `chrome.sidePanel` and `setPanelBehavior` exist.
   - `hasStorage()`: Checks whether `chrome.storage.local` is available.
   - `hasTabs()`: Checks whether `chrome.tabs` is available.
   - `hasDownloads()`: Checks whether `chrome.downloads` is available.
   - `hasWindows()`: Checks whether `chrome.windows` is available for fallback window creation.
2. **Unified Execution (`browser-adapter.js`)**:
   - Normalized messaging: `sendMessageToTab(tabId, message)`.
   - Normalized storage: `getStorageItem(key)`, `setStorageItem(key, value)`.
   - Side panel vs Companion Window fallback: Automatically launches the native side panel if supported; falls back to an extension popup/companion window if unsupported.

---

## 6. Implementation Strategy & Stage Breakdown

- **Stage 1 (Current)**: Architecture investigation & deliverable report.
- **Stage 2**: Implement `browser-capabilities.js` and `browser-adapter.js` with feature detection.
- **Stage 3**: Update `manifest.json` with `https://kucet.in/*` host permission, and update `background.js` with guarded side-panel initialization and `chrome.windows` / action fallback.
- **Stage 4**: Refine `DELETE /api/staff/admission/bridge/session` to eliminate disruptive `Clear-Site-Data` while maintaining rigorous cookie clearance and session revocation.
- **Stage 5**: Verify `content.js` DOM detection and image attachment compatibility across Chromium engines.
- **Stage 6**: Verify tutorial, identity banner, and workflow stepper regression.
- **Stage 7**: Add dedicated cross-browser unit tests (`tests/unit/admission-bridge/browser-adapter.test.js`) and update documentation (`BROWSER-COMPATIBILITY.md`, `README-INSTALLATION.md`, and staff guide).
- **Stage 8**: Final review, ensuring all 104 existing tests pass, new compatibility tests pass, and ESLint is clean.
