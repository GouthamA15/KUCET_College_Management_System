import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
    fontSize: 7.5,
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
    marginBottom: 8,
  },
  logo: {
    width: 38,
    height: 38,
    marginRight: 10,
    objectFit: 'contain',
  },
  headerText: {
    flex: 1,
  },
  collegeTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#0b3578',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  universitySubtitle: {
    fontSize: 7.5,
    fontFamily: 'Helvetica',
    color: '#334155',
    marginTop: 1,
  },
  reportTitle: {
    fontSize: 9,
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
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  metaItem: {
    width: '25%',
    flexDirection: 'row',
    marginBottom: 2,
  },
  metaLabel: {
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
    marginRight: 4,
    fontSize: 7,
  },
  metaValue: {
    fontFamily: 'Helvetica',
    color: '#0f172a',
    fontSize: 7,
  },
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 2,
  },
  tableRowHeader: {
    flexDirection: 'row',
    backgroundColor: '#0b3578',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingVertical: 4,
  },
  tableHeaderCell: {
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    fontSize: 7,
    paddingHorizontal: 3,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 3.5,
  },
  tableRowAlt: {
    backgroundColor: '#f8fafc',
  },
  tableCell: {
    fontSize: 7,
    paddingHorizontal: 3,
    textAlign: 'center',
    color: '#1e293b',
  },
  tableCellLeft: {
    textAlign: 'left',
  },
  badgeCritical: {
    color: '#dc2626',
    fontFamily: 'Helvetica-Bold',
  },
  badgeWarning: {
    color: '#d97706',
    fontFamily: 'Helvetica-Bold',
  },
  badgeGood: {
    color: '#16a34a',
    fontFamily: 'Helvetica-Bold',
  },
  footer: {
    position: 'absolute',
    bottom: 12,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: '#cbd5e1',
    paddingTop: 4,
    fontSize: 6.5,
    color: '#64748b',
  },
});

export default function AcademicMonitoringReportPDF({
  collegeName = 'KU COLLEGE OF ENGINEERING & TECHNOLOGY',
  universityName = 'Kakatiya University Campus, Warangal – 506009, Telangana',
  reportTitle = 'Consolidated Academic Monitoring Report',
  branch = 'CSE',
  semester = 1,
  academicYear = '2026-27',
  generationDate = '',
  logoUrl = null,
  summary = null,
  type = 'combined',
  students = [],
  _subjects = []
}) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Institutional Header */}
        <View style={styles.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
          <View style={styles.headerText}>
            <Text style={styles.collegeTitle}>{collegeName}</Text>
            <Text style={styles.universitySubtitle}>{universityName}</Text>
            <Text style={styles.reportTitle}>{reportTitle}</Text>
          </View>
        </View>

        {/* Metadata Grid */}
        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Academic Year:</Text>
            <Text style={styles.metaValue}>{academicYear}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Branch:</Text>
            <Text style={styles.metaValue}>{branch}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Semester:</Text>
            <Text style={styles.metaValue}>{semester}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Total Students:</Text>
            <Text style={styles.metaValue}>{students.length}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Generated On:</Text>
            <Text style={styles.metaValue}>{generationDate || new Date().toLocaleDateString()}</Text>
          </View>
          {summary && (
            <>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Avg Attendance:</Text>
                <Text style={styles.metaValue}>{summary.average_attendance_percentage}%</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>At Risk (&lt;75%):</Text>
                <Text style={styles.metaValue}>{summary.students_below_75}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Avg CIE:</Text>
                <Text style={styles.metaValue}>{summary.average_cie_marks ?? 'N/A'}/30</Text>
              </View>
            </>
          )}
        </View>

        {/* Data Table */}
        <View style={styles.table}>
          <View style={styles.tableRowHeader}>
            <Text style={[styles.tableHeaderCell, { width: '5%' }]}>#</Text>
            <Text style={[styles.tableHeaderCell, { width: '15%', textAlign: 'left' }]}>Roll Number</Text>
            <Text style={[styles.tableHeaderCell, { width: '22%', textAlign: 'left' }]}>Student Name</Text>
            {type === 'attendance' ? (
              <>
                <Text style={[styles.tableHeaderCell, { width: '10%' }]}>Conducted</Text>
                <Text style={[styles.tableHeaderCell, { width: '10%' }]}>Attended</Text>
                <Text style={[styles.tableHeaderCell, { width: '10%' }]}>Absent</Text>
                <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Attendance %</Text>
                <Text style={[styles.tableHeaderCell, { width: '16%' }]}>Status</Text>
              </>
            ) : type === 'marks' ? (
              <>
                <Text style={[styles.tableHeaderCell, { width: '18%' }]}>Evaluated Subjects</Text>
                <Text style={[styles.tableHeaderCell, { width: '20%' }]}>Average CIE (30)</Text>
                <Text style={[styles.tableHeaderCell, { width: '20%' }]}>Academic Status</Text>
              </>
            ) : (
              <>
                <Text style={[styles.tableHeaderCell, { width: '14%' }]}>Attendance %</Text>
                <Text style={[styles.tableHeaderCell, { width: '14%' }]}>CIE Avg (30)</Text>
                <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Attendance Standing</Text>
                <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Combined Review</Text>
              </>
            )}
          </View>

          {students.map((st, index) => {
            const isAlt = index % 2 === 1;
            const attPct = st.attendance_percentage ?? 0;
            const statusStyle = attPct < 75 ? styles.badgeWarning : styles.badgeGood;

            return (
              <View key={st.id || index} style={[styles.tableRow, isAlt ? styles.tableRowAlt : null]}>
                <Text style={[styles.tableCell, { width: '5%' }]}>{index + 1}</Text>
                <Text style={[styles.tableCell, styles.tableCellLeft, { width: '15%' }]}>{st.roll_no}</Text>
                <Text style={[styles.tableCell, styles.tableCellLeft, { width: '22%' }]}>{st.name}</Text>
                {type === 'attendance' ? (
                  <>
                    <Text style={[styles.tableCell, { width: '10%' }]}>{st.total_sessions}</Text>
                    <Text style={[styles.tableCell, { width: '10%' }]}>{st.attended_sessions}</Text>
                    <Text style={[styles.tableCell, { width: '10%' }]}>{st.absent_count}</Text>
                    <Text style={[styles.tableCell, statusStyle, { width: '12%' }]}>{st.attendance_percentage}%</Text>
                    <Text style={[styles.tableCell, { width: '16%' }]}>{st.status_label}</Text>
                  </>
                ) : type === 'marks' ? (
                  <>
                    <Text style={[styles.tableCell, { width: '18%' }]}>{st.evaluated_subjects_count}</Text>
                    <Text style={[styles.tableCell, { width: '20%' }]}>
                      {st.average_cie_marks !== null ? `${st.average_cie_marks}/30` : 'N/A'}
                    </Text>
                    <Text style={[styles.tableCell, { width: '20%' }]}>{st.status_label}</Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.tableCell, statusStyle, { width: '14%' }]}>{st.attendance_percentage}%</Text>
                    <Text style={[styles.tableCell, { width: '14%' }]}>
                      {st.average_cie_marks !== null ? `${st.average_cie_marks}/30` : 'N/A'}
                    </Text>
                    <Text style={[styles.tableCell, { width: '15%' }]}>{st.attendance_status_label || st.status_label}</Text>
                    <Text style={[styles.tableCell, { width: '15%' }]}>{st.combined_label || 'Good Standing'}</Text>
                  </>
                )}
              </View>
            );
          })}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>KUCET Centralized Academic Monitoring System • Confidential Institutional Record</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
