export const POLICIES = {
  EXAM_ELIGIBILITY: {
    id: 'EXAM_ELIGIBILITY',
    name: 'Exam Eligibility',
    conditions: ['attendance >= 75', 'pending_dues == 0']
  },
  CONDONATION_ELIGIBILITY: {
    id: 'CONDONATION_ELIGIBILITY',
    name: 'Condonation Eligibility',
    conditions: ['attendance >= 65', 'attendance < 75']
  },
  SCHOLARSHIP_APPROVAL: {
    id: 'SCHOLARSHIP_APPROVAL',
    name: 'Scholarship Approval',
    conditions: ['missing_docs == false', 'annual_income <= limit']
  },
  CERTIFICATE_APPROVAL: {
    id: 'CERTIFICATE_APPROVAL',
    name: 'Certificate Approval',
    conditions: ['pending_dues == 0']
  },
  STUDENT_PROMOTION: {
    id: 'STUDENT_PROMOTION',
    name: 'Student Promotion',
    conditions: ['attendance >= 75', 'backlogs <= 5']
  },
  SEMESTER_COMPLETION: {
    id: 'SEMESTER_COMPLETION',
    name: 'Semester Completion',
    conditions: ['exams_completed == true']
  },
  ARCHIVE_ELIGIBILITY: {
    id: 'ARCHIVE_ELIGIBILITY',
    name: 'Archive Eligibility',
    conditions: ['status == "GRADUATED"']
  }
};
