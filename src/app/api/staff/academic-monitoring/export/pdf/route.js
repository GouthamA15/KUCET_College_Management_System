import fs from 'fs';
import path from 'path';
import React from 'react';
import { NextResponse } from 'next/server';
import { apiError, getAuthUser } from '@/lib/api-utils';
import { AcademicMonitoringService } from '@/services/academic/AcademicMonitoringService';
import { pdf } from '@react-pdf/renderer';
import AcademicMonitoringReportPDF from '@/pdf/templates/AcademicMonitoringReportPDF';
import logger from '@/lib/logger';

export async function GET(request) {
  try {
    const user = (await getAuthUser('faculty')) || (await getAuthUser('admin'));
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'combined'; // 'attendance', 'marks', 'combined'
    const branch = searchParams.get('branch');
    const semester = searchParams.get('semester');
    const academicYear = searchParams.get('academic_year') || searchParams.get('year');

    // Retrieve data using service
    let reportPayload = null;
    let title = 'Consolidated Academic Monitoring Report';

    if (type === 'attendance') {
      const data = await AcademicMonitoringService.getCohortAttendance({
        user,
        branch,
        semester,
        academicYear,
        limit: 1000
      });
      title = `Cohort Attendance Report - ${data.scope.branch} Sem ${data.scope.semester}`;
      reportPayload = data;
    } else if (type === 'marks') {
      const data = await AcademicMonitoringService.getCohortMarks({
        user,
        branch,
        semester,
        academicYear,
        limit: 1000
      });
      title = `CIE Marks Performance Report - ${data.scope.branch} Sem ${data.scope.semester}`;
      reportPayload = data;
    } else {
      const data = await AcademicMonitoringService.getCombinedAcademicData({
        user,
        branch,
        semester,
        academicYear,
        limit: 1000
      });
      title = `Consolidated Academic Monitoring Report - ${data.scope.branch} Sem ${data.scope.semester}`;
      reportPayload = data;
    }

    // Load College Logo
    let logoDataUrl = null;
    try {
      const kuLogoPath = path.join(process.cwd(), 'public', 'assets', 'ku-college-logo.png');
      if (fs.existsSync(kuLogoPath)) {
        const logoBuf = fs.readFileSync(kuLogoPath);
        logoDataUrl = `data:image/png;base64,${logoBuf.toString('base64')}`;
      }
    } catch {
      // Continue gracefully without logo
    }

    const pdfData = {
      collegeName: 'KU COLLEGE OF ENGINEERING & TECHNOLOGY',
      universityName: 'Kakatiya University Campus, Warangal – 506009, Telangana',
      reportTitle: title,
      branch: reportPayload.scope.branch,
      semester: reportPayload.scope.semester,
      academicYear: reportPayload.scope.academic_year,
      generationDate: new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }),
      logoUrl: logoDataUrl,
      type,
      students: reportPayload.students,
      subjects: reportPayload.subjects
    };

    const stream = await pdf(React.createElement(AcademicMonitoringReportPDF, pdfData)).toBuffer();

    let pdfBuffer;
    if (Buffer.isBuffer(stream)) {
      pdfBuffer = stream;
    } else {
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      pdfBuffer = Buffer.concat(chunks);
    }

    const filename = `KUCET_Academic_Monitoring_${reportPayload.scope.branch}_Sem${reportPayload.scope.semester}_${type.toUpperCase()}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status >= 500) {
      logger.error({ err, url: request.url }, '[ACADEMIC_MONITORING_PDF_ERR]');
    }
    return apiError(err.message || 'Failed to generate PDF export', status);
  }
}
