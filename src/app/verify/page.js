import { Suspense } from 'react';
import VerifyClient from './VerifyClient';

export const metadata = {
  title: 'Document Verification | KUCET CMS',
  description: 'Cryptographic document and credential verification portal for Kakatiya University College of Engineering and Technology.',
};

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-[#0b3578] border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-600 font-medium uppercase text-xs tracking-widest">Loading Verification Engine...</p>
        </div>
      </div>
    }>
      <VerifyClient />
    </Suspense>
  );
}