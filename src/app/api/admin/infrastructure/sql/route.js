import { db } from '@/db';
import { wrapHandler, apiError } from '@/lib/api-utils';
import { sql } from 'drizzle-orm';
import logger from '@/lib/logger';

/**
 * SQL WORKBENCH API (Super Admin Only)
 * Executes raw SQL queries against the database.
 * DANGER: Use with extreme caution.
 */

export const POST = wrapHandler({
  auth: 'admin', // Strict Super Admin Auth
  handler: async (req, { user }) => {
    try {
      const { query } = await req.json();

      if (!query || typeof query !== 'string') {
        return apiError('Valid SQL query is required', 400);
      }

      const trimmedQuery = query.trim().toUpperCase();

      // Block highly dangerous operations (optional but recommended)
      const blacklisted = ['DROP DATABASE', 'TRUNCATE TABLE', 'GRANT ALL', 'REVOKE ALL'];
      if (blacklisted.some(keyword => trimmedQuery.includes(keyword))) {
         return apiError('Operation not permitted via web workbench for safety reasons.', 403);
      }

      logger.warn({ user: user.email, query: query.substring(0, 200) }, '[SQL_WORKBENCH_EXECUTION]');

      // Execute query using raw connection
      const [rows, fields] = await db.execute(sql.raw(query));

      return {
        success: true,
        results: rows,
        fields: fields ? fields.map(f => f.name) : [],
        affectedRows: rows?.affectedRows || 0
      };

    } catch (error) {
      logger.error({ err: error, query: req.body?.query }, '[SQL_WORKBENCH_ERROR]');
      return apiError(error.message || 'SQL Execution failed', 500);
    }
  },
  audit: {
    action: 'SQL_QUERY_EXECUTED',
    getTargetId: (data) => 'DB',
    getAfter: (data) => ({ query: data.query })
  }
});
