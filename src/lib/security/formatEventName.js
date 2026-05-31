export function formatEventName(type) {
  if (!type) return '';
  return type.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
}
