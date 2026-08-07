'use client';

import React from 'react';
import AssistantContainer from '@/components/assistant/AssistantContainer';

export default function AdminAssistantPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <AssistantContainer role="admin" />
    </div>
  );
}
