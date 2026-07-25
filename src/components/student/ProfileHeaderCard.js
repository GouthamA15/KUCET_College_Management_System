'use client';
import React from 'react';

import CommonProfileHeaderCard from '@/components/profile/ProfileHeaderCard';

export default function ProfileHeaderCard({ student }) {
  return (
    <CommonProfileHeaderCard
      name={student?.name}
      primaryId={student?.roll_no}
      photoUrl={student?.pfp}
      fallback="placeholder"
    />
  );
}
