'use client';

import React from 'react';
import AssistantContainer from '@/components/assistant/AssistantContainer';

export default function StudentAssistantPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <AssistantContainer role="student" />
    </div>
  );
}
