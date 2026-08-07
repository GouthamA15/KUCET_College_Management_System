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
        { label: 'Certificates', route: '/student/requests/certificates' }
      ]
    },
    { label: 'AI ASSISTANT', route: '/student/assistant' },
    { label: 'SETTINGS', route: '/student/settings/security' }
  ],
  clerk: [
    { label: 'DASHBOARD', route: '/clerk/admission/dashboard' },
    { label: 'PROFILE', route: '/clerk/admission/profile' },
    { label: 'ACADEMIC CALENDAR', route: '/clerk/academic-calendar' },
    { label: 'AI ASSISTANT', route: '/clerk/faculty/assistant' },
    { label: 'SETTINGS', children: [
        { label: 'Edit Profile', route: '/clerk/settings/edit-profile' },
        { label: 'Security & Privacy', route: '/clerk/settings/security' }
      ]
    },
  ],
  clerkAdmission: [
    { label: 'DASHBOARD', route: '/clerk/admission/dashboard' },
    { label: 'PROFILE', route: '/clerk/admission/profile' },
    { label: 'STUDENT RECORDS', children: [
        { label: 'Student Registry', route: '/clerk/admission/student-management' },
        { label: 'Student Requests', route: '/clerk/admission/requests' },
        { label: 'Finalize', route: '/clerk/admission/finalize' }
      ]
    },
    { label: 'ACADEMIC CALENDAR', route: '/clerk/academic-calendar' },
    { label: 'AI ASSISTANT', route: '/clerk/faculty/assistant' },
    { label: 'SETTINGS', children: [
        { label: 'Edit Profile', route: '/clerk/settings/edit-profile' },
        { label: 'Security & Privacy', route: '/clerk/settings/security' }
      ]
    },
  ],
  clerkScholarship: [
    { label: 'DASHBOARD', route: '/clerk/scholarship/dashboard' },
    { label: 'PROFILE', route: '/clerk/scholarship/profile' },
    { label: 'STUDENT RECORDS', route: '/clerk/scholarship/student-records' },
    { label: 'REQUESTS', route: '/clerk/scholarship/dashboard?view=requests&scroll=1' },
    { label: 'VERIFICATION', route: '/clerk/scholarship/dashboard?view=certificates&scroll=1' },
    { label: 'AI ASSISTANT', route: '/clerk/faculty/assistant' },
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
    { label: 'AI ASSISTANT', route: '/clerk/faculty/assistant' },
    { label: 'SETTINGS', children: [
        { label: 'Edit Profile', route: '/clerk/settings/edit-profile' },
        { label: 'Security & Privacy', route: '/clerk/settings/security' }
      ]
    }
  ],
  superAdmin: [
    { label: 'DASHBOARD', route: '/admin/dashboard' },
    { label: 'PAYMENTS', route: '/admin/payments' },
    { label: 'MANAGE CLERKS', route: '/admin/manage-clerks' },
    { label: 'CREATE CLERK', route: '/admin/create-clerk' },
    { label: 'INFRASTRUCTURE', children: [
        { label: 'System Configuration', route: '/admin/infrastructure?tab=config' },
        { label: 'Database Sovereignty', route: '/admin/infrastructure?tab=backups' },
        { label: 'Storage Explorer', route: '/admin/infrastructure?tab=storage' }
      ]
    },
    { label: 'AUDIT TRAILS', route: '/admin/audit-logs' },
    { label: 'ARCHIVE CENTER', route: '/admin/archive' },
    { label: 'VERIFICATIONS', route: '/admin/verifications' },
    { label: 'AI ASSISTANT', route: '/admin/assistant' },
  ]
};
