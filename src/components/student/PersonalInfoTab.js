'use client';
import React from 'react';
import { formatDate } from '@/lib/date';

import ProfileInfoList from '@/components/profile/ProfileInfoList';

export default function PersonalInfoTab({ student }) {
  const items = [
    { key: 'father_name', label: 'Father Name', value: student.personal_details?.father_name ?? '-' },
    { key: 'mother_name', label: 'Mother Name', value: student.personal_details?.mother_name ?? '-' },
    {
      key: 'dob',
      label: 'Date of Birth',
      value: student.date_of_birth ? formatDate(student.date_of_birth).replaceAll('-', '/') : '-',
    },
    { key: 'phone', label: 'Phone', value: student.mobile ?? '-' },
    {
      key: 'address',
      label: 'Address',
      value: student.personal_details?.address ?? student.address ?? '-',
    },
    { key: 'email', label: 'Email', value: student.email || '-' },
  ];

  return <ProfileInfoList items={items} />;
}
