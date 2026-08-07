export const RULES = [
  {
    id: 'ATTENDANCE_WARNING',
    name: 'Low Attendance Warning',
    category: 'attendance',
    description: 'Triggers when attendance falls below warning threshold',
    version: '1.0',
    priority: 1,
    enabled: true,
    severity: 'WARNING',
    defaultThresholdKey: 'attendance.warning',
    threshold: 75
  },
  {
    id: 'ATTENDANCE_CRITICAL',
    name: 'Critical Attendance',
    category: 'attendance',
    description: 'Triggers when attendance falls below critical threshold',
    version: '1.0',
    priority: 2,
    enabled: true,
    severity: 'CRITICAL',
    defaultThresholdKey: 'attendance.critical',
    threshold: 65
  },
  {
    id: 'FEE_DUE',
    name: 'Fee Due',
    category: 'fee',
    description: 'Fee is due soon',
    version: '1.0',
    priority: 1,
    enabled: true,
    severity: 'INFO'
  },
  {
    id: 'FEE_OVERDUE',
    name: 'Fee Overdue',
    category: 'fee',
    description: 'Fee is overdue',
    version: '1.0',
    priority: 2,
    enabled: true,
    severity: 'WARNING'
  },
  {
    id: 'FEE_DEFAULTER',
    name: 'Fee Defaulter',
    category: 'fee',
    description: 'Student is a fee defaulter',
    version: '1.0',
    priority: 3,
    enabled: true,
    severity: 'CRITICAL'
  },
  {
    id: 'CERT_PENDING_DUES',
    name: 'Pending Dues for Certificate',
    category: 'certificate',
    description: 'Cannot issue certificate due to pending dues',
    version: '1.0',
    priority: 2,
    enabled: true,
    severity: 'WARNING'
  },
  {
    id: 'CERT_ELIGIBILITY',
    name: 'Certificate Eligibility',
    category: 'certificate',
    description: 'Check if eligible for certificate',
    version: '1.0',
    priority: 1,
    enabled: true,
    severity: 'INFO'
  },
  {
    id: 'SCHOLARSHIP_MISSING_DOCS',
    name: 'Missing Scholarship Documents',
    category: 'scholarship',
    description: 'Missing documents for scholarship',
    version: '1.0',
    priority: 1,
    enabled: true,
    severity: 'WARNING'
  },
  {
    id: 'SCHOLARSHIP_EXPIRY',
    name: 'Scholarship Expiry',
    category: 'scholarship',
    description: 'Scholarship is expiring soon',
    version: '1.0',
    priority: 1,
    enabled: true,
    severity: 'WARNING'
  },
  {
    id: 'PROMOTION_ATTENDANCE',
    name: 'Promotion Attendance Criteria',
    category: 'promotion',
    description: 'Attendance requirements for promotion',
    version: '1.0',
    priority: 2,
    enabled: true,
    severity: 'CRITICAL'
  },
  {
    id: 'PROMOTION_BACKLOG',
    name: 'Promotion Backlog Criteria',
    category: 'promotion',
    description: 'Backlog limit for promotion',
    version: '1.0',
    priority: 2,
    enabled: true,
    severity: 'CRITICAL'
  }
];

export function getRule(id) {
  return RULES.find(r => r.id === id);
}

export function getRulesByCategory(category) {
  if (!category) return RULES;
  return RULES.filter(r => r.category === category);
}
