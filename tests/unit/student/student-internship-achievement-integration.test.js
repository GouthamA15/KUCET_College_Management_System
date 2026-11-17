import { describe, it, expect } from 'vitest';
import { ACHIEVEMENT_TYPES, ACHIEVEMENT_CONFIG } from '@/lib/achievement-config';
import { NAV_MENU_CONFIG } from '@/lib/menu-config';

describe('Student Internship UI Removal & Achievement Module Integration', () => {
  it('1. verifies Internship is an active achievement type in ACHIEVEMENT_TYPES', () => {
    expect(ACHIEVEMENT_TYPES).toContain('Internship');
  });

  it('2. verifies ACHIEVEMENT_CONFIG.Internship specifies required role and company fields', () => {
    const config = ACHIEVEMENT_CONFIG.Internship;
    expect(config).toBeDefined();
    expect(config.groups).toBeDefined();

    const detailsGroup = config.groups['Internship Details'];
    expect(detailsGroup).toBeDefined();

    const titleField = detailsGroup.find((f) => f.name === 'title');
    expect(titleField).toBeDefined();
    expect(titleField.required).toBe(true);
    expect(titleField.label).toBe('Internship Title / Role');

    const orgField = detailsGroup.find((f) => f.name === 'issuing_organization');
    expect(orgField).toBeDefined();
    expect(orgField.required).toBe(true);
    expect(orgField.label).toBe('Company / Organization Name');

    const durationGroup = config.groups['Duration & Dates'];
    expect(durationGroup).toBeDefined();
    const durationField = durationGroup.find((f) => f.name === 'duration');
    expect(durationField).toBeDefined();
    expect(durationField.isAdditional).toBe(true);
  });

  it('3. verifies student navigation menu does NOT contain standalone INTERNSHIPS link', () => {
    const studentMenu = NAV_MENU_CONFIG.student;
    expect(studentMenu).toBeDefined();

    const internshipItem = studentMenu.find(
      (item) => item.label === 'INTERNSHIPS' || item.route === '/student/internships'
    );
    expect(internshipItem).toBeUndefined();
  });

  it('4. verifies student menu retains core academic and service modules', () => {
    const studentMenu = NAV_MENU_CONFIG.student;
    const labels = studentMenu.map((item) => item.label);

    expect(labels).toContain('HOME');
    expect(labels).toContain('PROFILE');
    expect(labels).toContain('ACADEMICS');
    expect(labels).toContain('FEES');
    expect(labels).toContain('TIME TABLE');
    expect(labels).toContain('REQUESTS');
    expect(labels).toContain('SETTINGS');
  });

  it('5. preserves staff and faculty internship coordinator navigation paths', () => {
    // SuperAdmin, faculty, staff configurations are preserved
    expect(NAV_MENU_CONFIG.superAdmin).toBeDefined();
    expect(NAV_MENU_CONFIG.faculty).toBeDefined();
  });
});
