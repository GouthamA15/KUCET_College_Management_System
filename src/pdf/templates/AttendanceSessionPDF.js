import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    paddingTop: 18,
    paddingBottom: 32,
    paddingHorizontal: 22,
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: '#0b3578',
    paddingBottom: 6,
    marginBottom: 6,
  },
  logo: {
    width: 44,
    height: 44,
    marginRight: 10,
    objectFit: 'contain',
  },
  headerText: {
    flex: 1,
  },
  collegeTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#0b3578',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  universitySubtitle: {
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#334155',
    marginTop: 1,
  },
  reportTitle: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: '#b45309',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 3,
    paddingVertical: 5,
    paddingHorizontal: 7,
    marginBottom: 6,
  },
  metaCol: {
    width: '25%',
    marginBottom: 3,
  },
  metaColWide: {
    width: '50%',
    marginBottom: 3,
  },
  metaLabel: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    marginTop: 0.5,
  },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderWidth: 0.75,
    borderColor: '#bfdbfe',
    borderRadius: 3,
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 6,
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    color: '#1e40af',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a8a',
    marginTop: 0.5,
  },
  table: {
    width: '100%',
    borderWidth: 0.75,
    borderColor: '#cbd5e1',
    borderRadius: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0b3578',
    borderBottomWidth: 0.75,
    borderBottomColor: '#0b3578',
    minHeight: 18,
    alignItems: 'center',
  },
  tableHeaderCell: {
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.8,
    textAlign: 'center',
    paddingVertical: 2.5,
    paddingHorizontal: 2,
    borderRightWidth: 0.5,
    borderRightColor: '#3b82f6',
  },
  tableHeaderCellLast: {
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.8,
    textAlign: 'center',
    paddingVertical: 2.5,
    paddingHorizontal: 2,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    minHeight: 14,
    alignItems: 'center',
  },
  tableRowEven: {
    backgroundColor: '#f8fafc',
  },
  colSNo: {
    width: 30,
  },
  colRoll: {
    width: 105,
  },
  colName: {
    width: 316.28,
  },
  colStatus: {
    width: 100,
    alignItems: 'center',
  },
  tdCell: {
    fontSize: 7,
    paddingVertical: 1.5,
    paddingHorizontal: 2,
    borderRightWidth: 0.5,
    borderRightColor: '#e2e8f0',
    textAlign: 'center',
  },
  tdCellLeft: {
    fontSize: 7,
    paddingVertical: 1.5,
    paddingHorizontal: 4,
    borderRightWidth: 0.5,
    borderRightColor: '#e2e8f0',
    textAlign: 'left',
  },
  tdCellLast: {
    fontSize: 7,
    paddingVertical: 1.5,
    paddingHorizontal: 2,
    textAlign: 'center',
  },
  cellMono: {
    fontSize: 7,
    fontFamily: 'Courier',
    fontWeight: 'bold',
    color: '#0f172a',
  },
  statusBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 2,
    fontSize: 6.8,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    borderWidth: 0.75,
  },
  statusPresent: {
    backgroundColor: '#f0fdf4',
    color: '#14532d',
    borderColor: '#166534',
  },
  statusAbsent: {
    backgroundColor: '#fef2f2',
    color: '#991b1b',
    borderColor: '#b91c1c',
  },
  statusNcc: {
    backgroundColor: '#eff6ff',
    color: '#1e40af',
    borderColor: '#2563eb',
  },
  statusMedical: {
    backgroundColor: '#fffbeb',
    color: '#b45309',
    borderColor: '#d97706',
  },
  statusOther: {
    backgroundColor: '#fffbeb',
    color: '#78350f',
    borderColor: '#b45309',
  },
  signaturesBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 0.75,
    borderTopColor: '#cbd5e1',
  },
  signatureCol: {
    width: '30%',
    alignItems: 'center',
  },
  signatureLine: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#475569',
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
    textAlign: 'center',
  },
  signatureSub: {
    fontSize: 6.5,
    color: '#64748b',
    marginTop: 1,
    textAlign: 'center',
  },
  pageFooter: {
    position: 'absolute',
    bottom: 12,
    left: 22,
    right: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: '#e2e8f0',
    paddingTop: 4,
  },
  footerText: {
    fontSize: 6.5,
    color: '#64748b',
  },
  pageNumber: {
    fontSize: 6.5,
    color: '#64748b',
    fontFamily: 'Helvetica-Bold',
  },
});

const h = React.createElement;

export default function AttendanceSessionPDF({
  logoUrl,
  collegeName = 'KU College of Engineering & Technology',
  universityName = 'Kakatiya University Campus, Warangal – 506009, Telangana, India',
  branch,
  semester,
  subjectCode,
  subjectName,
  academicYear,
  date,
  session,
  topicCovered,
  facultyName,
  submissionTimestamp,
  generationTimestamp,
  subjectCategory,
  isHistoricalFallback = false,
  students = [],
  totals = { total: 0, present: 0, absent: 0, ncc: 0, medical: 0, percentage: 0 },
}) {
  const K = students.length > 5 ? 3 : 0;
  const mainStudents = students.slice(0, students.length - K);
  const trailingStudents = students.slice(students.length - K);

  const renderStudentRow = (st, index) => {
    const isEven = index % 2 === 1;
    const statusStyle =
      st.status === 'PRESENT'
        ? styles.statusPresent
        : st.status === 'ABSENT'
        ? styles.statusAbsent
        : st.status === 'NCC'
        ? styles.statusNcc
        : st.status === 'MEDICAL'
        ? styles.statusMedical
        : styles.statusOther;

    return h(
      View,
      { key: st.student_id || st.roll_no || index, style: [styles.tableRow, isEven ? styles.tableRowEven : null] },
      h(Text, { style: [styles.tdCell, styles.colSNo] }, String(index + 1)),
      h(Text, { style: [styles.tdCell, styles.cellMono, styles.colRoll] }, st.roll_no),
      h(Text, { style: [styles.tdCellLeft, styles.colName], numberOfLines: 1 }, st.name || '—'),
      h(
        View,
        { style: [styles.tdCellLast, styles.colStatus] },
        h(Text, { style: [styles.statusBadge, statusStyle] }, st.status)
      )
    );
  };

  const signaturesBlock = h(
    View,
    { style: styles.signaturesBlock },
    h(
      View,
      { style: styles.signatureCol },
      h(View, { style: styles.signatureLine }),
      h(Text, { style: styles.signatureLabel }, facultyName || 'Course Faculty'),
      h(Text, { style: styles.signatureSub }, 'Faculty In-Charge')
    ),
    h(
      View,
      { style: styles.signatureCol },
      h(View, { style: styles.signatureLine }),
      h(Text, { style: styles.signatureLabel }, 'Head of Department'),
      h(Text, { style: styles.signatureSub }, `Department of ${branch || 'Engineering'}`)
    ),
    h(
      View,
      { style: styles.signatureCol },
      h(View, { style: styles.signatureLine }),
      h(Text, { style: styles.signatureLabel }, 'Principal / Academic Dean'),
      h(Text, { style: styles.signatureSub }, 'KU College of Engineering & Technology')
    )
  );

  return h(
    Document,
    { title: `Attendance_${subjectCode || 'SUB'}_${date || 'DATE'}_S${session || 1}` },
    h(
      Page,
      { size: 'A4', orientation: 'portrait', style: styles.page },
      // 1. Institutional Header
      h(
        View,
        { style: styles.header, fixed: true },
        logoUrl ? h(Image, { src: logoUrl, style: styles.logo }) : null,
        h(
          View,
          { style: styles.headerText },
          h(Text, { style: styles.collegeTitle }, collegeName),
          h(Text, { style: styles.universitySubtitle }, universityName),
          h(Text, { style: styles.reportTitle }, `Official Attendance Record • Session S${session}${subjectCategory ? ` (${subjectCategory})` : ''}`)
        )
      ),

      // 2. Academic Context & Metadata
      h(
        View,
        { style: styles.metaGrid },
        h(
          View,
          { style: styles.metaColWide },
          h(Text, { style: styles.metaLabel }, 'Subject & Type'),
          h(Text, { style: styles.metaValue }, `${subjectName || 'Subject'} (${subjectCode || 'CODE'})${subjectCategory ? ` • ${subjectCategory}` : ''}`)
        ),
        h(
          View,
          { style: styles.metaCol },
          h(Text, { style: styles.metaLabel }, 'Branch & Semester'),
          h(Text, { style: styles.metaValue }, `${branch || 'Engineering'} • Sem ${semester || '—'}`)
        ),
        h(
          View,
          { style: styles.metaCol },
          h(Text, { style: styles.metaLabel }, 'Academic Year'),
          h(Text, { style: styles.metaValue }, academicYear || '—')
        ),
        h(
          View,
          { style: styles.metaCol },
          h(Text, { style: styles.metaLabel }, 'Attendance Date'),
          h(Text, { style: styles.metaValue }, date || '—')
        ),
        h(
          View,
          { style: styles.metaCol },
          h(Text, { style: styles.metaLabel }, 'Session'),
          h(Text, { style: styles.metaValue }, `Session S${session}`)
        ),
        h(
          View,
          { style: styles.metaColWide },
          h(Text, { style: styles.metaLabel }, 'Course Faculty'),
          h(Text, { style: styles.metaValue }, facultyName || 'Course Faculty')
        ),
        h(
          View,
          { style: styles.metaColWide },
          h(Text, { style: styles.metaLabel }, 'Submitted Timestamp'),
          h(Text, { style: styles.metaValue }, `${submissionTimestamp || '—'} ${isHistoricalFallback ? '(Historical Record)' : ''}`)
        ),
        h(
          View,
          { style: styles.metaColWide },
          h(Text, { style: styles.metaLabel }, 'Topic Covered'),
          h(Text, { style: [styles.metaValue, { fontFamily: 'Helvetica', color: '#334155' }] }, topicCovered || 'Regular Syllabus Curriculum Coverage')
        )
      ),

      // 3. Summary Metric Counters
      h(
        View,
        { style: styles.summaryBar },
        h(
          View,
          { style: styles.summaryItem },
          h(Text, { style: styles.summaryLabel }, 'Total Enrolled'),
          h(Text, { style: styles.summaryValue }, String(totals.total ?? students.length))
        ),
        h(
          View,
          { style: styles.summaryItem },
          h(Text, { style: styles.summaryLabel }, 'Present'),
          h(Text, { style: [styles.summaryValue, { color: '#16a34a' }] }, String(totals.present ?? 0))
        ),
        (totals.ncc > 0 || totals.medical > 0)
          ? h(
              View,
              { style: styles.summaryItem },
              h(Text, { style: styles.summaryLabel }, 'Duty / Med'),
              h(Text, { style: [styles.summaryValue, { color: '#2563eb' }] }, `${(totals.ncc || 0) + (totals.medical || 0)}`)
            )
          : null,
        h(
          View,
          { style: styles.summaryItem },
          h(Text, { style: styles.summaryLabel }, 'Absent'),
          h(Text, { style: [styles.summaryValue, { color: '#dc2626' }] }, String(totals.absent ?? 0))
        ),
        h(
          View,
          { style: styles.summaryItem },
          h(Text, { style: styles.summaryLabel }, 'Attendance Rate'),
          h(
            Text,
            {
              style: [
                styles.summaryValue,
                { color: (totals.percentage ?? 0) >= 75 ? '#15803d' : (totals.percentage ?? 0) >= 65 ? '#b45309' : '#b91c1c' },
              ],
            },
            `${totals.percentage ?? 0}%`
          )
        )
      ),

      // 4. Student Attendance Table with Atomic Signatures Orphan Prevention
      h(
        View,
        { style: styles.table },
        h(
          View,
          { style: styles.tableHeader, fixed: true },
          h(Text, { style: [styles.tableHeaderCell, styles.colSNo] }, '#'),
          h(Text, { style: [styles.tableHeaderCell, styles.colRoll] }, 'Roll Number'),
          h(Text, { style: [styles.tableHeaderCell, styles.colName, { textAlign: 'left', paddingLeft: 4 }] }, 'Student Name'),
          h(Text, { style: [styles.tableHeaderCellLast, styles.colStatus] }, 'Status')
        ),
        mainStudents.map((st, index) => renderStudentRow(st, index)),
        trailingStudents.length > 0
          ? h(
              View,
              { wrap: false },
              trailingStudents.map((st, index) => renderStudentRow(st, mainStudents.length + index)),
              signaturesBlock
            )
          : signaturesBlock
      ),

      // 5. Fixed Page Footer on all pages
      h(
        View,
        { style: styles.pageFooter, fixed: true },
        h(
          Text,
          { style: styles.footerText },
          `KUCET CMS • Session Attendance Record (S${session}) • Generated: ${generationTimestamp || new Date().toLocaleString()}`
        ),
        h(
          Text,
          { style: [styles.footerText, { fontFamily: 'Helvetica-Bold', color: '#15803d' }] },
          'OFFICIAL ACADEMIC RECORD'
        ),
        h(
          Text,
          {
            style: styles.pageNumber,
            render: ({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`,
          }
        )
      )
    )
  );
}
