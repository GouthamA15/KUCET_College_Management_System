'use client';
import React from 'react';

export default function ProfileStatusBar({ courseLabel, yearOfStudy, semesterLabel, currentAcademicYearLabel, batchString }) {
  return (
    <div className="space-y-1">
      <div className="text-xl font-semibold">{courseLabel}</div>
      <div className="text-blue-700 font-semibold">Year: {yearOfStudy} | Semester: {semesterLabel}</div>
      {currentAcademicYearLabel && (
        <>
          <div className="text-blue-700 font-semibold">Academic Year: {currentAcademicYearLabel} (Current Academic)</div>
          <div className="text-blue-700 font-semibold">Batch: {batchString}</div>
        </>
      )}
    </div>
  );
}
