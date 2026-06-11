// Single source-of-truth menu configuration per role
export const NAV_MENU_CONFIG = {
  guest: [
    { label: 'STUDENT LOGIN', action: 'open-panel-student' },
    { label: 'STAFF LOGIN', action: 'open-panel-clerk' }
  ],
  student: [
    { label: 'HOME', route: '/student' },
    { label: 'PROFILE', route: '/student/profile' },
    { label: 'ACADEMICS', route: '/student/academics' },
    { label: 'FEES', route: '/student/finances' },
    { label: 'TIME TABLE', route: '/student/timetable' },
    { label: 'REQUESTS', children: [
        { label: 'Certificates', route: '/student/requests/certificates' },
        { label: 'Profile Updates', route: '/student/requests/profile-updates' },
        { label: 'ID Card Re-issue', route: '/student/requests/id-card' }
      ]
    },
    { label: 'MENU', children: [
        { label: 'Edit Profile', route: '/student/settings/edit-profile' },
        { label: 'Security & Privacy', route: '/student/settings/security' }
      ]
    }
  ],
  clerk: [
    { label: 'DASHBOARD', route: '/clerk/admission/dashboard' },
    { label: 'PROFILE', route: '/clerk/admission/profile' },
    { label: 'DEPARTMENTS', route: '/clerk/departments' },
    { label: 'ACADEMIC CALENDAR', route: '/clerk/academic-calendar' },
    { label: 'TIME TABLE', route: '/clerk/timetable' },
    { label: 'FACULTIES', route: '/clerk/faculties' },
    { label: 'SETTINGS', children: [
        { label: 'Edit Profile', route: '/clerk/settings/edit-profile' },
        { label: 'Security & Privacy', route: '/clerk/settings/security' }
      ]
    },
  ],
  // Explicit menu for Admission clerks (keeps Academic Calendar)
  clerkAdmission: [
    { label: 'DASHBOARD', route: '/clerk/admission/dashboard' },
    { label: 'PROFILE', route: '/clerk/admission/profile' },
    { label: 'STUDENT RECORDS', route: '/clerk/admission/student-management' },
    { label: 'REQUESTS', route: '/clerk/admission/requests' },
    { label: 'FINALIZE', route: '/clerk/admission/finalize' },
    { label: 'DEPARTMENTS', route: '/clerk/departments' },
    { label: 'ACADEMIC CALENDAR', route: '/clerk/academic-calendar' },
    { label: 'TIME TABLE', route: '/clerk/timetable' },
    { label: 'SETTINGS', children: [
        { label: 'Edit Profile', route: '/clerk/settings/edit-profile' },
        { label: 'Security & Privacy', route: '/clerk/settings/security' }
      ]
    },
  ],
  // Scholarship clerks: omit Academic Calendar
  clerkScholarship: [
    { label: 'DASHBOARD', route: '/clerk/scholarship/dashboard' },
    { label: 'PROFILE', route: '/clerk/scholarship/profile' },
    { label: 'REQUESTS', route: '/clerk/scholarship/dashboard?view=requests&scroll=1' },
    { label: 'VERIFICATION', route: '/clerk/scholarship/dashboard?view=certificates&scroll=1' },
    { label: 'DEPARTMENTS', route: '/clerk/departments' },
    { label: 'TIME TABLE', route: '/clerk/timetable' },
    { label: 'SETTINGS', children: [
        { label: 'Edit Profile', route: '/clerk/settings/edit-profile' },
        { label: 'Security & Privacy', route: '/clerk/settings/security' }
      ]
    },
  ],
  faculty: [
    { label: 'DASHBOARD', route: '/clerk/faculty/dashboard' },
    { label: 'PROFILE', route: '/clerk/faculty/profile' },
    { label: 'ATTENDANCE', route: '/clerk/faculty/attendance' },
    { label: 'MARKS', route: '/clerk/faculty/marks' },
    { label: 'TIME TABLE', route: '/clerk/faculty/time-table' },
    { label: 'MATERIALS', route: '/clerk/faculty/materials' },
    { label: 'SETTINGS', children: [
        { label: 'Edit Profile', route: '/clerk/settings/edit-profile' },
        { label: 'Security & Privacy', route: '/clerk/settings/security' }
      ]
    }
  ],
  superAdmin: [
    { label: 'HOME', route: '/' },
    { label: 'ADMIN DASHBOARD', route: '/admin/dashboard' },
    { label: 'MANAGE CLERKS', route: '/admin/manage-clerks' },
    { label: 'STUDENT STATS', route: '/admin/student-stats' },
    { label: 'MENU', children: [
        { label: 'Edit Profile', route: '/admin/settings/edit-profile' },
        { label: 'Security & Privacy', route: '/admin/settings/security' }
      ]
    }
  ]
};
