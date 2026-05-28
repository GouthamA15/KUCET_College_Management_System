"use client";
import React from 'react';
import { useRouter } from 'next/navigation';

export default function IDCardReissueComingSoon() {
  const router = useRouter();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center animate-fadeIn font-sans">
      <div className="max-w-md w-full space-y-8">
        <div className="space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-50 text-blue-600 rounded-full mb-2">
            <span className="text-4xl">🪪</span>
          </div>
          <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight">ID Card Reissue</h1>
          <div className="inline-block px-4 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">
            Feature Under Development
          </div>
          <p className="text-sm text-slate-500 font-medium leading-relaxed uppercase tracking-tighter">
            The automated institutional identity card reissue portal is currently being re-engineered for better security and visual parity.
          </p>
        </div>

        <div className="pt-6 space-y-4">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-loose">
            For urgent ID card requirements, please visit the <br />
            <span className="text-slate-600">College Admission Branch</span> with physical payment proof.
          </p>
          
          <button
            onClick={() => router.push('/student')}
            className="px-8 py-3 bg-slate-800 text-white text-xs font-black uppercase tracking-widest hover:bg-slate-900 transition-all rounded-sm shadow-xl active:scale-95"
          >
            ← Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}