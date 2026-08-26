// Single source-of-truth menu configuration per role
export const NAV_MENU_CONFIG = {
  guest: [
    { label: 'STUDENT LOGIN', action: 'open-panel-student' },
    { label: 'STAFF LOGIN', action: 'open-panel-staff' }
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

    { label: 'SETTINGS', children: [
        { label: 'Edit Profile', route: '/student/settings/edit-profile' },
        { label: 'Security & Privacy', route: '/student/settings/security' }
      ]
    }
  ],
  staff: [
    { label: 'DASHBOARD', route: '/staff/admission/dashboard' },
    { label: 'PROFILE', route: '/staff/admission/profile' },
    { label: 'SETTINGS', children: [
        { label: 'Edit Profile', route: '/staff/settings/edit-profile' },
        { label: 'Security & Privacy', route: '/staff/settings/security' }
      ]
    },
  ],
  admission: [
    { label: 'DASHBOARD', route: '/staff/admission/dashboard' },
    { label: 'PROFILE', route: '/staff/admission/profile' },
    { label: 'STUDENT RECORDS', children: [
        { label: 'Student Registry', route: '/staff/admission/student-management' },
        { label: 'Student Requests', route: '/staff/admission/requests' },
        { label: 'Finalize', route: '/staff/admission/finalize' }
      ]
    },
    { label: 'SETTINGS', children: [
        { label: 'Edit Profile', route: '/staff/settings/edit-profile' },
        { label: 'Security & Privacy', route: '/staff/settings/security' }
      ]
    },
  ],
  scholarship: [
    { label: 'DASHBOARD', route: '/staff/scholarship/dashboard' },
    { label: 'PROFILE', route: '/staff/scholarship/profile' },
    { label: 'STUDENT RECORDS', route: '/staff/scholarship/student-records' },
    { label: 'REQUESTS', route: '/staff/scholarship/dashboard?view=requests&scroll=1' },
    { label: 'VERIFICATION', route: '/staff/scholarship/dashboard?view=certificates&scroll=1' },
    { label: 'SETTINGS', children: [
        { label: 'Edit Profile', route: '/staff/settings/edit-profile' },
        { label: 'Security & Privacy', route: '/staff/settings/security' }
      ]
    },
  ],
  staffAdmission: [
    { label: 'DASHBOARD', route: '/staff/admission/dashboard' },
    { label: 'PROFILE', route: '/staff/admission/profile' },
    { label: 'STUDENT RECORDS', children: [
        { label: 'Student Registry', route: '/staff/admission/student-management' },
        { label: 'Student Requests', route: '/staff/admission/requests' },
        { label: 'Finalize', route: '/staff/admission/finalize' }
      ]
    },
    { label: 'SETTINGS', children: [
        { label: 'Edit Profile', route: '/staff/settings/edit-profile' },
        { label: 'Security & Privacy', route: '/staff/settings/security' }
      ]
    },
  ],
  staffScholarship: [
    { label: 'DASHBOARD', route: '/staff/scholarship/dashboard' },
    { label: 'PROFILE', route: '/staff/scholarship/profile' },
    { label: 'STUDENT RECORDS', route: '/staff/scholarship/student-records' },
    { label: 'REQUESTS', route: '/staff/scholarship/dashboard?view=requests&scroll=1' },
    { label: 'VERIFICATION', route: '/staff/scholarship/dashboard?view=certificates&scroll=1' },
    { label: 'SETTINGS', children: [
        { label: 'Edit Profile', route: '/staff/settings/edit-profile' },
        { label: 'Security & Privacy', route: '/staff/settings/security' }
      ]
    },
  ],
  faculty: [
    { label: 'DASHBOARD', route: '/staff/faculty/dashboard' },
    { label: 'PROFILE', route: '/staff/faculty/profile' },
    { label: 'ACADEMICS', route: '/staff/faculty/academics' },
    { label: 'TIME TABLE', route: '/staff/faculty/time-table' },
    { label: 'MATERIALS', route: '/staff/faculty/materials' },
    { label: 'SETTINGS', children: [
        { label: 'Edit Profile', route: '/staff/settings/edit-profile' },
        { label: 'Security & Privacy', route: '/staff/settings/security' }
      ]
    }
  ],
  superAdmin: [
    { label: 'DASHBOARD', route: '/admin/dashboard' },
    { label: 'ACADEMIC CALENDAR', route: '/admin/academic-calendar' },
    { label: 'PAYMENTS', route: '/admin/payments' },
    { label: 'MANAGE STAFF', route: '/admin/manage-staff' },
    { label: 'STAFF REQUESTS', route: '/admin/staff-requests' },
    { label: 'INFRASTRUCTURE', children: [
        { label: 'System Configuration', route: '/admin/infrastructure?tab=config' },
        { label: 'Database Sovereignty', route: '/admin/infrastructure?tab=backups' },
        { label: 'Storage Explorer', route: '/admin/infrastructure?tab=storage' }
      ]
    },
    { label: 'AUDIT TRAILS', route: '/admin/audit-logs' },
    { label: 'ARCHIVE CENTER', route: '/admin/archive' },
    { label: 'VERIFICATIONS', route: '/admin/verifications' }
  ]
};

