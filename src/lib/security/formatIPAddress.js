export function formatIPAddress(ip) {
  if (!ip) return null;
  const devIPs = ['::1', '127.0.0.1', 'localhost', '::ffff:127.0.0.1'];
  if (devIPs.includes(ip)) return 'Local Development';
  return ip;
}
