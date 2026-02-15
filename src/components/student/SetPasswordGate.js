'use client';
import React from 'react';
import SetPasswordModal from '@/components/SetPasswordModal';

export default function SetPasswordGate({ show, rollno, email, onPasswordSet }) {
  if (!show) return null;
  return (
    <SetPasswordModal rollno={rollno} email={email} onPasswordSet={onPasswordSet} />
  );
}
