/**
 * Simple User Agent Parser
 */
export class DeviceService {
  /**
   * Parse user agent string into device, browser and OS
   * @param {string} ua 
   * @returns {Object} { browser, os, device }
   */
  static parse(ua) {
    let browser = 'Unknown Browser';
    let os = 'Unknown OS';
    let device = 'Desktop';

    // Browser Detection
    if (/chrome|crios/i.test(ua) && !/edge|opr/i.test(ua)) browser = 'Chrome';
    else if (/safari/i.test(ua) && !/chrome|crios|edge|opr/i.test(ua)) browser = 'Safari';
    else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
    else if (/edge|edg/i.test(ua)) browser = 'Edge';
    else if (/opr|opera/i.test(ua)) browser = 'Opera';

    // OS Detection
    if (/android/i.test(ua)) os = 'Android';
    else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
    else if (/windows/i.test(ua)) os = 'Windows';
    else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
    else if (/linux/i.test(ua)) os = 'Linux';

    // Device Type
    if (/mobile|iphone|ipad|ipod|android/i.test(ua)) {
      if (/ipad|tablet/i.test(ua)) device = 'Tablet';
      else device = 'Mobile';
    }

    // Try to get versions if possible
    const browserMatch = ua.match(/(chrome|safari|firefox|edge|opr|opera|version)\/?\s*(\d+)/i);
    if (browserMatch && browserMatch[2]) {
      browser = `${browser} ${browserMatch[2]}`;
    }

    return { browser, os, device };
  }

  /**
   * Get a friendly name for a device/session
   * @param {Object} parsed 
   * @returns {string}
   */
  static getFriendlyName(parsed) {
    if (parsed.device === 'Mobile' || parsed.device === 'Tablet') {
      return `${parsed.os} ${parsed.device}`;
    }
    return `${parsed.os} Desktop`;
  }
}
