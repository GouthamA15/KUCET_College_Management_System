# 🔍 Root Cause Analysis: Cloudinary Image Rendering Failure

**System Subsystem:** Storage & Asset Retrieval Pipeline  
**Status:** Forensic Audit Complete & Fixed  
**Impact:** Images uploaded to Cloudinary existed in Cloudinary Media Library but returned `404 Not Found` inside the application UI.

---

## 📌 Executive Summary of Failure Mechanism

The forensic investigation confirmed that the **upload pipeline** (`uploadToCloudinary` -> Cloudinary SDK -> TiDB Database) was working properly. Test assets uploaded successfully, received valid Cloudinary public IDs (`kucet/clerks/pfp/uuid`), and correct relative storage keys (`kucet/clerks/pfp/c70735b60f3d4d43b72eef4b2a26e270.webp`) were written to the database.

The failure occurred entirely in the **retrieval and delivery URL resolution pipeline** between database storage and browser rendering:

```
[Uploaded Asset in Cloudinary] 
       │
       ▼
[DB Stored Key]: "kucet/clerks/pfp/c70735b6...webp"
       │
       ▼
[getAssetUrl()]: Unconditionally returned "/api/assets/view/kucet/clerks/pfp/c70735b6...webp"
       │
       ▼
[Browser Request]: GET /api/assets/view/kucet/clerks/pfp/c70735b6...webp
       │
       ▼
[/api/assets/view Route]: Looked for file on VPS Local Disk (public/uploads/) 
       │
       ▼
[Local File Check]: File NOT on local disk (it was uploaded to Cloudinary!)
       │
       ▼
❌ [RESULT]: HTTP 404 Not Found -> Broken Image Icon rendered in UI
```

---

## 🔬 Key Breakdown of Failure Points

### 1. Asset URL Resolution Bypass (`src/lib/assets.js`)
* **Failure**: `getAssetUrl(path)` unconditionally prefixed all relative storage keys with `/api/assets/view/`, completely ignoring `STORAGE_TYPE=cloudinary`.
* **Consequence**: The frontend components requested local API proxy URLs (`/api/assets/view/kucet/...`) instead of Cloudinary CDN delivery URLs (`https://res.cloudinary.com/djs0ry74r/image/upload/...`).

### 2. Local Disk File Proxy Assumption (`src/app/api/assets/view/[...path]/route.js`)
* **Failure**: `/api/assets/view/[...path]/route.js` checked only `public/uploads/` on local disk using `fs.statSync`.
* **Consequence**: When `STORAGE_TYPE=cloudinary` was enabled, uploads went to Cloudinary servers. Local disk checks failed (`ENOENT`), causing `/api/assets/view` to return `404 Not Found`.

### 3. Shallow Cloudinary Search Expression (`src/app/api/admin/infrastructure/storage/route.js`)
* **Failure**: The Storage Explorer used `cloudinary.search.expression('folder:kucet/*')`.
* **Consequence**: Cloudinary's Search API interprets `folder:kucet/*` as matching assets **exactly 1 directory level down** (e.g., `kucet/backups`). Assets nested 2 levels deep (`kucet/clerks/pfp/`, `kucet/students/pfp/`, `kucet/requests/pfp/`) were omitted, causing Storage Explorer to display empty directory trees.

---

## ✅ Resolution & Architectural Fixes Applied

1. **Environment-Aware `getAssetUrl`**: Updated `src/lib/assets.js` to dynamically generate Cloudinary CDN URLs (`https://res.cloudinary.com/${cloudName}/${resourceType}/upload/f_auto,q_auto/${cleanPath}`) when `STORAGE_TYPE=cloudinary`, and local proxy URLs (`/api/assets/view/${cleanPath}`) when `STORAGE_TYPE=local`.
2. **Fallback Redirect in Proxy Route**: Updated `/api/assets/view/[...path]/route.js` so that if `STORAGE_TYPE=cloudinary` and an asset is requested via `/api/assets/view/` without being on local disk, the route issues an **HTTP 307 Temporary Redirect** to the Cloudinary CDN URL.
3. **Deep Search Expression in Storage Explorer**: Updated search expression in `route.js` to `public_id:kucet* OR folder:kucet*`, and integrated recursive `cloudinary.api.sub_folders('kucet')` API calls to discover all explicit folder nodes.

---

## 📊 Verification Matrix

| Lifecycle Stage | Pre-Fix Behavior | Post-Fix Behavior | Verification Result |
| :--- | :--- | :--- | :--- |
| **Upload Pipeline** | Uploads to Cloudinary; stores key | Uploads to Cloudinary; stores key | PASS |
| **Database Key** | `kucet/clerks/pfp/<uuid>.webp` | `kucet/clerks/pfp/<uuid>.webp` | PASS |
| **URL Generation** | `/api/assets/view/kucet/...` | `https://res.cloudinary.com/...` | PASS |
| **Browser Request** | GET `/api/assets/view/...` (404) | GET `https://res.cloudinary.com/...` (200) | PASS (HTTP 200) |
| **Storage Explorer** | Empty subfolders (1-level limit) | Full folder hierarchy (`kucet/clerks/pfp`) | PASS |
