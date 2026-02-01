import React from 'react';

const DuesSection = ({ title, status, children }) => {
  const statusClasses = {
    paid: 'bg-green-100 text-green-800',
    pending: 'bg-red-100 text-red-800',
    'in-progress': 'bg-yellow-100 text-yellow-800',
    unknown: 'bg-gray-100 text-gray-800',
  };

  const statusText = {
    paid: 'Cleared',
    pending: 'Pending',
    'in-progress': 'In Progress',
    unknown: 'Unavailable',
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-800">{title}</h3>
        <span className={`px-3 py-1 text-sm font-semibold rounded-full ${statusClasses[status]}`}>
          {statusText[status]}
        </span>
      </div>
      <div>{children}</div>
    </div>
  );
};

export default DuesSection;
