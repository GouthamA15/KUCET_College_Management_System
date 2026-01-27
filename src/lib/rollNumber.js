const branchCodes = {
  '09': 'CSE',
  '30': 'CSD',
  '15': 'ECE',
  '12': 'EEE',
  '00': 'CIVIL',
  '18': 'IT',
  '03': 'MECH',
};

function validateRollNo(rollNo) {
  const regularPattern = /^(\d{2})567T(\d{2})(\d{2})$/;
  const lateralPattern = /^(\d{2})567(\d{2})(\d{2})L$/;

  const regularMatch = rollNo.match(regularPattern);
  const lateralMatch = rollNo.match(lateralPattern);

  if (regularMatch) {
    const [, year, branchCode, serial] = regularMatch;
    const branch = branchCodes[branchCode];
    if (branch && parseInt(serial) >= 1 && parseInt(serial) <= 99) {
      return {
        isValid: true,
        entryYear: `20${year}`,
        branch,
        admissionType: 'Regular',
      };
    }
  }

  if (lateralMatch) {
    const [, year, branchCode, serial] = lateralMatch;
    const branch = branchCodes[branchCode];
    if (branch && parseInt(serial) >= 1 && parseInt(serial) <= 99) {
      return {
        isValid: true,
        entryYear: `20${year}`,
        branch,
        admissionType: 'Lateral',
      };
    }
  }

  return { isValid: false };
}

function getEntryYearFromRoll(rollNo) {
  const { isValid, entryYear } = validateRollNo(rollNo);
  return isValid ? entryYear : null;
}

function getBranchFromRoll(rollNo) {
  const { isValid, branch } = validateRollNo(rollNo);
  return isValid ? branch : null;
}

function getAdmissionTypeFromRoll(rollNo) {
  const { isValid, admissionType } = validateRollNo(rollNo);
  return isValid ? admissionType : null;
}

function getAcademicYear(rollNo) {
  const entryYear = getEntryYearFromRoll(rollNo);
  const admissionType = getAdmissionTypeFromRoll(rollNo);

  if (!entryYear) {
    return null;
  }

  const startYear = parseInt(entryYear, 10);
  const endYear = admissionType === 'Regular' ? startYear + 4 : startYear + 3;

  return `${startYear}-${endYear}`;
}

function getCurrentStudyingYear(rollNo) {
  const entryYear = getEntryYearFromRoll(rollNo);
  const admissionType = getAdmissionTypeFromRoll(rollNo);

  if (!entryYear) {
    return null;
  }

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const entryYearInt = parseInt(entryYear, 10);

  let yearDiff = currentYear - entryYearInt;

  if (currentMonth < 6) {
    // Before June, student is in the previous academic year's session.
    yearDiff -= 1;
  }

  if (admissionType === 'Regular') {
    return yearDiff + 1;
  } else if (admissionType === 'Lateral') {
    return yearDiff + 2;
  }

  return null;
}

function getAcademicYearForStudyYear(rollNo, yearOfStudy) {
  const entryYear = getEntryYearFromRoll(rollNo);
  if (!entryYear) {
    return null;
  }

  const startYear = parseInt(entryYear, 10) + (yearOfStudy - 1);
  const endYear = startYear + 1;

  return `${startYear}-${String(endYear).slice(-2)}`;
}

export {
  validateRollNo,
  getEntryYearFromRoll,
  getBranchFromRoll,
  getAdmissionTypeFromRoll,
  getAcademicYear,
  getCurrentStudyingYear,
  getAcademicYearForStudyYear,
  branchCodes,
};
