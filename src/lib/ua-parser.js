/**
 * Simple User Agent Parser
 * Minimalist implementation to avoid adding external dependencies.
 */
export function parseUA(uaString) {
  const ua = uaString || '';
  let browser = 'Unknown';
  let operatingSystem = 'Unknown';
  let deviceName = 'Desktop';

  // Detect Browser
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Microsoft Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';
  else if (ua.includes('MSIE') || ua.includes('Trident')) browser = 'Internet Explorer';

  // Detect OS
  if (ua.includes('Windows')) operatingSystem = 'Windows';
  else if (ua.includes('Macintosh') || ua.includes('Mac OS X')) operatingSystem = 'macOS';
  else if (ua.includes('Android')) {
    operatingSystem = 'Android';
    deviceName = 'Mobile Device';
  }
  else if (ua.includes('iPhone')) {
    operatingSystem = 'iOS';
    deviceName = 'iPhone';
  }
  else if (ua.includes('iPad')) {
    operatingSystem = 'iOS';
    deviceName = 'iPad';
  }
  else if (ua.includes('Linux')) operatingSystem = 'Linux';

  // Refine Device Name for known patterns
  if (ua.includes('Mobile') && deviceName === 'Desktop') {
    deviceName = 'Mobile Device';
  }

  return { browser, operatingSystem, deviceName };
}
