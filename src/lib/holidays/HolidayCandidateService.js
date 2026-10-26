import Holidays from 'date-holidays';
import { FIXED_ANNUAL_HOLIDAYS, DYNAMIC_GAZETTED_HOLIDAYS } from './telangana-gad-holidays';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DAY_MAP = {
  'SUNDAY': 0,
  'MONDAY': 1,
  'TUESDAY': 2,
  'WEDNESDAY': 3,
  'THURSDAY': 4,
  'FRIDAY': 5,
  'SATURDAY': 6
};

export class HolidayCandidateService {
  /**
   * Generates public holiday candidate suggestions for a given semester date range.
   * 
   * @param {Object} params
   * @param {string} params.startDate - YYYY-MM-DD
   * @param {string} params.endDate - YYYY-MM-DD
   * @param {Array<string>} [params.weekendDays=['SUNDAY']] - e.g. ['SUNDAY']
   * @param {Array<Object>} [params.existingCalendarEntries=[]] - existing rows from `academic_calendar`
   * @returns {Array<Object>} candidate holiday objects
   */
  static generateCandidates({ startDate, endDate, weekendDays = ['SUNDAY'], existingCalendarEntries = [] }) {
    if (!startDate || !endDate) return [];

    const startYear = parseInt(startDate.slice(0, 4), 10);
    const endYear = parseInt(endDate.slice(0, 4), 10);

    const weekendUtcDays = new Set(
      weekendDays
        .map(d => typeof d === 'string' ? DAY_MAP[d.toUpperCase()] : undefined)
        .filter(x => x !== undefined)
    );

    // Map existing records by YYYY-MM-DD
    const existingMap = new Map();
    for (const rec of existingCalendarEntries) {
      const dStr = typeof rec.date === 'string' && rec.date.includes('T') ? rec.date.split('T')[0] : String(rec.date);
      existingMap.set(dStr, rec);
    }

    const candidateMap = new Map(); // key: date (YYYY-MM-DD)

    // Helper to add/merge a candidate
    const addCandidate = (item) => {
      const { date, name, category, source } = item;
      if (date < startDate || date > endDate) return;

      if (!candidateMap.has(date)) {
        candidateMap.set(date, {
          date,
          name,
          category,
          source,
          synonyms: []
        });
      } else {
        const existingCand = candidateMap.get(date);
        // If names differ, retain official/gazette name as primary and record synonym
        if (existingCand.name !== name && !existingCand.synonyms.includes(name)) {
          existingCand.synonyms.push(name);
          // Prefer Telangana GAD Gazette category/name if present
          if (source.includes('Telangana') && !existingCand.source.includes('Telangana')) {
            existingCand.synonyms.push(existingCand.name);
            existingCand.name = name;
            existingCand.category = category;
            existingCand.source = source;
          }
        }
      }
    };

    // 1. Process `date-holidays` (India, Telangana)
    try {
      const hd = new Holidays('IN', 'TG');
      for (let yr = startYear; yr <= endYear; yr++) {
        const rawList = hd.getHolidays(yr) || [];
        for (const h of rawList) {
          const dateStr = h.date.split(' ')[0];
          addCandidate({
            date: dateStr,
            name: h.name,
            category: h.type === 'public' ? 'NATIONAL_PUBLIC_HOLIDAY' : 'GENERAL_PUBLIC_HOLIDAY',
            source: 'date-holidays (IN-TG)'
          });
        }
      }
    } catch (_err) {
      // Fallback gracefully to curated gazette if library encounters any issue
    }

    // 2. Process FIXED_ANNUAL_HOLIDAYS for each year in scope
    for (let yr = startYear; yr <= endYear; yr++) {
      for (const fixed of FIXED_ANNUAL_HOLIDAYS) {
        const dateStr = `${yr}-${fixed.dayMonth}`;
        addCandidate({
          date: dateStr,
          name: fixed.name,
          category: fixed.category,
          source: fixed.source
        });
      }
    }

    // 3. Process DYNAMIC_GAZETTED_HOLIDAYS for each year in scope
    for (let yr = startYear; yr <= endYear; yr++) {
      const gazettedList = DYNAMIC_GAZETTED_HOLIDAYS[yr] || [];
      for (const dyn of gazettedList) {
        addCandidate({
          date: dyn.date,
          name: dyn.name,
          category: dyn.category,
          source: dyn.source
        });
      }
    }

    // 4. Transform candidates into enriched review objects
    const sortedCandidates = Array.from(candidateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return sortedCandidates.map(cand => {
      const [y, m, d] = cand.date.split('-').map(Number);
      const dateObj = new Date(Date.UTC(y, m - 1, d));
      const dayOfWeekIdx = dateObj.getUTCDay();
      const dayOfWeekName = DAY_NAMES[dayOfWeekIdx];
      const isWeekend = weekendUtcDays.has(dayOfWeekIdx);

      const existingRecord = existingMap.get(cand.date);
      let conflictType = 'NONE';
      let conflictWarning = null;
      let isAlreadyApproved = false;
      let isExamCollision = false;

      if (existingRecord) {
        if (existingRecord.day_type === 'HOLIDAY') {
          if (existingRecord.holiday_name && existingRecord.holiday_name !== 'Weekend') {
            if (existingRecord.holiday_name.toLowerCase() === cand.name.toLowerCase()) {
              conflictType = 'ALREADY_APPROVED';
              conflictWarning = `Already approved as "${existingRecord.holiday_name}"`;
              isAlreadyApproved = true;
            } else {
              conflictType = 'DIFFERENT_HOLIDAY';
              conflictWarning = `Existing holiday is "${existingRecord.holiday_name}"`;
            }
          } else {
            conflictType = 'WEEKEND_ONLY';
            conflictWarning = 'Currently configured as Weekend';
          }
        } else if (['EXAM', 'INTERNAL', 'EVENT'].includes(existingRecord.day_type)) {
          conflictType = 'EXAM_EVENT_COLLISION';
          conflictWarning = `Collision: Currently designated as ${existingRecord.day_type}`;
          isExamCollision = true;
        } else if (existingRecord.day_type === 'WORKING') {
          conflictType = 'WORKING_DAY';
          conflictWarning = isWeekend ? 'Weekend day currently marked as WORKING' : null;
        }
      }

      // Pre-select recommendation:
      // - Pre-select if NOT already approved, NOT colliding with EXAM/EVENT
      const defaultSelected = !isAlreadyApproved && !isExamCollision;

      return {
        date: cand.date,
        day_of_week: dayOfWeekName,
        occasion_name: cand.name,
        category: cand.category,
        category_label: formatCategoryLabel(cand.category),
        source: cand.source,
        synonyms: cand.synonyms,
        is_weekend: isWeekend,
        weekend_note: isWeekend ? `${dayOfWeekName} (Configured Weekend)` : null,
        current_classification: existingRecord?.day_type || 'NOT_GENERATED',
        current_holiday_name: existingRecord?.holiday_name || null,
        conflict_type: conflictType,
        conflict_warning: conflictWarning,
        is_already_approved: isAlreadyApproved,
        is_exam_collision: isExamCollision,
        recommended_action: isAlreadyApproved ? 'SKIP' : (isExamCollision ? 'REVIEW' : 'APPROVE'),
        selected: defaultSelected
      };
    });
  }
}

function formatCategoryLabel(category) {
  switch (category) {
    case 'NATIONAL_PUBLIC_HOLIDAY':
      return 'National Public Holiday';
    case 'TELANGANA_STATE_HOLIDAY':
      return 'Telangana State Holiday (GAD)';
    case 'INSTITUTION_SPECIFIC':
      return 'Kakatiya University Institutional';
    case 'OPTIONAL_HOLIDAY':
      return 'Optional / Restricted Holiday';
    default:
      return 'General Public Holiday';
  }
}
