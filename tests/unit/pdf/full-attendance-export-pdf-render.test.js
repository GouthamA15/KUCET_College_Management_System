import { describe, it, expect } from 'vitest';
import React from 'react';
import { pdf } from '@react-pdf/renderer';
import FullAttendanceExportPDF from '@/pdf/templates/FullAttendanceExportPDF';
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
});
