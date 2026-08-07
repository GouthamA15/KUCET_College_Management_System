import React from 'react';

export function SecurityOverview({ title = "Account Status", description = "Overview of your credentials and activity.", children }) {
  return (
    <section className="border border-gray-400 rounded-md bg-white p-4 sm:p-6 space-y-8 animate-fadeIn">
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
        {children}
      </div>
    </section>
  );
}
