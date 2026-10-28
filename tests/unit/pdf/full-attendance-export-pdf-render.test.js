import { describe, it, expect } from 'vitest';
import React from 'react';
import { pdf } from '@react-pdf/renderer';
import FullAttendanceExportPDF from '@/pdf/templates/FullAttendanceExportPDF';

describe('Full Attendance Export PDF Template Rendering Pipeline', () => {
  it('renders a multi-session, multi-student landscape PDF buffer successfully', async () => {
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
      reportPeriod: '01-09-2026 to 03-09-2026',
      totalConducted: 3,
      overallPercentage: 56,
      sessions,
      students,
      sessionStats,
    });

    const stream = await pdf(doc).toBuffer();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100);
    // Standard PDF file starts with %PDF-
    expect(buffer.toString('utf-8', 0, 5)).toBe('%PDF-');
  });

  it('handles horizontal chunking when sessions exceed 15 without throwing', async () => {
    // Generate 25 sessions to trigger horizontal chunking across pages
    const sessions = Array.from({ length: 25 }, (_, i) => ({
      key: `2026-09-${String(i + 1).padStart(2, '0')}__1`,
      date: `2026-09-${String(i + 1).padStart(2, '0')}`,
      session: 1,
      displayDate: `${String(i + 1).padStart(2, '0')}-09-2026`,
      topic_covered: `Lecture ${i + 1}`,
    }));

    const students = [
      {
        student_id: 1,
        roll_no: '24567T0901',
        name: 'A. Sucharitha',
        records: sessions.reduce((acc, s) => {
          acc[s.key] = 'PRESENT';
          return acc;
        }, {}),
        totalPresent: 25,
        totalAbsent: 0,
        percentage: 100,
      },
    ];

    const sessionStats = sessions.reduce((acc, s) => {
      acc[s.key] = { presentCount: 1, totalCount: 1, percentage: 100 };
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
      reportPeriod: '01-09-2026 to 25-09-2026',
      totalConducted: 25,
      overallPercentage: 100,
      sessions,
      students,
      sessionStats,
    });

    const stream = await pdf(doc).toBuffer();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.toString('utf-8', 0, 5)).toBe('%PDF-');
  });
});
