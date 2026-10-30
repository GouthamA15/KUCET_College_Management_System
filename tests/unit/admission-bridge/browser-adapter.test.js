import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hasSidePanel,
  hasStorage,
  hasTabs,
  hasDownloads,
  hasWindows,
  getBrowserCapabilities,
  detectBrowserBrand,
} from '@/lib/admission-bridge/browser-capabilities';
import { createBrowserAdapter } from '@/lib/admission-bridge/browser-adapter';

describe('KUCET Admission Bridge — Browser Adapter & Capability Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Feature & Capability Detection', () => {
    it('should detect sidePanel availability correctly without crashing when undefined', () => {
      expect(hasSidePanel({})).toBe(false);
      expect(hasSidePanel({ chrome: {} })).toBe(false);
      expect(hasSidePanel({ chrome: { sidePanel: {} } })).toBe(false);
      expect(hasSidePanel({ chrome: { sidePanel: { setPanelBehavior: () => {} } } })).toBe(true);
    });

    it('should detect storage availability correctly', () => {
      expect(hasStorage({})).toBe(false);
      expect(hasStorage({ chrome: { storage: {} } })).toBe(false);
      expect(hasStorage({ chrome: { storage: { local: { get: () => {} } } } })).toBe(true);
    });

    it('should detect tabs API availability correctly', () => {
      expect(hasTabs({})).toBe(false);
      expect(hasTabs({ chrome: { tabs: { query: () => {}, sendMessage: () => {} } } })).toBe(true);
    });

    it('should detect downloads API availability correctly', () => {
      expect(hasDownloads({})).toBe(false);
      expect(hasDownloads({ chrome: { downloads: { download: () => {} } } })).toBe(true);
    });

    it('should detect windows API availability correctly', () => {
      expect(hasWindows({})).toBe(false);
      expect(hasWindows({ chrome: { windows: { create: () => {} } } })).toBe(true);
    });

    it('should assemble a complete capabilities object', () => {
      const mockEnv = {
        chrome: {
          storage: { local: { get: () => {} } },
          tabs: { query: () => {}, sendMessage: () => {} },
          windows: { create: () => {} },
        },
      };

      const caps = getBrowserCapabilities(mockEnv);
      expect(caps.sidePanel).toBe(false);
      expect(caps.storage).toBe(true);
      expect(caps.tabs).toBe(true);
      expect(caps.windows).toBe(true);
      expect(caps.downloads).toBe(false);
    });

    it('should detect browser brand strings for diagnostic logging', () => {
      expect(detectBrowserBrand('Mozilla/5.0 Edg/120.0.0.0')).toBe('Microsoft Edge');
      expect(detectBrowserBrand('Mozilla/5.0 OPR/105.0.0.0')).toBe('Opera');
      expect(detectBrowserBrand('Mozilla/5.0 Vivaldi/6.5.3206')).toBe('Vivaldi');
      expect(detectBrowserBrand('Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36')).toBe('Google Chrome');
      expect(detectBrowserBrand('Mozilla/5.0 Custom/1.0', { navigator: { brave: { isBrave: () => true } } })).toBe('Brave');
      expect(detectBrowserBrand('CustomBrowser/1.0')).toBe('Chromium');
    });
  });

  describe('BrowserAdapter Storage & Messaging Operations', () => {
    it('should use chrome.storage.local when available', async () => {
      const mockGet = vi.fn().mockResolvedValue({ test_key: 'saved_value' });
      const mockSet = vi.fn().mockResolvedValue(undefined);

      const adapter = createBrowserAdapter({
        chrome: {
          storage: { local: { get: mockGet, set: mockSet } },
        },
      });

      const val = await adapter.getStorage('test_key');
      expect(val).toBe('saved_value');
      expect(mockGet).toHaveBeenCalledWith('test_key');

      const setRes = await adapter.setStorage('test_key', 'new_value');
      expect(setRes).toBe(true);
      expect(mockSet).toHaveBeenCalledWith({ test_key: 'new_value' });
    });

    it('should fall back to localStorage when chrome.storage is unavailable', async () => {
      const storageStore = new Map();
      const mockLocalStorage = {
        getItem: (k) => storageStore.get(k) || null,
        setItem: (k, v) => storageStore.set(k, v),
      };

      const adapter = createBrowserAdapter({
        localStorage: mockLocalStorage,
      });

      await adapter.setStorage('pref', { dark: true });
      expect(storageStore.get('pref')).toBe('{"dark":true}');

      const retrieved = await adapter.getStorage('pref');
      expect(retrieved).toEqual({ dark: true });
    });

    it('should query active tab safely via getActiveTab', async () => {
      const mockTab = { id: 42, url: 'https://kuonline.co.in/BTechsql/Btechreg.aspx' };
      const mockQuery = vi.fn().mockResolvedValue([mockTab]);

      const adapter = createBrowserAdapter({
        chrome: {
          tabs: { query: mockQuery, sendMessage: vi.fn() },
        },
      });

      const tab = await adapter.getActiveTab();
      expect(tab).toEqual(mockTab);
      expect(mockQuery).toHaveBeenCalledWith({ active: true, currentWindow: true });
    });

    it('should send messages to tab and return responses', async () => {
      const mockSendMessage = vi.fn().mockResolvedValue({ success: true, populatedFields: ['name'] });

      const adapter = createBrowserAdapter({
        chrome: {
          tabs: { query: vi.fn(), sendMessage: mockSendMessage },
        },
      });

      const res = await adapter.sendMessageToTab(42, { action: 'TEST_POPULATE' });
      expect(res.success).toBe(true);
      expect(mockSendMessage).toHaveBeenCalledWith(42, { action: 'TEST_POPULATE' });
    });
  });

  describe('Side Panel and Companion Window Fallback', () => {
    it('should prioritize chrome.sidePanel.open when supported', async () => {
      const mockOpen = vi.fn().mockResolvedValue(undefined);
      const mockQuery = vi.fn().mockResolvedValue([{ id: 10 }]);

      const adapter = createBrowserAdapter({
        chrome: {
          sidePanel: { setPanelBehavior: () => {}, open: mockOpen },
          tabs: { query: mockQuery, sendMessage: vi.fn() },
        },
      });

      const result = await adapter.openBridgeInterface();
      expect(result.mode).toBe('sidePanel');
      expect(result.success).toBe(true);
      expect(mockOpen).toHaveBeenCalledWith({ tabId: 10 });
    });

    it('should fall back to chrome.windows.create when sidePanel is unavailable (e.g. Opera/Vivaldi)', async () => {
      const mockWinCreate = vi.fn().mockResolvedValue({ id: 99 });

      const adapter = createBrowserAdapter({
        chrome: {
          windows: { create: mockWinCreate },
        },
      });

      const result = await adapter.openBridgeInterface('sidepanel.html');
      expect(result.mode).toBe('window');
      expect(result.success).toBe(true);
      expect(result.id).toBe(99);
      expect(mockWinCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'sidepanel.html',
          type: 'popup',
          width: 440,
          height: 780,
        })
      );
    });

    it('should fall back to chrome.tabs.create when neither sidePanel nor windows API is available', async () => {
      const mockTabCreate = vi.fn().mockResolvedValue({ id: 88 });

      const adapter = createBrowserAdapter({
        chrome: {
          tabs: { create: mockTabCreate, query: vi.fn(), sendMessage: vi.fn() },
        },
      });

      const result = await adapter.openBridgeInterface('sidepanel.html');
      expect(result.mode).toBe('tab');
      expect(result.success).toBe(true);
      expect(result.id).toBe(88);
      expect(mockTabCreate).toHaveBeenCalledWith({ url: 'sidepanel.html', active: true });
    });
  });
});
