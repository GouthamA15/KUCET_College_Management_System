'use client';
import React from 'react';

import CommonProfileStatusBar from '@/components/profile/ProfileStatusBar';

export default function ProfileStatusBar({ courseLabel, _yearOfStudy, semesterLabel, currentAcademicYearLabel, batchString }) {
  const lines = currentAcademicYearLabel
    ? [
        { label: '', value: semesterLabel },
        { label: 'Academic Year', value: currentAcademicYearLabel },
        { label: 'Batch', value: batchString },
      ]
    : [];

  return <CommonProfileStatusBar title={courseLabel} lines={lines} />;
}
