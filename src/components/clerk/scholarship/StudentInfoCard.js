'use client';
import { useState } from 'react';
import Image from 'next/image';

export default function StudentInfoCard({ student, onImageClick }) {
  const [imageLoading, setImageLoading] = useState(true);
  if (!student) return null;
  const p = student.pfp;
  const has = p && String(p).trim() !== '';
  const isData = has && String(p).startsWith('data:');
  const dataHasBody = !isData || (String(p).includes(',') && String(p).split(',')[1].trim() !== '');

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-1">
        <div>
          {has && dataHasBody ? (
            <div className="mb-3 relative w-24 h-24 rounded-full overflow-hidden">
              {imageLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 z-10 space-y-1">
                  <div className="animate-spin h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
                  <span className="text-[8px] text-gray-500 font-medium">Loading...</span>
                </div>
              )}
              <Image
                src={String(p)}
                alt="Profile Pic"
                width={96}
                height={96}
                unoptimized
                onClick={(e) => { e.stopPropagation(); onImageClick?.(String(p)); }}
                className={`w-full h-full object-cover cursor-pointer transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                onLoad={() => setImageLoading(false)}
              />
            </div>
          ) : null}
          <div className="text-sm text-gray-500">Roll Number</div>
          <div className="font-medium">{student.roll_no}</div>
          <div className="text-sm text-gray-500 mt-2">Student Name</div>
          <div className="font-medium">{student.name}</div>
          <div className="text-sm text-gray-500 mt-2">Fee Reimbursement</div>
          <div className="font-medium">{student.fee_reimbursement}</div>
        </div>

        <div>
          <div className="text-sm text-gray-500">Course</div>
          <div className="font-medium">{student.course || '-'}</div>
          <div className="text-sm text-gray-500 mt-2">Admission Academic Year</div>
          <div className="font-medium">{student.admission_year || '-'}</div>
          <div className="text-sm text-gray-500 mt-2">Current Academic Year</div>
          <div className="font-medium">{student.current_year || '-'}</div>
        </div>

        <div>
          <div className="text-sm text-gray-500">Email</div>
          <div className="font-medium">{student.email || '-'}</div>
          <div className="text-sm text-gray-500 mt-2">Mobile</div>
          <div className="font-medium">{student.mobile || '-'}</div>
        </div>
      </div>
    </div>
  );
}
