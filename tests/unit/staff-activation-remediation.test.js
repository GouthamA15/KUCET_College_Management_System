import { beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import { db } from '@/db';
import { staffAccounts, staffAccountActivationTokens } from '@/db/schema';
import { POST } from '@/app/api/public/staff-registration/activate/route';

vi.mock('@/db', () => ({ db: { transaction: vi.fn() } }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn(async () => ({ success: true })) }));
vi.mock('bcrypt', () => ({ default: { hash: vi.fn(async () => 'hashed-password') } }));

describe('staff activation link replay handling', () => {
  let tokenRow;
  let account;
  let activationWrites;

  beforeEach(() => {
    vi.clearAllMocks();
    const token = 'activation-test-token';
    tokenRow = {
      id: 9,
      staff_account_id: 12,
      token_hash: crypto.createHash('sha256').update(token).digest('hex'),
      expires_at: new Date(Date.now() + 60_000),
      used_at: null,
    };
    account = { id: 12, employee_id: 'EMP-12', email: 'staff@example.test', account_status: 'PENDING_ACTIVATION' };
    activationWrites = 0;

    db.transaction.mockImplementation(async (callback) => {
      let selectedTable;
      const tx = {
        select: () => ({
          from: (table) => {
            selectedTable = table;
            return {
              where: () => ({
                for: async () => selectedTable === staffAccountActivationTokens ? (tokenRow ? [tokenRow] : []) : [account],
              }),
            };
          },
        }),
        update: (table) => ({
          set: (values) => ({
            where: async () => {
              activationWrites += 1;
              if (table === staffAccountActivationTokens) tokenRow.used_at = values.used_at;
              if (table === staffAccounts) Object.assign(account, values);
            },
          }),
        }),
        insert: () => ({ values: async () => undefined }),
      };
      return callback(tx);
    });
  });

  async function activate() {
    return POST(new Request('http://localhost/api/public/staff-registration/activate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'activation-test-token', password: 'new-password-123' }),
    }), {});
  }

  it('activates once and returns a controlled conflict on replay', async () => {
    const first = await activate();
    expect(first.status).toBe(200);
    expect(account.account_status).toBe('ACTIVE');

    const replay = await activate();
    expect(replay.status).toBe(409);
    expect(await replay.json()).toMatchObject({ error: expect.stringContaining('already been used') });
    expect(activationWrites).toBe(2);
  });

  it('returns a controlled response for an expired token without updating the account', async () => {
    tokenRow.expires_at = new Date(Date.now() - 60_000);
    const response = await activate();
    expect(response.status).toBe(410);
    expect(account.account_status).toBe('PENDING_ACTIVATION');
    expect(activationWrites).toBe(0);
  });

  it('does not disclose account state for an invalid token', async () => {
    tokenRow = null;
    const response = await activate();
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'This activation link is invalid or unavailable.' });
  });
});
