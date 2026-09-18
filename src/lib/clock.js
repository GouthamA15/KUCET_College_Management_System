/**
 * Canonical Application Clock & Time-Machine Abstraction for KUCET CMS.
 *
 * Provides a unified temporal authority that separates:
 * 1. Application / Business Time (simulated for testing via request-isolated cookies/headers)
 * 2. System / Infrastructure / Persistence Time (authoritative real system time)
 *
 * ZERO MONKEY-PATCHING: Does not alter global.Date or Date.now.
 * ZERO GLOBAL SERVER STATE: Request-isolated; safe for concurrent test sessions.
 * STRICT PRODUCTION LOCKDOWN: Disabled in standard production unless explicitly enabled.
 * STRICT IST: Always calculates Indian Standard Time (Asia/Kolkata, UTC+5:30).
 */

const IST_TIMEZONE = 'Asia/Kolkata';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30

/**
 * Checks if the Time Machine feature is permitted in the current environment.
 * Allowed in:
 * - Non-production environments (development, test)
 * - Explicit test working environment (NEXT_PUBLIC_WORKING_ENV === 'testing')
 * - Explicit environment toggle (ENABLE_TIME_MACHINE === 'true' or NEXT_PUBLIC_ENABLE_TIME_MACHINE === 'true')
 */
export function isTimeMachineEnabled() {
  if (process.env.ENABLE_TIME_MACHINE === 'true') return true;
  if (process.env.NEXT_PUBLIC_ENABLE_TIME_MACHINE === 'true') return true;
  if (process.env.NEXT_PUBLIC_WORKING_ENV === 'testing') return true;
  if (process.env.NODE_ENV !== 'production') return true;
  return false;
}

/**
 * Computes an IST Date representation for a given Date or timestamp.
 * Returns a Date object whose local getters (.getFullYear(), .getHours(), etc.)
 * accurately represent wall-clock IST time.
 */
export function toISTDate(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return new Date();

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: IST_TIMEZONE,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      fractionalSecondDigits: 3,
      hour12: false,
    });
    const parts = formatter.formatToParts(d);
    const partMap = {};
    for (const p of parts) {
      if (p.type !== 'literal') partMap[p.type] = parseInt(p.value, 10);
    }
    return new Date(
      partMap.year,
      partMap.month - 1,
      partMap.day,
      partMap.hour,
      partMap.minute,
      partMap.second,
      partMap.fractionalSecond || 0
    );
  } catch (_e) {
    // Math-based fallback: UTC timestamp + 5.5 hours
    const utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
    return new Date(utcMs + IST_OFFSET_MS);
  }
}

/**
 * Parses raw mock date input (from cookie, header, or context) safely.
 * Returns { targetDate: Date, setAt: number|null, frozen: boolean } or null if invalid.
 */
export function parseMockDateInput(rawInput) {
  if (!rawInput) return null;

  try {
    let targetStr = null;
    let setAt = null;
    let frozen = false;

    if (typeof rawInput === 'object') {
      if (rawInput instanceof Date) {
        targetStr = rawInput.toISOString();
        frozen = true;
      } else if (rawInput.target || rawInput.iso || rawInput.date) {
        targetStr = rawInput.target || rawInput.iso || rawInput.date;
        setAt = rawInput.setAt ? Number(rawInput.setAt) : null;
        frozen = rawInput.frozen === true || rawInput.frozen === 'true';
      }
    } else if (typeof rawInput === 'string') {
      const trimmed = decodeURIComponent(rawInput).trim();
      if (!trimmed) return null;

      // Check if JSON
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const parsed = JSON.parse(trimmed);
        targetStr = parsed.target || parsed.iso || parsed.date;
        setAt = parsed.setAt ? Number(parsed.setAt) : null;
        frozen = parsed.frozen === true || parsed.frozen === 'true';
      } else {
        // Plain string (ISO or datetime-local format)
        targetStr = trimmed;
        // If not JSON, default to frozen unless specified
        frozen = true;
      }
    }

    if (!targetStr) return null;

    const parsedDate = new Date(targetStr);
    const timeMs = parsedDate.getTime();
    if (isNaN(timeMs)) return null;

    // Sanity boundary check: between 1970 and 2100
    const year = parsedDate.getFullYear();
    if (year < 1970 || year > 2100) return null;

    return {
      targetDate: parsedDate,
      setAt: setAt && !isNaN(setAt) ? setAt : null,
      frozen,
    };
  } catch (_err) {
    return null;
  }
}

/**
 * Extracts mock date string or object from an incoming request, context, or environment.
 */
function extractMockInputFromContext(context) {
  if (!context) return null;

  // Direct Date or string passed
  if (context instanceof Date) return context;
  if (typeof context === 'string') {
    // If it contains cookie format "dev_mock_date=...", extract value
    const match = context.match(/(?:^|;\s*)dev_mock_date=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : context;
  }

  // NextRequest / Web Request
  if (typeof context.headers?.get === 'function') {
    // Priority 1: x-app-mock-date header (injected by proxy middleware)
    const headerVal = context.headers.get('x-app-mock-date');
    if (headerVal) return headerVal;

    // Priority 2: cookie header
    const cookieHeader = context.headers.get('cookie') || '';
    const match = cookieHeader.match(/(?:^|;\s*)dev_mock_date=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }

  // Request cookies object (NextRequest.cookies or cookieStore)
  if (typeof context.cookies?.get === 'function') {
    const c = context.cookies.get('dev_mock_date');
    if (c?.value) return c.value;
  }

  // Context is an options object: { mockDate: ... } or { cookies: ... }
  if (context.mockDate) return context.mockDate;

  return null;
}

/**
 * Attempts to extract mock date on client or server when no context is provided.
 */
function extractAmbientMockInput() {
  // Client-side browser execution
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      const match = document.cookie.match(/(?:^|;\s*)dev_mock_date=([^;]+)/);
      if (match) return decodeURIComponent(match[1]);
    } catch (_e) {
      return null;
    }
  }
  return null;
}

/**
 * Canonical Clock Object
 */
export const Clock = {
  /**
   * Authoritative real system time (Date object) in IST wall-clock.
   * NEVER affected by time travel.
   */
  getRealNow() {
    return toISTDate(new Date());
  },

  /**
   * Authoritative real system timestamp (milliseconds since Unix epoch).
   * Monotonic and immutable; never affected by time travel.
   */
  getRealTimestamp() {
    return Date.now();
  },

  /**
   * Primary Application Time getter.
   * Evaluates simulated time if Time Machine is active and permitted;
   * otherwise returns the authoritative real IST time.
   *
   * @param {Request|Headers|string|Object} [context] Optional request, cookie string, or context
   * @returns {Date} Date object representing application IST time
   */
  now(context = null) {
    const realNow = this.getRealNow();

    // Strict security check: time travel disabled in standard production
    if (!isTimeMachineEnabled()) {
      return realNow;
    }

    const rawInput = extractMockInputFromContext(context) || extractAmbientMockInput();
    const mockConfig = parseMockDateInput(rawInput);

    if (!mockConfig) {
      return realNow;
    }

    const { targetDate, setAt, frozen } = mockConfig;

    if (frozen || !setAt) {
      // Frozen mode: returns the exact configured moment converted to IST
      return toISTDate(targetDate);
    }

    // Advancing mode: simulated time advances 1:1 with real elapsed time
    const elapsed = Date.now() - setAt;
    const currentSimulatedMs = targetDate.getTime() + elapsed;
    return toISTDate(new Date(currentSimulatedMs));
  },

  /**
   * Checks if time travel is currently active for the given context.
   *
   * @param {Request|Headers|string|Object} [context]
   * @returns {boolean}
   */
  isTimeTraveling(context = null) {
    if (!isTimeMachineEnabled()) return false;
    const rawInput = extractMockInputFromContext(context) || extractAmbientMockInput();
    return parseMockDateInput(rawInput) !== null;
  },

  /**
   * Returns temporal offset in milliseconds from real time for the given context.
   * Positive = future, Negative = past, 0 = real time.
   *
   * @param {Request|Headers|string|Object} [context]
   * @returns {number}
   */
  getOffset(context = null) {
    if (!this.isTimeTraveling(context)) return 0;
    const simulated = this.now(context);
    const real = this.getRealNow();
    return simulated.getTime() - real.getTime();
  },

  /**
   * Returns current calendar date in 'YYYY-MM-DD' format (IST).
   * Guaranteed not to shift across UTC boundaries.
   *
   * @param {Request|Headers|string|Object} [context]
   * @returns {string} e.g. "2026-03-10"
   */
  today(context = null) {
    const d = this.now(context);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Returns current calendar date in UI format 'DD-MM-YYYY' (IST).
   *
   * @param {Request|Headers|string|Object} [context]
   * @returns {string} e.g. "10-03-2026"
   */
  todayFormatted(context = null) {
    const d = this.now(context);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${day}-${month}-${year}`;
  },

  /**
   * Extracts detailed IST calendar and time components from a Date or simulated time.
   *
   * @param {Date|string|number} [dateInput] Defaults to Clock.now()
   * @returns {{
   *   year: number,
   *   month: number, // 1 - 12
   *   day: number,   // 1 - 31
   *   hours: number, // 0 - 23
   *   minutes: number, // 0 - 59
   *   seconds: number, // 0 - 59
   *   dayOfWeek: number, // 0 (Sun) - 6 (Sat)
   *   dayName: string, // 'SUN', 'MON', etc.
   *   timeNumber: number // e.g. 930 for 09:30, 1415 for 14:15
   * }}
   */
  getISTParts(dateInput = null) {
    const d = dateInput ? toISTDate(dateInput) : this.now();
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const hours = d.getHours();
    const minutes = d.getMinutes();

    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      hours: hours,
      minutes: minutes,
      seconds: d.getSeconds(),
      dayOfWeek: d.getDay(),
      dayName: days[d.getDay()],
      timeNumber: hours * 100 + minutes,
    };
  },

  /**
   * Maps an IST time to the corresponding official KUCET College period (1 through 7).
   * Periods:
   * 1: 09:30 - 10:20
   * 2: 10:20 - 11:10
   * (Tea Break: 11:10 - 11:20)
   * 3: 11:20 - 12:10
   * 4: 12:10 - 13:00
   * (Lunch: 13:00 - 14:00)
   * 5: 14:00 - 14:50
   * 6: 14:50 - 15:40
   * 7: 15:40 - 16:30
   *
   * @param {Date|string|number} [dateInput] Defaults to Clock.now()
   * @returns {number|null} Period number (1-7) or null if outside periods or on Sunday.
   */
  currentPeriod(dateInput = null) {
    const parts = this.getISTParts(dateInput);
    if (parts.dayOfWeek === 0) return null; // Sunday

    const t = parts.timeNumber;
    if (t >= 930 && t < 1020) return 1;
    if (t >= 1020 && t < 1110) return 2;
    if (t >= 1120 && t < 1210) return 3;
    if (t >= 1210 && t < 1300) return 4;
    if (t >= 1400 && t < 1450) return 5;
    if (t >= 1450 && t < 1540) return 6;
    if (t >= 1540 && t < 1630) return 7;

    return null;
  },

  /**
   * Date comparison helpers.
   */
  isBefore(dateA, dateB) {
    return new Date(dateA).getTime() < new Date(dateB).getTime();
  },

  isAfter(dateA, dateB) {
    return new Date(dateA).getTime() > new Date(dateB).getTime();
  },

  isBetween(date, startDate, endDate) {
    const t = new Date(date).getTime();
    return t >= new Date(startDate).getTime() && t <= new Date(endDate).getTime();
  },
};

/**
 * Backward-compatible function export.
 * Delegates to Clock.now(context).
 */
export function getNow(context = null) {
  return Clock.now(context);
}

/**
 * Backward-compatible synchronous function export.
 * Delegates to Clock.now(context).
 */
export function getNowSync(context = null) {
  return Clock.now(context);
}

export default Clock;
