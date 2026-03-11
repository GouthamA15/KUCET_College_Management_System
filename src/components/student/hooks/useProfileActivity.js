'use client';

import { useContext } from 'react';
import { ProfileActivityContext } from '@/context/ProfileActivityContext';

export default function useProfileActivity() {
  const ctx = useContext(ProfileActivityContext);
  if (!ctx) {
    throw new Error('useProfileActivity must be used within a ProfileActivityProvider');
  }
  return ctx;
}
