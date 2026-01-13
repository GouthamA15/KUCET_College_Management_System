'use client';
import { useState } from 'react';

export default function ClerkDashboard() {
  const [students, setStudents] = useState([]);
  const [branch, setBranch] = useState('');
  const [year, setYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFetchStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/clerk/students?year=${year}&branch=${branch}`);
      if (!response.ok) {
        throw new Error('Failed to fetch students');
      }
      const data = await response.json();
      setStudents(data.students);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-8">Clerk Dashboard</h1>
      <div className="flex space-x-4 mb-8">
        <div>
          <label htmlFor="branch" className="block text-sm font-medium text-gray-700">Branch</label>
          <select
            id="branch"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value="">Select Branch</option>
            <option value="09">CSE</option>
            <option value="30">CSD</option>
            <option value="15">ECE</option>
            <option value="12">EEE</option>
            <option value="00">CIVIL</option>
            <option value="18">IT</option>
            <option value="03">MECH</option>
          </select>
        </div>
        <div>
          <label htmlFor="year" className="block text-sm font-medium text-gray-700">Year of Admission</label>
          <input
            type="text"
            id="year"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="e.g., 2023"
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          />
        </div>
        <button
          onClick={handleFetchStudents}
          className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Fetch Students'}
        </button>
      </div>

      {error && <p className="text-red-500">{error}</p>}

      <div className="mt-8">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll No</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Father Name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gender</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone No</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DOB</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {students.map((student) => (
                <tr key={student.rollno}>
                  <td className="px-6 py-4 whitespace-nowrap">{student.rollno}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{student.student_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{student.father_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{student.gender}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{student.category}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{student.phone_no}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{new Date(student.dob).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
