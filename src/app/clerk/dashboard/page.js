'use client';
import { useState } from 'react';

export default function ClerkDashboard() {
  const [students, setStudents] = useState([]);
  const [branch, setBranch] = useState('');
  const [year, setYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Edit State
  const [editingStudent, setEditingStudent] = useState(null);
  const [editForm, setEditForm] = useState({
    student_name: '',
    father_name: '',
    gender: '',
    category: '',
    phone_no: '',
    dob: ''
  });
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');

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

  const handleEditClick = (student) => {
    setEditingStudent(student.rollno);
    setEditForm({
      student_name: student.student_name,
      father_name: student.father_name,
      gender: student.gender,
      category: student.category,
      phone_no: student.phone_no,
      dob: student.dob ? new Date(student.dob).toISOString().split('T')[0] : ''
    });
    setUpdateMessage('');
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setUpdateLoading(true);
    setUpdateMessage('');

    try {
      const res = await fetch(`/api/clerk/students/${editingStudent}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });

      const data = await res.json();

      if (res.ok) {
        setUpdateMessage('Student updated successfully!');
        // Update local state to reflect changes without re-fetching
        setStudents(students.map(s => 
          s.rollno === editingStudent ? { ...s, ...editForm } : s
        ));
        setTimeout(() => setEditingStudent(null), 1500);
      } else {
        setUpdateMessage(data.error || 'Failed to update student.');
      }
    } catch (err) {
      console.error('Update error:', err);
      setUpdateMessage('An unexpected error occurred.');
    } finally {
      setUpdateLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-8">Clerk Dashboard</h1>
      
      {/* Search Controls */}
      <div className="flex space-x-4 mb-8 bg-white p-4 rounded-lg shadow">
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

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {/* Edit Modal */}
      {editingStudent && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Edit Student Details</h2>
            <form onSubmit={handleUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Student Name</label>
                <input
                  type="text"
                  value={editForm.student_name}
                  onChange={(e) => setEditForm({...editForm, student_name: e.target.value})}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Father Name</label>
                <input
                  type="text"
                  value={editForm.father_name}
                  onChange={(e) => setEditForm({...editForm, father_name: e.target.value})}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Gender</label>
                <select
                  value={editForm.gender}
                  onChange={(e) => setEditForm({...editForm, gender: e.target.value})}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <input
                  type="text"
                  value={editForm.category}
                  onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone No</label>
                <input
                  type="text"
                  value={editForm.phone_no}
                  onChange={(e) => setEditForm({...editForm, phone_no: e.target.value})}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                <input
                  type="date"
                  value={editForm.dob}
                  onChange={(e) => setEditForm({...editForm, dob: e.target.value})}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  required
                />
              </div>
              
              <div className="md:col-span-2 flex justify-end space-x-3 mt-4">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateLoading}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
                >
                  {updateLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
              {updateMessage && (
                <div className={`md:col-span-2 text-center text-sm font-medium ${updateMessage.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                  {updateMessage}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Student List */}
      <div className="mt-8">
        <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 rounded-lg">
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
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {students.map((student) => (
                <tr key={student.rollno} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.rollno}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.student_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.father_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.gender}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.category}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.phone_no}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.dob ? new Date(student.dob).toLocaleDateString() : 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEditClick(student)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {students.length === 0 && !loading && !error && (
            <div className="text-center py-10 text-gray-500">
              No students found. Please select a branch and year.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
