import React from 'react';
import { Shield } from 'lucide-react';

export function SecurityEmptyState({ 
  icon: Icon = Shield, 
  _title = "No data available", 
  message = "There are no records to display at this time." 
}) {
  return (
    <div className="py-12 text-center text-gray-400 flex flex-col items-center gap-3 animate-fadeIn">
      <Icon size={32} className="text-gray-200" />
      <p>{message}</p>
    </div>
  );
}
