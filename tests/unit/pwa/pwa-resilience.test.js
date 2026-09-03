import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { isChunkLoadError, handleChunkRecovery } from '@/components/PwaRegister';

describe('PWA & Chunk Recovery Resilience Suite', () => {
  let mockSessionStorage = {};

  beforeEach(() => {
    mockSessionStorage = {};
    const mockStorage = {
      getItem: (key) => mockSessionStorage[key] || null,
      setItem: (key, val) => {
        mockSessionStorage[key] = val.toString();
      },
      removeItem: (key) => {
        delete mockSessionStorage[key];
      },
      clear: () => {
        mockSessionStorage = {};
      },
    };

    global.sessionStorage = mockStorage;
    global.window = {
      sessionStorage: mockStorage,
      location: {
        reload: vi.fn(),
        href: 'http://localhost:3000/staff/faculty/academics',
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isChunkLoadError Detection', () => {
    it('should identify ChunkLoadError by error name', () => {
      const error = new Error('Chunk loading failed');
      error.name = 'ChunkLoadError';
      expect(isChunkLoadError(error)).toBe(true);
    });

    it('should identify ChunkLoadError by message contents', () => {
      const error1 = new Error('Loading chunk app/page-123 failed.');
      const error2 = new Error('Failed to fetch dynamically imported module /_next/static/chunks/abc.js');
      const error3 = new Error('Importing a module script failed');
      const error4 = new Error('error loading dynamically imported module');

      expect(isChunkLoadError(error1)).toBe(true);
      expect(isChunkLoadError(error2)).toBe(true);
      expect(isChunkLoadError(error3)).toBe(true);
      expect(isChunkLoadError(error4)).toBe(true);
    });

    it('should return false for regular business logic or syntax errors', () => {
      const error1 = new Error('Cannot read properties of undefined (reading "map")');
      const error2 = new Error('Network timeout fetching /api/student/profile');
      const error3 = new TypeError('Invalid parameter value');

      expect(isChunkLoadError(error1)).toBe(false);
      expect(isChunkLoadError(error2)).toBe(false);
      expect(isChunkLoadError(error3)).toBe(false);
      expect(isChunkLoadError(null)).toBe(false);
      expect(isChunkLoadError(undefined)).toBe(false);
    });
  });

  describe('handleChunkRecovery Reload Guard', () => {
    it('should trigger reload on first chunk failure and set timestamp in sessionStorage', () => {
      const error = new Error('Loading chunk 456 failed');
      const result = handleChunkRecovery(error);

      expect(result).toBe(true);
      expect(global.window.location.reload).toHaveBeenCalledTimes(1);
      expect(global.sessionStorage.getItem('kucet_chunk_retry_ts')).toBeTruthy();
    });

    it('should throttle and prevent infinite reload loops if triggered repeatedly within 20s', () => {
      const error = new Error('Loading chunk 456 failed');

      // First attempt triggers reload
      const result1 = handleChunkRecovery(error);
      expect(result1).toBe(true);
      expect(global.window.location.reload).toHaveBeenCalledTimes(1);

      // Immediate second attempt within throttle window should be suppressed
      const result2 = handleChunkRecovery(error);
      expect(result2).toBe(false);
      expect(global.window.location.reload).toHaveBeenCalledTimes(1); // Not called again!
    });

    it('should allow reload after the 20-second throttle window has elapsed', () => {
      const error = new Error('Loading chunk 789 failed');

      // Set old timestamp (30 seconds ago)
      const pastTime = Date.now() - 30000;
      global.sessionStorage.setItem('kucet_chunk_retry_ts', pastTime.toString());

      const result = handleChunkRecovery(error);
      expect(result).toBe(true);
      expect(global.window.location.reload).toHaveBeenCalledTimes(1);
    });
  });

  describe('Service Worker File Invariants', () => {
    it('should contain CACHE_VERSION v5 and bypass /api/ routes', () => {
      const swPath = path.resolve(process.cwd(), 'public/sw.js');
      const swContent = fs.readFileSync(swPath, 'utf8');

      expect(swContent).toContain("CACHE_VERSION = 'v5'");
      expect(swContent).toContain("url.pathname.startsWith('/api/')");
      expect(swContent).toContain("url.pathname.startsWith('/_next/static/chunks/')");
      expect(swContent).toContain("OFFLINE_URL = '/offline'");
      expect(swContent).toContain("self.skipWaiting()");
      expect(swContent).toContain("self.clients.claim()");
    });

    it('should not cache RSC payloads or auth routes', () => {
      const swPath = path.resolve(process.cwd(), 'public/sw.js');
      const swContent = fs.readFileSync(swPath, 'utf8');

      // Verifies navigation mode prioritizing network
      expect(swContent).toContain("request.mode === 'navigate'");
      expect(swContent).toContain('fetch(request).catch');
    });
  });
});
