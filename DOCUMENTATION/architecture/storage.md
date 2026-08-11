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

## 🌐 Environment Resolution Strategy

| Environment | Primary Provider | Fallback Provider | Storage Key Resolution Endpoint |
| :--- | :--- | :--- | :--- |
| **Production (Hostinger VPS)** | AWS S3 / Cloudflare R2 | Cloudinary → Local VPS Disk (`/var/www/kucet-storage`) | Fully-qualified CDN URL via `getAssetUrl()` |
| **Staging / QA** | Cloudinary | Local Disk | Cloudinary Staging Folder URL |
| **Development (Local Dev)** | Local Storage Provider (`./public/uploads`) | Cloudinary Sandbox | Relative Local Asset Route `/api/assets/view/...` |

---

> 💡 **Next Steps**: See how production storage volumes are mounted in Docker in [Deployment Architecture](./deployment.md) or explore database column specifications in [Database Architecture](./database.md).
