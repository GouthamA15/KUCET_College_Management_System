'use client';

import React from 'react';
import AdminEventControl from '@/modules/events/components/AdminEventControl';

export default function AdminChessEventPage() {
  return (
    <div className="py-2">
      <AdminEventControl eventKey="chess" />
    </div>
  );
}
