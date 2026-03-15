'use client';
import React, { useState } from 'react';
import Image from 'next/image';

import Link from 'next/link';

export default function ProfileHeaderCard({ student }) {
  const [imageLoading, setImageLoading] = useState(true);

  return (
    <div className="flex flex-col items-center md:items-start">
      <div className="w-40 h-40 rounded-full border-4 border-gray-300 overflow-hidden flex items-center justify-center bg-gray-100 relative">
        {student.pfp ? (
          <>
            {imageLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 z-10 space-y-2">
                    <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
                    <span className="text-xs text-gray-500 font-medium">Image is loading...</span>
                </div>
            )}
            <Image 
                src={student.pfp} 
                alt="Profile Photo" 
                width={160} 
                height={160} 
                unoptimized
                className={`object-cover w-full h-full transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                onLoad={() => setImageLoading(false)}
            />
          </>
        ) : (
          <div className="text-gray-500">Profile Pic</div>
        )}
      </div>
      <div className="mt-6 text-center md:text-left">
        <div className="flex items-center justify-center md:justify-start gap-3">
          <div className="text-3xl font-bold leading-tight">{student.name}</div>
          <Link href="/student/settings/edit-profile" title="Modify Records" className="p-1.5 text-slate-400 hover:text-[#0b3578] hover:bg-slate-100 rounded-full transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </Link>
        </div>
        <div className="mt-1 text-lg font-semibold tracking-wide text-gray-800">{student.roll_no}</div>
      </div>
    </div>
  );
}
