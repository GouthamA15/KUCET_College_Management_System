import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const h = React.createElement;

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
    marginTop: 3,
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
  badgePublished: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#14532d',
    backgroundColor: '#f0fdf4',
    borderWidth: 0.75,
    borderColor: '#166534',
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 2,
    alignSelf: 'flex-start',
    marginTop: 1,
  },
  badgeDraft: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#78350f',
    backgroundColor: '#fffbeb',
    borderWidth: 0.75,
    borderColor: '#92400e',
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 2,
    alignSelf: 'flex-start',
    marginTop: 1,
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
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#0b3578',
    borderBottomWidth: 0.75,
    borderBottomColor: '#0b3578',
    minHeight: 18,
    alignItems: 'center',
  },
  thCell: {
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.8,
    textAlign: 'center',
    paddingVertical: 2.5,
    paddingHorizontal: 2,
    borderRightWidth: 0.5,
    borderRightColor: '#3b82f6',
  },
  thCellLast: {
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
  monoText: {
    fontFamily: 'Courier',
    fontSize: 7,
    fontWeight: 'bold',
  },
  highlightTotal: {
    fontFamily: 'Helvetica-Bold',
    color: '#1d4ed8',
    fontSize: 7.2,
  },
  statusRecorded: {
    color: '#15803d',
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.5,
  },
  statusPending: {
    color: '#b45309',
    fontSize: 6.5,
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

export default function EvaluationReportPDF({
  logoUrl,
  collegeName = 'KU College of Engineering & Technology',
  universityName = 'Kakatiya University Campus, Warangal – 506009, Telangana, India',
  branch,
  semester,
  academicYear,
  subjectCode,
  subjectName,
  subjectType, // 'theory' | 'lab'
  view = 'overview', // 'overview' | 'mid1' | 'mid2' | 'assignment' | 'execution' | 'writing' | 'record'
  reportTitle,
  facultyName,
  generationTimestamp,
  isPublished = false,
  midMax = 20,
  patternName,
  students = [],
  stats = {}
}) {
  const isLab = subjectType === 'lab';
  const isOverview = view === 'overview';
  const isPattern3 = !isLab && midMax === 30;

  // Dynamic Component Columns for Overview
  const colLabels = isLab
    ? { c1: 'Execution', c2: 'Writing', c3: 'Record', m1: 10, m2: 10, m3: 5, totalMax: 25 }
    : {
        c1: 'MID-1',
        c2: 'MID-2',
        c3: isPattern3 ? 'Assignment' : 'Assignment',
        m1: midMax,
        m2: midMax,
        m3: isPattern3 ? 'N/A' : (midMax === 25 ? 5 : 10),
        totalMax: 30
      };

  // Individual component label and max marks
  let singleLabel = '';
  let singleMax = 0;
  if (!isOverview) {
    if (isLab) {
      if (view === 'execution' || view === 'mid1') { singleLabel = 'Execution'; singleMax = 10; }
      else if (view === 'writing' || view === 'mid2') { singleLabel = 'Writing'; singleMax = 10; }
      else if (view === 'record' || view === 'assignment') { singleLabel = 'Record'; singleMax = 5; }
    } else {
      if (view === 'mid1') { singleLabel = 'MID-1'; singleMax = midMax; }
      else if (view === 'mid2') { singleLabel = 'MID-2'; singleMax = midMax; }
      else if (view === 'assignment') { singleLabel = 'Assignment'; singleMax = (midMax === 25 ? 5 : 10); }
    }
  }

  const formatMark = (m) => {
    if (m === null || m === undefined || m === '') return '—';
    const n = Number(m);
    return Number.isFinite(n) ? (n % 1 === 0 ? n.toString() : n.toFixed(1)) : '—';
  };

  return h(
    Document,
    { title: `${subjectCode}_${isOverview ? 'Overall' : singleLabel}_Evaluation_Report` },
    h(
      Page,
      { size: 'A4', style: styles.page },
      // 1. Institutional Header
      h(
        View,
        { style: styles.header },
        logoUrl ? h(Image, { src: logoUrl, style: styles.logo }) : null,
        h(
          View,
          { style: styles.headerText },
          h(Text, { style: styles.collegeTitle }, collegeName),
          h(Text, { style: styles.universitySubtitle }, universityName),
          h(Text, { style: styles.reportTitle }, reportTitle || 'Continuous Internal Evaluation (CIE) Report')
        )
      ),

      // 2. Academic Context Metadata Grid
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
          h(Text, { style: styles.metaLabel }, 'Classification'),
          h(Text, { style: styles.metaValue }, isLab ? 'Practical / Laboratory' : 'Theory')
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
          h(Text, { style: styles.metaLabel }, 'Branch & Semester'),
          h(Text, { style: styles.metaValue }, `${branch} • Sem ${semester}`)
        ),
        h(
          View,
          { style: styles.metaCol },
          h(Text, { style: styles.metaLabel }, 'Faculty In-Charge'),
          h(Text, { style: styles.metaValue }, facultyName || '—')
        ),
        h(
          View,
          { style: styles.metaCol },
          h(Text, { style: styles.metaLabel }, 'Assessment View'),
          h(Text, { style: styles.metaValue }, isOverview ? `Overview (Max: ${colLabels.totalMax})` : `${singleLabel} (Max: ${singleMax})`)
        ),
        !isLab ? h(
          View,
          { style: styles.metaCol },
          h(Text, { style: styles.metaLabel }, 'Assessment Pattern'),
          h(Text, { style: styles.metaValue }, patternName || (midMax === 25 ? 'Pattern 2 (25 + 5)' : (midMax === 30 ? 'Pattern 3 (30 for Mids)' : 'Pattern 1 (20 + 10)')))
        ) : null,
        h(
          View,
          { style: styles.metaCol },
          h(Text, { style: styles.metaLabel }, 'Status'),
          h(
            Text,
            { style: isPublished ? styles.badgePublished : styles.badgeDraft },
            isPublished ? 'PUBLISHED' : 'DRAFT (UNOFFICIAL)'
          )
        )
      ),

      // 3. Summary Statistics Bar
      h(
        View,
        { style: styles.summaryBar },
        h(
          View,
          { style: styles.summaryItem },
          h(Text, { style: styles.summaryLabel }, 'Total Students'),
          h(Text, { style: styles.summaryValue }, String(stats.totalStudents ?? students.length))
        ),
        h(
          View,
          { style: styles.summaryItem },
          h(Text, { style: styles.summaryLabel }, 'Marks Entered'),
          h(Text, { style: styles.summaryValue }, String(stats.recordedCount ?? 0))
        ),
        h(
          View,
          { style: styles.summaryItem },
          h(Text, { style: styles.summaryLabel }, 'Pending'),
          h(Text, { style: styles.summaryValue }, String(stats.missingCount ?? 0))
        ),
        h(
          View,
          { style: styles.summaryItem },
          h(Text, { style: styles.summaryLabel }, 'Highest Mark'),
          h(Text, { style: styles.summaryValue }, stats.highest !== null && stats.highest !== undefined ? String(stats.highest) : '—')
        ),
        h(
          View,
          { style: styles.summaryItem },
          h(Text, { style: styles.summaryLabel }, 'Lowest Mark'),
          h(Text, { style: styles.summaryValue }, stats.lowest !== null && stats.lowest !== undefined ? String(stats.lowest) : '—')
        ),
        h(
          View,
          { style: styles.summaryItem },
          h(Text, { style: styles.summaryLabel }, 'Class Average'),
          h(Text, { style: styles.summaryValue }, stats.average !== null && stats.average !== undefined ? `${stats.average}` : '—')
        ),
        h(
          View,
          { style: styles.summaryItem },
          h(Text, { style: styles.summaryLabel }, 'Completion'),
          h(Text, { style: styles.summaryValue }, `${stats.completionRate ?? 0}%`)
        )
      ),

      // 4. Student Marks Table
      h(
        View,
        { style: styles.table },
        // Fixed Table Header (repeats across pages)
        isOverview
          ? h(
              View,
              { style: styles.tableHeaderRow, fixed: true },
              h(Text, { style: [styles.thCell, { width: '6%' }] }, 'S.No'),
              h(Text, { style: [styles.thCell, { width: '22%' }] }, 'Roll Number'),
              h(Text, { style: [styles.thCell, { width: '32%', textAlign: 'left', paddingLeft: 4 }] }, 'Student Name'),
              h(Text, { style: [styles.thCell, { width: '10%' }] }, `${colLabels.c1} (${colLabels.m1})`),
              h(Text, { style: [styles.thCell, { width: '10%' }] }, `${colLabels.c2} (${colLabels.m2})`),
              h(Text, { style: [styles.thCell, { width: '10%' }] }, `${colLabels.c3} (${colLabels.m3})`),
              h(Text, { style: [styles.thCellLast, { width: '10%' }] }, `Total (${colLabels.totalMax})`)
            )
          : h(
              View,
              { style: styles.tableHeaderRow, fixed: true },
              h(Text, { style: [styles.thCell, { width: '8%' }] }, 'S.No'),
              h(Text, { style: [styles.thCell, { width: '25%' }] }, 'Roll Number'),
              h(Text, { style: [styles.thCell, { width: '37%', textAlign: 'left', paddingLeft: 4 }] }, 'Student Name'),
              h(Text, { style: [styles.thCell, { width: '15%' }] }, `${singleLabel} (Max: ${singleMax})`),
              h(Text, { style: [styles.thCellLast, { width: '15%' }] }, 'Status')
            ),

        // Table Rows
        students.map((student, idx) => {
          const isEven = idx % 2 === 1;
          const rowStyle = [styles.tableRow, isEven ? styles.tableRowEven : null];

          if (isOverview) {
            return h(
              View,
              { key: student.id || student.roll_no, style: rowStyle },
              h(Text, { style: [styles.tdCell, { width: '6%' }] }, String(idx + 1)),
              h(Text, { style: [styles.tdCell, styles.monoText, { width: '22%' }] }, student.roll_no),
              h(Text, { style: [styles.tdCellLeft, { width: '32%' }] }, student.name),
              h(Text, { style: [styles.tdCell, { width: '10%' }] }, formatMark(student.c1_marks)),
              h(Text, { style: [styles.tdCell, { width: '10%' }] }, formatMark(student.c2_marks)),
              h(Text, { style: [styles.tdCell, { width: '10%', color: isPattern3 ? '#64748b' : '#334155' }] }, isPattern3 ? 'N/A' : formatMark(student.c3_marks)),
              h(Text, { style: [styles.tdCellLast, styles.highlightTotal, { width: '10%' }] }, formatMark(student.total_marks))
            );
          }

          // Single View
          const hasMark = student.mark !== null && student.mark !== undefined && student.mark !== '';
          return h(
            View,
            { key: student.id || student.roll_no, style: rowStyle },
            h(Text, { style: [styles.tdCell, { width: '8%' }] }, String(idx + 1)),
            h(Text, { style: [styles.tdCell, styles.monoText, { width: '25%' }] }, student.roll_no),
            h(Text, { style: [styles.tdCellLeft, { width: '37%' }] }, student.name),
            h(Text, { style: [styles.tdCell, styles.highlightTotal, { width: '15%' }] }, formatMark(student.mark)),
            h(
              Text,
              { style: [styles.tdCellLast, hasMark ? styles.statusRecorded : styles.statusPending, { width: '15%' }] },
              hasMark ? 'Recorded' : 'Pending'
            )
          );
        })
      ),

      // 5. Signatures Block (wrap={false} keeps it atomic on one page)
      h(
        View,
        { style: styles.signaturesBlock, wrap: false },
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
          h(Text, { style: styles.signatureSub }, `Department of ${branch}`)
        ),
        h(
          View,
          { style: styles.signatureCol },
          h(View, { style: styles.signatureLine }),
          h(Text, { style: styles.signatureLabel }, 'Principal / Academic Dean'),
          h(Text, { style: styles.signatureSub }, 'KU College of Engineering & Technology')
        )
      ),

      // 6. Fixed Page Footer on all pages
      h(
        View,
        { style: styles.pageFooter, fixed: true },
        h(
          Text,
          { style: styles.footerText },
          `KUCET CMS • Continuous Internal Evaluation (CIE) • Generated: ${generationTimestamp || new Date().toLocaleString()}`
        ),
        h(
          Text,
          { style: [styles.footerText, { fontFamily: 'Helvetica-Bold', color: isPublished ? '#15803d' : '#b45309' }] },
          isPublished ? 'OFFICIAL ACADEMIC RECORD' : 'DRAFT REPORT — UNOFFICIAL'
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
