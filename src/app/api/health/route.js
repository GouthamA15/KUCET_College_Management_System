import { NextResponse } from 'next/server';
import HealthService from '@/services/shared/HealthService';

export async function GET() {
  const diagnostics = await HealthService.getFullDiagnostics();
  const statusCode = diagnostics.status === 'healthy' ? 200 : 503;

  return NextResponse.json(diagnostics, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Content-Type': 'application/json',
    },
  });
}
