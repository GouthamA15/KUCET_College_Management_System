import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const h = React.createElement;

const styles = StyleSheet.create({
  page: {
    paddingTop: 18,
    paddingBottom: 22,
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
    width: 42,
    height: 42,
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
    fontSize: 8.5,
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
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 6,
  },
  metaCol: {
    width: '25%',
    marginBottom: 2,
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
  chunkNotice: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#1d4ed8',
    backgroundColor: '#eff6ff',
    borderWidth: 0.5,
    borderColor: '#bfdbfe',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 2,
    marginBottom: 5,
    textAlign: 'center',
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
    minHeight: 22,
    alignItems: 'center',
  },
  tableSubHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#1e3a8a',
    borderBottomWidth: 0.75,
    borderBottomColor: '#cbd5e1',
    minHeight: 14,
    alignItems: 'center',
  },
  thCell: {
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.5,
    textAlign: 'center',
    paddingVertical: 2,
    paddingHorizontal: 1,
    borderRightWidth: 0.5,
    borderRightColor: '#3b82f6',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    minHeight: 13,
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
  monoText: {
    fontFamily: 'Courier',
    fontSize: 6.8,
    fontWeight: 'bold',
  },
  statusPresent: {
    color: '#15803d',
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.2,
  },
  statusAbsent: {
    color: '#b91c1c',
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.2,
  },
  statusOther: {
    color: '#b45309',
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.5,
  },
  statusEmpty: {
    color: '#94a3b8',
    fontSize: 7,
  },
  footerRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderTopWidth: 1,
    borderTopColor: '#94a3b8',
    minHeight: 15,
    alignItems: 'center',
  },
  footerCell: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    paddingVertical: 2,
    paddingHorizontal: 1,
    borderRightWidth: 0.5,
    borderRightColor: '#cbd5e1',
  },
  signaturesBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 0.75,
    borderTopColor: '#cbd5e1',
  },
  signatureCol: {
    width: '28%',
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
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaFooterText: {
    fontSize: 6.5,
    color: '#64748b',
  },
  pageNumber: {
    fontSize: 6.5,
    color: '#64748b',
    fontFamily: 'Helvetica-Bold',
  },
});

const SESSIONS_PER_CHUNK = 15;
const STUDENTS_PER_PAGE = 20;

export default function FullAttendanceExportPDF({
  logoUrl,
  collegeName = 'KU College of Engineering & Technology',
  universityName = 'Kakatiya University Campus, Warangal – 506009',
  branch,
  semester,
  subjectCode,
  subjectName,
  academicYear,
  facultyName,
  generationTimestamp,
  reportPeriod,
  totalConducted,
  overallPercentage,
  sessions = [],
  students = [],
  sessionStats = {}
}) {
  const sessionChunks = [];
  if (sessions.length === 0) {
    sessionChunks.push([]);
  } else {
    for (let i = 0; i < sessions.length; i += SESSIONS_PER_CHUNK) {
      sessionChunks.push(sessions.slice(i, i + SESSIONS_PER_CHUNK));
    }
  }

  const studentPages = [];
  if (students.length === 0) {
    studentPages.push([]);
  } else {
    for (let i = 0; i < students.length; i += STUDENTS_PER_PAGE) {
      studentPages.push(students.slice(i, i + STUDENTS_PER_PAGE));
    }
  }

  const colSNoWidth = 18;
  const colRollWidth = 72;
  const colNameWidth = 98;
  const colSumCondWidth = 24;
  const colSumPresWidth = 24;
  const colSumAbsWidth = 24;
  const colSumPctWidth = 28;

  const totalFixed = colSNoWidth + colRollWidth + colNameWidth + colSumCondWidth + colSumPresWidth + colSumAbsWidth + colSumPctWidth;
  const availableForSessions = 794 - totalFixed;

  // Pre-generate static Meta Grid once for the entire report
  const metaItems = [
    { label: 'Subject Code & Name', val: `${subjectCode} — ${subjectName}` },
    { label: 'Branch & Semester', val: `${branch} (Sem ${semester})` },
    { label: 'Course Faculty', val: facultyName || 'Course Faculty' },
    { label: 'Report Period (Conducted Dates)', val: reportPeriod || 'Current Semester' },
    { label: 'Total Classes Conducted', val: `${totalConducted} Sessions`, color: '#0b3578' },
    { label: 'Total Students Enrolled', val: `${students.length} Students` },
    { label: 'Overall Class Attendance', val: `${overallPercentage}%`, color: '#16a34a' },
    { label: 'Report Generated', val: generationTimestamp }
  ];

  const metaCols = metaItems.map((m, mIdx) =>
    h(View, { key: `meta-${mIdx}`, style: styles.metaCol },
      h(Text, { style: styles.metaLabel }, m.label),
      h(Text, { style: [styles.metaValue, m.color ? { color: m.color } : {}] }, m.val)
    )
  );

  const pages = [];

  sessionChunks.forEach((chunkSessions, chunkIdx) => {
    const sessionColWidth = chunkSessions.length > 0
      ? Math.floor(availableForSessions / Math.max(chunkSessions.length, 1))
      : 50;

    const startSessionNum = chunkIdx * SESSIONS_PER_CHUNK + 1;
    const endSessionNum = chunkIdx * SESSIONS_PER_CHUNK + chunkSessions.length;
    const chunkNoticeText = sessions.length > SESSIONS_PER_CHUNK
      ? `Attendance Matrix: Sessions ${startSessionNum} to ${endSessionNum} of ${sessions.length} conducted classes`
      : `Attendance Matrix: Complete semester history (${sessions.length} conducted classes)`;

    // Pre-create static cell styles for this chunk to avoid thousands of inline array allocations
    const cellStylePresent = { ...styles.tdCell, width: sessionColWidth, ...styles.statusPresent };
    const cellStyleAbsent = { ...styles.tdCell, width: sessionColWidth, ...styles.statusAbsent };
    const cellStyleOther = { ...styles.tdCell, width: sessionColWidth, ...styles.statusOther };
    const cellStyleEmpty = { ...styles.tdCell, width: sessionColWidth, ...styles.statusEmpty };

    const thCellStyle = { ...styles.thCell, width: sessionColWidth };
    const thSubCellStyle = { ...styles.thCell, width: sessionColWidth, backgroundColor: '#1e3a8a' };

    // Pre-create Table Header Rows once per chunk
    const thCells = [
      h(Text, { key: 'th-sno', style: [styles.thCell, { width: colSNoWidth }] }, '#'),
      h(Text, { key: 'th-roll', style: [styles.thCell, { width: colRollWidth }] }, 'Roll Number'),
      h(Text, { key: 'th-name', style: [styles.thCell, { width: colNameWidth, textAlign: 'left', paddingLeft: 4 }] }, 'Student Name'),
      ...chunkSessions.map((s, sIdx) =>
        h(Text, { key: `th-s-${s.key || sIdx}`, style: thCellStyle }, s.displayDate || s.date)
      ),
      h(Text, { key: 'th-cond', style: [styles.thCell, { width: colSumCondWidth }] }, 'Cond'),
      h(Text, { key: 'th-pres', style: [styles.thCell, { width: colSumPresWidth }] }, 'Pres'),
      h(Text, { key: 'th-abs', style: [styles.thCell, { width: colSumAbsWidth }] }, 'Abs'),
      h(Text, { key: 'th-pct', style: [styles.thCell, { width: colSumPctWidth, borderRightWidth: 0 }] }, '%')
    ];

    const thSubCells = [
      h(Text, { key: 'sub-sno', style: [styles.thCell, { width: colSNoWidth, backgroundColor: '#1e3a8a' }] }, '-'),
      h(Text, { key: 'sub-roll', style: [styles.thCell, { width: colRollWidth, backgroundColor: '#1e3a8a' }] }, 'Canonical'),
      h(Text, { key: 'sub-name', style: [styles.thCell, { width: colNameWidth, textAlign: 'left', paddingLeft: 4, backgroundColor: '#1e3a8a' }] }, `Roster (${students.length})`),
      ...chunkSessions.map((s, sIdx) =>
        h(Text, { key: `sub-s-${s.key || sIdx}`, style: thSubCellStyle }, `S${s.session}`)
      ),
      h(Text, { key: 'sub-cond', style: [styles.thCell, { width: colSumCondWidth, backgroundColor: '#1e3a8a' }] }, 'Tot'),
      h(Text, { key: 'sub-pres', style: [styles.thCell, { width: colSumPresWidth, backgroundColor: '#1e3a8a' }] }, 'P'),
      h(Text, { key: 'sub-abs', style: [styles.thCell, { width: colSumAbsWidth, backgroundColor: '#1e3a8a' }] }, 'A'),
      h(Text, { key: 'sub-pct', style: [styles.thCell, { width: colSumPctWidth, backgroundColor: '#1e3a8a', borderRightWidth: 0 }] }, 'Att%')
    ];

    studentPages.forEach((pageStudents, pageIdx) => {
      const isLastStudentPageOfChunk = pageIdx === studentPages.length - 1;
      const globalPageOffset = chunkIdx * studentPages.length + pageIdx + 1;
      const totalGlobalPages = sessionChunks.length * studentPages.length;

      // Header Elements
      const headerElements = [
        logoUrl ? h(Image, { key: 'logo', src: logoUrl, style: styles.logo }) : null,
        h(View, { key: 'htext', style: styles.headerText },
          h(Text, { style: styles.collegeTitle }, collegeName),
          h(Text, { style: styles.universitySubtitle }, universityName),
          h(Text, { style: styles.reportTitle }, `Department of ${branch || 'Engineering'} — Official Semester Attendance Register`)
        ),
        h(View, { key: 'hright', style: { alignItems: 'flex-end' } },
          h(Text, { style: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#0b3578' } }, `ACADEMIC YEAR: ${academicYear || '2026-2027'}`),
          h(Text, { style: { fontSize: 7, color: '#475569', marginTop: 1 } }, `SEMESTER: ${semester ? `Semester ${semester}` : '—'}`)
        )
      ];

      // Student Table Rows
      const studentRows = pageStudents.map((st, idx) => {
        const globalIdx = pageIdx * STUDENTS_PER_PAGE + idx + 1;
        const isEven = idx % 2 === 1;

        const rowCells = [
          h(Text, { key: 'td-sno', style: [styles.tdCell, { width: colSNoWidth }] }, String(globalIdx)),
          h(Text, { key: 'td-roll', style: [styles.tdCell, styles.monoText, { width: colRollWidth }] }, st.roll_no),
          h(Text, { key: 'td-name', style: [styles.tdCellLeft, { width: colNameWidth }], numberOfLines: 1 }, st.name || '—'),
          ...chunkSessions.map((s, sIdx) => {
            const status = st.records ? st.records[s.key] : null;
            const isPresent = status === 'PRESENT';
            const isAbsent = status === 'ABSENT';
            const isOther = status && !isPresent && !isAbsent;

            const stStyle = isPresent
              ? cellStylePresent
              : isAbsent
              ? cellStyleAbsent
              : isOther
              ? cellStyleOther
              : cellStyleEmpty;

            const letter = isPresent ? 'P' : isAbsent ? 'A' : isOther ? (status === 'NCC' ? 'OD' : 'M') : '-';

            return h(Text, {
              key: `cell-${st.student_id}-${s.key || sIdx}`,
              style: stStyle
            }, letter);
          }),
          h(Text, { key: 'td-cond', style: [styles.tdCell, { width: colSumCondWidth, fontFamily: 'Helvetica-Bold' }] }, String(totalConducted)),
          h(Text, { key: 'td-pres', style: [styles.tdCell, { width: colSumPresWidth, color: '#16a34a', fontFamily: 'Helvetica-Bold' }] }, String(st.totalPresent)),
          h(Text, { key: 'td-abs', style: [styles.tdCell, { width: colSumAbsWidth, color: '#dc2626', fontFamily: 'Helvetica-Bold' }] }, String(st.totalAbsent)),
          h(Text, {
            key: 'td-pct',
            style: [
              styles.tdCell,
              {
                width: colSumPctWidth,
                fontFamily: 'Helvetica-Bold',
                color: st.percentage >= 75 ? '#15803d' : st.percentage >= 65 ? '#b45309' : '#b91c1c',
                borderRightWidth: 0
              }
            ]
          }, `${st.percentage}%`)
        ];

        return h(View, {
          key: st.student_id || st.roll_no || idx,
          style: isEven ? [styles.tableRow, styles.tableRowEven] : styles.tableRow
        }, rowCells);
      });

      // Summary Totals Row (on last student page of chunk)
      let summaryRow = null;
      if (isLastStudentPageOfChunk && chunkSessions.length > 0) {
        const sumCells = [
          h(Text, { key: 'sum-sno', style: [styles.footerCell, { width: colSNoWidth }] }, 'Σ'),
          h(Text, { key: 'sum-roll', style: [styles.footerCell, { width: colRollWidth }] }, 'TOTALS'),
          h(Text, { key: 'sum-name', style: [styles.footerCell, { width: colNameWidth, textAlign: 'left', paddingLeft: 4 }] }, 'Present / Total Students'),
          ...chunkSessions.map((s, sIdx) => {
            const stat = sessionStats[s.key] || { presentCount: 0, totalCount: students.length };
            return h(Text, {
              key: `stat-${s.key || sIdx}`,
              style: [styles.footerCell, { width: sessionColWidth, color: '#0b3578' }]
            }, `${stat.presentCount}/${students.length}`);
          }),
          h(Text, { key: 'sum-cond', style: [styles.footerCell, { width: colSumCondWidth }] }, '—'),
          h(Text, { key: 'sum-pres', style: [styles.footerCell, { width: colSumPresWidth, color: '#16a34a' }] }, String(students.reduce((acc, s) => acc + (s.totalPresent || 0), 0))),
          h(Text, { key: 'sum-abs', style: [styles.footerCell, { width: colSumAbsWidth, color: '#dc2626' }] }, String(students.reduce((acc, s) => acc + (s.totalAbsent || 0), 0))),
          h(Text, { key: 'sum-pct', style: [styles.footerCell, { width: colSumPctWidth, borderRightWidth: 0, color: '#0b3578' }] }, `${overallPercentage}%`)
        ];

        summaryRow = h(View, { key: 'table-summary-row', style: styles.footerRow }, sumCells);
      }

      // Signatures Block (on last student page of chunk)
      let signaturesBlock = null;
      if (isLastStudentPageOfChunk) {
        signaturesBlock = h(View, { key: 'sig-block', style: styles.signaturesBlock },
          h(View, { style: styles.signatureCol },
            h(View, { style: styles.signatureLine }),
            h(Text, { style: styles.signatureLabel }, 'Signature of Course Faculty'),
            h(Text, { style: styles.signatureSub }, `Name: ${facultyName || 'Course Faculty'}`)
          ),
          h(View, { style: styles.signatureCol },
            h(View, { style: styles.signatureLine }),
            h(Text, { style: styles.signatureLabel }, 'Head of Department (HOD)'),
            h(Text, { style: styles.signatureSub }, `Department of ${branch || 'Engineering'}`)
          ),
          h(View, { style: styles.signatureCol },
            h(View, { style: styles.signatureLine }),
            h(Text, { style: styles.signatureLabel }, 'Principal / Dean Academic'),
            h(Text, { style: styles.signatureSub }, 'KU College of Engineering & Technology')
          )
        );
      }

      // Page Footer
      const pageFooter = h(View, { key: 'page-footer', style: styles.pageFooter },
        h(Text, { style: styles.metaFooterText }, `KUCET CMS — Official Document Generated on ${generationTimestamp} • Confidential Academic Record`),
        h(Text, { style: styles.pageNumber }, `Sheet ${globalPageOffset} of ${totalGlobalPages}`)
      );

      // Assemble Single Page
      pages.push(
        h(Page, {
          key: `chunk-${chunkIdx}-page-${pageIdx}`,
          size: 'A4',
          orientation: 'landscape',
          style: styles.page
        },
          h(View, { style: styles.header }, headerElements),
          h(View, { style: styles.metaGrid }, metaCols),
          h(Text, { style: styles.chunkNotice }, chunkNoticeText),
          h(View, { style: styles.table },
            h(View, { style: styles.tableHeaderRow }, thCells),
            h(View, { style: styles.tableSubHeaderRow }, thSubCells),
            ...studentRows,
            summaryRow
          ),
          signaturesBlock,
          pageFooter
        )
      );
    });
  });

  return h(Document, { title: `Attendance_Register_${subjectCode || 'SUBJECT'}_${branch || 'ALL'}` }, pages);
}
