import { describe, it, expect } from 'vitest';
import { safeJsonParse } from '@/lib/json-utils';

describe('safeJsonParse', () => {
  it('parses valid JSON string correctly', () => {
    const input = '{"name":"John","age":30}';
    const result = safeJsonParse(input, {});
    expect(result).toEqual({ name: 'John', age: 30 });
  });

  it('returns fallback on invalid JSON string without throwing', () => {
    const input = '{invalid_json: true';
    const fallback = { status: 'fallback' };
    const result = safeJsonParse(input, fallback);
    expect(result).toEqual(fallback);
  });

  it('returns non-string values as-is if already parsed', () => {
    const inputObj = { key: 'val' };
    expect(safeJsonParse(inputObj, null)).toEqual(inputObj);
  });

  it('returns fallback for empty string or null/undefined', () => {
    expect(safeJsonParse(null, 'default')).toBe('default');
    expect(safeJsonParse(undefined, 'default')).toBe('default');
    expect(safeJsonParse('', 'default')).toBe('default');
    expect(safeJsonParse('   ', 'default')).toBe('default');
  });

  it('returns plain text strings as-is without attempting JSON.parse or throwing warnings', () => {
    expect(safeJsonParse('Scholarship applications')).toBe('Scholarship applications');
    expect(safeJsonParse('Bonafide Certificate')).toBe('Bonafide Certificate');
    expect(safeJsonParse('Late Fee')).toBe('Late Fee');
    expect(safeJsonParse('General Request')).toBe('General Request');
    expect(safeJsonParse('For bank account opening')).toBe('For bank account opening');
  });
});
