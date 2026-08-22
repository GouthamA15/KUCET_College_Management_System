/**
 * Centralized Institutional Staff Role & Category Configuration
 * KUCET College Management System
 */

export const STAFF_CATEGORIES = {
  FACULTY: {
    id: 'FACULTY',
    label: 'Faculty',
    role: 'faculty',
    requiresBranch: true,
    description: 'Academic teaching faculty member assigned to a specific academic branch.',
  },
  SCHOLARSHIP_STAFF: {
    id: 'SCHOLARSHIP_STAFF',
    label: 'Scholarship Staff',
    role: 'scholarship',
    requiresBranch: false,
    description: 'Administrative staff managing student scholarship sanctions and fee ledgers.',
  },
  ADMISSION_STAFF: {
    id: 'ADMISSION_STAFF',
    label: 'Admission Staff',
    role: 'admission',
    requiresBranch: false,
    description: 'Administrative staff handling student admissions and enrollment registration.',
  },
};

export const FACULTY_BRANCHES = ['CSE', 'CSD', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT'];

export const isValidStaffCategory = (cat) => Object.keys(STAFF_CATEGORIES).includes(cat);
export const isValidFacultyBranch = (branch) => FACULTY_BRANCHES.includes(branch);

export const getStaffCategoryDetails = (catKey) => STAFF_CATEGORIES[catKey] || null;
