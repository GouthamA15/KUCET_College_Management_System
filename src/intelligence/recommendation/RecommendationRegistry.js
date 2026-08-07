export const RecommendationRegistry = {
  // Student
  ATTEND_REMEDIAL: { id: 'ATTEND_REMEDIAL', type: 'STUDENT', title: 'Attend Remedial Classes', description: 'Subject attendance is below minimum requirement', priority: 'HIGH', category: 'ACADEMIC', ruleRef: 'ATT_75', enabled: true },
  IMPROVE_ATTENDANCE: { id: 'IMPROVE_ATTENDANCE', type: 'STUDENT', title: 'Improve Overall Attendance', description: 'Overall attendance is below minimum requirement', priority: 'HIGH', category: 'ACADEMIC', ruleRef: 'ATT_OVERALL_75', enabled: true },
  CLEAR_PENDING_FEES: { id: 'CLEAR_PENDING_FEES', type: 'STUDENT', title: 'Clear Pending Fees', description: 'Tuition fees for the current academic year are pending', priority: 'HIGH', category: 'FINANCIAL', ruleRef: 'FEE_PAYMENT', enabled: true },
  APPLY_SCHOLARSHIP: { id: 'APPLY_SCHOLARSHIP', type: 'STUDENT', title: 'Apply for Scholarship', description: 'Eligible for scholarship but no application found', priority: 'MEDIUM', category: 'FINANCIAL', ruleRef: 'SCHOLARSHIP_APPLY', enabled: true },
  SUBMIT_SCHOLARSHIP_DOCS: { id: 'SUBMIT_SCHOLARSHIP_DOCS', type: 'STUDENT', title: 'Submit Scholarship Documents', description: 'Scholarship application is pending document submission', priority: 'HIGH', category: 'FINANCIAL', ruleRef: 'SCHOLARSHIP_DOCS', enabled: true },
  IMPROVE_MARKS: { id: 'IMPROVE_MARKS', type: 'STUDENT', title: 'Improve Subject Marks', description: 'Performance in subject is below average', priority: 'MEDIUM', category: 'ACADEMIC', ruleRef: 'MARKS_50', enabled: true },
  CERTIFICATE_REQUEST_FOLLOWUP: { id: 'CERTIFICATE_REQUEST_FOLLOWUP', type: 'STUDENT', title: 'Follow-up Certificate Request', description: 'Certificate request has been pending for over 7 days', priority: 'LOW', category: 'ADMINISTRATIVE', ruleRef: 'CERT_REQ_7D', enabled: true },

  // Faculty
  CONDUCT_REVISION: { id: 'CONDUCT_REVISION', type: 'FACULTY', title: 'Conduct Revision Class', description: 'Class average marks in subject are below par', priority: 'HIGH', category: 'ACADEMIC', ruleRef: 'CLASS_AVG_50', enabled: true },
  COMPLETE_SYLLABUS: { id: 'COMPLETE_SYLLABUS', type: 'FACULTY', title: 'Record Session Topics', description: 'Topic coverage not recorded for all sessions', priority: 'MEDIUM', category: 'ACADEMIC', ruleRef: 'SYLLABUS_70', enabled: true },
  REVIEW_WEAK_STUDENTS: { id: 'REVIEW_WEAK_STUDENTS', type: 'FACULTY', title: 'Review Weak Students', description: 'High percentage of students with low marks', priority: 'HIGH', category: 'ACADEMIC', ruleRef: 'WEAK_STUDENTS_30', enabled: true },
  SUBMIT_ATTENDANCE: { id: 'SUBMIT_ATTENDANCE', type: 'FACULTY', title: 'Submit Pending Attendance', description: 'Attendance records pending for recent sessions', priority: 'CRITICAL', category: 'ADMINISTRATIVE', ruleRef: 'ATT_24H', enabled: true },

  // HOD
  ALLOCATE_EXTRA_FACULTY: { id: 'ALLOCATE_EXTRA_FACULTY', type: 'HOD', title: 'Review Faculty Workload', description: 'Faculty assigned to excessive number of subjects', priority: 'HIGH', category: 'ADMINISTRATIVE', ruleRef: 'FACULTY_OVERLOAD_6', enabled: true },
  SCHEDULE_SPECIAL_CLASSES: { id: 'SCHEDULE_SPECIAL_CLASSES', type: 'HOD', title: 'Schedule Special Classes', description: 'Department average attendance is below par', priority: 'HIGH', category: 'ACADEMIC', ruleRef: 'DEPT_ATT_75', enabled: true },
  REVIEW_LOW_SUBJECTS: { id: 'REVIEW_LOW_SUBJECTS', type: 'HOD', title: 'Review Low Pass Rate Subject', description: 'Subject pass rate is below minimum expectation', priority: 'HIGH', category: 'ACADEMIC', ruleRef: 'PASS_RATE_50', enabled: true },
  FACULTY_WORKLOAD_IMBALANCE: { id: 'FACULTY_WORKLOAD_IMBALANCE', type: 'HOD', title: 'Rebalance Faculty Assignments', description: 'Uneven distribution of workload among faculty', priority: 'MEDIUM', category: 'ADMINISTRATIVE', ruleRef: 'WORKLOAD_IMBALANCE', enabled: true },

  // Admin
  ARCHIVE_SEMESTER: { id: 'ARCHIVE_SEMESTER', type: 'ADMIN', title: 'Archive Completed Semester', description: 'Semester has concluded and data should be archived', priority: 'LOW', category: 'SYSTEM', ruleRef: 'SEMESTER_END', enabled: true },
  PENDING_APPROVALS: { id: 'PENDING_APPROVALS', type: 'ADMIN', title: 'Review Pending Approvals', description: 'High number of pending certificate requests', priority: 'MEDIUM', category: 'ADMINISTRATIVE', ruleRef: 'PENDING_CERTS_10', enabled: true },
  SCHOLARSHIP_FOLLOWUP: { id: 'SCHOLARSHIP_FOLLOWUP', type: 'ADMIN', title: 'Follow-up Unreleased Scholarships', description: 'Scholarships sanctioned but not released after extended period', priority: 'HIGH', category: 'FINANCIAL', ruleRef: 'SCHOLARSHIP_180D', enabled: true },
  FEE_DEFAULTERS: { id: 'FEE_DEFAULTERS', type: 'ADMIN', title: 'Review Fee Defaulters', description: 'Students with no fee payment for current year', priority: 'HIGH', category: 'FINANCIAL', ruleRef: 'FEE_DEFAULTERS', enabled: true }
};
