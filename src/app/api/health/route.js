import { NextResponse } from 'next/server';
import HealthService from '@/services/shared/HealthService';

export async function GET(req) {
  const url = new URL(req.url, 'http://localhost');
  const type = url.searchParams.get('type');

  if (type === 'liveness') {
    const liveness = HealthService.getLiveness();
    return NextResponse.json(liveness, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Content-Type': 'application/json',
      },
    });
  }

  if (type === 'readiness') {
    const readiness = await HealthService.getReadiness();
    const statusCode = readiness.ready ? 200 : 503;
    return NextResponse.json(readiness, {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Content-Type': 'application/json',
      },
    });
  }

  const diagnostics = await HealthService.getFullDiagnostics();
  const statusCode = diagnostics.status === 'unhealthy' ? 503 : 200;

  return NextResponse.json(diagnostics, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Content-Type': 'application/json',
    },
  });
}
