import PizZip from 'pizzip';
import { getInstitutionalLogoBuffer } from '@/lib/institutional-logo';

function escapeXml(unsafe) {
  if (unsafe === undefined || unsafe === null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates an official, editable Word document (.docx) replicating the
 * KU College of Engineering & Technology Admission Form with 100% full-page alignment,
 * flush margins, enlarged crisp typography, embedded college logo, and structured tables.
 *
 * Invariant:
 * - Fits strictly on ONE single A4 page.
 * - Table width (10800 dxa) spans flush edge-to-edge across printable page area.
 * - Unified 7-column table grid ensuring 100% valid OpenXML with no Word repair warnings.
 *
 * @param {Object} data Pre-filled or blank student data fields
 * @returns {Buffer} Node.js buffer representing the valid .docx file
 */
export function generateAdmissionFormDocx(data = {}) {
  const zip = new PizZip();

  // Load official college logo
  const logoBuf = getInstitutionalLogoBuffer();

  // 1. [Content_Types].xml
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`);

  // 2. _rels/.rels
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  // 3. word/_rels/document.xml.rels
  const relsContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  ${logoBuf ? '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>' : ''}
</Relationships>`;
  zip.file('word/_rels/document.xml.rels', relsContent);

  if (logoBuf) {
    zip.file('word/media/image1.png', logoBuf);
  }

  // 4. word/styles.xml
  zip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:sz w:val="20"/>
        <w:szCs w:val="20"/>
        <w:color w:val="000000"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:line="210" w:lineRule="auto" w:before="0" w:after="0"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
</w:styles>`);

  // Borders definition for cells
  const cellBorders = `
    <w:tcBorders>
      <w:top w:val="single" w:sz="6" w:space="0" w:color="000000"/>
      <w:left w:val="single" w:sz="6" w:space="0" w:color="000000"/>
      <w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/>
      <w:right w:val="single" w:sz="6" w:space="0" w:color="000000"/>
    </w:tcBorders>`;

  const cellMar = `
    <w:tcMar>
      <w:top w:w="30" w:type="dxa"/>
      <w:bottom w:w="30" w:type="dxa"/>
      <w:left w:w="80" w:type="dxa"/>
      <w:right w:w="80" w:type="dxa"/>
    </w:tcMar>`;

  /**
   * Helper to make a standard form row in the unified 7-column table:
   * Col 1 (No.): width = 500 dxa (span 1)
   * Col 2..5 (Label): width = 5300 dxa (span 4: 500+1600+1700+1500)
   * Col 6..7 (Value): width = 5000 dxa (span 2: 1500+3500)
   * Total width = 10800 dxa. Total spans = 7.
   */
  function makeRow(no, label, val = '', boldLabel = false, height = 280) {
    const valText = escapeXml(val);
    const labelLines = label.split('\\n');
    const labelParagraphs = labelLines.map(line => 
      `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr>${boldLabel ? '<w:b/>' : ''}<w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>${escapeXml(line)}</w:t></w:r></w:p>`
    ).join('');

    return `
    <w:tr>
      <w:trPr><w:trHeight w:val="${height}" w:hRule="atLeast"/><w:cantSplit/></w:trPr>
      <w:tc>
        <w:tcPr><w:tcW w:w="500" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>${no ? no + '.' : ''}</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="5300" w:type="dxa"/><w:gridSpan w:val="4"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr>
        ${labelParagraphs}
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="5000" w:type="dxa"/><w:gridSpan w:val="2"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>${valText}</w:t></w:r></w:p>
      </w:tc>
    </w:tr>`;
  }

  // Parse identification marks
  let idMark1 = data.identification_mark_1 || '';
  let idMark2 = data.identification_mark_2 || '';
  if (!idMark1 && !idMark2 && data.identification_marks) {
    const raw = String(data.identification_marks).trim();
    const parts = raw.split(/\r?\n|;|\b2\)\s*/);
    idMark1 = (parts[0] || '').replace(/^1\)\s*/, '').trim();
    idMark2 = (parts[1] || '').trim();
  }

  // Address lines
  const formatAddressLines = (addrStr) => {
    if (addrStr && typeof addrStr === 'string' && addrStr.trim()) {
      const parts = addrStr.split(/[\r\n]+|, /).map(s => s.trim()).filter(Boolean);
      return [
        parts.slice(0, 2).join(', '),
        parts.slice(2, 4).join(', '),
        parts.slice(4, 6).join(', '),
        parts.slice(6).join(', ')
      ].filter(Boolean);
    }
    return [];
  };

  const presentLines = data.present_address_lines || formatAddressLines(data.present_address || data.present_address_line1);
  const permLines = data.permanent_address_lines || formatAddressLines(data.permanent_address || data.permanent_address_line1);

  // Logo drawing snippet
  const logoDrawing = logoBuf ? `
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="20"/></w:pPr>
      <w:r>
        <w:drawing>
          <wp:inline distT="0" distB="0" distL="0" distR="0">
            <wp:extent cx="685800" cy="685800"/>
            <wp:docPr id="1" name="College Logo"/>
            <wp:cNvGraphicFramePr>
              <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
            </wp:cNvGraphicFramePr>
            <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
              <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                  <pic:nvPicPr>
                    <pic:cNvPr id="0" name="ku-college-logo.png"/>
                    <pic:cNvPicPr/>
                  </pic:nvPicPr>
                  <pic:blipFill>
                    <a:blip r:embed="rIdLogo"/>
                    <a:stretch><a:fillRect/></a:stretch>
                  </pic:blipFill>
                  <pic:spPr>
                    <a:xfrm>
                      <a:off x="0" y="0"/>
                      <a:ext cx="685800" cy="685800"/>
                    </a:xfrm>
                    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                  </pic:spPr>
                </pic:pic>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    </w:p>` : '';

  // 5. word/document.xml
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <!-- Header Table: 3 columns (Logo/No: 1400 dxa, Center Titles: 7600 dxa, Photo Box: 1800 dxa = 10800 dxa) -->
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="10800" w:type="dxa"/>
        <w:jc w:val="center"/>
        <w:tblLayout w:type="fixed"/>
        <w:tblBorders>
          <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/>
          <w:insideH w:val="none"/><w:insideV w:val="none"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tblGrid>
        <w:gridCol w:w="1400"/>
        <w:gridCol w:w="7600"/>
        <w:gridCol w:w="1800"/>
      </w:tblGrid>
      <w:tr>
        <w:trPr><w:cantSplit/></w:trPr>
        <!-- Left: Logo & No. -->
        <w:tc>
          <w:tcPr><w:tcW w:w="1400" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>
          ${logoDrawing}
          <w:p>
            <w:pPr><w:spacing w:before="40" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr><w:t>No.</w:t></w:r>
            <w:r><w:rPr><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr><w:t> ${escapeXml(data.admission_no || '')}</w:t></w:r>
          </w:p>
        </w:tc>

        <!-- Center: Institutional Titles -->
        <w:tc>
          <w:tcPr><w:tcW w:w="7600" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="20" w:line="210" w:lineRule="auto"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="27"/><w:szCs w:val="27"/></w:rPr><w:t>KU COLLEGE OF ENGINEERING &amp; TECHNOLOGY</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="30" w:line="210" w:lineRule="auto"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>KAKATIYA UNIVERSITY CAMPUS, WARANGAL - 506 009 (TG)</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="20" w:line="210" w:lineRule="auto"/></w:pPr>
            <w:r><w:rPr><w:b/><w:u w:val="single"/><w:sz w:val="23"/><w:szCs w:val="23"/></w:rPr><w:t>Admission Form</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="20" w:line="210" w:lineRule="auto"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>${data.academic_year ? `Academic Year - ${escapeXml(data.academic_year)}` : 'Academic Year - 202    - 202   '}</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="30" w:line="210" w:lineRule="auto"/></w:pPr>
            <w:r><w:rPr><w:b/><w:u w:val="single"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr><w:t>EXAM BRANCH</w:t></w:r>
          </w:p>
        </w:tc>

        <!-- Right: Photo Box with Signature slot -->
        <w:tc>
          <w:tcPr><w:tcW w:w="1800" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>
          <w:tbl>
            <w:tblPr>
              <w:tblW w:w="1750" w:type="dxa"/>
              <w:jc w:val="center"/>
              <w:tblLayout w:type="fixed"/>
              <w:tblBorders>
                <w:top w:val="single" w:sz="8" w:space="0" w:color="000000"/>
                <w:left w:val="single" w:sz="8" w:space="0" w:color="000000"/>
                <w:bottom w:val="single" w:sz="8" w:space="0" w:color="000000"/>
                <w:right w:val="single" w:sz="8" w:space="0" w:color="000000"/>
              </w:tblBorders>
            </w:tblPr>
            <w:tr>
              <w:trPr><w:trHeight w:val="1400" w:hRule="exact"/><w:cantSplit/></w:trPr>
              <w:tc>
                <w:tcPr>
                  <w:tcW w:w="1750" w:type="dxa"/>
                  <w:tcBorders><w:bottom w:val="single" w:sz="8" w:color="000000"/></w:tcBorders>
                  <w:vAlign w:val="center"/>
                </w:tcPr>
                <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:t></w:t></w:r></w:p>
              </w:tc>
            </w:tr>
            <w:tr>
              <w:trPr><w:trHeight w:val="360" w:hRule="exact"/><w:cantSplit/></w:trPr>
              <w:tc>
                <w:tcPr><w:tcW w:w="1750" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>
                <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:t></w:t></w:r></w:p>
              </w:tc>
            </w:tr>
          </w:tbl>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:before="20" w:after="0" w:line="180" w:lineRule="auto"/></w:pPr>
            <w:r><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>Signature of the Student</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>

    <!-- Small spacing between header and main table -->
    <w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr></w:p>

    <!-- Unified Master Table (10800 dxa wide, 7 grid columns) -->
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="10800" w:type="dxa"/>
        <w:jc w:val="center"/>
        <w:tblLayout w:type="fixed"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="6" w:space="0" w:color="000000"/>
          <w:left w:val="single" w:sz="6" w:space="0" w:color="000000"/>
          <w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/>
          <w:right w:val="single" w:sz="6" w:space="0" w:color="000000"/>
          <w:insideH w:val="single" w:sz="6" w:space="0" w:color="000000"/>
          <w:insideV w:val="single" w:sz="6" w:space="0" w:color="000000"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tblGrid>
        <w:gridCol w:w="500"/>
        <w:gridCol w:w="500"/>
        <w:gridCol w:w="1600"/>
        <w:gridCol w:w="1700"/>
        <w:gridCol w:w="1500"/>
        <w:gridCol w:w="1500"/>
        <w:gridCol w:w="3500"/>
      </w:tblGrid>

      ${makeRow(1, 'For Admission into I / II - Year B. Tech /\\nM. Tech Branch', data.branch || '', false, 380)}
      ${makeRow(2, 'Qualifying Exam', data.qualifying_exam || '')}
      ${makeRow(3, 'Name of the Student (as per SSC Certificate)', data.name || '')}
      ${makeRow(4, "Father's Name (as per SSC Certificate)", data.father_name || '')}
      ${makeRow(5, "Mother's Name (as per SSC Certificate)", data.mother_name || '')}
      ${makeRow(6, "Guardian's Name (If Parents are not alive)", data.guardian_name || '')}
      ${makeRow(7, 'Date of Birth (as per SSC Certificate)', data.date_of_birth || '')}
      ${makeRow(8, 'Sex (Male / Female)', data.gender || '')}
      ${makeRow(9, 'Nationality', data.nationality || (data.name ? 'Indian' : ''))}
      ${makeRow(10, 'Religion', data.religion || '')}
      ${makeRow(11, 'Category : OC / BC-A / BC-B / BC-C /\\nBC-D / BC-E / SC / ST / EWS', data.category || '', false, 380)}
      ${makeRow(12, 'Sub Caste', data.sub_caste || '', true)}
      ${makeRow(13, 'Mother Tongue', data.mother_tongue || '')}
      ${makeRow(14, 'Place of Birth', data.place_of_birth || '')}
      ${makeRow(15, 'Student Blood Group', data.blood_group || '')}
      ${makeRow(16, "Father's Occupation", data.father_occupation || '')}
      ${makeRow(17, 'Annual Income', data.annual_income || '')}
      ${makeRow(18, 'Student Aadhar No.', data.aadhaar_no || '')}
      ${makeRow(19, 'Student Mobile Number', data.student_mobile || data.mobile || '')}
      ${makeRow(20, 'Father / Guardian Mobile Number', data.guardian_mobile || '')}
      ${makeRow(21, 'Mail ID of the Student', data.email || '')}
      
      <!-- 22 Identification Marks -->
      <w:tr>
        <w:trPr><w:trHeight w:val="420" w:hRule="atLeast"/><w:cantSplit/></w:trPr>
        <w:tc>
          <w:tcPr><w:tcW w:w="500" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>22.</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="5300" w:type="dxa"/><w:gridSpan w:val="4"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>Identification Marks</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="5000" w:type="dxa"/><w:gridSpan w:val="2"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:spacing w:before="0" w:after="10" w:line="200" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>1) ${escapeXml(idMark1)}</w:t></w:r></w:p>
          <w:p><w:pPr><w:spacing w:before="10" w:after="0" w:line="200" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>2) ${escapeXml(idMark2)}</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
      
      ${makeRow(23, 'Seat Allotted Category', data.seat_allotted_category || '')}
      ${makeRow(24, 'ECET / EAPCET / PGECET Rank Details', data.exam_rank ? String(data.exam_rank) : '')}
      ${makeRow(25, 'Area : Local / Non Local', data.area_status || '')}
      ${makeRow(26, 'Whether you come Under Fee-Reimbursement Category :\\nYes/ No', data.fee_reimbursement || '', false, 380)}
      
      <!-- 27 Furnish the Following Details -->
      <w:tr>
        <w:trPr><w:trHeight w:val="280" w:hRule="atLeast"/><w:cantSplit/></w:trPr>
        <w:tc>
          <w:tcPr><w:tcW w:w="500" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>27.</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="10300" w:type="dxa"/><w:gridSpan w:val="6"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr><w:t>Furnish the Following Details</w:t></w:r></w:p>
        </w:tc>
      </w:tr>

      <!-- 28 Fee Paid Sub-Table Header (Spans: 1, 2, 1, 1, 1, 1 = 7) -->
      <w:tr>
        <w:trPr><w:trHeight w:val="290" w:hRule="atLeast"/><w:cantSplit/></w:trPr>
        <w:tc>
          <w:tcPr><w:tcW w:w="500" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>28.</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="2100" w:type="dxa"/><w:gridSpan w:val="2"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>Fee Paid</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="1700" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>UPIT No.</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="1500" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>Date</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="1500" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>Amount (Rs/-)</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="3500" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>Name of the Bank, Branch &amp; IFSC Code</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
      <!-- Sub-rows -->
      <w:tr>
        <w:trPr><w:trHeight w:val="280" w:hRule="atLeast"/><w:cantSplit/></w:trPr>
        <w:tc><w:tcPr><w:tcW w:w="500" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:t></w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="2100" w:type="dxa"/><w:gridSpan w:val="2"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>Convener Fee</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1700" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>${escapeXml(data.convener_upit || '')}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1500" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>${escapeXml(data.convener_date || '')}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1500" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>${escapeXml(data.convener_amount || '')}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="3500" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>${escapeXml(data.convener_bank || '')}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:trPr><w:trHeight w:val="280" w:hRule="atLeast"/><w:cantSplit/></w:trPr>
        <w:tc><w:tcPr><w:tcW w:w="500" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:t></w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="2100" w:type="dxa"/><w:gridSpan w:val="2"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>Processing Fee</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1700" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>${escapeXml(data.processing_upit || '')}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1500" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>${escapeXml(data.processing_date || '')}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1500" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>${escapeXml(data.processing_amount || '')}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="3500" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>${escapeXml(data.processing_bank || '')}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:trPr><w:trHeight w:val="280" w:hRule="atLeast"/><w:cantSplit/></w:trPr>
        <w:tc><w:tcPr><w:tcW w:w="500" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:t></w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="2100" w:type="dxa"/><w:gridSpan w:val="2"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>Alumni Fee</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1700" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>${escapeXml(data.alumni_upit || '')}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1500" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>${escapeXml(data.alumni_date || '')}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1500" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>${escapeXml(data.alumni_amount || '')}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="3500" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>${escapeXml(data.alumni_bank || '')}</w:t></w:r></w:p></w:tc>
      </w:tr>

      <!-- Contact Details (Postal) Header (Spans all 7 columns = 10800 dxa) -->
      <w:tr>
        <w:trPr><w:trHeight w:val="290" w:hRule="atLeast"/><w:cantSplit/></w:trPr>
        <w:tc>
          <w:tcPr><w:tcW w:w="10800" w:type="dxa"/><w:gridSpan w:val="7"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr><w:t>Contact Details (Postal)</w:t></w:r></w:p>
        </w:tc>
      </w:tr>

      <!-- Present & Permanent Address sub-headers (Cols: 1, 1, 3, 2 = 7) -->
      <w:tr>
        <w:trPr><w:trHeight w:val="280" w:hRule="atLeast"/><w:cantSplit/></w:trPr>
        <w:tc><w:tcPr><w:tcW w:w="500" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:t></w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="500" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:t></w:t></w:r></w:p></w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4800" w:type="dxa"/><w:gridSpan w:val="3"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>Present Address</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="5000" w:type="dxa"/><w:gridSpan w:val="2"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>Permanent Address</w:t></w:r></w:p>
        </w:tc>
      </w:tr>

      <!-- 4 address lines -->
      <w:tr>
        <w:trPr><w:trHeight w:val="280" w:hRule="atLeast"/><w:cantSplit/></w:trPr>
        <w:tc><w:tcPr><w:tcW w:w="500" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:t></w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="500" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:t></w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="4800" w:type="dxa"/><w:gridSpan w:val="3"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>${escapeXml(presentLines[0] || '')}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="5000" w:type="dxa"/><w:gridSpan w:val="2"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>${escapeXml(permLines[0] || '')}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:trPr><w:trHeight w:val="280" w:hRule="atLeast"/><w:cantSplit/></w:trPr>
        <w:tc><w:tcPr><w:tcW w:w="500" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:t></w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="500" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:t></w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="4800" w:type="dxa"/><w:gridSpan w:val="3"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>${escapeXml(presentLines[1] || '')}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="5000" w:type="dxa"/><w:gridSpan w:val="2"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>${escapeXml(permLines[1] || '')}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:trPr><w:trHeight w:val="280" w:hRule="atLeast"/><w:cantSplit/></w:trPr>
        <w:tc><w:tcPr><w:tcW w:w="500" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:t></w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="500" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:t></w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="4800" w:type="dxa"/><w:gridSpan w:val="3"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>${escapeXml(presentLines[2] || '')}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="5000" w:type="dxa"/><w:gridSpan w:val="2"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>${escapeXml(permLines[2] || '')}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:trPr><w:trHeight w:val="280" w:hRule="atLeast"/><w:cantSplit/></w:trPr>
        <w:tc><w:tcPr><w:tcW w:w="500" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:t></w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="500" w:type="dxa"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:t></w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="4800" w:type="dxa"/><w:gridSpan w:val="3"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>${escapeXml(presentLines[3] || '')}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="5000" w:type="dxa"/><w:gridSpan w:val="2"/>${cellBorders}${cellMar}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>${escapeXml(permLines[3] || '')}</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>

    <!-- Footer Table (Spans exactly 10800 dxa: Left 5400 dxa, Right 5400 dxa) -->
    <w:p><w:pPr><w:spacing w:before="60" w:after="0"/></w:pPr></w:p>
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="10800" w:type="dxa"/>
        <w:jc w:val="center"/>
        <w:tblLayout w:type="fixed"/>
        <w:tblBorders>
          <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/>
          <w:insideH w:val="none"/><w:insideV w:val="none"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tblGrid>
        <w:gridCol w:w="5400"/>
        <w:gridCol w:w="5400"/>
      </w:tblGrid>
      <w:tr>
        <w:trPr><w:cantSplit/></w:trPr>
        <w:tc>
          <w:tcPr><w:tcW w:w="5400" w:type="dxa"/></w:tcPr>
          <w:p><w:r><w:rPr><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr><w:t>Date${data.date ? `: ${escapeXml(data.date)}` : ''}</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="5400" w:type="dxa"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr><w:t>Signature of the Student</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
    </w:tbl>

    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="360" w:right="553" w:bottom="360" w:left="553" w:header="0" w:footer="0" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  zip.file('word/document.xml', docXml);
  return zip.generate({ type: 'nodebuffer' });
}
