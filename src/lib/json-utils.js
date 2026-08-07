/**
 * Safely parses a JSON string without throwing an exception or flooding console.
 *
 * Rules:
 * 1. Returns `fallback` for `null`, `undefined`, or empty/whitespace-only strings.
 * 2. Returns non-string values (objects, arrays, numbers, booleans) directly without parsing.
 * 3. Inspects string prefix before calling `JSON.parse()`. If string is plain text
 *    (e.g., "Scholarship applications", "Bonafide Certificate", "Late Fee"), it does NOT call `JSON.parse()`
 *    and returns the original string directly without logging any warnings.
 * 4. Only calls `JSON.parse()` for strings that start with valid JSON characters ('{', '[', '"', 'true', 'false', 'null', numbers).
 * 5. Avoids console spam for non-JSON text and malformed strings.
 *
 * @param {*} value - The value to parse or return.
 * @param {*} fallback - Default return value if parsing fails or input is null/empty. Defaults to null.
 * @returns {*} Parsed value, original string/object, or fallback.
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

  // Check if string appears to be JSON before parsing.
  // Valid JSON starts with '{', '[', '"', 't' (true), 'f' (false), 'n' (null), or a digit/'-'.
  const firstChar = trimmed[0];
  const isPossibleJson = (
    firstChar === '{' ||
    firstChar === '[' ||
    firstChar === '"' ||
    trimmed === 'true' ||
    trimmed === 'false' ||
    trimmed === 'null' ||
    (firstChar >= '0' && firstChar <= '9') ||
    firstChar === '-'
  );

  if (!isPossibleJson) {
    // Ordinary text (e.g., "Scholarship applications", "General Request")
    // Do NOT parse, do NOT warn, return original value directly.
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    // Only log in development mode when explicitly debugging to prevent console flood
    if (process.env.NODE_ENV === 'development') {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('safeJsonParse failed to parse malformed JSON string:', error?.message, trimmed.slice(0, 100));
      }
    }
    return fallback;
  }
}

export default safeJsonParse;
