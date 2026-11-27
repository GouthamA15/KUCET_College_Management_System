import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  toDateKey,
  findMatchingDispute,
  DisputeStatusActions,
  AttendanceDisputeModal,
  AttendanceDisputeResponseModal,
} from '@/components/student/AttendanceDisputeModal';

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Academic Attendance Timeline — Dispute Integration', () => {
  describe('Date normalization and session-to-dispute matching', () => {
    it('normalizes Date and ISO strings to YYYY-MM-DD without timezone drift', () => {
      expect(toDateKey('2026-11-26')).toBe('2026-11-26');
      expect(toDateKey('2026-11-26T00:00:00.000Z')).toBe('2026-11-26');
      expect(toDateKey(new Date('2026-11-26T00:00:00.000Z'))).toBe('2026-11-26');
      expect(toDateKey(null)).toBe('');
    });

    it('matches disputes strictly on assignmentId, date, and sessionNumber', () => {
      const disputes = [
        { id: 10, assignment_id: 501, attendance_date: '2026-11-25T00:00:00.000Z', session: 2, status: 'PENDING' },
        { id: 11, assignment_id: 502, attendance_date: '2026-11-25', session: 2, status: 'APPROVED' },
      ];

      expect(
        findMatchingDispute(disputes, { assignmentId: 501, date: '2026-11-25', sessionNumber: 2 })?.id
      ).toBe(10);
      expect(
        findMatchingDispute(disputes, { assignmentId: 502, date: '2026-11-25', sessionNumber: 2 })?.id
      ).toBe(11);
      expect(
        findMatchingDispute(disputes, { assignmentId: 501, date: '2026-11-25', sessionNumber: 3 })
      ).toBeNull();
    });
  });

  describe('DisputeStatusActions visibility and status states', () => {
    it('renders Dispute button only for ABSENT without an existing dispute', () => {
      const html = renderToStaticMarkup(
        React.createElement(DisputeStatusActions, {
          status: 'ABSENT',
          existingDispute: null,
          onOpenDispute: () => {},
        })
      );
      expect(html).toContain('>Dispute<');
    });

    it('does not render Dispute action for PRESENT, NCC, MEDICAL, or UNRECORDED', () => {
      for (const status of ['PRESENT', 'NCC', 'MEDICAL', 'UNRECORDED']) {
        const html = renderToStaticMarkup(
          React.createElement(DisputeStatusActions, {
            status,
            existingDispute: null,
            onOpenDispute: () => {},
          })
        );
        expect(html).toBe('');
      }
    });

    it('renders PENDING status with Add Evidence action and no duplicate Dispute button', () => {
      const html = renderToStaticMarkup(
        React.createElement(DisputeStatusActions, {
          status: 'ABSENT',
          existingDispute: { id: 1, status: 'PENDING' },
          onRespond: () => {},
        })
      );
      expect(html).toContain('Dispute pending');
      expect(html).toContain('Add Evidence');
      expect(html).not.toContain('>Dispute<');
    });

    it('renders MORE_INFO_REQUIRED status with Respond action', () => {
      const html = renderToStaticMarkup(
        React.createElement(DisputeStatusActions, {
          status: 'ABSENT',
          existingDispute: { id: 2, status: 'MORE_INFO_REQUIRED' },
          onRespond: () => {},
        })
      );
      expect(html).toContain('Info Requested');
      expect(html).toContain('Respond');
      expect(html).not.toContain('>Dispute<');
    });

    it('renders APPROVED and REJECTED statuses without allowing duplicate submission', () => {
      const approvedHtml = renderToStaticMarkup(
        React.createElement(DisputeStatusActions, {
          status: 'ABSENT',
          existingDispute: { id: 3, status: 'APPROVED' },
        })
      );
      expect(approvedHtml).toContain('Dispute approved');
      expect(approvedHtml).not.toContain('>Dispute<');

      const rejectedHtml = renderToStaticMarkup(
        React.createElement(DisputeStatusActions, {
          status: 'ABSENT',
          existingDispute: { id: 4, status: 'REJECTED' },
        })
      );
      expect(rejectedHtml).toContain('Dispute rejected');
      expect(rejectedHtml).not.toContain('>Dispute<');
    });
  });

  describe('Shared AttendanceDisputeModal & ResponseModal rendering', () => {
    it('renders Request Attendance Correction modal populated with selected session metadata', () => {
      const html = renderToStaticMarkup(
        React.createElement(AttendanceDisputeModal, {
          session: { date: '2026-11-26', sessionNumber: 4 },
          subjectName: 'Computer Networks',
          subjectCode: 'CS501',
          assignmentId: 450014,
          onClose: () => {},
          onSuccess: () => {},
        })
      );
      expect(html).toContain('Request Attendance Correction');
      expect(html).toContain('Computer Networks (CS501)');
      expect(html).toContain('Session 4');
      expect(html).toContain('ABSENT');
      expect(html).toContain('Submit Request');
    });

    it('renders AttendanceDisputeResponseModal with reviewer instructions', () => {
      const html = renderToStaticMarkup(
        React.createElement(AttendanceDisputeResponseModal, {
          dispute: {
            id: 99,
            status: 'MORE_INFO_REQUIRED',
            reviewer_comments: 'Please attach signed medical certificate.',
          },
          onClose: () => {},
          onSuccess: () => {},
        })
      );
      expect(html).toContain('Provide Additional Information');
      expect(html).toContain('Please attach signed medical certificate.');
      expect(html).toContain('Submit to Reviewer');
    });
  });
});
