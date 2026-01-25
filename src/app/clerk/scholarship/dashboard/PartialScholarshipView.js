// src/app/clerk/scholarship/dashboard/PartialScholarshipView.js
"use client";

import { useState } from 'react';

export default function PartialScholarshipView({ student, scholarshipData, feeData, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [scholarship, setScholarship] = useState(scholarshipData);
  const [fees, setFees] = useState(feeData);

  const handleScholarshipChange = (e, index) => {
    const { name, value } = e.target;
    const updatedData = [...scholarship];
    updatedData[index][name] = value;
    setScholarship(updatedData);
  };

  const handleFeeChange = (e, index) => {
    const { name, value } = e.target;
    const updatedData = [...fees];
    updatedData[index][name] = value;
    setFees(updatedData);
  };

  const handleSave = () => {
    onUpdate({ scholarship, fees });
    setEditing(false);
  };

  const addScholarship = () => {
    setScholarship([...scholarship, {
      id: `new-${Date.now()}`,
      year: new Date().getFullYear(),
      application_no: '',
      proceedings_no: '',
      scholarship_type: 'Partial',
      status: 'Applied',
      academic_year: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      remarks: '',
      amount_sanctioned: 0,
      amount_disbursed: 0,
      ch_no: '',
      date: '',
    }]);
  };

  return (
    <div className="p-4 border rounded-md bg-gray-50">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Partial Scholarship Student</h3>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Edit
          </button>
        ) : (
          <div className="flex gap-4">
            <button
              onClick={handleSave}
              className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
      <p className="mb-4">
        Student <span className="font-bold">{student.name}</span> (Roll No:{" "}
        <span className="font-bold">{student.roll_no}</span>)
      </p>

      {editing && (
        <div className="mb-4">
          <button
            onClick={addScholarship}
            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Add Scholarship
          </button>
        </div>
      )}
      
      {/* Scholarship Section */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-2">Scholarship Details</h3>
        {scholarship.map((item, index) => (
          <div key={item.id || index} className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4 p-4 border rounded-md">
            {Object.keys(item).map((key) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 capitalize">{key.replace(/_/g, ' ')}</label>
                <input
                  type="text"
                  name={key}
                  value={item[key] || ''}
                  onChange={(e) => handleScholarshipChange(e, index)}
                  disabled={!editing || key === 'id' || key === 'student_id'}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Fees Section */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Fee Details</h3>
        {fees.map((fee, index) => (
          <div key={fee.id || index} className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 p-4 border rounded-md">
            {Object.keys(fee).map((key) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 capitalize">{key.replace(/_/g, ' ')}</label>
                <input
                  type="text"
                  name={key}
                  value={fee[key] || ''}
                  onChange={(e) => handleFeeChange(e, index)}
                  disabled={!editing || key === 'id' || key === 'student_id'}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}