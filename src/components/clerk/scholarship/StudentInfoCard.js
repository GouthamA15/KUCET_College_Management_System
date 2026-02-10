'use client';
import Image from 'next/image';

export default function StudentInfoCard({ student, onImageClick }) {
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
            <div className="mb-3">
              <Image
                src={String(p)}
                alt="Profile Pic"
                width={96}
                height={96}
                onClick={(e) => { e.stopPropagation(); onImageClick?.(String(p)); }}
                className="w-24 h-24 object-cover rounded-full border-2 border-gray-300 cursor-pointer"
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
