import { POLICIES } from './PolicyRegistry';

export class PolicyEngine {
  evaluate(policyId, studentData) {
    const policy = POLICIES[policyId];
    if (!policy) {
      throw new Error(`Policy ${policyId} not found`);
    }

    const failedConditions = [];
    const passedConditions = [];
    let status = 'ELIGIBLE';
    let reason = 'All conditions met';
    let suggestedAction = 'Proceed';

    switch (policyId) {
      case 'EXAM_ELIGIBILITY': {
        const attendance = studentData.attendancePercentage ?? 100;
        const pendingDues = studentData.pendingDues ?? 0;

        if (attendance >= 75) {
          passedConditions.push('attendance >= 75');
        } else {
          failedConditions.push(`Attendance ${attendance}% < 75%`);
        }

        if (pendingDues === 0) {
          passedConditions.push('pending_dues == 0');
        } else {
          failedConditions.push(`Pending dues: ${pendingDues}`);
        }

        if (failedConditions.length > 0) {
          status = 'INELIGIBLE';
          reason = 'Exam eligibility conditions not met';
          suggestedAction = attendance < 75 && attendance >= 65 ? 'Apply for condonation' : 'Clear dues / Not eligible';
        }
        break;
      }
      case 'CONDONATION_ELIGIBILITY': {
        const attendance = studentData.attendancePercentage ?? 100;
        if (attendance >= 65 && attendance < 75) {
          status = 'CONDITIONAL';
          reason = 'Eligible for condonation';
          passedConditions.push('attendance >= 65 and < 75');
          suggestedAction = 'Pay condonation fee';
        } else {
          status = 'INELIGIBLE';
          reason = 'Not eligible for condonation';
          failedConditions.push(`Attendance ${attendance}% not in [65, 75) range`);
        }
        break;
      }
      case 'CERTIFICATE_APPROVAL': {
        const pendingDues = studentData.pendingDues ?? 0;
        if (pendingDues === 0) {
          status = 'ELIGIBLE';
          passedConditions.push('pending_dues == 0');
        } else {
          status = 'INELIGIBLE';
          reason = 'Cannot issue certificate with pending dues';
          failedConditions.push(`Pending dues: ${pendingDues}`);
          suggestedAction = 'Clear dues';
        }
        break;
      }
      default:
        break;
    }

    return {
      status,
      reason,
      failedConditions,
      passedConditions,
      suggestedAction
    };
  }
}
