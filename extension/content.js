/* global chrome */
/**
 * Content Script for KUCET Admission Bridge.
 * Executes in the context of: https://kuonline.co.in/BTechsql/Btechreg.aspx
 * 
 * Invariants:
 * - Strictly guarded to target university registration page.
 * - Fills fields in dependency order and dispatches native 'change' & 'input' events.
 * - Attaches photos and signatures via modern HTML5 DataTransfer.
 * - Activates accompanying photo/sign checkboxes if present.
 * - NEVER clicks or submits 'Submit & Step2'.
 */

(() => {
  // Guard against duplicate injection
  if (window.__KUCET_ADMISSION_BRIDGE_LOADED__) return;
  window.__KUCET_ADMISSION_BRIDGE_LOADED__ = true;

  console.info('[KUCET Admission Bridge] Content script initialized on KU Online portal.');

  // Conservative University Upload Limit (190 KiB = 194,560 bytes)
  const MAX_PORTAL_IMAGE_BYTES = 194560;

  // DOM Finder Helpers
  function findElementByPatterns(selectors) {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) return el;
      } catch (_err) {
        // Element not found in selector pattern
      }
    }
    return null;
  }

  function findSelect(patterns) {
    const selects = Array.from(document.querySelectorAll('select'));
    for (const s of selects) {
      const id = (s.id || '').toLowerCase();
      const name = (s.name || '').toLowerCase();
      for (const p of patterns) {
        if (id.includes(p.toLowerCase()) || name.includes(p.toLowerCase())) {
          return s;
        }
      }
    }
    return null;
  }

  function findInput(patterns, type = 'text') {
    const inputs = Array.from(document.querySelectorAll(`input[type="${type}"], input:not([type])`));
    for (const inp of inputs) {
      const id = (inp.id || '').toLowerCase();
      const name = (inp.name || '').toLowerCase();
      for (const p of patterns) {
        if (id.includes(p.toLowerCase()) || name.includes(p.toLowerCase())) {
          return inp;
        }
      }
    }
    return null;
  }

  function setSelectValue(selectEl, targetValue) {
    if (!selectEl) return { success: false, reason: 'Element not found' };
    const cleanTarget = String(targetValue).trim().toUpperCase();
    let matched = false;

    for (let i = 0; i < selectEl.options.length; i++) {
      const opt = selectEl.options[i];
      const optText = (opt.text || '').trim().toUpperCase();
      const optVal = (opt.value || '').trim().toUpperCase();

      if (optText === cleanTarget || optVal === cleanTarget || optText.includes(cleanTarget)) {
        selectEl.selectedIndex = i;
        matched = true;
        break;
      }
    }

    if (matched) {
      selectEl.dispatchEvent(new Event('input', { bubbles: true }));
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true, value: selectEl.value, text: selectEl.options[selectEl.selectedIndex]?.text };
    }

    return { success: false, reason: `Value "${targetValue}" not found in dropdown options` };
  }

  function setInputValue(inputEl, val) {
    if (!inputEl) return { success: false, reason: 'Input element not found' };
    inputEl.focus();
    inputEl.value = val;
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    inputEl.blur();
    return { success: true, value: inputEl.value };
  }

  function findTextarea(patterns) {
    const textareas = Array.from(document.querySelectorAll('textarea'));
    for (const ta of textareas) {
      const id = (ta.id || '').toLowerCase();
      const name = (ta.name || '').toLowerCase();
      for (const p of patterns) {
        if (id.includes(p.toLowerCase()) || name.includes(p.toLowerCase())) {
          return ta;
        }
      }
    }
    return null;
  }

  function setTextareaValue(taEl, val) {
    if (!taEl) return { success: false, reason: 'Textarea element not found' };
    taEl.focus();
    taEl.value = val;
    taEl.dispatchEvent(new Event('input', { bubbles: true }));
    taEl.dispatchEvent(new Event('change', { bubbles: true }));
    taEl.blur();
    return { success: true, value: taEl.value };
  }

  function setRadioOption(patterns, targetValue) {
    if (!targetValue) return { success: false, reason: 'No target value provided' };
    const cleanTarget = String(targetValue).trim().toUpperCase();
    const radios = Array.from(document.querySelectorAll('input[type="radio"]'));

    for (const radio of radios) {
      const id = (radio.id || '').toLowerCase();
      const name = (radio.name || '').toLowerCase();
      const val = (radio.value || '').trim().toUpperCase();

      const matchesGroup = patterns.some(p => id.includes(p.toLowerCase()) || name.includes(p.toLowerCase()));
      if (!matchesGroup) continue;

      let isMatch = (val === cleanTarget);

      if (!isMatch && radio.id) {
        const label = document.querySelector(`label[for="${radio.id}"]`);
        if (label) {
          const labelText = (label.textContent || '').trim().toUpperCase();
          if (labelText === cleanTarget || labelText.includes(cleanTarget)) {
            isMatch = true;
          }
        }
      }

      if (isMatch) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        radio.dispatchEvent(new Event('click', { bubbles: true }));
        return { success: true, value: radio.value };
      }
    }

    return { success: false, reason: `Radio option "${targetValue}" not found for group` };
  }

  function setSameAddressCheckbox() {
    const checkboxPatterns = ['same', 'chksame', 'chkaddress', 'chksameaspermanent', 'chksameascurrent', 'chkpermanent'];
    const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
    let matchedCheckbox = null;

    for (const chk of checkboxes) {
      const id = (chk.id || '').toLowerCase();
      const name = (chk.name || '').toLowerCase();
      if (checkboxPatterns.some(p => id.includes(p) || name.includes(p))) {
        matchedCheckbox = chk;
        break;
      }
    }

    if (!matchedCheckbox) {
      for (const chk of checkboxes) {
        const parentText = (chk.parentElement?.textContent || '').toLowerCase();
        if (parentText.includes('same as') || parentText.includes('permanent address same')) {
          matchedCheckbox = chk;
          break;
        }
      }
    }

    if (!matchedCheckbox) {
      return { success: false, reason: 'Same-address checkbox not found on page' };
    }

    if (!matchedCheckbox.checked) {
      matchedCheckbox.checked = true;
      matchedCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
      matchedCheckbox.dispatchEvent(new Event('click', { bubbles: true }));
    }

    const permField = findTextarea(['permanent', 'permaddress', 'txtpermaddress']) ||
                      findInput(['permanent', 'permaddress', 'txtpermaddress']);

    const isCopied = permField ? (permField.value && permField.value.trim().length > 0) : true;

    return {
      success: true,
      checkboxId: matchedCheckbox.id || matchedCheckbox.name,
      permanentCopied: isCopied,
    };
  }

  function populateDateOfBirth(dobComponents) {
    if (!dobComponents) return { success: false, reason: 'No DOB components provided' };

    const result = { day: null, month: null, year: null };

    const daySelect = findSelect(['dob_day', 'ddlday', 'day', 'birthday', 'selday']);
    if (daySelect) {
      let res = setSelectValue(daySelect, dobComponents.day);
      if (!res.success && dobComponents.dayPadded) {
        res = setSelectValue(daySelect, dobComponents.dayPadded);
      }
      result.day = res;
    }

    const monthSelect = findSelect(['dob_month', 'ddlmonth', 'month', 'birthmonth', 'selmonth']);
    if (monthSelect) {
      let res = setSelectValue(monthSelect, dobComponents.monthName);
      if (!res.success && dobComponents.monthShort) {
        res = setSelectValue(monthSelect, dobComponents.monthShort);
      }
      if (!res.success && dobComponents.month) {
        res = setSelectValue(monthSelect, dobComponents.month);
      }
      if (!res.success && dobComponents.monthPadded) {
        res = setSelectValue(monthSelect, dobComponents.monthPadded);
      }
      result.month = res;
    }

    const yearSelect = findSelect(['dob_year', 'ddlyear', 'year', 'birthyear', 'selyear']);
    if (yearSelect) {
      result.year = setSelectValue(yearSelect, dobComponents.year);
    }

    return {
      success: !!(result.day?.success && result.month?.success && result.year?.success),
      components: result,
    };
  }

  function attachFile(fileInputEl, fileObject) {
    if (!fileInputEl) return { success: false, reason: 'File input not found' };
    if (!fileObject) return { success: false, reason: 'File object is null' };

    try {
      const dt = new DataTransfer();
      dt.items.add(fileObject);
      fileInputEl.files = dt.files;
      fileInputEl.dispatchEvent(new Event('input', { bubbles: true }));
      fileInputEl.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true, attachedFilename: fileObject.name, sizeBytes: fileObject.size };
    } catch (err) {
      return { success: false, reason: err.message };
    }
  }

  function checkCheckbox(patterns) {
    const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
    for (const chk of checkboxes) {
      const id = (chk.id || '').toLowerCase();
      const name = (chk.name || '').toLowerCase();
      for (const p of patterns) {
        if (id.includes(p.toLowerCase()) || name.includes(p.toLowerCase())) {
          if (!chk.checked) {
            chk.checked = true;
            chk.dispatchEvent(new Event('change', { bubbles: true }));
            chk.dispatchEvent(new Event('click', { bubbles: true }));
          }
          return true;
        }
      }
    }
    return false;
  }

  // Detect Registration Form
  function detectRegistrationForm() {
    const isTargetUrl = window.location.href.toLowerCase().includes('btechreg.aspx');
    const courseSelect = findSelect(['course', 'programme']);
    const branchSelect = findSelect(['branch', 'admitted', 'dept']);
    const admNoInput = findInput(['admission', 'admno']);

    return {
      isTargetUrl,
      isFormPresent: !!(courseSelect || branchSelect || admNoInput),
      detectedFields: {
        hasCourse: !!courseSelect,
        hasBranch: !!branchSelect,
        hasAdmissionNo: !!admNoInput,
      },
    };
  }

  // Message Handler from Side Panel
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'CHECK_PAGE_STATUS') {
      const status = detectRegistrationForm();
      sendResponse(status);
      return false;
    }

    if (request.action === 'FILL_PORTAL_FORM') {
      const { studentData, photoBytesBase64, photoFilename, signatureBytesBase64, signatureFilename } = request;
      const report = {
        filled: {},
        warnings: [],
        errors: [],
      };

      try {
        // 1. Course
        const courseSelect = findSelect(['course', 'ddlcourse']);
        if (courseSelect) {
          const res = setSelectValue(courseSelect, studentData.course || 'B.TECH');
          report.filled.course = res;
        } else {
          report.warnings.push('Course dropdown not found on page');
        }

        // 2. Previous Studying (Inter / Diploma / Other)
        const prevSelect = findSelect(['previous', 'studying', 'prevstudy', 'ddlprevstudy', 'qualif']);
        if (prevSelect && studentData.previousStudying) {
          const res = setSelectValue(prevSelect, studentData.previousStudying);
          report.filled.previousStudying = res;
        } else {
          report.warnings.push('Previous Studying dropdown not found or value missing');
        }

        // 3. Scheme (2013)
        const schemeSelect = findSelect(['scheme', 'ddlscheme', 'regulation']);
        if (schemeSelect) {
          const res = setSelectValue(schemeSelect, studentData.scheme || '2013');
          report.filled.scheme = res;
        } else {
          report.warnings.push('Scheme dropdown not found on page');
        }

        // 4. Admitted Into (Branch: DATA SCIENCE, MECHANICAL, CSE, etc.)
        const branchSelect = findSelect(['admitted', 'branch', 'ddlbranch', 'dept']);
        if (branchSelect && studentData.portalBranch) {
          const res = setSelectValue(branchSelect, studentData.portalBranch);
          report.filled.portalBranch = res;
        } else {
          report.warnings.push(`Branch dropdown not found or mapping missing for "${studentData.portalBranch}"`);
        }

        // 5. College Admission No
        const admNoInput = findInput(['admission', 'admno', 'txtadmno', 'txtcollegeadmissionno']);
        if (admNoInput && studentData.admissionNo) {
          const res = setInputValue(admNoInput, studentData.admissionNo);
          report.filled.admissionNo = res;
        } else {
          report.warnings.push('College Admission No input not found on page');
        }

        // 6. Admission Date (DD-MMM-YY)
        const admDateInput = findInput(['admissiondate', 'admdate', 'txtadmdate', 'txtadmissiondate']);
        if (admDateInput && studentData.formattedAdmissionDate) {
          const res = setInputValue(admDateInput, studentData.formattedAdmissionDate);
          report.filled.admissionDate = res;
        } else {
          report.warnings.push('Admission Date input not found on page');
        }

        // 7. Hall Ticket Number (KUCET Roll Number)
        const htNoInput = findInput(['hallticket', 'htno', 'rollno', 'txthallticket', 'txthtno']);
        if (htNoInput && studentData.hallTicketNumber) {
          const res = setInputValue(htNoInput, studentData.hallTicketNumber);
          report.filled.hallTicketNumber = res;
        } else {
          report.warnings.push('Hall Ticket Number input not found on page');
        }

        // 8. Photo Attachment (Enforces size <= 194,560 bytes)
        if (photoBytesBase64 && photoFilename) {
          const photoInput = findElementByPatterns([
            'input[type="file"][id*="photo" i]',
            'input[type="file"][id*="pfp" i]',
            'input[type="file"][name*="photo" i]',
            'input[type="file"]:first-of-type',
          ]);

          if (photoInput) {
            const byteChars = atob(photoBytesBase64);
            const byteNums = new Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) {
              byteNums[i] = byteChars.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNums);
            const photoFile = new File([byteArray], photoFilename, { type: 'image/jpeg' });

            if (photoFile.size <= MAX_PORTAL_IMAGE_BYTES) {
              const res = attachFile(photoInput, photoFile);
              report.filled.photoAttachment = res;
              // Check photo checkbox if present
              checkCheckbox(['photo', 'chkphoto', 'chkpic']);
            } else {
              report.skipped.push(`Photo (${photoFile.name}): Exceeds safe upload limit (${photoFile.size} bytes > ${MAX_PORTAL_IMAGE_BYTES} bytes / 190 KiB). Attachment blocked.`);
              report.warnings.push(`This photograph could not be reduced below the safe upload limit (${Math.round(photoFile.size / 1024)} KB > 190 KiB). Attachment blocked to prevent portal rejection.`);
            }
          } else {
            report.warnings.push('Photo file input not found on page');
          }
        }

        // 9. Signature Attachment (Enforces size <= 194,560 bytes)
        if (signatureBytesBase64 && signatureFilename) {
          const sigInput = findElementByPatterns([
            'input[type="file"][id*="sign" i]',
            'input[type="file"][name*="sign" i]',
            'input[type="file"]:nth-of-type(2)',
          ]);

          if (sigInput) {
            const byteChars = atob(signatureBytesBase64);
            const byteNums = new Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) {
              byteNums[i] = byteChars.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNums);
            const sigFile = new File([byteArray], signatureFilename, { type: 'image/jpeg' });

            if (sigFile.size <= MAX_PORTAL_IMAGE_BYTES) {
              const res = attachFile(sigInput, sigFile);
              report.filled.signatureAttachment = res;
              // Check signature checkbox if present
              checkCheckbox(['sign', 'chksign', 'chksignature']);
            } else {
              report.skipped.push(`Signature (${sigFile.name}): Exceeds safe upload limit (${sigFile.size} bytes > ${MAX_PORTAL_IMAGE_BYTES} bytes / 190 KiB). Attachment blocked.`);
              report.warnings.push(`This signature could not be reduced below the safe upload limit (${Math.round(sigFile.size / 1024)} KB > 190 KiB). Attachment blocked to prevent portal rejection.`);
            }
          } else {
            report.warnings.push('Signature file input not found on page');
          }
        }

        sendResponse({ success: true, report });
      } catch (err) {
        sendResponse({ success: false, error: err.message, report });
      }

      return false;
    }

    // Phase 2: Primary Details Form Population
    if (request.action === 'FILL_PRIMARY_DETAILS') {
      const { primaryDetails } = request;
      const report = {
        populated: [],
        skipped: [],
        warnings: [],
        sameAddressResult: null,
      };

      try {
        if (!primaryDetails) {
          sendResponse({ success: false, error: 'No primary details payload provided' });
          return false;
        }

        // 1. Full Name
        const nameInput = findInput(['fullname', 'studentname', 'txtname', 'txtfullname']);
        if (nameInput && primaryDetails.fullName) {
          setInputValue(nameInput, primaryDetails.fullName);
          report.populated.push('Full Name');
        } else if (!primaryDetails.fullName) {
          report.skipped.push('Full Name');
        } else {
          report.warnings.push('Full Name input not found on page');
        }

        // 2. Father's / Guardian Name
        const fatherInput = findInput(['father', 'guardian', 'txtfathername', 'txtfather']);
        if (fatherInput && primaryDetails.fatherName) {
          setInputValue(fatherInput, primaryDetails.fatherName);
          report.populated.push("Father's Name");
        } else if (!primaryDetails.fatherName) {
          report.skipped.push("Father's Name");
        } else {
          report.warnings.push("Father's Name input not found on page");
        }

        // 3. Mother Name
        const motherInput = findInput(['mother', 'txtmothername', 'txtmother']);
        if (motherInput && primaryDetails.motherName) {
          setInputValue(motherInput, primaryDetails.motherName);
          report.populated.push('Mother Name');
        } else if (!primaryDetails.motherName) {
          report.skipped.push('Mother Name');
        } else {
          report.warnings.push('Mother Name input not found on page');
        }

        // 4. Date of Birth (3 Dropdowns: Day, Month, Year)
        if (primaryDetails.dobComponents) {
          const dobRes = populateDateOfBirth(primaryDetails.dobComponents);
          if (dobRes.success) {
            report.populated.push('Date of Birth');
          } else {
            report.warnings.push('Date of Birth dropdowns partially or not matched');
          }
        } else {
          report.skipped.push('Date of Birth');
        }

        // 5. Place of Birth
        const pobInput = findInput(['placeofbirth', 'birthplace', 'txtplaceofbirth', 'txtpob']);
        if (pobInput && primaryDetails.placeOfBirth) {
          setInputValue(pobInput, primaryDetails.placeOfBirth);
          report.populated.push('Place of Birth');
        } else if (!primaryDetails.placeOfBirth) {
          report.skipped.push('Place of Birth');
        } else {
          report.warnings.push('Place of Birth input not found on page');
        }

        // 6. Blood Group (Dropdown)
        const bloodSelect = findSelect(['blood', 'bloodgroup', 'ddlbloodgroup']);
        if (bloodSelect && primaryDetails.bloodGroup) {
          const res = setSelectValue(bloodSelect, primaryDetails.bloodGroup);
          if (res.success) {
            report.populated.push('Blood Group');
          } else {
            report.warnings.push(`Blood group option "${primaryDetails.bloodGroup}" not in dropdown`);
          }
        } else if (!primaryDetails.bloodGroup) {
          report.skipped.push('Blood Group');
        }

        // 7. Gender (Radio / Dropdown)
        if (primaryDetails.gender) {
          const radioRes = setRadioOption(['gender', 'rblgender', 'sex'], primaryDetails.gender);
          if (radioRes.success) {
            report.populated.push('Gender');
          } else {
            const genderSelect = findSelect(['gender', 'ddlgender', 'sex']);
            if (genderSelect && setSelectValue(genderSelect, primaryDetails.gender).success) {
              report.populated.push('Gender');
            } else {
              report.warnings.push('Gender radio/dropdown not found or not matched');
            }
          }
        }

        // 8. Location (Local / Nonlocal - Radio / Dropdown)
        if (primaryDetails.location) {
          const locRes = setRadioOption(['location', 'area', 'rbllocation', 'local'], primaryDetails.location);
          if (locRes.success) {
            report.populated.push('Location');
          } else {
            const locSelect = findSelect(['location', 'area', 'ddllocation', 'local']);
            if (locSelect && setSelectValue(locSelect, primaryDetails.location).success) {
              report.populated.push('Location');
            } else {
              report.warnings.push('Location radio/dropdown not found or not matched');
            }
          }
        }

        // 9. Current Address
        const addrField = findTextarea(['currentaddress', 'curraddress', 'address', 'txtaddress', 'txtcurrentaddress']) ||
                          findInput(['currentaddress', 'curraddress', 'address', 'txtaddress', 'txtcurrentaddress']);
        if (addrField && primaryDetails.currentAddress) {
          if (addrField.tagName.toLowerCase() === 'textarea') {
            setTextareaValue(addrField, primaryDetails.currentAddress);
          } else {
            setInputValue(addrField, primaryDetails.currentAddress);
          }
          report.populated.push('Current Address');
        } else if (!primaryDetails.currentAddress) {
          report.skipped.push('Current Address');
        } else {
          report.warnings.push('Current Address input/textarea not found on page');
        }

        // 10. Permanent Address (Same as Current Address via Checkbox)
        const sameAddrRes = setSameAddressCheckbox();
        report.sameAddressResult = sameAddrRes;
        if (sameAddrRes.success) {
          report.populated.push('Permanent Address (Same-as-current checkbox activated)');
          report.sameAddressCopied = sameAddrRes.permanentCopied;
        } else {
          report.warnings.push(sameAddrRes.reason || 'Could not activate same-address checkbox');
        }

        // 11. Aadhaar Card Number
        const aadhaarInput = findInput(['aadhaar', 'aadhar', 'txtaadhaar', 'uid', 'txtuid']);
        if (aadhaarInput && primaryDetails.aadhaarNumber) {
          setInputValue(aadhaarInput, primaryDetails.aadhaarNumber);
          report.populated.push('Aadhaar Card Number');
        } else if (!primaryDetails.aadhaarNumber) {
          report.skipped.push('Aadhaar Card Number');
        } else {
          report.warnings.push('Aadhaar Card Number input not found on page');
        }

        // 12. Contact Number
        const contactInput = findInput(['contact', 'mobile', 'phone', 'txtcontact', 'txtmobile']);
        if (contactInput && primaryDetails.contactNumber) {
          setInputValue(contactInput, primaryDetails.contactNumber);
          report.populated.push('Contact Number');
        } else if (!primaryDetails.contactNumber) {
          report.skipped.push('Contact Number');
        } else {
          report.warnings.push('Contact Number input not found on page');
        }

        // 13. EMAIL ID: EXPLICITLY OMITTED PER MANDATORY INSTITUTIONAL RULE
        // Must leave university Email ID completely blank. Do not search or warn.

        // 14. Nationality
        const natSelect = findSelect(['nationality', 'ddlnationality']);
        if (natSelect && primaryDetails.nationality) {
          if (setSelectValue(natSelect, primaryDetails.nationality).success) {
            report.populated.push('Nationality');
          } else {
            report.warnings.push(`Nationality option "${primaryDetails.nationality}" not matched`);
          }
        }

        // 15. Religion
        const relSelect = findSelect(['religion', 'ddlreligion']);
        if (relSelect && primaryDetails.religion) {
          if (setSelectValue(relSelect, primaryDetails.religion).success) {
            report.populated.push('Religion');
          } else {
            const relInput = findInput(['religion', 'txtreligion']);
            if (relInput) {
              setInputValue(relInput, primaryDetails.religion);
              report.populated.push('Religion');
            } else {
              report.warnings.push(`Religion "${primaryDetails.religion}" not matched`);
            }
          }
        }

        // 16. Mother Tongue
        const tongueSelect = findSelect(['mothertongue', 'tongue', 'ddlmothertongue']);
        if (tongueSelect && primaryDetails.motherTongue) {
          if (setSelectValue(tongueSelect, primaryDetails.motherTongue).success) {
            report.populated.push('Mother Tongue');
          } else {
            const tongueInput = findInput(['mothertongue', 'txtmothertongue']);
            if (tongueInput) {
              setInputValue(tongueInput, primaryDetails.motherTongue);
              report.populated.push('Mother Tongue');
            } else {
              report.warnings.push(`Mother Tongue "${primaryDetails.motherTongue}" not matched`);
            }
          }
        }

        // 17. Social Status (Category)
        const socialSelect = findSelect(['socialstatus', 'category', 'community', 'ddlsocialstatus', 'ddlcategory']);
        if (socialSelect && primaryDetails.socialStatus) {
          if (setSelectValue(socialSelect, primaryDetails.socialStatus).success) {
            report.populated.push('Social Status');
          } else {
            report.warnings.push(`Social Status option "${primaryDetails.socialStatus}" not matched in dropdown`);
          }
        } else if (!primaryDetails.socialStatus) {
          report.skipped.push('Social Status');
        }

        // 18. Sub-Caste
        const subCasteInput = findInput(['subcaste', 'caste', 'txtsubcaste']);
        if (subCasteInput && primaryDetails.subCaste) {
          setInputValue(subCasteInput, primaryDetails.subCaste);
          report.populated.push('Sub-Caste');
        } else if (!primaryDetails.subCaste) {
          report.skipped.push('Sub-Caste');
        }

        // 19. Father/Guardian Occupation
        const occInput = findInput(['occupation', 'fatheroccupation', 'txtoccupation']);
        if (occInput && primaryDetails.fatherOccupation) {
          setInputValue(occInput, primaryDetails.fatherOccupation);
          report.populated.push("Father's Occupation");
        } else if (!primaryDetails.fatherOccupation) {
          report.skipped.push("Father's Occupation");
        }

        // 20. Income (Exact Numeric Value: e.g. 50000, 100001, 250001, 500001, 800001)
        const incomeInput = findInput(['income', 'annualincome', 'txtincome', 'txtannualincome']);
        if (incomeInput && primaryDetails.portalIncome) {
          setInputValue(incomeInput, primaryDetails.portalIncome);
          report.populated.push(`Income (${primaryDetails.portalIncome})`);
        } else if (!primaryDetails.portalIncome) {
          report.skipped.push('Income');
        } else {
          report.warnings.push('Income input not found on page');
        }

        sendResponse({ success: true, report });
      } catch (err) {
        sendResponse({ success: false, error: err.message, report });
      }

      return false;
    }
  });
})();
