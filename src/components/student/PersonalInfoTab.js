'use client';
import React from 'react';
import { formatDate } from '@/lib/date';

export default function PersonalInfoTab({ student }) {
  return (
    <div className="space-y-3 text-[16px]">
      <div><span className="font-semibold">Father Name:</span> <span className="ml-2">{student.personal_details?.father_name ?? '-'}</span></div>
      <div><span className="font-semibold">Mother Name:</span> <span className="ml-2">{student.personal_details?.mother_name ?? '-'}</span></div>
      <div><span className="font-semibold">Date of Birth:</span> <span className="ml-2">{student.date_of_birth ? formatDate(student.date_of_birth).replaceAll('-', '/') : '-'}</span></div>
      <div><span className="font-semibold">Phone:</span> <span className="ml-2">{student.mobile ?? '-'}</span></div>
      <div><span className="font-semibold">Address:</span> <span className="ml-2">{student.personal_details?.address ?? student.address ?? '-'}</span></div>
      <div><span className="font-semibold">Email:</span> <span className="ml-2">{student.email || '-'}</span></div>
    </div>
  );
}
