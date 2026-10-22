export const COLLEGE_CONFIG = {
  name: "KU COLLEGE OF ENGINEERING & TECHNOLOGY",
  address: "KAKATIYA UNIVERSITY CAMPUS, WARANGAL – 506 009",
  shortName: "KUCET",
  location: "Warangal",
  pincode: "506009",
  contact: "0870-2970125",
  entranceCodes: {
    tgpgecet: "KUWL1",
    tgeapcet: "KUWL",
    tgecet: "KUWL"
  },
  branches: [
    { code: '09', name: 'CSE' },
    { code: '30', name: 'CSD' },
    { code: '15', name: 'ECE' },
    { code: '12', name: 'EEE' },
    { code: '00', name: 'CIVIL' },
    { code: '18', name: 'IT' },
    { code: '03', name: 'MECH' },
  ],
  areaStatuses: ['Local', 'Non-Local'],
  genders: ['MALE', 'FEMALE'],
  religions: ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Parsi', 'Other'],
  categories: ['OC', 'BC-A', 'BC-B', 'BC-C', 'BC-D', 'BC-E', 'SC-A', 'SC-B', 'SC-C', 'SC-D', 'ST', 'EWS'],
  bloodGroups: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Not available'],
  annualIncomes: [
    'Less than 1,00,000',
    '1,00,001 - 2,50,000',
    '2,50,001 - 5,00,000',
    '5,00,001 - 8,00,000',
    'Above 8,00,000'
  ],
  incomeRanges: [
    'Up to 1,00,000',
    '1,00,000 - 2,00,000',
    '2,00,01 - 3,00,000',
    '3,00,001 - 4,00,000',
    '4,00,001 - 5,00,000',
    '5,00,001 - 6,00,000',
    '6,00,001 - 7,00,000',
    '7,00,001 - 8,00,000',
    'Above 8,00,000'
  ],
};

export const AREA_STATUSES = ['Local', 'Non-Local'];

export function normalizeAreaStatus(val) {
  if (val === null || val === undefined || val === '') return null;
  const clean = String(val).trim();
  if (!clean) return null;
  const stripped = clean.toLowerCase().replace(/[\s_-]+/g, '');
  if (stripped === 'local') return 'Local';
  if (stripped === 'nonlocal') return 'Non-Local';
  return null;
}

export function isValidAreaStatus(val) {
  return normalizeAreaStatus(val) !== null;
}

export const GENDER_LABELS = {
  MALE: 'Male',
  FEMALE: 'Female',
};

export const formatGenderLabel = (g) => {
  if (!g) return '';
  const key = String(g).trim().toUpperCase();
  return GENDER_LABELS[key] || g;
};

export const MOBILE_NAV_MODE = 'sidebar'; // 'sidebar' | 'navbar'


