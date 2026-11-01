# KUCET Admission Bridge — Cross-Browser Installation & Quickstart Guide

This guide describes how to install and run the **KUCET Admission Bridge Extension** across all supported Chromium browsers: **Google Chrome**, **Microsoft Edge**, **Brave Browser**, **Opera**, and **Vivaldi**.

---

## 1. Prerequisites

Before installing:
1. Ensure your computer has a supported Chromium-based browser installed.
2. Have your official **KUCET CMS Staff Credentials** (Email and Password) ready.
3. Obtain the approved `extension/` folder from your college system administrator.

> **Note:** You do **not** need to open or log into the KUCET CMS website in another tab before using the extension. You can authenticate directly inside the extension.

---

## 2. Browser-Specific Installation Steps

### A. Google Chrome
1. Open Google Chrome.
2. In the address bar, type `chrome://extensions` and press **Enter**.
3. Toggle the **Developer mode** switch in the top-right corner to **ON**.
4. Click the **Load unpacked** button in the top-left toolbar.
5. In the file picker, select the `extension/` folder containing `manifest.json`.
6. Click the Extensions puzzle icon in Chrome's top-right toolbar and click the **Pin** icon next to **KUCET Admission Bridge**.
7. Click the extension icon to open the docked **Side Panel**.

---

### B. Microsoft Edge
1. Open Microsoft Edge.
2. In the address bar, type `edge://extensions` and press **Enter**.
3. In the left navigation menu, turn ON **Developer mode**.
4. Click the **Load unpacked** button.
5. Select the `extension/` folder.
6. Click the Extensions icon (puzzle piece) and click the **Show in toolbar** (eye) icon.
7. Click the extension icon to open the **Edge Side Panel**.

---

### C. Brave Browser
1. Open Brave.
2. In the address bar, type `brave://extensions` and press **Enter**.
3. Toggle **Developer mode** in the top-right corner to **ON**.
4. Click **Load unpacked** and select the `extension/` folder.
5. Pin the extension to your toolbar.
6. Click the extension icon. The extension will open in Brave's native side panel (or companion window if the sidebar is disabled).

---

### D. Opera Browser
1. Open Opera.
2. In the address bar, type `opera://extensions` and press **Enter**.
3. Toggle the **Developer mode** switch in the top-right corner to **ON**.
4. Click **Load unpacked** and select the `extension/` folder.
5. Pin the extension to your toolbar.
6. Click the extension icon. The extension will automatically open as a dedicated, docked **Companion Assistant Window** (440×780) alongside your active portal tab.

---

### E. Vivaldi Browser
1. Open Vivaldi.
2. In the address bar, type `vivaldi://extensions` and press **Enter**.
3. Toggle **Developer mode** to **ON**.
4. Click **Load unpacked** and select the `extension/` folder.
5. Pin the extension to your toolbar.
6. Click the extension icon to open the **Companion Assistant Window**.

---

## 3. First-Time Authentication & Workflow

```text
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  1. Sign In  │ ──► │  2. Tutorial │ ──► │ 3. KU Online │ ──► │ 4. Transfer │
│  (CMS Staff) │     │  (8 Steps)   │     │ (Btechreg)   │     │  & Verify    │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

1. **Sign In**: Enter your official KUCET CMS staff email and password. Click **Sign In**.
2. **Interactive Tutorial**: Complete or skip the 8-step guided tutorial. You can replay it anytime by clicking **🎓 Tutorial** in the header.
3. **Open Portal**: In an adjacent tab, open the university portal:  
   `https://kuonline.co.in/BTechsql/Btechreg.aspx`
4. **Fetch Student**: In the extension, enter the 10-character KUCET Roll Number (e.g., `26567T0332`) and click **Fetch**.
5. **Populate Step 1**: Verify the student name, branch, scheme (`2013`), and `< 190 KiB` JPEG photo/signature. Click **Fill KU Online Admission Info (Step 1)**.
6. **Populate Step 2**: On KU Online, navigate to Primary Details. In the extension, click **Populate KU Online Primary Details**.
7. **Visual Audit & Submit**: Visually inspect all fields on the university portal. **Manually click the university submit button** (the extension will never auto-submit).
8. **Sign Out**: When finished, click **Sign Out** in the extension header.
