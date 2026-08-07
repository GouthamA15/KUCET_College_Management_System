/**
 * Safely parses a JSON string without throwing an exception.
 *
 * @param {*} value - The value to parse (usually a JSON string).
 * @param {*} fallback - Default return value if parsing fails or input is invalid. Defaults to null.
 * @returns {*} Parsed value or fallback.
 */
export function safeJsonParse(value, fallback = null) {
  if (value === null || value === undefined) {
    return fallback;
  }

  // If value is already an object, array, or non-string primitive, return as-is
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('safeJsonParse failed to parse JSON string:', error?.message, trimmed.slice(0, 100));
    }
    return fallback;
  }
}

export default safeJsonParse;

