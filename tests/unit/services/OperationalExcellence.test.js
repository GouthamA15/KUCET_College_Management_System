import { describe, it, expect, vi } from 'vitest';
import HealthService from '@/services/shared/HealthService';
import DisasterRecoveryService from '@/services/archive/DisasterRecoveryService';

vi.mock('@/db', () => ({
  db: {
    execute: vi.fn().mockResolvedValue([[{ '1': 1 }]]),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockResolvedValue([{ count: 10 }]),
    }),
  },
}));

describe('Operational Excellence Services', () => {
  it('should return rich health diagnostics', async () => {
    const diag = await HealthService.getFullDiagnostics();
    expect(diag.status).toBeDefined();
    expect(diag.components.database).toBeDefined();
    expect(diag.components.storage).toBeDefined();
    expect(diag.components.backups).toBeDefined();
  });

  it('should execute full disaster recovery procedure', async () => {
    const report = await DisasterRecoveryService.executeFullSystemRecovery();
    expect(report.recoveryId).toMatch(/^REC-/);
    expect(report.dbIntegrity.healthy).toBe(true);
    expect(report.cacheRebuild.success).toBe(true);
  });
});
