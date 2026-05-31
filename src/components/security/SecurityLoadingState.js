import React from 'react';

export function SecurityLoadingState({ message = "Loading..." }) {
  return (
    <div className="py-12 text-center text-gray-400 animate-fadeIn">
      {message}
    </div>
  );
}
