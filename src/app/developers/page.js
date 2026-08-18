import { Suspense } from 'react';
import DevelopersClient from './DevelopersClient';

export const metadata = {
  title: 'Developers & Contributors | KUCET CMS',
  description: 'Meet the engineering team behind the Kakatiya University College of Engineering and Technology College Management System.',
};

export default function DevelopersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 font-sans">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-[#0b3578] border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-600 font-medium uppercase text-xs tracking-widest">Loading Developer Showcase...</p>
        </div>
      </div>
    }>
      <DevelopersClient />
    </Suspense>
  );
}
