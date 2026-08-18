'use client';

import React from 'react';

export default function OfflineReloadButton() {
  return (
    <button
      onClick={() => window.location.reload()}
      className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 font-medium rounded-xl text-sm transition-colors cursor-pointer"
    >
      Try Reconnecting
    </button>
  );
}
