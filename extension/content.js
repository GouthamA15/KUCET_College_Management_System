/* global chrome */
/**
 * Content Script for KUCET Admission Bridge.
 * Executes in the context of: https://kuonline.co.in/BTechsql/Btechreg.aspx
 * 
 * Core Invariants:
 * - Strictly guarded to target university registration page.
 * - Robust ASP.NET Web Forms DOM interaction layer (finding controls by ID, safe option matching).
 * - Detects and handles ASP.NET postbacks via sessionStorage stage tracking.
 * - Attaches photos and signatures via modern HTML5 DataTransfer with explicit input enablement.
 * - Activates accompanying photo/sign checkboxes and parent span onchange triggers.
 * - Reads back and verifies target DOM values before reporting success.
 * - NEVER clicks or submits 'Submit & Step2' or 'Submit'.
 */

(() => {
  // 1. Guard against duplicate injection
  if (window.__KUCET_ADMISSION_BRIDGE_LOADED__) {
    console.info('[KUCET Admission Bridge] Content script already active on this tab.');
    return;
  }
  window.__KUCET_ADMISSION_BRIDGE_LOADED__ = true;

  console.info('[KUCET Admission Bridge] Content script loaded on KU Online portal.');

  // Maximum safe image upload limit (University requirement: < 250 KB; Extension target: < 190 KiB = 194,560 B)
  const MAX_PORTAL_IMAGE_BYTES = 250 * 1024; // 256,000 bytes hard university ceiling
  const SESSION_STAGE_KEY = 'kucet_bridge_pending_stage';

  // ==========================================
  // DOM CONTROL FINDERS & SAFE MANIPULATORS
  // ==========================================

  function findControlById(id) {
    if (!id) return null;
    return document.getElementById(id);
  }

  function findControlByPatterns(selectors) {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) return el;
      } catch (_) {}
    }
    return null;
  }

  function findSelect(exactId, fallbackPatterns = []) {
    const el = findControlById(exactId);
    if (el && el.tagName.toLowerCase() === 'select') return el;

    const selects = Array.from(document.querySelectorAll('select'));
    for (const p of fallbackPatterns) {
      const lowerP = p.toLowerCase();
      const match = selects.find(
        (s) => (s.id && s.id.toLowerCase().includes(lowerP)) || (s.name && s.name.toLowerCase().includes(lowerP))
      );
      if (match) return match;
    }
    return null;
  }

  function findInput(exactId, fallbackPatterns = [], type = 'text') {
    const el = findControlById(exactId);
    if (el) return el;

    const inputs = Array.from(document.querySelectorAll(`input[type="${type}"], input:not([type])`));
    for (const p of fallbackPatterns) {
      const lowerP = p.toLowerCase();
      const match = inputs.find(
        (inp) => (inp.id && inp.id.toLowerCase().includes(lowerP)) || (inp.name && inp.name.toLowerCase().includes(lowerP))
      );
      if (match) return match;
    }
    return null;
  }

  function findTextarea(exactId, fallbackPatterns = []) {
    const el = findControlById(exactId);
    if (el && el.tagName.toLowerCase() === 'textarea') return el;

    const textareas = Array.from(document.querySelectorAll('textarea'));
    for (const p of fallbackPatterns) {
      const lowerP = p.toLowerCase();
      const match = textareas.find(
        (ta) => (ta.id && ta.id.toLowerCase().includes(lowerP)) || (ta.name && ta.name.toLowerCase().includes(lowerP))
      );
      if (match) return match;
    }
    return null;
  }

  /**
   * Safely selects an option in an ASP.NET dropdown by exact value, exact text, or substring.
   * Detects whether the dropdown has an onchange handler triggering __doPostBack.
   */
  function safeSetSelectValue(selectEl, targetValue, { triggerPostback = true } = {}) {
    if (!selectEl) return { success: false, reason: 'Dropdown element not found' };
    if (targetValue === undefined || targetValue === null || String(targetValue).trim() === '') {
      return { success: false, reason: 'Empty target value' };
    }

    const cleanTarget = String(targetValue).trim().toUpperCase();
    let matchedIndex = -1;
    let matchType = '';

    // Pass 1: Exact text match or exact value match
    for (let i = 0; i < selectEl.options.length; i++) {
      const opt = selectEl.options[i];
      const optText = (opt.text || '').trim().toUpperCase();
      const optVal = (opt.value || '').trim().toUpperCase();

      if (optText === cleanTarget || optVal === cleanTarget) {
        matchedIndex = i;
        matchType = 'exact';
        break;
      }
    }

    // Pass 2: Word boundary or prefix match if not found
    if (matchedIndex === -1) {
      for (let i = 0; i < selectEl.options.length; i++) {
        const opt = selectEl.options[i];
        const optText = (opt.text || '').trim().toUpperCase();
        if (optText.startsWith(cleanTarget) || optText.includes(` ${cleanTarget}`) || cleanTarget.includes(optText)) {
          matchedIndex = i;
          matchType = 'partial';
          break;
        }
      }
    }

    // Pass 3: Substring fallback (ignoring punctuation like dots and dashes)
    if (matchedIndex === -1) {
      const strippedTarget = cleanTarget.replace(/[^A-Z0-9]/g, '');
      if (strippedTarget.length >= 2) {
        for (let i = 0; i < selectEl.options.length; i++) {
          const opt = selectEl.options[i];
          const strippedText = (opt.text || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (strippedText.includes(strippedTarget) || strippedTarget.includes(strippedText)) {
            matchedIndex = i;
            matchType = 'normalized';
            break;
          }
        }
      }
    }

    if (matchedIndex === -1) {
      const availableOptions = Array.from(selectEl.options).map((o) => `"${o.text}" (${o.value})`).slice(0, 8);
      return {
        success: false,
        reason: `Value "${targetValue}" not found in dropdown. Available options: ${availableOptions.join(', ')}`,
      };
    }

    const wasAlreadySelected = selectEl.selectedIndex === matchedIndex;
    selectEl.selectedIndex = matchedIndex;

    const onchangeAttr = selectEl.getAttribute('onchange') || '';
    const hasPostBack = onchangeAttr.includes('__doPostBack');

    // Dispatch DOM events
    selectEl.dispatchEvent(new Event('input', { bubbles: true }));

    if (!wasAlreadySelected && triggerPostback) {
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    return {
      success: true,
      value: selectEl.value,
      text: selectEl.options[matchedIndex]?.text,
      matchType,
      wasAlreadySelected,
      hasPostBack: !wasAlreadySelected && hasPostBack,
    };
  }

  /**
   * Safely sets text or number in an input element and dispatches input event.
   */
  function safeSetInputValue(inputEl, val) {
    if (!inputEl) return { success: false, reason: 'Input element not found' };
    const stringVal = val === null || val === undefined ? '' : String(val);

    inputEl.focus();
    inputEl.value = stringVal;
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.blur();

    return {
      success: inputEl.value === stringVal,
      value: inputEl.value,
    };
  }

  /**
   * Safely sets textarea content.
   */
  function safeSetTextareaValue(taEl, val) {
    if (!taEl) return { success: false, reason: 'Textarea element not found' };
    const stringVal = val === null || val === undefined ? '' : String(val);

    taEl.focus();
    taEl.value = stringVal;
    taEl.dispatchEvent(new Event('input', { bubbles: true }));
    taEl.blur();

    return {
      success: taEl.value === stringVal,
      value: taEl.value,
    };
  }

  /**
   * Safely selects an option from an ASP.NET radio button group or table.
   */
  function safeSetRadioOption(containerId, fallbackPatterns, targetValue) {
    if (!targetValue) return { success: false, reason: 'No target value provided' };
    const cleanTarget = String(targetValue).trim().toUpperCase();

    // Look inside specified container table/div first
    let radios = [];
    const container = findControlById(containerId);
    if (container) {
      radios = Array.from(container.querySelectorAll('input[type="radio"]'));
    }

    if (radios.length === 0) {
      const allRadios = Array.from(document.querySelectorAll('input[type="radio"]'));
      radios = allRadios.filter((r) => {
        const id = (r.id || '').toLowerCase();
        const name = (r.name || '').toLowerCase();
        return fallbackPatterns.some((p) => id.includes(p.toLowerCase()) || name.includes(p.toLowerCase()));
      });
    }

    for (const radio of radios) {
      const val = (radio.value || '').trim().toUpperCase();
      let isMatch = val === cleanTarget;

      // Check associated label
      if (!isMatch && radio.id) {
        const label = document.querySelector(`label[for="${radio.id}"]`);
        if (label) {
          const labelText = (label.textContent || '').trim().toUpperCase();
          if (labelText === cleanTarget || labelText.includes(cleanTarget) || cleanTarget.includes(labelText)) {
            isMatch = true;
          }
        }
      }

      // Check numerical alias (e.g. 1 = Male / Local, 2 = Female / Nonlocal)
      if (!isMatch) {
        if ((cleanTarget === 'MALE' || cleanTarget === 'LOCAL') && val === '1') isMatch = true;
        if ((cleanTarget === 'FEMALE' || cleanTarget === 'NONLOCAL' || cleanTarget === 'NON-LOCAL') && val === '2') isMatch = true;
      }

      if (isMatch) {
        radio.checked = true;
        radio.dispatchEvent(new Event('input', { bubbles: true }));
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        radio.dispatchEvent(new Event('click', { bubbles: true }));
        return { success: true, value: radio.value, checked: radio.checked };
      }
    }

    return { success: false, reason: `Radio option "${targetValue}" not found` };
  }

  /**
   * Activates the photo/signature checkbox and explicitly un-disables the file input.
   */
  function enableMediaInput(checkboxId, fileInputId) {
    const chk = findControlById(checkboxId);
    const fu = findControlById(fileInputId);

    if (chk && !chk.checked) {
      chk.checked = true;
      chk.dispatchEvent(new Event('change', { bubbles: true }));
      chk.dispatchEvent(new Event('click', { bubbles: true }));

      // Also trigger parent span onchange if present (ASP.NET Web Forms inline handler)
      if (chk.parentElement && typeof chk.parentElement.onchange === 'function') {
        try {
          chk.parentElement.onchange();
        } catch (_) {}
      }
    }

    if (fu) {
      fu.disabled = false;
      fu.removeAttribute('disabled');
    }

    return { checkboxChecked: Boolean(chk?.checked), inputEnabled: Boolean(fu && !fu.disabled) };
  }

  /**
   * Converts Base64 data to File object and attaches to input element via HTML5 DataTransfer.
   */
  function attachFileFromBase64(fileInputEl, base64Data, filename) {
    if (!fileInputEl) return { success: false, reason: 'File input not found' };
    if (!base64Data) return { success: false, reason: 'Base64 data is empty' };

    try {
      // Clean base64 string
      const rawBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      const byteChars = atob(rawBase64);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNums[i] = byteChars.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNums);

      if (byteArray.length > MAX_PORTAL_IMAGE_BYTES) {
        return {
          success: false,
          reason: `File size (${byteArray.length} B) exceeds maximum portal limit of ${MAX_PORTAL_IMAGE_BYTES} B (250 KB).`,
        };
      }

      const fileObj = new File([byteArray], filename, { type: 'image/jpeg' });
      const dt = new DataTransfer();
      dt.items.add(fileObj);

      fileInputEl.disabled = false;
      fileInputEl.removeAttribute('disabled');
      fileInputEl.files = dt.files;

      fileInputEl.dispatchEvent(new Event('input', { bubbles: true }));
      fileInputEl.dispatchEvent(new Event('change', { bubbles: true }));

      const attachedOk = fileInputEl.files && fileInputEl.files.length > 0;
      return {
        success: attachedOk,
        filename: fileObj.name,
        sizeBytes: fileObj.size,
      };
    } catch (err) {
      return { success: false, reason: err.message };
    }
  }

  // ==========================================
  // TAB ACTIVATION & NAVIGATION
  // ==========================================

  function ensureTabPanelActive(panelId, tabLinkId) {
    const tabLink = findControlById(tabLinkId) || findControlByPatterns([`#${panelId}_tab a`, `a[id*="${panelId}"]`]);
    if (tabLink) {
      tabLink.click();
    }
    const panel = findControlById(panelId);
    if (panel) {
      panel.style.display = 'block';
      panel.style.visibility = 'visible';
    }
  }

  // ==========================================
  // STEP 1: ADMISSION INFO POPULATION
  // ==========================================

  function populateAdmissionInfo(payload) {
    const student = payload.student || payload.studentData || {};
    const photoData = payload.photo || (payload.photoBytesBase64 ? { base64: payload.photoBytesBase64, filename: payload.photoFilename } : null);
    const signatureData = payload.signature || (payload.signatureBytesBase64 ? { base64: payload.signatureBytesBase64, filename: payload.signatureFilename } : null);

    const report = {
      startTime: new Date().toISOString(),
      populated: [],
      skipped: [],
      failed: [],
      warnings: [],
      requiresPostback: false,
      postbackStage: null,
      verification: {},
    };

    try {
      // Ensure Admission Info tab is active
      ensureTabPanelActive(
        'ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser',
        '__tab_ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser'
      );

      // 1. Course (ddlAdmisnInto)
      const courseSelect = findSelect('ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_ddlAdmisnInto', ['ddlAdmisnInto', 'course']);
      const targetCourse = student.course || 'B.TECH';

      if (courseSelect) {
        const courseRes = safeSetSelectValue(courseSelect, targetCourse);
        if (courseRes.success) {
          report.populated.push('Course');
          report.verification.course = courseRes.text;

          // If changing course triggered an ASP.NET postback, save stage and pause
          if (courseRes.hasPostBack) {
            report.requiresPostback = true;
            report.postbackStage = 'COURSE_POSTBACK';
            try {
              sessionStorage.setItem(
                SESSION_STAGE_KEY,
                JSON.stringify({
                  action: 'PORTAL_POPULATE_ADMISSION_INFO',
                  payload,
                  stage: 'COURSE_POSTBACK_PENDING',
                  timestamp: Date.now(),
                })
              );
            } catch (_) {}
            return {
              success: true,
              populatedFields: report.populated,
              skippedFields: report.skipped,
              failedFields: report.failed,
              warnings: report.warnings,
              requiresPostback: true,
              message: 'Course selected. Waiting for portal postback to populate branches...',
              report,
            };
          }
        } else {
          report.failed.push(`Course (${courseRes.reason})`);
        }
      } else {
        report.failed.push('Course dropdown (ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_ddlAdmisnInto) not found');
      }

      // 2. Admitted Into / Branch (ddlCoursc)
      const branchSelect = findSelect('ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_ddlCoursc', ['ddlCoursc', 'admitted', 'branch']);
      const targetBranch = student.portalBranch || student.cmsBranch;

      if (branchSelect) {
        if (branchSelect.options.length <= 1) {
          report.warnings.push('Branch options are not yet populated by the portal. Course postback may be in progress.');
          report.skipped.push('Admitted into (Branch dropdown empty)');
        } else if (targetBranch) {
          const branchRes = safeSetSelectValue(branchSelect, targetBranch);
          if (branchRes.success) {
            report.populated.push('Admitted into (Branch)');
            report.verification.branch = branchRes.text;

            if (branchRes.hasPostBack) {
              report.requiresPostback = true;
              report.postbackStage = 'BRANCH_POSTBACK';
              try {
                sessionStorage.setItem(
                  SESSION_STAGE_KEY,
                  JSON.stringify({
                    action: 'PORTAL_POPULATE_ADMISSION_INFO',
                    payload,
                    stage: 'BRANCH_POSTBACK_PENDING',
                    timestamp: Date.now(),
                  })
                );
              } catch (_) {}
              return {
                success: true,
                populatedFields: report.populated,
                skippedFields: report.skipped,
                failedFields: report.failed,
                warnings: report.warnings,
                requiresPostback: true,
                message: 'Branch selected. Waiting for portal postback to populate schemes...',
                report,
              };
            }
          } else {
            report.failed.push(`Admitted into (${branchRes.reason})`);
          }
        } else {
          report.skipped.push('Admitted into (No branch provided in CMS record)');
        }
      } else {
        report.failed.push('Branch dropdown (ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_ddlCoursc) not found');
      }

      // 3. Previous Studying (ddlMedium)
      const prevSelect = findSelect('ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_ddlMedium', ['ddlMedium', 'previous', 'studying']);
      if (prevSelect) {
        const prevStudyVal = student.previousStudying || (student.admissionType === 'Lateral' ? 'Diploma' : 'Inter');
        const prevRes = safeSetSelectValue(prevSelect, prevStudyVal);
        if (prevRes.success) {
          report.populated.push('Previous Studying');
          report.verification.previousStudying = prevRes.text;
        } else {
          report.failed.push(`Previous Studying (${prevRes.reason})`);
        }
      } else {
        report.failed.push('Previous Studying dropdown not found');
      }

      // 4. Scheme (ddlSCM)
      const schemeSelect = findSelect('ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_ddlSCM', ['ddlSCM', 'scheme']);
      const targetScheme = student.scheme || '2013';
      if (schemeSelect) {
        if (schemeSelect.options.length <= 1) {
          report.skipped.push('Scheme (Dropdown empty or waiting for branch selection)');
        } else {
          const schemeRes = safeSetSelectValue(schemeSelect, targetScheme, { triggerPostback: false });
          if (schemeRes.success) {
            report.populated.push('Scheme');
            report.verification.scheme = schemeRes.text;
          } else {
            report.warnings.push(`Scheme option "${targetScheme}" not present in dropdown.`);
            report.failed.push(`Scheme (${schemeRes.reason})`);
          }
        }
      } else {
        report.warnings.push('Scheme dropdown not found on page');
      }

      // 5. College Admission No (txtAdmno)
      const admNoInput = findInput('ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_txtAdmno', ['txtAdmno', 'admissionno']);
      if (admNoInput) {
        if (student.admissionNo) {
          const res = safeSetInputValue(admNoInput, student.admissionNo);
          if (res.success) {
            report.populated.push('College Admission No');
            report.verification.admissionNo = res.value;
          } else {
            report.failed.push('College Admission No (Failed to set input value)');
          }
        } else {
          report.skipped.push('College Admission No (Missing in CMS record)');
        }
      } else {
        report.failed.push('College Admission No input (ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_txtAdmno) not found');
      }

      // 6. Admission Date (txtAdminDate)
      const admDateInput = findInput('ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_txtAdminDate', ['txtAdminDate', 'admissiondate']);
      if (admDateInput) {
        const dateVal = student.formattedAdmissionDate || student.admissionDate;
        if (dateVal) {
          const res = safeSetInputValue(admDateInput, dateVal);
          if (res.success) {
            report.populated.push('Admission Date');
            report.verification.admissionDate = res.value;
          } else {
            report.failed.push('Admission Date (Failed to set input value)');
          }
        } else {
          report.skipped.push('Admission Date (Missing in CMS record)');
        }
      } else {
        report.failed.push('Admission Date input (ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_txtAdminDate) not found');
      }

      // 7. Hall Ticket Number (LblTempRollno)
      const htNoInput = findInput('ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_LblTempRollno', ['LblTempRollno', 'hallticket', 'htno']);
      if (htNoInput) {
        const rollVal = student.hallTicketNumber || student.rollNo;
        if (rollVal) {
          const res = safeSetInputValue(htNoInput, rollVal);
          if (res.success) {
            report.populated.push('Hall Ticket Number');
            report.verification.hallTicketNumber = res.value;
          } else {
            report.failed.push('Hall Ticket Number (Failed to set input value)');
          }
        } else {
          report.skipped.push('Hall Ticket Number (Missing in CMS record)');
        }
      } else {
        report.failed.push('Hall Ticket Number input (ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_LblTempRollno) not found');
      }

      // 8. Photo Attachment
      if (photoData && photoData.base64) {
        enableMediaInput(
          'ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_ChkStudentPhoto',
          'ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_fuStudentPhoto'
        );
        const photoInput = findControlById('ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_fuStudentPhoto');
        const filename = photoData.filename || (student.admissionNo ? `${student.admissionNo}.jpg` : `${student.rollNo || 'student'}_photo.jpg`);
        const photoRes = attachFileFromBase64(photoInput, photoData.base64, filename);

        if (photoRes.success) {
          report.populated.push(`Photo Attachment (${photoRes.filename}, ${Math.round(photoRes.sizeBytes / 1024)} KB)`);
          report.verification.photoAttached = true;
          report.verification.photoStatus = 'Attached — awaiting portal confirmation';
          report.verification.photoFilename = photoRes.filename;
        } else {
          report.failed.push(`Photo Attachment (${photoRes.reason})`);
          report.verification.photoStatus = 'FAILED';
        }
      } else {
        report.skipped.push('Photo Attachment (No photo data provided)');
        report.verification.photoStatus = 'MISSING';
      }

      // 9. Signature Attachment
      if (signatureData && signatureData.base64) {
        enableMediaInput(
          'ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_ChkSignature',
          'ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_fusign'
        );
        const sigInput = findControlById('ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_fusign');
        const filename = signatureData.filename || (student.admissionNo ? `${student.admissionNo}(1).jpg` : `${student.rollNo || 'student'}_sign.jpg`);
        const sigRes = attachFileFromBase64(sigInput, signatureData.base64, filename);

        if (sigRes.success) {
          report.populated.push(`Signature Attachment (${sigRes.filename}, ${Math.round(sigRes.sizeBytes / 1024)} KB)`);
          report.verification.signatureAttached = true;
          report.verification.signatureStatus = 'Attached — awaiting portal confirmation';
          report.verification.signatureFilename = sigRes.filename;
        } else {
          report.failed.push(`Signature Attachment (${sigRes.reason})`);
          report.verification.signatureStatus = 'FAILED';
        }
      } else {
        report.skipped.push('Signature Attachment (No signature data provided)');
        report.verification.signatureStatus = 'MISSING';
      }

      // If photo attached but signature failed, report partial attachment warning
      if (report.verification.photoAttached && !report.verification.signatureAttached) {
        report.warnings.push('Only photograph was attached; signature attachment failed or was missing.');
      } else if (!report.verification.photoAttached && report.verification.signatureAttached) {
        report.warnings.push('Only signature was attached; photograph attachment failed or was missing.');
      }

      // Clear pending postback session stage upon full completion
      try {
        sessionStorage.removeItem(SESSION_STAGE_KEY);
      } catch (_) {}

      return {
        success: report.failed.length === 0,
        populatedFields: report.populated,
        skippedFields: report.skipped,
        failedFields: report.failed,
        warnings: report.warnings,
        verification: report.verification,
        report,
      };
    } catch (err) {
      return {
        success: false,
        error: err.message,
        populatedFields: report.populated,
        skippedFields: report.skipped,
        failedFields: report.failed,
        report,
      };
    }
  }

  // ==========================================
  // STEP 2: PRIMARY DETAILS POPULATION
  // ==========================================

  function populatePrimaryDetails(payload) {
    const student = payload.student || payload.studentData || {};
    const pd = student.primaryDetails || payload.primaryDetails || {};

    const report = {
      startTime: new Date().toISOString(),
      populated: [],
      skipped: [],
      failed: [],
      warnings: [],
      verification: {},
    };

    try {
      // 1. Ensure Primary Details Tab (TabPanel1) is active
      ensureTabPanelActive(
        'ctl00_ContentPlaceHolder1_TabContainer1_TabPanel1',
        '__tab_ctl00_ContentPlaceHolder1_TabContainer1_TabPanel1'
      );

      // Helper for inputs
      const fillInput = (id, patterns, val, labelName, isMandatory = false) => {
        const inp = findInput(id, patterns);
        if (inp) {
          if (val) {
            const res = safeSetInputValue(inp, val);
            if (res.success) {
              report.populated.push(labelName);
              report.verification[id] = res.value;
            } else {
              report.failed.push(`${labelName} (Failed to update value)`);
            }
          } else {
            if (isMandatory) report.warnings.push(`Mandatory field "${labelName}" is missing in CMS student record.`);
            report.skipped.push(labelName);
          }
        } else {
          report.failed.push(`${labelName} (${id} not found on page)`);
        }
      };

      // 1. Full Name
      fillInput('ctl00_ContentPlaceHolder1_TabContainer1_TabPanel1_txtFName', ['txtFName', 'fullname'], pd.fullName || student.name, 'Full Name', true);

      // 2. Father's / Guardian Name
      fillInput('ctl00_ContentPlaceHolder1_TabContainer1_TabPanel1_txtFaName', ['txtFaName', 'father'], pd.fatherName, "Father's/Guardian Name", true);

      // 3. Mother Name
      fillInput('ctl00_ContentPlaceHolder1_TabContainer1_TabPanel1_txtMom', ['txtMom', 'mother'], pd.motherName, 'Mother Name', true);

      // 4. Date of Birth (3 Dropdowns: ddDate, ddMonth, ddYear)
      const dob = pd.dobComponents;
      if (dob) {
        // Date
        const dateSelect = findSelect('ctl00_ContentPlaceHolder1_TabContainer1_TabPanel1_ddDate', ['ddDate']);
        if (dateSelect) {
          const res = safeSetSelectValue(dateSelect, dob.day);
          if (res.success) {
            report.populated.push('Date of Birth (Day)');
          } else {
            report.failed.push(`DOB Day (${res.reason})`);
          }
        }

        // Month
        const monthSelect = findSelect('ctl00_ContentPlaceHolder1_TabContainer1_TabPanel1_ddMonth', ['ddMonth']);
        if (monthSelect) {
          let res = safeSetSelectValue(monthSelect, dob.monthShort || dob.monthName);
          if (!res.success && dob.month) {
            res = safeSetSelectValue(monthSelect, dob.month);
          }
          if (res.success) {
            report.populated.push('Date of Birth (Month)');
          } else {
            report.failed.push(`DOB Month (${res.reason})`);
          }
        }

        // Year
        const yearSelect = findSelect('ctl00_ContentPlaceHolder1_TabContainer1_TabPanel1_ddYear', ['ddYear']);
        if (yearSelect) {
          const res = safeSetSelectValue(yearSelect, dob.year);
          if (res.success) {
            report.populated.push('Date of Birth (Year)');
          } else {
            report.failed.push(`DOB Year (${res.reason})`);
          }
        }
      } else if (pd.dateOfBirth) {
        report.warnings.push('Date of birth components not structured; review portal DOB dropdowns.');
        report.skipped.push('Date of Birth');
      } else {
        report.warnings.push('Mandatory Date of Birth is missing in CMS record.');
        report.skipped.push('Date of Birth');
      }

      // 5. Place of Birth
      fillInput('ctl00_ContentPlaceHolder1_TabContainer1_TabPanel1_txtPob', ['txtPob', 'placeofbirth'], pd.placeOfBirth, 'Place of Birth');

      // 6. Blood Group (ddBlood) — Strict Not-Available Fallback & Validation
      const bloodSelect = findSelect('ctl00_ContentPlaceHolder1_TabContainer1_TabPanel1_ddBlood', ['ddBlood']);
      if (!bloodSelect) {
        report.failed.push('Blood Group dropdown (ctl00_ContentPlaceHolder1_TabContainer1_TabPanel1_ddBlood) not found');
      } else {
        const rawBlood = pd.bloodGroup;
        const isAbsent = rawBlood === undefined || rawBlood === null || String(rawBlood).trim() === '' || String(rawBlood).trim() === '—' || String(rawBlood).trim().toLowerCase() === 'not provided';
        
        let targetOption = null;
        let isUnknown = false;

        if (isAbsent) {
          targetOption = 'Not-Available';
        } else {
          const clean = String(rawBlood).toUpperCase().replace(/\s+/g, '').trim();
          const standardGroups = ['O+', 'O-', 'AB+', 'A+', 'A-', 'B+', 'B-', 'AB-'];
          if (standardGroups.includes(clean)) {
            targetOption = clean;
          } else if (
            clean.includes('NOTAVAILABLE') ||
            clean.includes('NOT-AVAILABLE') ||
            clean.includes('N/A') ||
            clean === 'NA' ||
            clean === 'NONE' ||
            clean === 'UNKNOWN'
          ) {
            targetOption = 'Not-Available';
          } else {
            isUnknown = true;
          }
        }

        if (isUnknown) {
          report.failed.push(`Blood Group requires manual verification: unmapped value "${rawBlood}"`);
          report.warnings.push(`Unknown blood group "${rawBlood}". Manual selection required.`);
        } else {
          // Find option matching targetOption in portal select element
          let matchedOptionIndex = -1;
          for (let i = 0; i < bloodSelect.options.length; i++) {
            const opt = bloodSelect.options[i];
            const optText = (opt.text || '').trim();
            const optVal = (opt.value || '').trim();

            if (targetOption === 'Not-Available') {
              if (
                optText.toLowerCase().includes('not-available') ||
                optText.toLowerCase().includes('not available') ||
                optVal.toLowerCase().includes('not-available') ||
                optVal.toLowerCase().includes('not available')
              ) {
                matchedOptionIndex = i;
                break;
              }
            } else {
              if (
                optText.toUpperCase().replace(/\s+/g, '') === targetOption ||
                optVal.toUpperCase().replace(/\s+/g, '') === targetOption
              ) {
                matchedOptionIndex = i;
                break;
              }
            }
          }

          if (matchedOptionIndex < 0) {
            if (targetOption === 'Not-Available') {
              report.failed.push("Blood Group: Missing 'Not-Available' option in portal dropdown");
            } else {
              report.failed.push(`Blood Group: Option "${targetOption}" not found in portal dropdown`);
            }
          } else {
            bloodSelect.selectedIndex = matchedOptionIndex;
            bloodSelect.dispatchEvent(new Event('input', { bubbles: true }));
            bloodSelect.dispatchEvent(new Event('change', { bubbles: true }));
            if (typeof bloodSelect.onchange === 'function') {
              try { bloodSelect.onchange(); } catch (_) {}
            }

            // Post-selection verification: ensure -Select- or empty is NOT selected
            const verifyOpt = bloodSelect.options[bloodSelect.selectedIndex];
            const verifyText = (verifyOpt?.text || '').trim();
            const verifyVal = (verifyOpt?.value || '').trim();

            if (bloodSelect.selectedIndex < 0 || verifyText.toLowerCase().includes('select') || verifyVal === '' || verifyVal === '0') {
              report.failed.push('Blood Group verification failed: default "-Select-" remains selected');
            } else {
              const label = isAbsent ? 'Blood Group (Not-Available fallback)' : `Blood Group (${verifyText})`;
              report.populated.push(label);
              report.verification.bloodGroup = verifyText;
            }
          }
        }
      }

      // 7. Gender (rbtnGender: 1=Male, 2=Female)
      if (pd.gender) {
        const res = safeSetRadioOption('ctl00_ContentPlaceHolder1_TabContainer1_TabPanel1_rbtnGender', ['rbtnGender', 'gender'], pd.gender);
        if (res.success) {
          report.populated.push('Gender');
        } else {
          report.failed.push(`Gender (${res.reason})`);
        }
      } else {
        report.skipped.push('Gender');
      }

      // 8. Location (rblLocation: 1=Local, 2=Nonlocal)
      if (pd.location) {
        const res = safeSetRadioOption('ctl00_ContentPlaceHolder1_TabContainer1_TabPanel1_rblLocation', ['rblLocation', 'location'], pd.location);
        if (res.success) {
          report.populated.push('Location');
        } else {
          report.failed.push(`Location (${res.reason})`);
        }
      } else {
        report.skipped.push('Location');
      }

      // 9. Current Address (txtAdd)
      const currAddrTa = findTextarea('ctl00_ContentPlaceHolder1_TabContainer1_TabPanel1_txtAdd', ['txtAdd', 'currentaddress']);
      if (currAddrTa && pd.currentAddress) {
        const res = safeSetTextareaValue(currAddrTa, pd.currentAddress);
        if (res.success) {
          report.populated.push('Current Address');
        } else {
          report.failed.push('Current Address (Failed to set textarea)');
        }
      } else if (!pd.currentAddress) {
        report.warnings.push('Mandatory Current Address missing in CMS record.');
        report.skipped.push('Current Address');
      }

      // 10. Permanent Address (txtPAdd) & Same Address Checkbox (chkSame)
      const permAddrTa = findTextarea('ctl00_ContentPlaceHolder1_TabContainer1_TabPanel1_txtPAdd', ['txtPAdd', 'permanentaddress']);
      const sameChk = findControlById('ctl00_ContentPlaceHolder1_TabContainer1_TabPanel1_chkSame');
      const permValue = pd.permanentAddress || pd.currentAddress;

      if (permAddrTa && permValue) {
        safeSetTextareaValue(permAddrTa, permValue);
        report.populated.push('Permanent Address');
      }
      if (sameChk && !sameChk.checked) {
        sameChk.checked = true;
        sameChk.dispatchEvent(new Event('change', { bubbles: true }));
        report.populated.push('Same Permanent Address (Checkbox)');
      }

      // 11. Aadhaar Card Number (txtAadhraCardno)
      fillInput('ctl00_ContentPlaceHolder1_TabContainer1_TabPanel1_txtAadhraCardno', ['txtAadhraCardno', 'aadhaar'], pd.aadhaarNumber, 'Aadhaar Card Number', true);

      // 12. Contact Number (txtCno)
      fillInput('ctl00_ContentPlaceHolder1_TabContainer1_TabPanel1_txtCno', ['txtCno', 'contact', 'mobile'], pd.contactNumber, 'Contact Number', true);

      // 13. EMAIL ID: EXPLICITLY OMITTED PER MANDATORY INSTITUTIONAL RULE
      // Leave university Email ID field completely blank.

      // 14. Nationality (ddlNation: 1=Indian, 2=Others)
      const natSelect = findSelect('ctl00_ContentPlaceHolder1_TabContainer1_TabPanel1_ddlNation', ['ddlNation']);
      if (natSelect && pd.nationality) {
        const res = safeSetSelectValue(natSelect, pd.nationality);
        if (res.success) {
          report.populated.push('Nationality');
        } else {
          report.failed.push(`Nationality (${res.reason})`);
        }
      } else if (!pd.nationality) {
        report.skipped.push('Nationality');
      }

      // 15. Religion (txtRelgion)
      fillInput('ctl00_ContentPlaceHolder1_TabContainer1_TabPanel1_txtRelgion', ['txtRelgion', 'religion'], pd.religion, 'Religion');

      // 16. Mother Tongue (txtMthrtung)
      fillInput('ctl00_ContentPlaceHolder1_TabContainer1_TabPanel1_txtMthrtung', ['txtMthrtung', 'mothertongue'], pd.motherTongue, 'Mother Tongue');

      // 17. Social Status (ddlScStus)
      const socialSelect = findSelect('ctl00_ContentPlaceHolder1_TabContainer1_TabPanel1_ddlScStus', ['ddlScStus', 'socialstatus']);
      if (socialSelect && pd.socialStatus) {
        const res = safeSetSelectValue(socialSelect, pd.socialStatus);
        if (res.success) {
          report.populated.push('Social Status');

          // Trigger onchange if present to reveal SC/BC sub-dropdowns
          if (typeof socialSelect.onchange === 'function') {
            try { socialSelect.onchange(); } catch (_) {}
          }
        } else {
          report.failed.push(`Social Status (${res.reason})`);
        }
      } else if (!pd.socialStatus) {
        report.skipped.push('Social Status');
      }

      // 18. Sub-Caste (txtSubcaste)
      fillInput('ctl00_ContentPlaceHolder1_TabContainer1_TabPanel1_txtSubcaste', ['txtSubcaste', 'subcaste'], pd.subCaste, 'Sub-Caste');

      // 19. Father/Guardian Occupation (txtOccptin)
      fillInput('ctl00_ContentPlaceHolder1_TabContainer1_TabPanel1_txtOccptin', ['txtOccptin', 'occupation'], pd.fatherOccupation, "Father's Occupation");

      // 20. Income (txtIncome: exact numeric value e.g. 50000, 100001, 250001, 500001, 800001)
      const incomeInput = findInput('ctl00_ContentPlaceHolder1_TabContainer1_TabPanel1_txtIncome', ['txtIncome', 'income']);
      if (incomeInput && pd.portalIncome) {
        const res = safeSetInputValue(incomeInput, pd.portalIncome);
        if (res.success) {
          report.populated.push(`Income (${pd.portalIncome})`);
        } else {
          report.failed.push('Income (Failed to set input value)');
        }
      } else if (!pd.portalIncome) {
        report.skipped.push('Income');
      }

      return {
        success: report.failed.length === 0,
        populatedFields: report.populated,
        skippedFields: report.skipped,
        failedFields: report.failed,
        warnings: report.warnings,
        verification: report.verification,
        report,
      };
    } catch (err) {
      return {
        success: false,
        error: err.message,
        populatedFields: report.populated,
        skippedFields: report.skipped,
        failedFields: report.failed,
        report,
      };
    }
  }

  // ==========================================
  // PAGE STATE DETECTION
  // ==========================================

  function getPageState() {
    const isTargetUrl = window.location.href.toLowerCase().includes('btechreg.aspx');
    const form = findControlById('aspnetForm');

    const courseSelect = findControlById('ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_ddlAdmisnInto');
    const branchSelect = findControlById('ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_ddlCoursc');
    const admNoInput = findControlById('ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_txtAdmno');
    const htNoInput = findControlById('ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_LblTempRollno');

    const nameInput = findControlById('ctl00_ContentPlaceHolder1_TabContainer1_TabPanel1_txtFName');
    const aadhaarInput = findControlById('ctl00_ContentPlaceHolder1_TabContainer1_TabPanel1_txtAadhraCardno');

    return {
      ready: true,
      isTargetUrl,
      url: window.location.href,
      formPresent: Boolean(form),
      step1: {
        course: courseSelect ? (courseSelect.options[courseSelect.selectedIndex]?.text || '') : null,
        branch: branchSelect ? (branchSelect.options[branchSelect.selectedIndex]?.text || '') : null,
        branchOptionsCount: branchSelect ? branchSelect.options.length : 0,
        admissionNo: admNoInput ? admNoInput.value : '',
        hallTicketNumber: htNoInput ? htNoInput.value : '',
      },
      step2: {
        fullName: nameInput ? nameInput.value : '',
        hasAadhaar: Boolean(aadhaarInput && aadhaarInput.value.trim().length > 0),
      },
    };
  }

  // ==========================================
  // SESSION STORAGE RESUMPTION (POSTBACK RECOVERY)
  // ==========================================

  function checkPendingPostbackResumption() {
    try {
      const raw = sessionStorage.getItem(SESSION_STAGE_KEY);
      if (!raw) return;

      const stageData = JSON.parse(raw);
      // Discard stages older than 3 minutes
      if (Date.now() - stageData.timestamp > 180000) {
        sessionStorage.removeItem(SESSION_STAGE_KEY);
        return;
      }

      console.info('[KUCET Admission Bridge] Detected pending postback stage:', stageData.stage);

      // Re-run population after DOM is ready
      setTimeout(() => {
        if (stageData.action === 'PORTAL_POPULATE_ADMISSION_INFO') {
          populateAdmissionInfo(stageData.payload);
        }
      }, 500);
    } catch (_) {}
  }

  // Check on load
  checkPendingPostbackResumption();

  // ==========================================
  // IMMEDIATE MESSAGE LISTENER
  // ==========================================

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const action = request.action || '';

    // 1. Readiness Handshake
    if (action === 'PORTAL_CHECK_READY' || action === 'CHECK_PAGE_STATUS') {
      sendResponse(getPageState());
      return false;
    }

    // 2. Query Page State
    if (action === 'PORTAL_GET_PAGE_STATE') {
      sendResponse({ success: true, state: getPageState() });
      return false;
    }

    // 3. Populate Admission Info (Step 1)
    if (action === 'PORTAL_POPULATE_ADMISSION_INFO' || action === 'FILL_PORTAL_FORM') {
      const result = populateAdmissionInfo(request);
      sendResponse(result);
      return false;
    }

    // 4. Populate Primary Details (Step 2)
    if (action === 'PORTAL_POPULATE_PRIMARY_DETAILS' || action === 'FILL_PRIMARY_DETAILS') {
      const result = populatePrimaryDetails(request);
      sendResponse(result);
      return false;
    }

    // 5. Direct Media Attachment
    if (action === 'PORTAL_ATTACH_STUDENT_MEDIA') {
      const { type, base64, filename } = request;
      const chkId = type === 'photo'
        ? 'ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_ChkStudentPhoto'
        : 'ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_ChkSignature';
      const fuId = type === 'photo'
        ? 'ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_fuStudentPhoto'
        : 'ctl00_ContentPlaceHolder1_TabContainer1_tbpnluser_fusign';

      enableMediaInput(chkId, fuId);
      const fu = findControlById(fuId);
      const res = attachFileFromBase64(fu, base64, filename);
      sendResponse(res);
      return false;
    }

    return false;
  });
})();
