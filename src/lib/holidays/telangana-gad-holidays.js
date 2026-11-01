/**
 * Curated and versioned official Telangana State General Administration Department (GAD) 
 * gazetted holidays and Kakatiya University (KUCET) institutional observances.
 * 
 * Sources:
 * - General Administration Department (GAD), Government of Telangana (Annual G.O. Ms. on General Holidays)
 * - Kakatiya University Academic Almanac & Senate Notifications
 */

export const FIXED_ANNUAL_HOLIDAYS = [
  { dayMonth: '01-01', name: "New Year's Day", category: 'GENERAL_PUBLIC_HOLIDAY', source: 'Telangana GAD Gazette' },
  { dayMonth: '01-26', name: 'Republic Day', category: 'NATIONAL_PUBLIC_HOLIDAY', source: 'Government of India / Telangana Gazette' },
  { dayMonth: '04-05', name: "Babu Jagjivan Ram's Birthday", category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
  { dayMonth: '04-14', name: 'Dr. B.R. Ambedkar Jayanti', category: 'NATIONAL_PUBLIC_HOLIDAY', source: 'Telangana GAD Gazette' },
  { dayMonth: '06-02', name: 'Telangana Formation Day', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
  { dayMonth: '08-15', name: 'Independence Day', category: 'NATIONAL_PUBLIC_HOLIDAY', source: 'Government of India / Telangana Gazette' },
  { dayMonth: '08-19', name: 'Kakatiya University Foundation Day', category: 'INSTITUTION_SPECIFIC', source: 'Kakatiya University Almanac' },
  { dayMonth: '10-02', name: 'Mahatma Gandhi Jayanti', category: 'NATIONAL_PUBLIC_HOLIDAY', source: 'Government of India / Telangana Gazette' },
  { dayMonth: '12-25', name: 'Christmas Day', category: 'GENERAL_PUBLIC_HOLIDAY', source: 'Telangana GAD Gazette' },
  { dayMonth: '12-26', name: 'Boxing Day (Following Day of Christmas)', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
];

export const DYNAMIC_GAZETTED_HOLIDAYS = {
  // Academic Year 2024-25
  2024: [
    { date: '2024-01-14', name: 'Bhogi', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2024-01-15', name: 'Sankranti / Pongal', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2024-03-08', name: 'Maha Shivaratri', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2024-03-25', name: 'Holi', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2024-03-29', name: 'Good Friday', category: 'GENERAL_PUBLIC_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2024-04-09', name: 'Ugadi (Telugu New Year)', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2024-04-11', name: 'Eid-ul-Fitr (Ramzan)', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2024-04-17', name: 'Sri Rama Navami', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2024-06-17', name: 'Bakrid (Eid-ul-Adha)', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2024-07-17', name: 'Muharram', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2024-07-29', name: 'Bonalu', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2024-08-26', name: 'Sri Krishna Janmashtami', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2024-09-07', name: 'Vinayaka Chavithi', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2024-09-16', name: 'Eid Milad-un-Nabi', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2024-10-02', name: 'Bathukamma Starting Day', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2024-10-11', name: 'Durgashtami', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2024-10-12', name: 'Vijaya Dashami (Dussehra)', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2024-10-31', name: 'Deepavali (Diwali)', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2024-11-15', name: 'Kartika Pournami / Guru Nanak Jayanti', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
  ],
  // Academic Year 2025-26
  2025: [
    { date: '2025-01-13', name: 'Bhogi', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2025-01-14', name: 'Sankranti / Pongal', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2025-02-26', name: 'Maha Shivaratri', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2025-03-14', name: 'Holi', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2025-03-30', name: 'Ugadi (Telugu New Year)', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2025-03-31', name: 'Eid-ul-Fitr (Ramzan)', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2025-04-06', name: 'Sri Rama Navami', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2025-04-18', name: 'Good Friday', category: 'GENERAL_PUBLIC_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2025-06-07', name: 'Bakrid (Eid-ul-Adha)', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2025-07-06', name: 'Muharram', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2025-07-21', name: 'Bonalu', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2025-08-16', name: 'Sri Krishna Janmashtami', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2025-08-27', name: 'Vinayaka Chavithi', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2025-09-05', name: 'Eid Milad-un-Nabi', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2025-09-21', name: 'Bathukamma Starting Day', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2025-10-01', name: 'Maha Navami / Durgashtami', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2025-10-02', name: 'Vijaya Dashami (Dussehra)', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2025-10-20', name: 'Deepavali (Diwali)', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2025-11-05', name: 'Kartika Pournami / Guru Nanak Jayanti', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
  ],
  // Academic Year 2026-27
  2026: [
    { date: '2026-01-14', name: 'Bhogi', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2026-01-15', name: 'Sankranti / Pongal', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2026-02-15', name: 'Maha Shivaratri', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2026-03-03', name: 'Holi', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2026-03-19', name: 'Ugadi (Telugu New Year)', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2026-03-20', name: 'Eid-ul-Fitr (Ramzan)', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2026-03-27', name: 'Sri Rama Navami', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2026-04-03', name: 'Good Friday', category: 'GENERAL_PUBLIC_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2026-05-27', name: 'Bakrid (Eid-ul-Adha)', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2026-06-25', name: 'Muharram', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2026-07-13', name: 'Bonalu', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2026-09-04', name: 'Sri Krishna Janmashtami', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2026-09-14', name: 'Vinayaka Chavithi', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2026-09-25', name: 'Eid Milad-un-Nabi', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2026-10-10', name: 'Bathukamma Starting Day', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2026-10-19', name: 'Durgashtami', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2026-10-20', name: 'Vijaya Dashami (Dussehra)', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2026-10-21', name: 'Following Day of Vijaya Dashami', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2026-11-08', name: 'Deepavali (Diwali)', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2026-11-24', name: 'Kartika Pournami / Guru Nanak Jayanti', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
  ],
  // Academic Year 2027-28
  2027: [
    { date: '2027-01-14', name: 'Bhogi', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2027-01-15', name: 'Sankranti / Pongal', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2027-03-06', name: 'Maha Shivaratri', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2027-03-09', name: 'Eid-ul-Fitr (Ramzan)', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2027-03-22', name: 'Holi', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2027-03-26', name: 'Good Friday', category: 'GENERAL_PUBLIC_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2027-04-07', name: 'Ugadi (Telugu New Year)', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2027-04-15', name: 'Sri Rama Navami', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2027-05-17', name: 'Bakrid (Eid-ul-Adha)', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2027-06-15', name: 'Muharram', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2027-08-02', name: 'Bonalu', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2027-08-25', name: 'Sri Krishna Janmashtami', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2027-09-04', name: 'Vinayaka Chavithi', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2027-09-15', name: 'Eid Milad-un-Nabi', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2027-09-29', name: 'Bathukamma Starting Day', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2027-10-09', name: 'Vijaya Dashami (Dussehra)', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2027-10-29', name: 'Deepavali (Diwali)', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
    { date: '2027-11-14', name: 'Kartika Pournami / Guru Nanak Jayanti', category: 'TELANGANA_STATE_HOLIDAY', source: 'Telangana GAD Gazette' },
  ]
};

export const OPTIONAL_HOLIDAY_CANDIDATES = [
  { dayMonth: '01-01', name: "New Year's Day (Optional)", category: 'OPTIONAL_HOLIDAY', source: 'Telangana GAD Gazette' },
  { dayMonth: '09-17', name: 'Telangana Praja Palana Dinotsavam (Liberation Day)', category: 'OPTIONAL_HOLIDAY', source: 'Telangana GAD Gazette' },
  { dayMonth: '11-01', name: 'Karva Chauth', category: 'OPTIONAL_HOLIDAY', source: 'Telangana GAD Gazette' },
];
