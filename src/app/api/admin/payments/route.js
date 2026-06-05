import { wrapHandler, apiResponse } from '@/lib/api-utils';
import { FinanceService } from '@/services/FinanceService';

export const GET = wrapHandler({
  auth: 'admin',
  handler: async (req) => {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const rollNo = searchParams.get('rollNo');
    const limit = parseInt(searchParams.get('limit') || '50');

    const [stats, transactions] = await Promise.all([
      FinanceService.getFinancialStats(),
      FinanceService.getAllTransactions({ type, status, rollNo, limit })
    ]);

    return apiResponse({
      stats,
      transactions
    });
  }
});
