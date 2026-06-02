import { describe, it, expect } from 'vitest';
import { DeviceService } from '@/services/DeviceService';

describe('DeviceService', () => {
  describe('parse', () => {
    it('should identify Windows Chrome', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      const result = DeviceService.parse(ua);
      expect(result.browser).toBe('Chrome 120');
      expect(result.os).toBe('Windows');
      expect(result.device).toBe('Desktop');
    });

    it('should identify iPhone Safari', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
      const result = DeviceService.parse(ua);
      expect(result.browser).toBe('Safari 17');
      expect(result.os).toBe('iOS');
      expect(result.device).toBe('Mobile');
    });

    it('should identify Android Chrome', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36';
      const result = DeviceService.parse(ua);
      expect(result.browser).toBe('Chrome 119');
      expect(result.os).toBe('Android');
      expect(result.device).toBe('Mobile');
    });

    it('should identify macOS Firefox', () => {
      const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0';
      const result = DeviceService.parse(ua);
      expect(result.browser).toBe('Firefox 121');
      expect(result.os).toBe('macOS');
      expect(result.device).toBe('Desktop');
    });

    it('should identify iPad', () => {
      const ua = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
      const result = DeviceService.parse(ua);
      expect(result.os).toBe('iOS');
      expect(result.device).toBe('Tablet');
    });

    it('should fallback for unknown UA', () => {
      const result = DeviceService.parse('');
      expect(result.browser).toBe('Unknown Browser');
      expect(result.os).toBe('Unknown OS');
      expect(result.device).toBe('Desktop');
    });
  });

  describe('getFriendlyName', () => {
    it('should return OS Desktop for desktop devices', () => {
      const parsed = { os: 'Windows', device: 'Desktop' };
      expect(DeviceService.getFriendlyName(parsed)).toBe('Windows Desktop');
    });

    it('should return OS Mobile for mobile devices', () => {
      const parsed = { os: 'Android', device: 'Mobile' };
      expect(DeviceService.getFriendlyName(parsed)).toBe('Android Mobile');
    });

    it('should return OS Tablet for tablets', () => {
      const parsed = { os: 'iOS', device: 'Tablet' };
      expect(DeviceService.getFriendlyName(parsed)).toBe('iOS Tablet');
    });
  });
});
