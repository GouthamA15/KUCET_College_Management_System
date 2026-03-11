/**
 * KUCET OFFICIAL FORM GENERATOR (v2 - Strict Validation)
 * This script builds the form with Roll Number constraints from src/lib/rollNumber.js
 */
function createKUCETForm() {
  var form = FormApp.create('KUCET Student Data Collection - 2026 Batch');
  form.setDescription('Official KUCET Data Collection Form. Please use UPPERCASE for all text entries to match University records.');
  
  form.setAllowResponseEdits(false);
  form.setLimitOneResponsePerUser(true);
  form.setCollectEmail(true);

  // --- SECTION 1: BASIC INFORMATION ---
  form.addPageBreakItem().setTitle('Section 1: Basic Information');
  
  /**
   * ROLL NUMBER VALIDATION LOGIC (from src/lib/rollNumber.js)
   * Regular: YY 567 T (BranchCode) (Serial)  -> ^\d{2}567T(00|03|09|12|15|18|30)(0[1-9]|[1-9][0-9])$
   * Lateral: YY 567 (BranchCode) (Serial) L  -> ^\d{2}567(00|03|09|12|15|18|30)(0[1-9]|[1-9][0-9])L$
   */
  var rollRegex = '^([0-9]{2}567T(00|03|09|12|15|18|30)(0[1-9]|[1-9][0-9])|[0-9]{2}567(00|03|09|12|15|18|30)(0[1-9]|[1-9][0-9])L)$';
  
  var rollVal = FormApp.createTextValidation()
    .setHelpText('Invalid Roll Number. Ensure the Year, College Code (567), Branch Code, and Format (T or L) are correct.')
    .requireTextMatchesPattern(rollRegex)
    .build();

  form.addTextItem()
    .setTitle('1. Roll Number')
    .setRequired(true)
    .setHelpText('Regular: e.g. 23567T0901 | Lateral: e.g. 235670901L')
    .setValidation(rollVal);
  
  form.addTextItem().setTitle('2. Full Name').setRequired(true).setHelpText('As per SSC Memo');
  form.addDateItem().setTitle('3. Date of Birth').setRequired(true);
  form.addMultipleChoiceItem().setTitle('4. Gender').setChoiceValues(['MALE', 'FEMALE']).setRequired(true);
  
  var phoneVal = FormApp.createTextValidation()
    .setHelpText('Enter a valid 10-digit mobile number')
    .requireTextMatchesPattern('^[0-9]{10}$')
    .build();
  form.addTextItem().setTitle('5. Student Mobile Number').setRequired(true).setValidation(phoneVal);
  form.addTextItem().setTitle('6. Student Email ID').setRequired(true);
  
  var aadhaarVal = FormApp.createTextValidation()
    .setHelpText('Enter exactly 12 digits')
    .requireTextMatchesPattern('^[0-9]{12}$')
    .build();
  form.addTextItem().setTitle('7. Aadhaar Number').setRequired(true).setValidation(aadhaarVal);

  // --- SECTION 2: PERSONAL DETAILS ---
  form.addPageBreakItem().setTitle('Section 2: Personal Details');
  form.addTextItem().setTitle("8. Father's Name").setRequired(true);
  form.addTextItem().setTitle("9. Mother's Name").setRequired(true);
  form.addTextItem().setTitle('10. Nationality').setRequired(true).setHelpText('Default: INDIAN');
  
  form.addListItem().setTitle('11. Religion')
    .setChoiceValues(['HINDU', 'MUSLIM', 'CHRISTIAN', 'SIKH', 'BUDDHIST', 'JAIN', 'OTHER'])
    .setRequired(true);
  
  form.addListItem().setTitle('12. Category')
    .setChoiceValues(['OC', 'BC-A', 'BC-B', 'BC-C', 'BC-D', 'BC-E', 'SC', 'ST', 'EWS', 'OC-EWS'])
    .setRequired(true);
  
  form.addTextItem().setTitle('13. Sub Caste').setRequired(true);
  form.addMultipleChoiceItem().setTitle('14. Area Status').setChoiceValues(['Local', 'Non Local']).setRequired(false);
  
  form.addListItem().setTitle('15. Mother Tongue')
    .setChoiceValues(['TELUGU', 'HINDI', 'ENGLISH', 'URDU', 'TAMIL', 'KANNADA', 'MARATHI', 'OTHER'])
    .setRequired(true);
  
  form.addTextItem().setTitle('16. Place of Birth');
  form.addTextItem().setTitle("17. Father's Occupation").setRequired(true);
  
  form.addListItem().setTitle('18. Annual Income').setRequired(true)
    .setChoiceValues([
      'Less than 1,00,000',
      'Greater than 1,00,000',
      'Greater than 2,00,000',
      'Greater than 3,00,000',
      'Greater than 4,00,000',
      'Greater than 5,00,000'
    ]);
    
  form.addTextItem().setTitle('19. Guardian Mobile Number').setRequired(true);
  form.addParagraphTextItem().setTitle('20. Permanent Address').setRequired(true);
  form.addParagraphTextItem().setTitle('21. Identification Marks').setHelpText('List Mark 1 and Mark 2');
  
  form.addListItem().setTitle('22. Blood Group')
    .setChoiceValues(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);

  // --- SECTION 3: ACADEMIC BACKGROUND ---
  var section3 = form.addPageBreakItem().setTitle('Section 3: Academic Background (Pre-B.Tech Records)');
  section3.setHelpText('Provide details of your background BEFORE joining KUCET B.Tech.');
  
  form.addMultipleChoiceItem().setTitle('23. Entrance Exam').setChoiceValues(['EAMCET', 'ECET']).setRequired(true);
  
  // Branches must match branchCodes in rollNumber.js
  form.addListItem().setTitle('24. Branch')
    .setChoiceValues(['CSE', 'CSD', 'ECE', 'EEE', 'CIVIL', 'IT', 'MECH']).setRequired(true);
    
  form.addTextItem().setTitle('25. Entrance Rank').setRequired(true);
  form.addTextItem().setTitle('26. Seat Allotted Category');
  
  form.addMultipleChoiceItem().setTitle('27. Fee Reimbursement Status').setRequired(true)
    .setChoiceValues([
      'YES (I am a scholarship holder)',
      'NO (I am not a scholarship holder)',
      'GOV (Parent is a government employee)'
    ]);
    
  form.addListItem().setTitle('28. Medium of Instruction').setChoiceValues(['ENGLISH', 'TELUGU', 'HINDI', 'OTHER']).setRequired(true);
  form.addParagraphTextItem().setTitle('29. Previous College Details');
  form.addTextItem().setTitle('30. SSC / 10th Marks').setRequired(true);
  form.addTextItem().setTitle('31. Intermediate / Diploma Marks').setRequired(true);

  Logger.log('SUCCESS! Form Link: ' + form.getEditUrl());
}
