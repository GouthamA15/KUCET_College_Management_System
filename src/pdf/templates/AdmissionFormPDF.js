/* eslint-disable jsx-a11y/alt-text */
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 18,
    fontSize: 9.5,
    fontFamily: 'Times-Roman',
    color: '#000000',
    backgroundColor: '#ffffff',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  logoCol: {
    width: 68,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  logo: {
    width: 52,
    height: 52,
    objectFit: 'contain',
  },
  formNoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
    width: '100%',
  },
  formNoLabel: {
    fontFamily: 'Times-Bold',
    fontSize: 10,
  },
  formNoValue: {
    fontFamily: 'Times-Roman',
    fontSize: 10,
    marginLeft: 3,
  },
  centerCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingTop: 0,
  },
  collegeTitle: {
    fontSize: 13.5,
    fontFamily: 'Times-Bold',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  collegeSubtitle: {
    fontSize: 9.2,
    fontFamily: 'Times-Bold',
    textAlign: 'center',
    marginTop: 1.5,
  },
  formTitle: {
    fontSize: 11.8,
    fontFamily: 'Times-Bold',
    textAlign: 'center',
    textDecoration: 'underline',
    marginTop: 3,
  },
  academicYear: {
    fontSize: 10,
    fontFamily: 'Times-Bold',
    textAlign: 'center',
    marginTop: 2,
  },
  branchTitle: {
    fontSize: 10.8,
    fontFamily: 'Times-Bold',
    textAlign: 'center',
    textDecoration: 'underline',
    marginTop: 2,
  },
  photoBoxCol: {
    width: 90,
    alignItems: 'center',
  },
  photoBox: {
    width: 86,
    height: 98,
    borderWidth: 0.9,
    borderColor: '#000000',
    borderStyle: 'solid',
  },
  photoInnerSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  photoSignatureDivider: {
    borderTopWidth: 0.9,
    borderTopColor: '#000000',
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBoxCaption: {
    fontSize: 7.6,
    fontFamily: 'Times-Roman',
    textAlign: 'center',
    marginTop: 1.5,
  },

  // Main Table styles
  table: {
    borderWidth: 0.9,
    borderColor: '#000000',
    borderStyle: 'solid',
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.9,
    borderBottomColor: '#000000',
    minHeight: 17,
    alignItems: 'stretch',
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  colNo: {
    width: 25,
    borderRightWidth: 0.9,
    borderRightColor: '#000000',
    paddingVertical: 1,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colNoText: {
    fontSize: 9.5,
    fontFamily: 'Times-Roman',
    textAlign: 'center',
  },
  colLabel: {
    width: 255,
    borderRightWidth: 0.9,
    borderRightColor: '#000000',
    paddingVertical: 1,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  colLabelText: {
    fontSize: 9.5,
    fontFamily: 'Times-Roman',
    lineHeight: 1.1,
  },
  colLabelBold: {
    fontSize: 9.5,
    fontFamily: 'Times-Bold',
    lineHeight: 1.1,
  },
  colValue: {
    flex: 1,
    paddingVertical: 1,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  colValueText: {
    fontSize: 9.5,
    fontFamily: 'Times-Roman',
    lineHeight: 1.1,
  },

  // Split row for identification marks
  idMarksContainer: {
    flex: 1,
  },
  idMarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 16,
    paddingHorizontal: 4,
  },
  idMarkRowTop: {
    borderBottomWidth: 0.9,
    borderBottomColor: '#000000',
  },

  // Fee Details Sub-table
  feeHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.9,
    borderBottomColor: '#000000',
    backgroundColor: '#ffffff',
    minHeight: 17,
    alignItems: 'stretch',
  },
  feeColName: {
    width: 108,
    borderRightWidth: 0.9,
    borderRightColor: '#000000',
    paddingVertical: 1,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  feeColUpit: {
    width: 88,
    borderRightWidth: 0.9,
    borderRightColor: '#000000',
    paddingVertical: 1,
    paddingHorizontal: 3,
    justifyContent: 'center',
  },
  feeColDate: {
    width: 66,
    borderRightWidth: 0.9,
    borderRightColor: '#000000',
    paddingVertical: 1,
    paddingHorizontal: 3,
    justifyContent: 'center',
  },
  feeColAmount: {
    width: 78,
    borderRightWidth: 0.9,
    borderRightColor: '#000000',
    paddingVertical: 1,
    paddingHorizontal: 3,
    justifyContent: 'center',
  },
  feeColBank: {
    flex: 1,
    paddingVertical: 1,
    paddingHorizontal: 3,
    justifyContent: 'center',
  },
  feeHeaderText: {
    fontSize: 8.8,
    fontFamily: 'Times-Bold',
    textAlign: 'center',
  },
  feeCellText: {
    fontSize: 8.8,
    fontFamily: 'Times-Roman',
  },

  // Address section
  addressHeaderRow: {
    borderBottomWidth: 0.9,
    borderBottomColor: '#000000',
    paddingVertical: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 17.5,
  },
  addressHeaderText: {
    fontSize: 10,
    fontFamily: 'Times-Bold',
    textAlign: 'center',
  },
  addressSubHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.9,
    borderBottomColor: '#000000',
    minHeight: 16.5,
    alignItems: 'stretch',
  },
  addressColDummy1: {
    width: 25,
    borderRightWidth: 0.9,
    borderRightColor: '#000000',
  },
  addressColDummy2: {
    width: 28,
    borderRightWidth: 0.9,
    borderRightColor: '#000000',
  },
  addressColPresent: {
    flex: 1,
    borderRightWidth: 0.9,
    borderRightColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 1,
  },
  addressColPermanent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 1,
  },
  addressLineRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.9,
    borderBottomColor: '#000000',
    height: 16.5,
    alignItems: 'center',
  },
  addressLineText: {
    fontSize: 8.8,
    fontFamily: 'Times-Roman',
    paddingHorizontal: 4,
  },

  // Footer
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  footerText: {
    fontSize: 10,
    fontFamily: 'Times-Roman',
  },
});

export default function AdmissionFormPDF({ data = {}, logoUrl = null }) {
  // Parse identification marks if passed as a single string
  let idMark1 = data.identification_mark_1 || '';
  let idMark2 = data.identification_mark_2 || '';
  if (!idMark1 && !idMark2 && data.identification_marks) {
    const raw = String(data.identification_marks).trim();
    const parts = raw.split(/\r?\n|;|\b2\)\s*/);
    idMark1 = (parts[0] || '').replace(/^1\)\s*/, '').trim();
    idMark2 = (parts[1] || '').trim();
  }

  // Address lines (present and permanent)
  const formatAddressLines = (addrStr, obj) => {
    if (addrStr && typeof addrStr === 'string' && addrStr.trim()) {
      const parts = addrStr.split(/[\r\n]+|, /).map(s => s.trim()).filter(Boolean);
      return [
        parts.slice(0, 2).join(', '),
        parts.slice(2, 4).join(', '),
        parts.slice(4, 6).join(', '),
        parts.slice(6).join(', ')
      ].filter(Boolean);
    }
    if (obj) {
      const line1 = [obj.house_no, obj.street].filter(Boolean).join(', ');
      const line2 = [obj.apartment, obj.city].filter(Boolean).join(', ');
      const line3 = [obj.state, obj.pincode].filter(Boolean).join(' - ');
      const line4 = obj.country || '';
      return [line1, line2, line3, line4].filter(Boolean);
    }
    return [];
  };

  const presentLines = data.present_address_lines || formatAddressLines(data.present_address, data.curr_address_obj);
  const permLines = data.permanent_address_lines || formatAddressLines(data.permanent_address, data.perm_address_obj);

  const academicYearText = data.academic_year 
    ? `Academic Year - ${data.academic_year}` 
    : 'Academic Year - 202    - 202   ';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Top Header */}
        <View style={styles.headerContainer}>
          <View style={styles.logoCol}>
            {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
            <View style={styles.formNoRow}>
              <Text style={styles.formNoLabel}>No.</Text>
              {data.admission_no ? (
                <Text style={styles.formNoValue}>{data.admission_no}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.centerCol}>
            <Text style={styles.collegeTitle}>KU COLLEGE OF ENGINEERING & TECHNOLOGY</Text>
            <Text style={styles.collegeSubtitle}>KAKATIYA UNIVERSITY CAMPUS, WARANGAL - 506 009 (TG)</Text>
            <Text style={styles.formTitle}>Admission Form</Text>
            <Text style={styles.academicYear}>{academicYearText}</Text>
            <Text style={styles.branchTitle}>EXAM BRANCH</Text>
          </View>

          <View style={styles.photoBoxCol}>
            <View style={styles.photoBox}>
              <View style={styles.photoInnerSlot}>
                {data.photo ? <Image src={data.photo} style={styles.photoImage} /> : null}
              </View>
              <View style={styles.photoSignatureDivider} />
            </View>
            <Text style={styles.photoBoxCaption}>Signature of the Student</Text>
          </View>
        </View>

        {/* Main Form Table */}
        <View style={styles.table}>
          {/* Row 1 */}
          <View style={[styles.row, { minHeight: 24 }]}>
            <View style={styles.colNo}><Text style={styles.colNoText}>1.</Text></View>
            <View style={styles.colLabel}>
              <Text style={styles.colLabelText}>For Admission into I / II - Year B. Tech /</Text>
              <Text style={styles.colLabelText}>M. Tech Branch</Text>
            </View>
            <View style={styles.colValue}>
              <Text style={styles.colValueText}>{data.branch || ''}</Text>
            </View>
          </View>

          {/* Row 2 */}
          <View style={styles.row}>
            <View style={styles.colNo}><Text style={styles.colNoText}>2.</Text></View>
            <View style={styles.colLabel}><Text style={styles.colLabelText}>Qualifying Exam</Text></View>
            <View style={styles.colValue}>
              <Text style={styles.colValueText}>{data.qualifying_exam || ''}</Text>
            </View>
          </View>

          {/* Row 3 */}
          <View style={styles.row}>
            <View style={styles.colNo}><Text style={styles.colNoText}>3.</Text></View>
            <View style={styles.colLabel}><Text style={styles.colLabelText}>Name of the Student (as per SSC Certificate)</Text></View>
            <View style={styles.colValue}>
              <Text style={styles.colValueText}>{data.name || ''}</Text>
            </View>
          </View>

          {/* Row 4 */}
          <View style={styles.row}>
            <View style={styles.colNo}><Text style={styles.colNoText}>4.</Text></View>
            <View style={styles.colLabel}><Text style={styles.colLabelText}>Father&apos;s Name (as per SSC Certificate)</Text></View>
            <View style={styles.colValue}>
              <Text style={styles.colValueText}>{data.father_name || ''}</Text>
            </View>
          </View>

          {/* Row 5 */}
          <View style={styles.row}>
            <View style={styles.colNo}><Text style={styles.colNoText}>5.</Text></View>
            <View style={styles.colLabel}><Text style={styles.colLabelText}>Mother&apos;s Name (as per SSC Certificate)</Text></View>
            <View style={styles.colValue}>
              <Text style={styles.colValueText}>{data.mother_name || ''}</Text>
            </View>
          </View>

          {/* Row 6 */}
          <View style={styles.row}>
            <View style={styles.colNo}><Text style={styles.colNoText}>6.</Text></View>
            <View style={styles.colLabel}><Text style={styles.colLabelText}>Guardian&apos;s Name (If Parents are not alive)</Text></View>
            <View style={styles.colValue}>
              <Text style={styles.colValueText}>{data.guardian_name || ''}</Text>
            </View>
          </View>

          {/* Row 7 */}
          <View style={styles.row}>
            <View style={styles.colNo}><Text style={styles.colNoText}>7.</Text></View>
            <View style={styles.colLabel}><Text style={styles.colLabelText}>Date of Birth (as per SSC Certificate)</Text></View>
            <View style={styles.colValue}>
              <Text style={styles.colValueText}>{data.date_of_birth || ''}</Text>
            </View>
          </View>

          {/* Row 8 */}
          <View style={styles.row}>
            <View style={styles.colNo}><Text style={styles.colNoText}>8.</Text></View>
            <View style={styles.colLabel}><Text style={styles.colLabelText}>Sex (Male / Female)</Text></View>
            <View style={styles.colValue}>
              <Text style={styles.colValueText}>{data.gender || ''}</Text>
            </View>
          </View>

          {/* Row 9 */}
          <View style={styles.row}>
            <View style={styles.colNo}><Text style={styles.colNoText}>9.</Text></View>
            <View style={styles.colLabel}><Text style={styles.colLabelText}>Nationality</Text></View>
            <View style={styles.colValue}>
              <Text style={styles.colValueText}>{data.nationality || (data.name ? 'Indian' : '')}</Text>
            </View>
          </View>

          {/* Row 10 */}
          <View style={styles.row}>
            <View style={styles.colNo}><Text style={styles.colNoText}>10.</Text></View>
            <View style={styles.colLabel}><Text style={styles.colLabelText}>Religion</Text></View>
            <View style={styles.colValue}>
              <Text style={styles.colValueText}>{data.religion || ''}</Text>
            </View>
          </View>

          {/* Row 11 */}
          <View style={[styles.row, { minHeight: 24 }]}>
            <View style={styles.colNo}><Text style={styles.colNoText}>11.</Text></View>
            <View style={styles.colLabel}>
              <Text style={styles.colLabelText}>Category : OC / BC-A / BC-B / BC-C /</Text>
              <Text style={styles.colLabelText}>BC-D / BC-E / SC / ST / EWS</Text>
            </View>
            <View style={styles.colValue}>
              <Text style={styles.colValueText}>{data.category || ''}</Text>
            </View>
          </View>

          {/* Row 12 */}
          <View style={styles.row}>
            <View style={styles.colNo}><Text style={styles.colNoText}>12.</Text></View>
            <View style={styles.colLabel}><Text style={styles.colLabelBold}>Sub Caste</Text></View>
            <View style={styles.colValue}>
              <Text style={styles.colValueText}>{data.sub_caste || ''}</Text>
            </View>
          </View>

          {/* Row 13 */}
          <View style={styles.row}>
            <View style={styles.colNo}><Text style={styles.colNoText}>13.</Text></View>
            <View style={styles.colLabel}><Text style={styles.colLabelText}>Mother Tongue</Text></View>
            <View style={styles.colValue}>
              <Text style={styles.colValueText}>{data.mother_tongue || ''}</Text>
            </View>
          </View>

          {/* Row 14 */}
          <View style={styles.row}>
            <View style={styles.colNo}><Text style={styles.colNoText}>14.</Text></View>
            <View style={styles.colLabel}><Text style={styles.colLabelText}>Place of Birth</Text></View>
            <View style={styles.colValue}>
              <Text style={styles.colValueText}>{data.place_of_birth || ''}</Text>
            </View>
          </View>

          {/* Row 15 */}
          <View style={styles.row}>
            <View style={styles.colNo}><Text style={styles.colNoText}>15.</Text></View>
            <View style={styles.colLabel}><Text style={styles.colLabelText}>Student Blood Group</Text></View>
            <View style={styles.colValue}>
              <Text style={styles.colValueText}>{data.blood_group || ''}</Text>
            </View>
          </View>

          {/* Row 16 */}
          <View style={styles.row}>
            <View style={styles.colNo}><Text style={styles.colNoText}>16.</Text></View>
            <View style={styles.colLabel}><Text style={styles.colLabelText}>Father&apos;s Occupation</Text></View>
            <View style={styles.colValue}>
              <Text style={styles.colValueText}>{data.father_occupation || ''}</Text>
            </View>
          </View>

          {/* Row 17 */}
          <View style={styles.row}>
            <View style={styles.colNo}><Text style={styles.colNoText}>17.</Text></View>
            <View style={styles.colLabel}><Text style={styles.colLabelText}>Annual Income</Text></View>
            <View style={styles.colValue}>
              <Text style={styles.colValueText}>{data.annual_income || ''}</Text>
            </View>
          </View>

          {/* Row 18 */}
          <View style={styles.row}>
            <View style={styles.colNo}><Text style={styles.colNoText}>18.</Text></View>
            <View style={styles.colLabel}><Text style={styles.colLabelText}>Student Aadhar No.</Text></View>
            <View style={styles.colValue}>
              <Text style={styles.colValueText}>{data.aadhaar_no || ''}</Text>
            </View>
          </View>

          {/* Row 19 */}
          <View style={styles.row}>
            <View style={styles.colNo}><Text style={styles.colNoText}>19.</Text></View>
            <View style={styles.colLabel}><Text style={styles.colLabelText}>Student Mobile Number</Text></View>
            <View style={styles.colValue}>
              <Text style={styles.colValueText}>{data.student_mobile || data.mobile || ''}</Text>
            </View>
          </View>

          {/* Row 20 */}
          <View style={styles.row}>
            <View style={styles.colNo}><Text style={styles.colNoText}>20.</Text></View>
            <View style={styles.colLabel}><Text style={styles.colLabelText}>Father / Guardian Mobile Number</Text></View>
            <View style={styles.colValue}>
              <Text style={styles.colValueText}>{data.guardian_mobile || ''}</Text>
            </View>
          </View>

          {/* Row 21 */}
          <View style={styles.row}>
            <View style={styles.colNo}><Text style={styles.colNoText}>21.</Text></View>
            <View style={styles.colLabel}><Text style={styles.colLabelText}>Mail ID of the Student</Text></View>
            <View style={styles.colValue}>
              <Text style={styles.colValueText}>{data.email || ''}</Text>
            </View>
          </View>

          {/* Row 22 */}
          <View style={[styles.row, { minHeight: 32 }]}>
            <View style={styles.colNo}><Text style={styles.colNoText}>22.</Text></View>
            <View style={styles.colLabel}><Text style={styles.colLabelText}>Identification Marks</Text></View>
            <View style={[styles.colValue, { paddingVertical: 0, paddingHorizontal: 0 }]}>
              <View style={styles.idMarksContainer}>
                <View style={[styles.idMarkRow, styles.idMarkRowTop]}>
                  <Text style={styles.colValueText}>1) {idMark1}</Text>
                </View>
                <View style={styles.idMarkRow}>
                  <Text style={styles.colValueText}>2) {idMark2}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Row 23 */}
          <View style={styles.row}>
            <View style={styles.colNo}><Text style={styles.colNoText}>23.</Text></View>
            <View style={styles.colLabel}><Text style={styles.colLabelText}>Seat Allotted Category</Text></View>
            <View style={styles.colValue}>
              <Text style={styles.colValueText}>{data.seat_allotted_category || ''}</Text>
            </View>
          </View>

          {/* Row 24 */}
          <View style={styles.row}>
            <View style={styles.colNo}><Text style={styles.colNoText}>24.</Text></View>
            <View style={styles.colLabel}><Text style={styles.colLabelText}>ECET / EAPCET / PGECET Rank Details</Text></View>
            <View style={styles.colValue}>
              <Text style={styles.colValueText}>{data.exam_rank ? String(data.exam_rank) : ''}</Text>
            </View>
          </View>

          {/* Row 25 */}
          <View style={styles.row}>
            <View style={styles.colNo}><Text style={styles.colNoText}>25.</Text></View>
            <View style={styles.colLabel}><Text style={styles.colLabelText}>Area : Local / Non Local</Text></View>
            <View style={styles.colValue}>
              <Text style={styles.colValueText}>{data.area_status || ''}</Text>
            </View>
          </View>

          {/* Row 26 */}
          <View style={[styles.row, { minHeight: 24 }]}>
            <View style={styles.colNo}><Text style={styles.colNoText}>26.</Text></View>
            <View style={styles.colLabel}>
              <Text style={styles.colLabelText}>Whether you come Under Fee-Reimbursement Category :</Text>
              <Text style={styles.colLabelText}>Yes/ No</Text>
            </View>
            <View style={styles.colValue}>
              <Text style={styles.colValueText}>{data.fee_reimbursement || ''}</Text>
            </View>
          </View>

          {/* Row 27 */}
          <View style={styles.row}>
            <View style={styles.colNo}><Text style={styles.colNoText}>27.</Text></View>
            <View style={[styles.colLabel, { borderRightWidth: 0, width: '100%', flex: 1 }]}>
              <Text style={styles.colLabelBold}>Furnish the Following Details</Text>
            </View>
          </View>

          {/* Row 28 Fee Sub-table */}
          <View style={styles.row}>
            <View style={styles.colNo}><Text style={styles.colNoText}>28.</Text></View>
            <View style={{ flex: 1 }}>
              {/* Fee Header */}
              <View style={styles.feeHeaderRow}>
                <View style={styles.feeColName}><Text style={styles.feeHeaderText}>Fee Paid</Text></View>
                <View style={styles.feeColUpit}><Text style={styles.feeHeaderText}>UPIT No.</Text></View>
                <View style={styles.feeColDate}><Text style={styles.feeHeaderText}>Date</Text></View>
                <View style={styles.feeColAmount}><Text style={styles.feeHeaderText}>Amount (Rs/-)</Text></View>
                <View style={styles.feeColBank}><Text style={styles.feeHeaderText}>Name of the Bank, Branch &amp; IFSC Code</Text></View>
              </View>

              {/* Sub-row 1 */}
              <View style={styles.feeHeaderRow}>
                <View style={styles.feeColName}><Text style={styles.feeCellText}>Convener Fee</Text></View>
                <View style={styles.feeColUpit}><Text style={styles.feeCellText}>{data.convener_upit || ''}</Text></View>
                <View style={styles.feeColDate}><Text style={styles.feeCellText}>{data.convener_date || ''}</Text></View>
                <View style={styles.feeColAmount}><Text style={styles.feeCellText}>{data.convener_amount || ''}</Text></View>
                <View style={styles.feeColBank}><Text style={styles.feeCellText}>{data.convener_bank || ''}</Text></View>
              </View>

              {/* Sub-row 2 */}
              <View style={styles.feeHeaderRow}>
                <View style={styles.feeColName}><Text style={styles.feeCellText}>Processing Fee</Text></View>
                <View style={styles.feeColUpit}><Text style={styles.feeCellText}>{data.processing_upit || ''}</Text></View>
                <View style={styles.feeColDate}><Text style={styles.feeCellText}>{data.processing_date || ''}</Text></View>
                <View style={styles.feeColAmount}><Text style={styles.feeCellText}>{data.processing_amount || ''}</Text></View>
                <View style={styles.feeColBank}><Text style={styles.feeCellText}>{data.processing_bank || ''}</Text></View>
              </View>

              {/* Sub-row 3 (no bottom border) */}
              <View style={[styles.feeHeaderRow, { borderBottomWidth: 0 }]}>
                <View style={styles.feeColName}><Text style={styles.feeCellText}>Alumni Fee</Text></View>
                <View style={styles.feeColUpit}><Text style={styles.feeCellText}>{data.alumni_upit || ''}</Text></View>
                <View style={styles.feeColDate}><Text style={styles.feeCellText}>{data.alumni_date || ''}</Text></View>
                <View style={styles.feeColAmount}><Text style={styles.feeCellText}>{data.alumni_amount || ''}</Text></View>
                <View style={styles.feeColBank}><Text style={styles.feeCellText}>{data.alumni_bank || ''}</Text></View>
              </View>
            </View>
          </View>

          {/* Postal Address Section */}
          <View style={styles.addressHeaderRow}>
            <Text style={styles.addressHeaderText}>Contact Details (Postal)</Text>
          </View>

          <View style={styles.addressSubHeaderRow}>
            <View style={styles.addressColDummy1} />
            <View style={styles.addressColDummy2} />
            <View style={styles.addressColPresent}><Text style={styles.colLabelBold}>Present Address</Text></View>
            <View style={styles.addressColPermanent}><Text style={styles.colLabelBold}>Permanent Address</Text></View>
          </View>

          {/* 4 address lines */}
          <View style={styles.addressLineRow}>
            <View style={styles.addressColDummy1} />
            <View style={styles.addressColDummy2} />
            <View style={styles.addressColPresent}><Text style={styles.addressLineText}>{presentLines[0] || ''}</Text></View>
            <View style={styles.addressColPermanent}><Text style={styles.addressLineText}>{permLines[0] || ''}</Text></View>
          </View>
          <View style={styles.addressLineRow}>
            <View style={styles.addressColDummy1} />
            <View style={styles.addressColDummy2} />
            <View style={styles.addressColPresent}><Text style={styles.addressLineText}>{presentLines[1] || ''}</Text></View>
            <View style={styles.addressColPermanent}><Text style={styles.addressLineText}>{permLines[1] || ''}</Text></View>
          </View>
          <View style={styles.addressLineRow}>
            <View style={styles.addressColDummy1} />
            <View style={styles.addressColDummy2} />
            <View style={styles.addressColPresent}><Text style={styles.addressLineText}>{presentLines[2] || ''}</Text></View>
            <View style={styles.addressColPermanent}><Text style={styles.addressLineText}>{permLines[2] || ''}</Text></View>
          </View>
          <View style={[styles.addressLineRow, styles.lastRow]}>
            <View style={styles.addressColDummy1} />
            <View style={styles.addressColDummy2} />
            <View style={styles.addressColPresent}><Text style={styles.addressLineText}>{presentLines[3] || ''}</Text></View>
            <View style={styles.addressColPermanent}><Text style={styles.addressLineText}>{permLines[3] || ''}</Text></View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Date{data.date ? `: ${data.date}` : ''}</Text>
          <Text style={styles.footerText}>Signature of the Student</Text>
        </View>
      </Page>
    </Document>
  );
}
