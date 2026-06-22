import { wrapHandler, apiResponse } from '@/lib/api-utils';
import { FinanceService } from '@/services/FinanceService';

export const GET = wrapHandler({
  auth: 'admin',
  handler: async (req) => {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const rollNo = searchParams.get('rollNo');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limitParam = parseInt(searchParams.get('limit') || '50');
    const limit = Number.isNaN(limitParam) ? 50 : Math.min(limitParam, 100);

    const [stats, transactions] = await Promise.all([
      FinanceService.getFinancialStats({ startDate, endDate }),
      FinanceService.getAllTransactions({ type, status, rollNo, startDate, endDate, limit })
    ]);

    return apiResponse({
      stats,
      transactions
    });
  }
});
