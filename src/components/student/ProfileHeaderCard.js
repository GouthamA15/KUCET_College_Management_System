'use client';
import React, { useState } from 'react';
import Image from 'next/image';

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
        <div className="text-3xl font-bold leading-tight">{student.name}</div>
        <div className="mt-1 text-lg font-semibold tracking-wide text-gray-800">{student.roll_no}</div>
      </div>
    </div>
  );
}
