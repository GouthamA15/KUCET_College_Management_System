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
  chunkNotice: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#1d4ed8',
    backgroundColor: '#eff6ff',
    borderWidth: 0.5,
    borderColor: '#bfdbfe',
    paddingVertical: 2.5,
    paddingHorizontal: 6,
    borderRadius: 2,
    marginBottom: 6,
    textAlign: 'center',
  },
  tableContainer: {
    width: '100%',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#0b3578',
    borderTopWidth: 0.75,
    borderTopColor: '#0b3578',
    borderBottomWidth: 0.75,
    borderBottomColor: '#0b3578',
    borderLeftWidth: 0.75,
    borderLeftColor: '#0b3578',
    borderRightWidth: 0.75,
    borderRightColor: '#0b3578',
    minHeight: 22,
    alignItems: 'center',
  },
  thCell: {
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.8,
    textAlign: 'center',
    paddingVertical: 2,
    paddingHorizontal: 1,
    borderRightWidth: 0.5,
    borderRightColor: '#3b82f6',
  },
  thCellLast: {
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.8,
    textAlign: 'center',
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  thCellSession: {
    borderRightWidth: 0.5,
    borderRightColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 1.5,
    paddingHorizontal: 0.5,
  },
  thDateText: {
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.2,
    textAlign: 'center',
  },
  thSessionText: {
    color: '#bfdbfe',
    fontFamily: 'Helvetica-Bold',
    fontSize: 5.5,
    textAlign: 'center',
    marginTop: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#cbd5e1',
    borderLeftWidth: 0.75,
    borderLeftColor: '#cbd5e1',
    borderRightWidth: 0.75,
    borderRightColor: '#cbd5e1',
    minHeight: 14,
    alignItems: 'center',
  },
  tableRowEven: {
    backgroundColor: '#f8fafc',
  },
  tdCell: {
    fontSize: 7,
    paddingVertical: 1.5,
    paddingHorizontal: 1,
    borderRightWidth: 0.5,
    borderRightColor: '#e2e8f0',
    textAlign: 'center',
  },
  tdCellLeft: {
    fontSize: 7,
    paddingVertical: 1.5,
    paddingHorizontal: 3,
    borderRightWidth: 0.5,
    borderRightColor: '#e2e8f0',
    textAlign: 'left',
  },
  tdCellLast: {
    fontSize: 7,
    paddingVertical: 1.5,
    paddingHorizontal: 1,
    textAlign: 'center',
  },
  monoText: {
    fontFamily: 'Courier',
    fontSize: 6.8,
    fontWeight: 'bold',
  },
  statusPresent: {
    color: '#14532d',
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
  },
  statusAbsent: {
    color: '#991b1b',
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
  },
  statusOther: {
    color: '#78350f',
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.2,
  },
  statusEmpty: {
    color: '#94a3b8',
    fontSize: 7,
  },
  summaryTotalsRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderTopWidth: 1,
    borderTopColor: '#94a3b8',
    borderBottomWidth: 0.75,
    borderBottomColor: '#cbd5e1',
    borderLeftWidth: 0.75,
    borderLeftColor: '#cbd5e1',
    borderRightWidth: 0.75,
    borderRightColor: '#cbd5e1',
    minHeight: 15,
    alignItems: 'center',
  },
  signaturesBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 10,
    paddingTop: 8,
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

const MAX_SESSIONS_PER_CHUNK = 10;
const PRINTABLE_WIDTH = 551.28; // 595.28 (A4 portrait width) - 44 (22pt horizontal padding each side)

// Helper to format short date string for table headers (DD/MM or DD/MM/YYYY for wide session columns)
function formatShortDate(dateStr, colWidth) {
  if (!dateStr) return '—';
  if (colWidth >= 75) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return `${dateStr.slice(8, 10)}/${dateStr.slice(5, 7)}/${dateStr.slice(0, 4)}`;
    }
  }
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(dateStr)) {
    return dateStr.slice(0, 5).replace('-', '/');
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return `${dateStr.slice(8, 10)}/${dateStr.slice(5, 7)}`;
  }
  return dateStr.length > 5 ? dateStr.slice(0, 5) : dateStr;
}

// Adaptive column-width sizing based on session count
function getAdaptiveColumnWidths(sessionCount) {
  const N = Math.max(0, sessionCount);

  if (N === 0) {
    const colSNo = 22;
    const colRoll = 84;
    const colCond = 30;
    const colPres = 30;
    const colAbs = 30;
    const colPct = 35.28;
    const colName = PRINTABLE_WIDTH - (colSNo + colRoll + colCond + colPres + colAbs + colPct);
    return { colSNo, colRoll, colName, sessionCol: 0, colCond, colPres, colAbs, colPct };
  }

  const t = Math.min(1, Math.max(0, (N - 1) / 9));

  const colSNo = Math.round(22 - 4 * t);
  const colRoll = Math.round(84 - 14 * t);
  const colCond = Math.round(32 - 10 * t);
  const colPres = Math.round(30 - 8 * t);
  const colAbs = Math.round(30 - 8 * t);
  const colPct = Math.round(34 - 9 * t);

  const targetNameWidth = Math.round(210 - 88 * t);
  const fixedExceptNameAndSessions = colSNo + colRoll + colCond + colPres + colAbs + colPct;
  const availableForNameAndSessions = PRINTABLE_WIDTH - fixedExceptNameAndSessions;

  const availableForSessions = availableForNameAndSessions - targetNameWidth;
  const sessionCol = Math.floor((availableForSessions / N) * 100) / 100;
  const colName = Math.round((availableForNameAndSessions - (sessionCol * N)) * 100) / 100;

  return { colSNo, colRoll, colName, sessionCol, colCond, colPres, colAbs, colPct };
}

export default function FullAttendanceExportPDF({
  logoUrl,
  collegeName = 'KU College of Engineering & Technology',
  universityName = 'Kakatiya University Campus, Warangal – 506009, Telangana, India',
  branch,
  semester,
  subjectCode,
  subjectName,
  academicYear,
  facultyName,
  generationTimestamp,
  reportPeriod,
  totalConducted = 0,
  overallPercentage = 0,
  distinctDatesCount,
  sessions = [],
  students = [],
  sessionStats = {},
}) {
  // 1. Partition sessions horizontally into readable A4 portrait batches
  const sessionChunks = [];
  if (sessions.length === 0) {
    sessionChunks.push([]);
  } else {
    for (let i = 0; i < sessions.length; i += MAX_SESSIONS_PER_CHUNK) {
      sessionChunks.push(sessions.slice(i, i + MAX_SESSIONS_PER_CHUNK));
    }
  }

  // 2. Analytics aggregations
  const totalEnrolled = students.length;
  const grandTotalPresent = students.reduce((acc, st) => acc + (st.totalPresent || 0), 0);
  const grandTotalAbsent = students.reduce((acc, st) => acc + (st.totalAbsent || 0), 0);
  const atRiskStudents = students.filter(st => (st.percentage ?? 0) < 75).length;
  const onTrackStudents = totalEnrolled - atRiskStudents;

  // Format attendance period description
  let periodDisplay = reportPeriod;
  if (!periodDisplay) {
    if (sessions.length === 0) {
      periodDisplay = 'No Sessions Conducted';
    } else if (sessions.length === 1) {
      periodDisplay = `${sessions[0].displayDate || sessions[0].date} (Session S${sessions[0].session || 1})`;
    } else {
      const first = sessions[0];
      const last = sessions[sessions.length - 1];
      periodDisplay = `${first.displayDate || first.date} to ${last.displayDate || last.date}`;
    }
  }

  // 3. Render Pages for each session chunk
  const pages = sessionChunks.map((chunkSessions, chunkIdx) => {
    const isMultiChunk = sessionChunks.length > 1;
    const { colSNo, colRoll, colName, sessionCol, colCond, colPres, colAbs, colPct } = getAdaptiveColumnWidths(chunkSessions.length);

    const startSessionNum = chunkIdx * MAX_SESSIONS_PER_CHUNK + 1;
    const endSessionNum = chunkIdx * MAX_SESSIONS_PER_CHUNK + chunkSessions.length;
    const chunkNoticeText = isMultiChunk
      ? `Attendance Register • Part ${chunkIdx + 1} of ${sessionChunks.length}: Sessions ${startSessionNum} to ${endSessionNum} of ${sessions.length} Conducted Classes`
      : null;

    // Helper to render individual student rows
    const renderRow = (st, idx) => {
      const isEven = idx % 2 === 1;
      const rowStyle = [styles.tableRow, isEven ? styles.tableRowEven : null];
      const pct = st.percentage ?? 0;
      const pctColor = pct >= 75 ? '#15803d' : pct >= 65 ? '#b45309' : '#b91c1c';

      return h(
        View,
        { key: st.student_id || st.roll_no || idx, style: rowStyle },
        h(Text, { style: [styles.tdCell, { width: colSNo }] }, String(idx + 1)),
        h(Text, { style: [styles.tdCell, styles.monoText, { width: colRoll }] }, st.roll_no || '—'),
        h(
          Text,
          { style: [styles.tdCellLeft, { width: colName }], numberOfLines: 1 },
          st.name || '—'
        ),
        ...chunkSessions.map((s, sIdx) => {
          const status = st.records ? st.records[s.key] : null;
          const isPresent = status === 'PRESENT';
          const isAbsent = status === 'ABSENT';
          const isOther = status && !isPresent && !isAbsent;

          const cellStyle = isPresent
            ? styles.statusPresent
            : isAbsent
            ? styles.statusAbsent
            : isOther
            ? styles.statusOther
            : styles.statusEmpty;

          const letter = isPresent
            ? 'P'
            : isAbsent
            ? 'A'
            : isOther
            ? (status === 'NCC' ? 'OD' : status === 'MEDICAL' ? 'M' : 'OD')
            : '-';

          return h(
            Text,
            {
              key: `cell-${st.student_id || idx}-${s.key || sIdx}`,
              style: [styles.tdCell, cellStyle, { width: sessionCol }],
            },
            letter
          );
        }),
        h(Text, { style: [styles.tdCell, { width: colCond, fontFamily: 'Helvetica-Bold' }] }, String(totalConducted)),
        h(Text, { style: [styles.tdCell, { width: colPres, color: '#16a34a', fontFamily: 'Helvetica-Bold' }] }, String(st.totalPresent ?? 0)),
        h(Text, { style: [styles.tdCell, { width: colAbs, color: '#dc2626', fontFamily: 'Helvetica-Bold' }] }, String(st.totalAbsent ?? 0)),
        h(Text, { style: [styles.tdCellLast, { width: colPct, color: pctColor, fontFamily: 'Helvetica-Bold' }] }, `${pct}%`)
      );
    };

    // Table Header Row (Repeats automatically on continuation pages)
    const headerRow = h(
      View,
      { style: styles.tableHeaderRow, fixed: true },
      h(Text, { style: [styles.thCell, { width: colSNo }] }, '#'),
      h(Text, { style: [styles.thCell, { width: colRoll }] }, 'Roll Number'),
      h(Text, { style: [styles.thCell, { width: colName, textAlign: 'left', paddingLeft: 4 }] }, 'Student Name'),
      ...chunkSessions.map((s, sIdx) =>
        h(
          View,
          { key: `th-s-${s.key || sIdx}`, style: [styles.thCellSession, { width: sessionCol }] },
          h(Text, { style: styles.thDateText }, formatShortDate(s.displayDate || s.date, sessionCol)),
          h(Text, { style: styles.thSessionText }, sessionCol >= 75 ? `Session S${s.session || 1}` : `S${s.session || 1}`)
        )
      ),
      h(Text, { style: [styles.thCell, { width: colCond }] }, 'Cond'),
      h(Text, { style: [styles.thCell, { width: colPres }] }, 'Pres'),
      h(Text, { style: [styles.thCell, { width: colAbs }] }, 'Abs'),
      h(Text, { style: [styles.thCellLast, { width: colPct }] }, '%')
    );

    // Summary Totals Row
    const summaryTotalsRow = (students.length > 0 && chunkSessions.length > 0)
      ? h(
          View,
          { style: styles.summaryTotalsRow },
          h(Text, { style: [styles.tdCell, { width: colSNo, fontFamily: 'Helvetica-Bold' }] }, 'Σ'),
          h(Text, { style: [styles.tdCell, { width: colRoll, fontFamily: 'Helvetica-Bold' }] }, 'TOTALS'),
          h(Text, { style: [styles.tdCellLeft, { width: colName, fontFamily: 'Helvetica-Bold' }] }, 'Present / Enrolled'),
          ...chunkSessions.map((s, sIdx) => {
            const stat = sessionStats[s.key] || { presentCount: 0, totalCount: totalEnrolled };
            return h(
              Text,
              {
                key: `stat-${s.key || sIdx}`,
                style: [styles.tdCell, { width: sessionCol, color: '#0b3578', fontFamily: 'Helvetica-Bold', fontSize: 6.2 }],
              },
              `${stat.presentCount}/${totalEnrolled}`
            );
          }),
          h(Text, { style: [styles.tdCell, { width: colCond, fontFamily: 'Helvetica-Bold' }] }, '—'),
          h(Text, { style: [styles.tdCell, { width: colPres, color: '#16a34a', fontFamily: 'Helvetica-Bold' }] }, String(grandTotalPresent)),
          h(Text, { style: [styles.tdCell, { width: colAbs, color: '#dc2626', fontFamily: 'Helvetica-Bold' }] }, String(grandTotalAbsent)),
          h(Text, { style: [styles.tdCellLast, { width: colPct, color: '#0b3578', fontFamily: 'Helvetica-Bold' }] }, `${overallPercentage}%`)
        )
      : null;

    // Signatures Block
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

    // Orphan Prevention Partition:
    // When roster has more than 5 students, keep the trailing 3 rows + summaryTotalsRow + signaturesBlock
    // atomically grouped inside wrap={false} within the single table container.
    const K = students.length > 5 ? 3 : 0;
    const mainStudents = students.slice(0, students.length - K);
    const trailingStudents = students.slice(students.length - K);

    return h(
      Page,
      {
        key: `session-chunk-${chunkIdx}`,
        size: 'A4',
        orientation: 'portrait',
        style: styles.page,
      },

      // Section 1: Institutional Header
      h(
        View,
        { style: styles.header },
        logoUrl ? h(Image, { src: logoUrl, style: styles.logo }) : null,
        h(
          View,
          { style: styles.headerText },
          h(Text, { style: styles.collegeTitle }, collegeName),
          h(Text, { style: styles.universitySubtitle }, universityName),
          h(
            Text,
            { style: styles.reportTitle },
            `Department of ${branch || 'Engineering'} — Official Semester Attendance Register`
          )
        )
      ),

      // Section 2: Academic Context Metadata Grid
      h(
        View,
        { style: styles.metaGrid },
        h(
          View,
          { style: styles.metaColWide },
          h(Text, { style: styles.metaLabel }, 'Subject'),
          h(Text, { style: styles.metaValue }, `${subjectName || 'Subject'} (${subjectCode || 'CODE'})`)
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
          { style: styles.metaColWide },
          h(Text, { style: styles.metaLabel }, 'Course Faculty'),
          h(Text, { style: styles.metaValue }, facultyName || 'Course Faculty')
        ),
        h(
          View,
          { style: styles.metaColWide },
          h(Text, { style: styles.metaLabel }, 'Attendance Period (Conducted Dates)'),
          h(Text, { style: styles.metaValue }, periodDisplay)
        ),
        h(
          View,
          { style: styles.metaCol },
          h(Text, { style: styles.metaLabel }, 'Report Generated'),
          h(Text, { style: styles.metaValue }, generationTimestamp || '—')
        ),
        h(
          View,
          { style: styles.metaCol },
          h(Text, { style: styles.metaLabel }, 'Record Status'),
          h(Text, { style: styles.badgePublished }, 'OFFICIAL RECORD')
        )
      ),

      // Section 3: Summary Statistics Bar
      h(
        View,
        { style: styles.summaryBar },
        h(
          View,
          { style: styles.summaryItem },
          h(Text, { style: styles.summaryLabel }, 'Total Enrolled'),
          h(Text, { style: styles.summaryValue }, `${totalEnrolled} Students`)
        ),
        h(
          View,
          { style: styles.summaryItem },
          h(Text, { style: styles.summaryLabel }, 'Classes Conducted'),
          h(Text, { style: styles.summaryValue }, distinctDatesCount ? `${totalConducted} (${distinctDatesCount} Days)` : `${totalConducted} Sessions`)
        ),
        h(
          View,
          { style: styles.summaryItem },
          h(Text, { style: styles.summaryLabel }, 'Overall Attendance'),
          h(
            Text,
            {
              style: [
                styles.summaryValue,
                { color: overallPercentage >= 75 ? '#15803d' : overallPercentage >= 65 ? '#b45309' : '#b91c1c' },
              ],
            },
            `${overallPercentage}%`
          )
        ),
        h(
          View,
          { style: styles.summaryItem },
          h(Text, { style: styles.summaryLabel }, 'On Track (≥ 75%)'),
          h(Text, { style: [styles.summaryValue, { color: '#15803d' }] }, `${onTrackStudents}`)
        ),
        h(
          View,
          { style: styles.summaryItem },
          h(Text, { style: styles.summaryLabel }, 'Condonation Alert (< 75%)'),
          h(
            Text,
            {
              style: [
                styles.summaryValue,
                { color: atRiskStudents > 0 ? '#b91c1c' : '#15803d' },
              ],
            },
            `${atRiskStudents}`
          )
        )
      ),

      // Section 4: Chunk Part Banner (if multi-chunk horizontal overflow)
      chunkNoticeText ? h(Text, { style: styles.chunkNotice }, chunkNoticeText) : null,

      // Section 5: Unified Table & Signature Container
      h(
        View,
        { style: styles.tableContainer },
        headerRow,
        mainStudents.length === 0 && trailingStudents.length === 0
          ? h(
              View,
              { style: styles.tableRow },
              h(
                Text,
                { style: [styles.tdCell, { width: '100%', color: '#64748b', fontStyle: 'italic', paddingVertical: 8 }] },
                'No student attendance records recorded for this subject assignment.'
              )
            )
          : mainStudents.map((st, idx) => renderRow(st, idx)),
        trailingStudents.length > 0
          ? h(
              View,
              { wrap: false },
              trailingStudents.map((st, idx) => renderRow(st, mainStudents.length + idx)),
              summaryTotalsRow,
              signaturesBlock
            )
          : signaturesBlock
      ),

      // Section 6: Fixed Page Footer on all pages
      h(
        View,
        { style: styles.pageFooter, fixed: true },
        h(
          Text,
          { style: styles.footerText },
          `KUCET CMS • Official Semester Attendance Register • Generated: ${generationTimestamp || new Date().toLocaleString()}`
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
    );
  });

  return h(
    Document,
    { title: `Attendance_Register_${subjectCode || 'SUBJECT'}_${branch || 'ALL'}_Sem${semester || ''}` },
    pages
  );
}
