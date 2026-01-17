"use client";

import { useState } from 'react';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function ScholarshipDashboard() {
  const handleLogout = () => {
    document.cookie = 'clerk_auth=; Max-Age=0; path=/;';
    document.cookie = 'clerk_logged_in=; Max-Age=0; path=/;';
    sessionStorage.removeItem('clerk_authenticated');
    window.location.replace('/');
  };
  const [rollNo, setRollNo] = useState('');
  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStudentData(null);
    const toastId = toast.loading('Searching for student...');

    try {
      const res = await fetch(`/api/clerk/scholarship/${rollNo}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch student data');
      }

      setStudentData(data);
      toast.success('Student found!', { id: toastId });
    } catch (error) {
      toast.error(error.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    setLoading(true);
    const toastId = toast.loading('Updating student data...');

    try {
      const res = await fetch(`/api/clerk/scholarship/${rollNo}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update student data');
      }

      toast.success('Student data updated successfully!', { id: toastId });
      setEditing(false);
    } catch (error) {
      toast.error(error.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e, section, index) => {
    const { name, value } = e.target;
    const updatedData = { ...studentData };
    updatedData[section][index][name] = value;
    setStudentData(updatedData);
  };

  return (
    <>
      <Header />
      <Navbar clerkMode={true} clerkMinimal={true} onLogout={handleLogout} />
      <main className="min-h-screen bg-gray-100 flex flex-col items-center py-8">
        <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-[#0b3578] mb-6">Scholarship Dashboard</h1>
          <form onSubmit={handleSearch} className="flex gap-4 mb-8">
            <input
              type="text"
              value={rollNo}
              onChange={(e) => setRollNo(e.target.value)}
              placeholder="Enter Roll Number"
              className="flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#0b3578] hover:bg-[#0a2d66] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>

          {studentData && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-[#0b3578]">
                  Student: {studentData.student.name} ({studentData.student.roll_no})
                </h2>
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
                      onClick={handleUpdate}
                      disabled={loading}
                      className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                    >
                      {loading ? 'Saving...' : 'Save'}
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

              {/* Fees Section */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-2">Fee Details</h3>
                {studentData.fees.map((fee, index) => (
                  <div key={fee.id} className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 p-4 border rounded-md">
                    {Object.keys(fee).map((key) => (
                      <div key={key}>
                        <label className="block text-sm font-medium text-gray-700 capitalize">{key.replace(/_/g, ' ')}</label>
                        <input
                          type="text"
                          name={key}
                          value={fee[key]}
                          onChange={(e) => handleChange(e, 'fees', index)}
                          disabled={!editing || key === 'id' || key === 'student_id'}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Scholarship Section */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Scholarship Details</h3>
                {studentData.scholarship.map((scholarship, index) => (
                  <div key={scholarship.id} className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 p-4 border rounded-md">
                    {Object.keys(scholarship).map((key) => (
                      <div key={key}>
                        <label className="block text-sm font-medium text-gray-700 capitalize">{key.replace(/_/g, ' ')}</label>
                        <input
                          type="text"
                          name={key}
                          value={scholarship[key]}
                          onChange={(e) => handleChange(e, 'scholarship', index)}
                          disabled={!editing || key === 'id' || key === 'student_id'}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}