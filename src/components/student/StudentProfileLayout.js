'use client';
import React from 'react';

export default function StudentProfileLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col overflow-hidden">
      {children}
    </div>
  );
}
