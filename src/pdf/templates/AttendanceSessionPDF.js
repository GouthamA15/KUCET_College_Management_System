import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#1e293b',
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: '#0b3578',
    paddingBottom: 10,
    marginBottom: 12,
  },
  logo: {
    width: 50,
    height: 50,
    marginRight: 12,
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
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#334155',
    marginTop: 2,
  },
  reportTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#dc2626',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 8,
    marginBottom: 12,
  },
  metaCol: {
    width: '25%',
    marginBottom: 4,
  },
  metaColWide: {
    width: '50%',
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    marginTop: 1,
  },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#1e40af',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a8a',
    marginTop: 1,
  },
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0b3578',
    borderBottomWidth: 1,
    borderBottomColor: '#0b3578',
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableHeaderCell: {
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  tableRowEven: {
    backgroundColor: '#f8fafc',
  },
  colSNo: {
    width: '8%',
  },
  colRoll: {
    width: '32%',
  },
  colName: {
    width: '42%',
  },
  colStatus: {
    width: '18%',
    alignItems: 'center',
  },
  cellText: {
    fontSize: 8,
    color: '#1e293b',
  },
  cellMono: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  statusPresent: {
    backgroundColor: '#dcfce7',
    color: '#15803d',
  },
  statusAbsent: {
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
  },
  statusOther: {
    backgroundColor: '#f1f5f9',
    color: '#475569',
  },
  footer: {
    marginTop: 'auto',
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
    paddingTop: 8,
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  facultyInfo: {
    width: '60%',
  },
  signatureBlock: {
    width: '35%',
    alignItems: 'center',
  },
  signatureLine: {
    width: 140,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#334155',
    textTransform: 'uppercase',
  },
  pageNumber: {
    fontSize: 7,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 6,
  },
});

const h = React.createElement;

export default function AttendanceSessionPDF({
  logoUrl,
  collegeName = 'KU College of Engineering & Technology',
  universityName = 'Kakatiya University Campus, Warangal – 506009',
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
  isHistoricalFallback = false,
  students = [],
  totals = { total: 0, present: 0, absent: 0, percentage: 0 },
}) {
  return h(
    Document,
    { title: `Attendance_${subjectCode}_${date}_S${session}` },
    h(
      Page,
      { size: 'A4', style: styles.page },
      // Institutional Header
      h(
        View,
        { style: styles.header },
        logoUrl ? h(Image, { src: logoUrl, style: styles.logo }) : null,
        h(
          View,
          { style: styles.headerText },
          h(Text, { style: styles.collegeTitle }, collegeName),
          h(Text, { style: styles.universitySubtitle }, universityName),
          h(Text, { style: styles.reportTitle }, `Official Attendance Record • Session S${session}`)
        )
      ),

      // Academic Context & Metadata
      h(
        View,
        { style: styles.metaGrid },
        h(
          View,
          { style: styles.metaColWide },
          h(Text, { style: styles.metaLabel }, 'Subject'),
          h(Text, { style: styles.metaValue }, `${subjectName} (${subjectCode})`)
        ),
        h(
          View,
          { style: styles.metaCol },
          h(Text, { style: styles.metaLabel }, 'Branch & Semester'),
          h(Text, { style: styles.metaValue }, `${branch} • Sem ${semester}`)
        ),
        h(
          View,
          { style: styles.metaCol },
          h(Text, { style: styles.metaLabel }, 'Academic Year'),
          h(Text, { style: styles.metaValue }, academicYear)
        ),
        h(
          View,
          { style: styles.metaCol },
          h(Text, { style: styles.metaLabel }, 'Attendance Date'),
          h(Text, { style: styles.metaValue }, date)
        ),
        h(
          View,
          { style: styles.metaCol },
          h(Text, { style: styles.metaLabel }, 'Session'),
          h(Text, { style: styles.metaValue }, `Session ${session}`)
        ),
        h(
          View,
          { style: styles.metaColWide },
          h(Text, { style: styles.metaLabel }, 'Submitted Timestamp'),
          h(Text, { style: styles.metaValue }, `${submissionTimestamp} ${isHistoricalFallback ? '(Historical Record)' : ''}`)
        ),
        topicCovered
          ? h(
              View,
              { style: { width: '100%', marginTop: 3 } },
              h(Text, { style: styles.metaLabel }, 'Topic Covered'),
              h(Text, { style: { fontSize: 8, color: '#334155', marginTop: 1 } }, topicCovered)
            )
          : null
      ),

      // Summary Metric Counters
      h(
        View,
        { style: styles.summaryBar },
        h(
          View,
          { style: styles.summaryItem },
          h(Text, { style: styles.summaryLabel }, 'Total Enrolled'),
          h(Text, { style: styles.summaryValue }, totals.total)
        ),
        h(
          View,
          { style: styles.summaryItem },
          h(Text, { style: styles.summaryLabel }, 'Present'),
          h(Text, { style: [styles.summaryValue, { color: '#16a34a' }] }, totals.present)
        ),
        h(
          View,
          { style: styles.summaryItem },
          h(Text, { style: styles.summaryLabel }, 'Absent'),
          h(Text, { style: [styles.summaryValue, { color: '#dc2626' }] }, totals.absent)
        ),
        h(
          View,
          { style: styles.summaryItem },
          h(Text, { style: styles.summaryLabel }, 'Attendance %'),
          h(Text, { style: [styles.summaryValue, { color: '#0b3578' }] }, `${totals.percentage}%`)
        )
      ),

      // Student Attendance Table
      h(
        View,
        { style: styles.table },
        h(
          View,
          { style: styles.tableHeader },
          h(Text, { style: [styles.tableHeaderCell, styles.colSNo] }, '#'),
          h(Text, { style: [styles.tableHeaderCell, styles.colRoll] }, 'Roll Number'),
          h(Text, { style: [styles.tableHeaderCell, styles.colName] }, 'Student Name'),
          h(Text, { style: [styles.tableHeaderCell, styles.colStatus] }, 'Status')
        ),
        students.map((st, index) => {
          const isEven = index % 2 === 1;
          const statusStyle =
            st.status === 'PRESENT'
              ? styles.statusPresent
              : st.status === 'ABSENT'
              ? styles.statusAbsent
              : styles.statusOther;

          return h(
            View,
            { key: st.student_id || index, style: [styles.tableRow, isEven ? styles.tableRowEven : {}] },
            h(Text, { style: [styles.cellText, styles.colSNo] }, index + 1),
            h(Text, { style: [styles.cellMono, styles.colRoll] }, st.roll_no),
            h(Text, { style: [styles.cellText, styles.colName] }, st.name || '—'),
            h(
              View,
              { style: styles.colStatus },
              h(Text, { style: [styles.statusBadge, statusStyle] }, st.status)
            )
          );
        })
      ),

      // Footer & Endorsement Section
      h(
        View,
        { style: styles.footer },
        h(
          View,
          { style: styles.signatureRow },
          h(
            View,
            { style: styles.facultyInfo },
            h(Text, { style: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#0f172a' } }, `Submitted by: ${facultyName || 'Course Faculty'}`),
            h(Text, { style: { fontSize: 7, color: '#64748b', marginTop: 2 } }, `Submission Time: ${submissionTimestamp} ${isHistoricalFallback ? '(Historical Archive)' : ''}`),
            h(Text, { style: { fontSize: 7, color: '#64748b', marginTop: 1 } }, `Report Generated: ${generationTimestamp}`)
          ),
          h(
            View,
            { style: styles.signatureBlock },
            h(View, { style: styles.signatureLine }),
            h(Text, { style: styles.signatureLabel }, 'Faculty Signature')
          )
        ),
        h(Text, {
          style: styles.pageNumber,
          render: ({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`,
          fixed: true
        })
      )
    )
  );
}
