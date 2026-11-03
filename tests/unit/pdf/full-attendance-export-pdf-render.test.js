import { describe, it, expect } from 'vitest';
import React from 'react';
import { pdf } from '@react-pdf/renderer';
import FullAttendanceExportPDF from '@/pdf/templates/FullAttendanceExportPDF';
import AttendanceSessionPDF from '@/pdf/templates/AttendanceSessionPDF';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function renderToBuffer(doc) {
  const stream = await pdf(doc).toBuffer();
  if (Buffer.isBuffer(stream)) return stream;
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function getPdfInfo(buffer) {
  const tmpPath = path.join(os.tmpdir(), `test-pdf-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  fs.writeFileSync(tmpPath, buffer);
  try {
    const output = execSync(`pdfinfo "${tmpPath}"`).toString();
    const pagesMatch = output.match(/Pages:\s+(\d+)/);
    const sizeMatch = output.match(/Page size:\s+([^\n]+)/);
    return {
      pages: pagesMatch ? parseInt(pagesMatch[1], 10) : null,
      pageSize: sizeMatch ? sizeMatch[1].trim() : null,
    };
  } finally {
    try {
      fs.unlinkSync(tmpPath);
    } catch (_cleanupErr) {
      // Ignored
    }
  }
}

function getPdfText(buffer) {
  const tmpPath = path.join(os.tmpdir(), `test-pdf-text-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  fs.writeFileSync(tmpPath, buffer);
  try {
    return execSync(`pdftotext "${tmpPath}" -`).toString();
  } finally {
    try {
      fs.unlinkSync(tmpPath);
    } catch (_cleanupErr) {
      // Ignored
    }
  }
}

describe('Full Attendance Export PDF Template Rendering Pipeline', () => {
  it('renders a multi-session, multi-student portrait A4 PDF buffer successfully', async () => {
    const sessions = [
      { key: '2026-09-01__1', date: '2026-09-01', session: 1, displayDate: '01-09-2026', topic_covered: 'Unit 1 Introduction' },
      { key: '2026-09-02__2', date: '2026-09-02', session: 2, displayDate: '02-09-2026', topic_covered: 'Process Scheduling' },
      { key: '2026-09-03__1', date: '2026-09-03', session: 1, displayDate: '03-09-2026', topic_covered: 'Threads & Concurrency' },
    ];

    const students = [
      {
        student_id: 1,
        roll_no: '24567T0901',
        name: 'A. Sucharitha',
        records: {
          '2026-09-01__1': 'PRESENT',
          '2026-09-02__2': 'PRESENT',
          '2026-09-03__1': 'ABSENT',
        },
        totalPresent: 2,
        totalAbsent: 1,
        percentage: 67,
      },
      {
        student_id: 2,
        roll_no: '24567T0902',
        name: 'B. Rahul',
        records: {
          '2026-09-01__1': 'PRESENT',
          '2026-09-02__2': 'PRESENT',
          '2026-09-03__1': 'PRESENT',
        },
        totalPresent: 3,
        totalAbsent: 0,
        percentage: 100,
      },
      {
        student_id: 3,
        roll_no: '24567T0903',
        name: 'C. Sneha',
        records: {
          '2026-09-01__1': 'ABSENT',
          '2026-09-02__2': 'ABSENT',
          '2026-09-03__1': 'ABSENT',
        },
        totalPresent: 0,
        totalAbsent: 3,
        percentage: 0,
      },
    ];

    const sessionStats = {
      '2026-09-01__1': { presentCount: 2, totalCount: 3, percentage: 67 },
      '2026-09-02__2': { presentCount: 2, totalCount: 3, percentage: 67 },
      '2026-09-03__1': { presentCount: 1, totalCount: 3, percentage: 33 },
    };

    const doc = React.createElement(FullAttendanceExportPDF, {
      logoUrl: null,
      collegeName: 'KU College of Engineering & Technology',
      universityName: 'Kakatiya University Campus, Warangal – 506009',
      branch: 'CSE',
      semester: 5,
      subjectCode: 'CS301',
      subjectName: 'Operating Systems',
      academicYear: '2026-2027',
      facultyName: 'Dr. P. Sannith',
      generationTimestamp: '28-10-2026 • 05:30 PM',
      reportPeriod: '01-09-2026 to 03-09-2026 (3 Sessions)',
      totalConducted: 3,
      overallPercentage: 56,
      sessions,
      students,
      sessionStats,
    });

    const buffer = await renderToBuffer(doc);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100);
    expect(buffer.toString('utf-8', 0, 5)).toBe('%PDF-');

    const info = getPdfInfo(buffer);
    expect(info.pages).toBe(1);
    expect(info.pageSize).toContain('595.28 x 841.89');
  }, 20000);

  it('generates a clean 2-page report for 65 students and 10 sessions in A4 portrait', async () => {
    const sessions = Array.from({ length: 10 }, (_, i) => ({
      key: `2026-09-${String(i + 1).padStart(2, '0')}__1`,
      date: `2026-09-${String(i + 1).padStart(2, '0')}`,
      session: 1,
      displayDate: `${String(i + 1).padStart(2, '0')}-09-2026`,
      topic_covered: `Session ${i + 1}`,
    }));

    const students = Array.from({ length: 65 }, (_, i) => ({
      student_id: i + 1,
      roll_no: `24567T09${String(i + 1).padStart(2, '0')}`,
      name: `Student Long Name ${i + 1}`,
      totalPresent: 8,
      totalAbsent: 2,
      percentage: 80,
      records: sessions.reduce((acc, s) => {
        acc[s.key] = i % 5 === 0 ? 'ABSENT' : 'PRESENT';
        return acc;
      }, {}),
    }));

    const sessionStats = sessions.reduce((acc, s) => {
      acc[s.key] = { presentCount: 52, totalCount: 65, percentage: 80 };
      return acc;
    }, {});

    const doc = React.createElement(FullAttendanceExportPDF, {
      branch: 'CSE',
      semester: 5,
      subjectCode: 'CS301',
      subjectName: 'Operating Systems',
      academicYear: '2026-2027',
      facultyName: 'Dr. Faculty',
      generationTimestamp: '03-11-2026 • 08:00 AM',
      reportPeriod: '01-09-2026 to 10-09-2026 (10 Sessions / 10 Teaching Days)',
      totalConducted: 10,
      overallPercentage: 80,
      sessions,
      students,
      sessionStats,
    });

    const buffer = await renderToBuffer(doc);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.toString('utf-8', 0, 5)).toBe('%PDF-');

    const info = getPdfInfo(buffer);
    // Dynamic pagination must generate exactly 2 pages for 65 students, not 4
    expect(info.pages).toBe(2);
    expect(info.pageSize).toContain('595.28 x 841.89');
  }, 25000);

  it('generates a clean report for full 75-student batch (regular + lateral entries) in A4 portrait', async () => {
    const sessions = Array.from({ length: 10 }, (_, i) => ({
      key: `2026-09-${String(i + 1).padStart(2, '0')}__1`,
      date: `2026-09-${String(i + 1).padStart(2, '0')}`,
      session: 1,
      displayDate: `${String(i + 1).padStart(2, '0')}-09-2026`,
      topic_covered: `Session ${i + 1}`,
    }));

    const regular = Array.from({ length: 65 }, (_, i) => ({
      student_id: i + 1,
      roll_no: `24567T09${String(i + 1).padStart(2, '0')}`,
      name: `Regular Student ${i + 1}`,
      totalPresent: 8,
      totalAbsent: 2,
      percentage: 80,
      records: sessions.reduce((acc, s) => {
        acc[s.key] = i % 5 === 0 ? 'ABSENT' : 'PRESENT';
        return acc;
      }, {}),
    }));

    const lateral = Array.from({ length: 10 }, (_, i) => ({
      student_id: 65 + i + 1,
      roll_no: `2556709${String(i + 1).padStart(2, '0')}L`,
      name: `Lateral Student ${i + 1}`,
      totalPresent: 9,
      totalAbsent: 1,
      percentage: 90,
      records: sessions.reduce((acc, s) => {
        acc[s.key] = 'PRESENT';
        return acc;
      }, {}),
    }));

    const all75 = [...regular, ...lateral];
    const sessionStats = sessions.reduce((acc, s) => {
      acc[s.key] = { presentCount: 65, totalCount: 75, percentage: 87 };
      return acc;
    }, {});

    const doc = React.createElement(FullAttendanceExportPDF, {
      branch: 'CSE',
      semester: 3,
      subjectCode: 'CS201',
      subjectName: 'Data Structures',
      academicYear: '2026-2027',
      facultyName: 'Dr. Faculty',
      generationTimestamp: '03-11-2026 • 08:00 AM',
      reportPeriod: '01-09-2026 to 10-09-2026 (10 Sessions / 10 Teaching Days)',
      totalConducted: 10,
      overallPercentage: 81,
      sessions,
      students: all75,
      sessionStats,
    });

    const buffer = await renderToBuffer(doc);
    expect(buffer).toBeInstanceOf(Buffer);

    const info = getPdfInfo(buffer);
    expect(info.pages).toBe(2);
    expect(info.pageSize).toContain('595.28 x 841.89');
  }, 25000);

  it('handles horizontal chunking cleanly when sessions exceed 10 (e.g. 25 sessions)', async () => {
    const sessions = Array.from({ length: 25 }, (_, i) => ({
      key: `2026-09-${String(i + 1).padStart(2, '0')}__1`,
      date: `2026-09-${String(i + 1).padStart(2, '0')}`,
      session: 1,
      displayDate: `${String(i + 1).padStart(2, '0')}-09-2026`,
      topic_covered: `Lecture ${i + 1}`,
    }));

    const students = Array.from({ length: 65 }, (_, i) => ({
      student_id: i + 1,
      roll_no: `24567T09${String(i + 1).padStart(2, '0')}`,
      name: `Student Name ${i + 1}`,
      records: sessions.reduce((acc, s) => {
        acc[s.key] = 'PRESENT';
        return acc;
      }, {}),
      totalPresent: 25,
      totalAbsent: 0,
      percentage: 100,
    }));

    const sessionStats = sessions.reduce((acc, s) => {
      acc[s.key] = { presentCount: 65, totalCount: 65, percentage: 100 };
      return acc;
    }, {});

    const doc = React.createElement(FullAttendanceExportPDF, {
      branch: 'ECE',
      semester: 3,
      subjectCode: 'EC201',
      subjectName: 'Signals & Systems',
      academicYear: '2026-2027',
      facultyName: 'Prof. Rao',
      generationTimestamp: '28-10-2026 • 06:00 PM',
      reportPeriod: '01-09-2026 to 25-09-2026 (25 Sessions)',
      totalConducted: 25,
      overallPercentage: 100,
      sessions,
      students,
      sessionStats,
    });

    const buffer = await renderToBuffer(doc);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.toString('utf-8', 0, 5)).toBe('%PDF-');

    const info = getPdfInfo(buffer);
    // 25 sessions partitioned into 3 parts (10 + 10 + 5 sessions), each taking 2 pages for 65 students = 6 pages
    expect(info.pages).toBe(6);
    expect(info.pageSize).toContain('595.28 x 841.89');
  }, 30000);

  it('handles large cohorts (150 students) dynamically across pages without data loss', async () => {
    const sessions = Array.from({ length: 8 }, (_, i) => ({
      key: `2026-09-${String(i + 1).padStart(2, '0')}__1`,
      date: `2026-09-${String(i + 1).padStart(2, '0')}`,
      session: 1,
      displayDate: `${String(i + 1).padStart(2, '0')}-09-2026`,
      topic_covered: `Session ${i + 1}`,
    }));

    const students = Array.from({ length: 150 }, (_, i) => ({
      student_id: i + 1,
      roll_no: `24567T09${String(i + 1).padStart(3, '0')}`,
      name: `Cohort Student ${i + 1}`,
      totalPresent: 6,
      totalAbsent: 2,
      percentage: 75,
      records: sessions.reduce((acc, s) => {
        acc[s.key] = 'PRESENT';
        return acc;
      }, {}),
    }));

    const doc = React.createElement(FullAttendanceExportPDF, {
      branch: 'CSE',
      semester: 1,
      subjectCode: 'CS101',
      subjectName: 'Problem Solving',
      academicYear: '2026-2027',
      facultyName: 'Dr. Faculty',
      generationTimestamp: '03-11-2026 • 08:00 AM',
      reportPeriod: '01-09-2026 to 08-09-2026 (8 Sessions)',
      totalConducted: 8,
      overallPercentage: 75,
      sessions,
      students,
      sessionStats: {},
    });

    const buffer = await renderToBuffer(doc);
    expect(buffer).toBeInstanceOf(Buffer);

    const info = getPdfInfo(buffer);
    // 150 students comfortably fits across 4 portrait pages
    expect(info.pages).toBe(4);
    expect(info.pageSize).toContain('595.28 x 841.89');
  }, 25000);

  it('renders gracefully when zero sessions are conducted', async () => {
    const students = [
      { student_id: 1, roll_no: '24567T0901', name: 'Student 1', totalPresent: 0, totalAbsent: 0, percentage: 0, records: {} }
    ];

    const doc = React.createElement(FullAttendanceExportPDF, {
      branch: 'CSE',
      semester: 1,
      subjectCode: 'CS101',
      subjectName: 'Problem Solving',
      academicYear: '2026-2027',
      facultyName: 'Dr. Faculty',
      generationTimestamp: '03-11-2026 • 08:00 AM',
      totalConducted: 0,
      overallPercentage: 0,
      sessions: [],
      students,
      sessionStats: {},
    });

    const buffer = await renderToBuffer(doc);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.toString('utf-8', 0, 5)).toBe('%PDF-');

    const info = getPdfInfo(buffer);
    expect(info.pages).toBe(1);
    expect(info.pageSize).toContain('595.28 x 841.89');
  });

  // --- PDF TEST MATRIX SCENARIOS (Requirement 11 & Subject Category Coverage) ---

  it('renders 65 students with 1 session with adaptive portrait column widths and no excessive whitespace', async () => {
    const session1 = [{ key: '2026-09-01__1', date: '2026-09-01', session: 1, displayDate: '01-09-2026', topic_covered: 'Introduction' }];
    const students = Array.from({ length: 65 }, (_, i) => ({
      student_id: i + 1,
      roll_no: `24567T09${String(i + 1).padStart(2, '0')}`,
      name: `Student Name ${i + 1}`,
      totalPresent: i % 4 === 0 ? 0 : 1,
      totalAbsent: i % 4 === 0 ? 1 : 0,
      percentage: i % 4 === 0 ? 0 : 100,
      records: { '2026-09-01__1': i % 4 === 0 ? 'ABSENT' : 'PRESENT' },
    }));

    const doc = React.createElement(FullAttendanceExportPDF, {
      branch: 'CSE',
      semester: 5,
      subjectCode: 'CS501',
      subjectName: 'Software Engineering',
      subjectCategory: 'Theory',
      academicYear: '2026-2027',
      facultyName: 'Dr. Faculty',
      generationTimestamp: '03-11-2026 • 10:00 AM',
      reportPeriod: '01-09-2026 (1 Session)',
      totalConducted: 1,
      overallPercentage: 75,
      sessions: session1,
      students,
      sessionStats: { '2026-09-01__1': { presentCount: 49, totalCount: 65, percentage: 75 } },
    });

    const buffer = await renderToBuffer(doc);
    expect(buffer).toBeInstanceOf(Buffer);

    const info = getPdfInfo(buffer);
    expect(info.pages).toBe(2);
    expect(info.pageSize).toContain('595.28 x 841.89');

    const text = getPdfText(buffer);
    expect(text).toContain('Software Engineering');
    expect(text).toContain('Theory');
    expect(text).toContain('24567T0901');
    expect(text).toContain('24567T0965');
  }, 25000);

  it('renders 75 students (regular + lateral) with 1 session for Practical / Laboratory subject', async () => {
    const session1 = [{ key: '2026-09-01__1', date: '2026-09-01', session: 1, displayDate: '01-09-2026', topic_covered: 'Lab Exp 1' }];
    const regular = Array.from({ length: 65 }, (_, i) => ({
      student_id: i + 1,
      roll_no: `24567T09${String(i + 1).padStart(2, '0')}`,
      name: `Regular Student ${i + 1}`,
      totalPresent: 1,
      totalAbsent: 0,
      percentage: 100,
      records: { '2026-09-01__1': 'PRESENT' },
    }));
    const lateral = Array.from({ length: 10 }, (_, i) => ({
      student_id: 65 + i + 1,
      roll_no: `2556709${String(i + 1).padStart(2, '0')}L`,
      name: `Lateral Student ${i + 1}`,
      totalPresent: 1,
      totalAbsent: 0,
      percentage: 100,
      records: { '2026-09-01__1': 'PRESENT' },
    }));
    const all75 = [...regular, ...lateral];

    const doc = React.createElement(FullAttendanceExportPDF, {
      branch: 'CSE',
      semester: 5,
      subjectCode: 'CS502L',
      subjectName: 'Compiler Design Lab',
      subjectCategory: 'Practical / Laboratory',
      academicYear: '2026-2027',
      facultyName: 'Dr. Lab Incharge',
      generationTimestamp: '03-11-2026 • 10:00 AM',
      reportPeriod: '01-09-2026 (1 Session)',
      totalConducted: 1,
      overallPercentage: 100,
      sessions: session1,
      students: all75,
      sessionStats: { '2026-09-01__1': { presentCount: 75, totalCount: 75, percentage: 100 } },
    });

    const buffer = await renderToBuffer(doc);
    const info = getPdfInfo(buffer);
    expect(info.pages).toBe(2);
    expect(info.pageSize).toContain('595.28 x 841.89');

    const text = getPdfText(buffer);
    expect(text).toContain('Compiler Design Lab');
    expect(text).toContain('Practical / Laboratory');
    expect(text).toContain('255670910L');
  }, 25000);

  it('renders 75 students with 3 sessions with compact readable distribution', async () => {
    const sessions = Array.from({ length: 3 }, (_, i) => ({
      key: `2026-09-0${i + 1}__1`,
      date: `2026-09-0${i + 1}`,
      session: 1,
      displayDate: `0${i + 1}-09-2026`,
      topic_covered: `Session ${i + 1}`,
    }));
    const students = Array.from({ length: 75 }, (_, i) => ({
      student_id: i + 1,
      roll_no: `24567T09${String(i + 1).padStart(2, '0')}`,
      name: `Student ${i + 1}`,
      totalPresent: 2,
      totalAbsent: 1,
      percentage: 67,
      records: {
        '2026-09-01__1': 'PRESENT',
        '2026-09-02__1': 'PRESENT',
        '2026-09-03__1': 'ABSENT',
      },
    }));

    const doc = React.createElement(FullAttendanceExportPDF, {
      branch: 'MECH',
      semester: 4,
      subjectCode: 'ME401',
      subjectName: 'Thermodynamics',
      subjectCategory: 'Theory',
      academicYear: '2026-2027',
      facultyName: 'Prof. Sharma',
      generationTimestamp: '03-11-2026 • 10:00 AM',
      reportPeriod: '01-09-2026 to 03-09-2026 (3 Sessions)',
      totalConducted: 3,
      overallPercentage: 67,
      sessions,
      students,
      sessionStats: {},
    });

    const buffer = await renderToBuffer(doc);
    const info = getPdfInfo(buffer);
    expect(info.pages).toBe(2);
    expect(info.pageSize).toContain('595.28 x 841.89');
  }, 25000);

  it('renders 100 students with 10 sessions demonstrating dynamic vertical pagination', async () => {
    const sessions = Array.from({ length: 10 }, (_, i) => ({
      key: `2026-09-${String(i + 1).padStart(2, '0')}__1`,
      date: `2026-09-${String(i + 1).padStart(2, '0')}`,
      session: 1,
      displayDate: `${String(i + 1).padStart(2, '0')}-09-2026`,
      topic_covered: `Session ${i + 1}`,
    }));
    const students = Array.from({ length: 100 }, (_, i) => ({
      student_id: i + 1,
      roll_no: `24567T10${String(i + 1).padStart(3, '0')}`,
      name: `Cohort Student ${i + 1}`,
      totalPresent: 9,
      totalAbsent: 1,
      percentage: 90,
      records: sessions.reduce((acc, s) => {
        acc[s.key] = 'PRESENT';
        return acc;
      }, {}),
    }));

    const doc = React.createElement(FullAttendanceExportPDF, {
      branch: 'EEE',
      semester: 3,
      subjectCode: 'EE301',
      subjectName: 'Network Analysis',
      subjectCategory: 'Theory',
      academicYear: '2026-2027',
      facultyName: 'Dr. Kumar',
      generationTimestamp: '03-11-2026 • 10:00 AM',
      reportPeriod: '01-09-2026 to 10-09-2026 (10 Sessions)',
      totalConducted: 10,
      overallPercentage: 90,
      sessions,
      students,
      sessionStats: {},
    });

    const buffer = await renderToBuffer(doc);
    const info = getPdfInfo(buffer);
    // 100 students fits cleanly across 3 portrait pages
    expect(info.pages).toBe(3);
    expect(info.pageSize).toContain('595.28 x 841.89');

    const text = getPdfText(buffer);
    expect(text).toContain('24567T10001');
    expect(text).toContain('24567T10100');
  }, 25000);

  it('renders 300 students with 8 sessions without missing students or overflow', async () => {
    const sessions = Array.from({ length: 8 }, (_, i) => ({
      key: `2026-09-${String(i + 1).padStart(2, '0')}__1`,
      date: `2026-09-${String(i + 1).padStart(2, '0')}`,
      session: 1,
      displayDate: `${String(i + 1).padStart(2, '0')}-09-2026`,
      topic_covered: `Session ${i + 1}`,
    }));
    const students = Array.from({ length: 300 }, (_, i) => ({
      student_id: i + 1,
      roll_no: `24567T30${String(i + 1).padStart(3, '0')}`,
      name: `Large Cohort Student ${i + 1}`,
      totalPresent: 8,
      totalAbsent: 0,
      percentage: 100,
      records: sessions.reduce((acc, s) => {
        acc[s.key] = 'PRESENT';
        return acc;
      }, {}),
    }));

    const doc = React.createElement(FullAttendanceExportPDF, {
      branch: 'CSE',
      semester: 1,
      subjectCode: 'CS102',
      subjectName: 'Engineering Workshop',
      subjectCategory: 'Practical / Laboratory',
      academicYear: '2026-2027',
      facultyName: 'Prof. Workshop Team',
      generationTimestamp: '03-11-2026 • 10:00 AM',
      reportPeriod: '01-09-2026 to 08-09-2026 (8 Sessions)',
      totalConducted: 8,
      overallPercentage: 100,
      sessions,
      students,
      sessionStats: {},
    });

    const buffer = await renderToBuffer(doc);
    const info = getPdfInfo(buffer);
    // 300 students cleanly paginates across 7 or 8 portrait pages
    expect(info.pages).toBeGreaterThanOrEqual(7);
    expect(info.pageSize).toContain('595.28 x 841.89');

    const text = getPdfText(buffer);
    expect(text).toContain('24567T30001');
    expect(text).toContain('24567T30300');
  }, 35000);

  it('renders AttendanceSessionPDF for single session export in portrait A4 for Theory and Lab', async () => {
    const students = Array.from({ length: 65 }, (_, i) => ({
      id: i + 1,
      roll_no: `24567T09${String(i + 1).padStart(2, '0')}`,
      name: `Student Name ${i + 1}`,
      status: i === 0 ? 'NCC' : i === 1 ? 'MEDICAL' : i % 5 === 0 ? 'ABSENT' : 'PRESENT',
    }));

    const doc = React.createElement(AttendanceSessionPDF, {
      subjectName: 'Data Structures Lab',
      subjectCode: 'CS202L',
      subjectCategory: 'Practical / Laboratory',
      branch: 'CSE',
      semester: 3,
      academicYear: '2026-2027',
      facultyName: 'Dr. Faculty',
      attendanceDate: '2026-09-04',
      sessionNumber: 1,
      topicCovered: 'Binary Search Trees Implementation',
      students,
      totalCount: 65,
      presentCount: 50,
      absentCount: 13,
      nccCount: 1,
      medicalCount: 1,
      percentage: 80,
      generatedAt: '04-09-2026 • 11:30 AM',
    });

    const buffer = await renderToBuffer(doc);
    expect(buffer).toBeInstanceOf(Buffer);

    const info = getPdfInfo(buffer);
    expect(info.pages).toBe(2);
    expect(info.pageSize).toContain('595.28 x 841.89');

    const text = getPdfText(buffer);
    expect(text).toContain('Data Structures Lab');
    expect(text).toContain('Practical / Laboratory');
    expect(text).toContain('Binary Search Trees Implementation');
    expect(text).toContain('24567T0901');
    expect(text).toContain('24567T0965');
  }, 25000);

  it('handles horizontal chunking for 11 sessions (border case: 10 + 1 session chunks) for 75 students', async () => {
    const sessions = Array.from({ length: 11 }, (_, i) => ({
      key: `2026-09-${String(i + 1).padStart(2, '0')}__1`,
      date: `2026-09-${String(i + 1).padStart(2, '0')}`,
      session: 1,
      displayDate: `${String(i + 1).padStart(2, '0')}-09-2026`,
      topic_covered: `Lecture ${i + 1}`,
    }));

    const all75 = [
      ...Array.from({ length: 65 }, (_, i) => ({
        student_id: i + 1,
        roll_no: `24567T09${String(i + 1).padStart(2, '0')}`,
        name: `Regular Student ${i + 1}`,
        totalPresent: 11,
        totalAbsent: 0,
        percentage: 100,
        records: sessions.reduce((acc, s) => { acc[s.key] = 'PRESENT'; return acc; }, {}),
      })),
      ...Array.from({ length: 10 }, (_, i) => ({
        student_id: 66 + i,
        roll_no: `2556709${String(i + 1).padStart(2, '0')}L`,
        name: `Lateral Student ${i + 1}`,
        totalPresent: 10,
        totalAbsent: 1,
        percentage: 91,
        records: sessions.reduce((acc, s) => { acc[s.key] = 'PRESENT'; return acc; }, {}),
      })),
    ];

    const sessionStats = sessions.reduce((acc, s) => {
      acc[s.key] = { presentCount: 75, totalCount: 75, percentage: 100 };
      return acc;
    }, {});

    const doc = React.createElement(FullAttendanceExportPDF, {
      branch: 'EEE',
      semester: 5,
      subjectCode: 'EE501',
      subjectName: 'Power Systems Analysis',
      subjectCategory: 'Theory',
      academicYear: '2026-2027',
      facultyName: 'Dr. Electrical Faculty',
      generationTimestamp: '03-11-2026 • 09:00 AM',
      reportPeriod: '01-09-2026 to 11-09-2026 (11 Sessions)',
      totalConducted: 11,
      overallPercentage: 99,
      sessions,
      students: all75,
      sessionStats,
    });

    const buffer = await renderToBuffer(doc);
    expect(buffer).toBeInstanceOf(Buffer);

    const info = getPdfInfo(buffer);
    // 11 sessions partitioned into 2 chunks (10 sessions + 1 session), each chunk taking 2 pages = 4 pages
    expect(info.pages).toBe(4);
    expect(info.pageSize).toContain('595.28 x 841.89');

    const text = getPdfText(buffer);
    expect(text).toContain('Part 1 of 2: Sessions 1 to 10 of 11 Conducted Classes');
    expect(text).toContain('Part 2 of 2: Sessions 11 to 11 of 11 Conducted Classes');
    expect(text).toContain('24567T0901');
    expect(text).toContain('255670910L');
    expect(text).toContain('Power Systems Analysis');
    expect(text).toContain('Head of Department');
  }, 30000);

  it('handles horizontal chunking for 20 sessions (exactly 2 chunks of 10) for 75 students', async () => {
    const sessions = Array.from({ length: 20 }, (_, i) => ({
      key: `2026-09-${String(i + 1).padStart(2, '0')}__1`,
      date: `2026-09-${String(i + 1).padStart(2, '0')}`,
      session: 1,
      displayDate: `${String(i + 1).padStart(2, '0')}-09-2026`,
      topic_covered: `Session ${i + 1}`,
    }));

    const all75 = Array.from({ length: 75 }, (_, i) => ({
      student_id: i + 1,
      roll_no: i < 65 ? `24567T09${String(i + 1).padStart(2, '0')}` : `2556709${String(i - 64).padStart(2, '0')}L`,
      name: `Student ${i + 1}`,
      totalPresent: 20,
      totalAbsent: 0,
      percentage: 100,
      records: sessions.reduce((acc, s) => { acc[s.key] = 'PRESENT'; return acc; }, {}),
    }));

    const doc = React.createElement(FullAttendanceExportPDF, {
      branch: 'MECH',
      semester: 4,
      subjectCode: 'ME401',
      subjectName: 'Thermodynamics',
      subjectCategory: 'Theory',
      academicYear: '2026-2027',
      facultyName: 'Prof. Mechanical',
      totalConducted: 20,
      overallPercentage: 100,
      sessions,
      students: all75,
      sessionStats: {},
    });

    const buffer = await renderToBuffer(doc);
    const info = getPdfInfo(buffer);
    // 20 sessions partitioned into 2 chunks of 10, each chunk taking 2 pages = 4 pages
    expect(info.pages).toBe(4);
    expect(info.pageSize).toContain('595.28 x 841.89');

    const text = getPdfText(buffer);
    expect(text).toContain('Part 1 of 2: Sessions 1 to 10 of 20 Conducted Classes');
    expect(text).toContain('Part 2 of 2: Sessions 11 to 20 of 20 Conducted Classes');
  }, 30000);

  it('handles horizontal chunking for 40 sessions (4 chunks of 10) cleanly for 75 students', async () => {
    const sessions = Array.from({ length: 40 }, (_, i) => ({
      key: `2026-10-${String(i + 1).padStart(2, '0')}__1`,
      date: `2026-10-${String(i + 1).padStart(2, '0')}`,
      session: 1,
      displayDate: `${String(i + 1).padStart(2, '0')}-10-2026`,
      topic_covered: `Class ${i + 1}`,
    }));

    const all75 = Array.from({ length: 75 }, (_, i) => ({
      student_id: i + 1,
      roll_no: i < 65 ? `24567T09${String(i + 1).padStart(2, '0')}` : `2556709${String(i - 64).padStart(2, '0')}L`,
      name: `Student ${i + 1}`,
      totalPresent: 38,
      totalAbsent: 2,
      percentage: 95,
      records: sessions.reduce((acc, s) => { acc[s.key] = 'PRESENT'; return acc; }, {}),
    }));

    const doc = React.createElement(FullAttendanceExportPDF, {
      branch: 'CSE',
      semester: 6,
      subjectCode: 'CS601',
      subjectName: 'Artificial Intelligence',
      subjectCategory: 'Theory',
      academicYear: '2026-2027',
      facultyName: 'Dr. AI Specialist',
      totalConducted: 40,
      overallPercentage: 95,
      sessions,
      students: all75,
      sessionStats: {},
    });

    const buffer = await renderToBuffer(doc);
    const info = getPdfInfo(buffer);
    // 40 sessions partitioned into 4 chunks of 10, each chunk taking 2 pages = 8 pages
    expect(info.pages).toBe(8);
    expect(info.pageSize).toContain('595.28 x 841.89');

    const text = getPdfText(buffer);
    expect(text).toContain('Part 1 of 4: Sessions 1 to 10 of 40 Conducted Classes');
    expect(text).toContain('Part 2 of 4: Sessions 11 to 20 of 40 Conducted Classes');
    expect(text).toContain('Part 3 of 4: Sessions 21 to 30 of 40 Conducted Classes');
    expect(text).toContain('Part 4 of 4: Sessions 31 to 40 of 40 Conducted Classes');
    expect(text).toContain('24567T0901');
    expect(text).toContain('255670910L');
  }, 45000);

  it('renders AttendanceSessionPDF for single session Theory export in portrait A4', async () => {
    const students = Array.from({ length: 65 }, (_, i) => ({
      id: i + 1,
      roll_no: `24567T09${String(i + 1).padStart(2, '0')}`,
      name: `Theory Student ${i + 1}`,
      status: i % 10 === 0 ? 'ABSENT' : i % 25 === 0 ? 'NCC' : 'PRESENT',
    }));

    const doc = React.createElement(AttendanceSessionPDF, {
      subjectName: 'Theory of Computation',
      subjectCode: 'CS301',
      subjectCategory: 'Theory',
      branch: 'CSE',
      semester: 5,
      academicYear: '2026-2027',
      facultyName: 'Dr. Automata Expert',
      date: '03-11-2026',
      session: 2,
      topicCovered: 'Turing Machines and Decidability',
      students,
      totals: {
        total: 65,
        present: 57,
        absent: 6,
        ncc: 2,
        medical: 0,
        percentage: 91,
      },
    });

    const buffer = await renderToBuffer(doc);
    const info = getPdfInfo(buffer);
    expect(info.pages).toBe(2);
    expect(info.pageSize).toContain('595.28 x 841.89');

    const text = getPdfText(buffer);
    expect(text).toContain('Theory of Computation');
    expect(text).toContain('(THEORY)');
    expect(text).toContain('Turing Machines and Decidability');
    expect(text).toContain('Session S2');
    expect(text).toContain('Dr. Automata Expert');
  }, 25000);
});
