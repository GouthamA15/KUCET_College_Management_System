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
  SCHOLARSHIP_CLERK: {
    id: 'SCHOLARSHIP_CLERK',
    label: 'Scholarship Clerk',
    role: 'scholarship',
    requiresBranch: false,
    description: 'Administrative clerk managing student scholarship sanctions and fee ledgers.',
  },
  ADMISSION_CLERK: {
    id: 'ADMISSION_CLERK',
    label: 'Admission Clerk',
    role: 'admission',
    requiresBranch: false,
    description: 'Administrative clerk handling student admissions and enrollment registration.',
  },
};

export const FACULTY_BRANCHES = ['CSE', 'CSD', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT'];

export const isValidStaffCategory = (cat) => Object.keys(STAFF_CATEGORIES).includes(cat);
export const isValidFacultyBranch = (branch) => FACULTY_BRANCHES.includes(branch);

export const getStaffCategoryDetails = (catKey) => STAFF_CATEGORIES[catKey] || null;
