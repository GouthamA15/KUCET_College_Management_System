
'use client';

import { useState } from 'react';

export default function ScholarshipDashboardPage() {
  const [rollno, setRollno] = useState('');
  const [student, setStudent] = useState(null);
  const [scholarshipData, setScholarshipData] = useState([]);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    setError(null);
    setStudent(null);
    setScholarshipData([]);

    try {
      const response = await fetch(`/api/clerk/scholarship/${rollno}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch student data');
      }
      const data = await response.json();
      setStudent(data.student);
      setScholarshipData(data.scholarship);
    } catch (error) {
      setError(error.message);
    }
  };

  const handleScholarshipChange = (e, year) => {
    const { name, value } = e.target;
    setScholarshipData((prevData) =>
      prevData.map((item) => (item.year === year ? { ...item, [name]: value } : item))
    );
  };

  const handleUpdateScholarship = async (year) => {
    try {
      const dataToUpdate = scholarshipData.find((item) => item.year === year);
      const response = await fetch(`/api/clerk/scholarship/${rollno}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToUpdate),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update scholarship data');
      }
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6">Scholarship Dashboard</h1>
        <form onSubmit={handleSearch} className="mb-6 flex">
          <input
            type="text"
            value={rollno}
            onChange={(e) => setRollno(e.target.value)}
            placeholder="Enter Student Roll No."
            className="flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
          <button
            type="submit"
            className="ml-4 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Search
          </button>
        </form>

        {error && <p className="text-red-500 mb-4">{error}</p>}

        {student && (
          <div>
            <h2 className="text-xl font-bold mb-4">Student Details</h2>
            <p><strong>Name:</strong> {student.name}</p>
            <p><strong>Roll No:</strong> {student.roll_no}</p>

            <h2 className="text-xl font-bold mt-8 mb-4">Scholarship Details</h2>
            <div className="space-y-6">
              {[1, 2, 3, 4].map((year) => {
                const yearData = scholarshipData.find((item) => item.year === year) || { year };
                return (
                  <div key={year} className="p-4 border border-gray-200 rounded-md">
                    <h3 className="text-lg font-bold mb-2">Year {year}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {['proceedings_no', 'amount_sanctioned', 'amount_disbursed', 'ch_no', 'date'].map((field) => (
                        <div key={field}>
                          <label className="block text-sm font-medium text-gray-700 capitalize">
                            {field.replace('_', ' ')}
                          </label>
                          <input
                            type={field === 'date' ? 'date' : 'text'}
                            name={field}
                            value={yearData[field] || ''}
                            onChange={(e) => handleScholarshipChange(e, year)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => handleUpdateScholarship(year)}
                      className="mt-4 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                    >
                      Update Year {year}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
