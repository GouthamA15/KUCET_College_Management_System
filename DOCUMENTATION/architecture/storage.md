# 📦 Universal Storage Abstraction & Failover Architecture

This document provides a detailed specification of the **KUCET College Management System (CMS)** storage architecture, covering the Universal Storage Abstraction Layer, Strategy Pattern implementation, `FailoverStorageProvider` chain of responsibility, the non-negotiable Storage Key Invariant Rule, and environment resolution strategies.

---

## 📌 Related Documentation
- [Master Index](../README.md)
- [System Architecture](./system-architecture.md)
- [Backend Architecture](./backend.md)
- [Database Architecture](./database.md)
- [Deployment Architecture](./deployment.md)

---

## 🏛️ Universal Storage Abstraction Layer

The file management subsystem is built around a polymorphic storage abstraction layer located in `src/lib/providers/storage/`. This layer abstracts underlying physical file storage mechanisms, enabling the application to upload, retrieve, move, and delete assets across multiple cloud vendors seamlessly.

```
src/lib/providers/storage/
├── StorageProvider.js              # Base Abstract Class Interface
├── S3StorageProvider.js            # AWS S3 / Cloudflare R2 Provider Implementation
├── CloudinaryStorageProvider.js    # Cloudinary Image CDN Provider Implementation
├── LocalStorageProvider.js         # VPS Local Disk / Filesystem Provider Implementation
├── FailoverStorageProvider.js      # Resilient Multi-Provider Fallback Wrapper
└── factory.js                      # Storage Provider Factory & Environment Selector
```

### Base `StorageProvider` Contract Interface
All concrete storage providers extend `StorageProvider` and implement the following contract methods:

```javascript
export default class StorageProvider {
  /**
   * Uploads a buffer to storage under a canonical relative key.
   * @param {Buffer} fileBuffer - File binary data
   * @param {string} key - Canonical storage key (e.g., 'kucet/students/pfp/uuid.jpg')
   * @param {Object} options - Mimetype, tags, transformation options
   * @returns {Promise<{ key: string, url: string }>}
   */
  async upload(fileBuffer, key, options = {}) { throw new Error('Not implemented'); }

  /**
   * Deletes an asset by its storage key.
   * @param {string} key 
   * @returns {Promise<boolean>}
   */
  async delete(key) { throw new Error('Not implemented'); }

  /**
   * Resolves a storage key to a public URL.
   * @param {string} key 
   * @param {Object} options 
   * @returns {string}
   */
  getUrl(key, options = {}) { throw new Error('Not implemented'); }

  /** Copies an asset from source key to destination key */
  async copyFile(sourceKey, destKey) { throw new Error('Not implemented'); }

  /** Moves an asset from source key to destination key */
  async moveFile(sourceKey, destKey) { throw new Error('Not implemented'); }
}
```

---

## 🎯 Strategy Pattern & Provider Factory (`factory.js`)

Application services never instantiate concrete storage providers directly. Instead, services invoke `getStorageProvider()` from `factory.js`, which inspects environment variables and constructs a configured `FailoverStorageProvider` chain.

### Provider Factory Implementation (`src/lib/providers/storage/factory.js`)

```javascript
import CloudinaryStorageProvider from './CloudinaryStorageProvider';
import LocalStorageProvider from './LocalStorageProvider';
import S3StorageProvider from './S3StorageProvider';
import FailoverStorageProvider from './FailoverStorageProvider';

let instance = null;

export function getStorageProvider() {
  if (instance) return instance;

  const storageType = (
    process.env.NEXT_PUBLIC_STORAGE_TYPE || 
    process.env.STORAGE_TYPE || 
    'local'
  ).toLowerCase();

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 
                   process.env.CLOUDINARY_CLOUD_NAME || 
                   'djs0ry74r';

  const localProvider = new LocalStorageProvider();
  const cloudinaryProvider = new CloudinaryStorageProvider(cloudName);
  const s3Provider = new S3StorageProvider();

  let providers = [];
  if (storageType === 'local') {
    // Development / Local Priority Strategy
    providers = [localProvider, cloudinaryProvider, s3Provider];
  } else if (storageType === 's3' || storageType === 'r2') {
    // High-Scale Cloud Priority Strategy
    providers = [s3Provider, cloudinaryProvider, localProvider];
  } else {
    // Cloudinary Primary Strategy (Default Production)
    providers = [cloudinaryProvider, localProvider, s3Provider];
  }

  instance = new FailoverStorageProvider(providers);
  return instance;
}
```

---

## 🛡️ `FailoverStorageProvider` Chain of Responsibility

To guarantee zero file upload loss during vendor outages or network failures, `FailoverStorageProvider` wraps the provider chain using the **Chain of Responsibility** pattern.

### Operational Workflow
1. **Upload Execution**: When an upload request arrives, `FailoverStorageProvider` attempts to upload the binary file buffer to the **primary provider** (e.g., AWS S3 / Cloudflare R2).
2. **Automatic Failover**: If the primary provider throws an error (due to rate limits, invalid API keys, or cloud timeouts), `FailoverStorageProvider` catches the exception, dispatches a warning log to Pino logger, and immediately retries the upload using the **secondary provider** (e.g., Cloudinary).
3. **Tertiary Local Fallback**: If all cloud providers fail, the upload falls back to the **local disk filesystem** (`/var/www/kucet-storage/public`), ensuring mission-critical workflows (such as student admission photo submission) succeed without breaking user operations.

### Complete Failover Implementation (`FailoverStorageProvider.js`)

```javascript
import StorageProvider from './StorageProvider';
import logger from '@/lib/logger';

export default class FailoverStorageProvider extends StorageProvider {
  constructor(providers = []) {
    super();
    this.providers = providers.filter(Boolean);
  }

  getUrl(storageKey, options = {}) {
    for (const provider of this.providers) {
      if (typeof provider.getUrl === 'function') {
        return provider.getUrl(storageKey, options);
      }
    }
    return storageKey;
  }

  async upload(fileBuffer, key, options = {}) {
    let lastError = null;

    for (const provider of this.providers) {
      try {
        const result = await provider.upload(fileBuffer, key, options);
        return result;
      } catch (err) {
        lastError = err;
        logger.warn({ 
          err: err.message, 
          provider: provider.constructor.name, 
          key 
        }, '[StorageFailover] Primary provider failed, attempting fallback provider');
      }
    }

    throw new Error(`All storage providers failed to upload key "${key}": ${lastError?.message}`);
  }

  async delete(key) {
    for (const provider of this.providers) {
      try {
        await provider.delete(key);
      } catch (err) {
        logger.warn({ err: err.message, key }, '[StorageFailover] Delete failed on provider');
      }
    }
    return true;
  }
}
```

---

## 🔒 Storage Key Invariant Rule

To maintain absolute environment independence and prevent database lock-in, the KUCET CMS architecture enforces the **Storage Key Invariant Rule**:

> ⚠️ **INVARIANT RULE**: Database tables MUST ONLY store immutable relative storage keys following the canonical format (`kucet/<category>/<subfolder>/<uuid>.<ext>`). Database tables MUST NEVER store full domain URLs, bucket endpoints, or cloud vendor prefixes.

### Canonical Key Examples
- Student Profile Photo: `kucet/students/pfp/b3f96f9f4d51487fb2d69fce.webp`
- Verification Document: `kucet/requests/proofs/71a9e1c8ab7d4b6d8d4e7e4a.pdf`
- Issued Certificate PDF: `kucet/certificates/bonafide/2026/tc_998124.pdf`

### Why This Invariant Rule Is Non-Negotiable
1. **Zero Database Migrations**: Switching from Cloudinary to Cloudflare R2 or local disk storage requires **zero SQL update scripts**.
2. **Dynamic CDN Optimization**: Image delivery formats (e.g., WebP/AVIF auto-conversion `f_auto,q_auto`) can be tuned globally in `src/lib/assets.js` at read-time.
3. **Secure URL Signing**: Supports generating short-lived, signed URLs for sensitive documents without modifying stored database keys.

---

## 🔬 Cloudinary Version Handling & Metadata Investigation

### Detailed Technical Findings

| Investigation Question | Technical Finding | Architectural Implication |
| :--- | :--- | :--- |
| **Where does Cloudinary generate the version?** | Server-side Unix timestamp generated during asset upload/update. | Unique timestamp generated automatically per upload. |
| **Is it available in the upload response & SDK?** | Yes (`result.version`, `r.version`). Supported in `cloudinary.url()`. | Available in API responses if explicitly requested. |
| **Is it required for image retrieval?** | **NO.** Cloudinary CDN endpoints resolve assets by `public_id` + `format` directly. Tested: HTTP 200 returned both with and without version segment. | Delivery URLs work cleanly as `https://res.cloudinary.com/<cloud>/<type>/upload/<transforms>/<public_id>.<ext>`. |
| **Is it only used for browser cache invalidation?** | Yes, strictly for cache busting when an asset is updated *in place* under the same `public_id`. | Irrelevant in KUCET CMS because every upload receives an immutable cryptographically random UUID key per Rule 2 & 3. |
| **Can URLs be generated correctly without storing version?** | Yes. Omitting the version segment causes Cloudinary CDN to automatically resolve and serve the latest active version. | DB schemas remain pure, storing relative keys (`kucet/clerks/pfp/<uuid>.webp`). |

### Architecture Rationale & Storage Metadata Decision

- **Immutable UUID Storage Keys**: Per System Invariants, every upload generates a unique UUID filename (e.g., `kucet/students/pfp/7a59662b.webp`). Updating a photo creates a brand-new file key, rendering cache invalidation automatic.
- **Provider Agnostic Schema**: Storing clean relative keys without Cloudinary version strings or vendor prefixes keeps database tables 100% storage-provider independent, enabling effortless switching between `STORAGE_TYPE=cloudinary` and `STORAGE_TYPE=local` without database migrations.
- **Dynamic Delivery URL Construction**: `getAssetUrl(path)` and `StorageProvider.getUrl(path)` construct optimized CDN delivery URLs dynamically based on active `STORAGE_TYPE`.

---

## 📁 Storage Explorer Directory Hierarchy Architecture

The Admin Storage Explorer (`src/components/admin/infrastructure/StorageExplorer.js`) displays a dynamic, navigable folder tree representing the active storage provider structure:

1. **Cloudinary Subfolder Discovery**: The API (`/api/admin/infrastructure/storage`) uses Cloudinary Search API (`public_id:kucet* OR folder:kucet*`) to query all assets across all nested folder depths, alongside recursive Admin API subfolder calls (`cloudinary.api.sub_folders`) to retrieve explicit folder hierarchy nodes.
2. **Local Directory Scanning**: In `STORAGE_TYPE=local` mode, local storage directory paths (`public/uploads`) are recursively scanned for directories and files.
3. **Dynamic View Grouping**: `StorageExplorer` combines explicit server-provided folder nodes with file-derived relative paths to render breadcrumb navigation and structured folder views (`kucet/` → `students/` → `pfp/` → `file.webp`).

---

## ⚡ Client-Side Image Caching Layer

To eliminate duplicate network requests and provide instant image rendering across all UI views (Headers, Avatars, Dashboards, Modals, Tables), the frontend includes an **in-memory client asset cache** managed by `src/lib/assets.js` and `src/context/AssetContext.js`.

### 🔄 Client Asset Resolution & Cache Lifecycle

```
[Database Column]
       │
       ▼
[getAssetUrl(path)]
       │
       ├─► 1. Check CLIENT_ASSET_CACHE memory map
       │      ├─► CACHE HIT  ──► Return cached URL immediately (0ms delay)
       │      └─► CACHE MISS ──► Proceed to URL generation
       │
       ├─► 2. Resolve URL based on STORAGE_TYPE
       │      ├─► Cloudinary ──► "https://res.cloudinary.com/djs0ry74r/image/upload/f_auto,q_auto/kucet/..."
       │      └─► Local      ──► "/api/assets/view/kucet/..."
       │
       └─► 3. Store (cacheKey -> browserUrl) in CLIENT_ASSET_CACHE memory map
```

### 🎯 Key Caching Architecture Principles

1. **Zero Duplicate Requests**: When a profile picture or signature is rendered across multiple components simultaneously (e.g. Header Avatar, Sidebar Avatar, Profile Card, Settings Form), `getAssetUrl()` returns the cached URL instance on subsequent renders without recalculating strings or triggering multiple Cloudinary requests.
2. **Selective Cache Invalidation**: When a user updates their profile photo or signature, `invalidateAssetCache(key)` is invoked for that specific key. Only the modified asset key is purged from memory, leaving all other cached assets intact.
3. **Storage-Provider Agnostic**: Caching operates on the relative path key (`kucet/<folder>/<uuid>.<ext>`), caching Cloudinary CDN URLs in Cloudinary mode and `/api/assets/view/...` URLs in Local mode seamlessly.

---

## 🌐 Environment Resolution Strategy

| Environment | Primary Provider | Fallback Provider | Storage Key Resolution Endpoint |
| :--- | :--- | :--- | :--- |
| **Production (Cloudinary Mode)** | `CloudinaryStorageProvider` | `LocalStorageProvider` → `S3StorageProvider` | Fully-qualified CDN URL via `getAssetUrl()` / `StorageProvider.getUrl()` (Cached in Client Memory) |
| **Production (Local Mode)** | `LocalStorageProvider` (`/var/www/kucet-storage`) | `CloudinaryStorageProvider` | Secure Proxy Route `/api/assets/view/...` (Cached in Client Memory) |
| **Development (Local Dev)** | `LocalStorageProvider` (`./public/uploads`) | `CloudinaryStorageProvider` | Relative Local Asset Route `/api/assets/view/...` (Cached in Client Memory) |

---

> 💡 **Next Steps**: See how production storage volumes are mounted in Docker in [Deployment Architecture](./deployment.md) or explore database column specifications in [Database Architecture](./database.md).


