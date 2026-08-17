import { db } from '@/db';
import { staffAccountActivationTokens, staffAccounts, staffRoles, staffAccountRoles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import PasswordSetupClient from './PasswordSetupClient';
import Link from 'next/link';

export const metadata = {
  title: 'Activate Staff Account - KUCET',
};

export default async function StaffActivationPage({ searchParams }) {
  // In Next.js 15+, searchParams must be awaited if accessed dynamically
  const params = await searchParams;
  const token = params?.token;

  if (!token) {
    return <ErrorState message="Activation token is missing from the URL." />;
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // Pre-validate token Server-Side
  const [tokenRecord] = await db
    .select()
    .from(staffAccountActivationTokens)
    .where(eq(staffAccountActivationTokens.token_hash, tokenHash));

  if (!tokenRecord) {
    return <ErrorState message="This activation link is invalid." />;
  }

  if (tokenRecord.used_at) {
    return <ErrorState message="This activation link has already been used." />;
  }

  if (new Date() > new Date(tokenRecord.expires_at)) {
    return <ErrorState message="This activation link has expired. Please contact the administrator or request a new activation email." />;
  }

  // Find account
  const [account] = await db
    .select({
      id: staffAccounts.id,
      name: staffAccounts.name,
      employee_id: staffAccounts.employee_id,
      account_status: staffAccounts.account_status,
    })
    .from(staffAccounts)
    .where(eq(staffAccounts.id, tokenRecord.staff_account_id));

  if (!account) {
    return <ErrorState message="Associated staff account not found." />;
  }

  if (account.account_status === 'ACTIVE') {
    return <ErrorState message="This account has already been activated." />;
  }

  if (account.account_status !== 'PENDING_ACTIVATION') {
    return <ErrorState message={`Cannot activate account in status: ${account.account_status}`} />;
  }
  
  const [roleMapping] = await db
    .select({
      roleName: staffRoles.role_name
    })
    .from(staffAccountRoles)
    .leftJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
    .where(eq(staffAccountRoles.staff_account_id, account.id))
    .limit(1);

  const assignedRole = roleMapping?.roleName || 'Staff Member';

  return (
    <div className="min-h-screen bg-slate-50 py-12 flex flex-col justify-center sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h2 className="text-3xl font-extrabold text-[#0b3578]">
          Account Activation
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Welcome to KUCET Portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-slate-200">
          <div className="mb-6 pb-6 border-b border-slate-100">
            <h3 className="text-lg font-medium text-slate-900">Staff Details</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Name</dt>
                <dd className="font-medium text-slate-900">{account.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Employee ID</dt>
                <dd className="font-medium text-slate-900">{account.employee_id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Assigned Role</dt>
                <dd className="font-medium text-slate-900">{assignedRole}</dd>
              </div>
            </dl>
          </div>
          
          <PasswordSetupClient token={token} />
        </div>
      </div>
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center border border-slate-200">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">Activation Failed</h3>
          <p className="text-sm text-slate-500 mb-6">{message}</p>
          <Link href="/" className="inline-flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-[#0b3578] border border-transparent rounded-md shadow-sm hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0b3578]">
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
