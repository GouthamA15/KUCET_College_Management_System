'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/app/components/Footer/Footer';
import toast from 'react-hot-toast';

export default function ClerkDashboard() {
  const router = useRouter();
  const [students, setStudents] = useState([]);
  const [branch, setBranch] = useState('');
  const [year, setYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hint, setHint] = useState('');
  
  // Edit State
  const [editingStudent, setEditingStudent] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    father_name: '',
    gender: '',
    category: '',
    mobile: '',
    date_of_birth: ''
  });
  const [updateLoading, setUpdateLoading] = useState(false);

  // Roll Number Search State
  const [rollNo, setRollNo] = useState('');
  const [singleStudent, setSingleStudent] = useState(null);
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleError, setSingleError] = useState('');

  const handleFetchStudents = async () => {
    if (!branch || !year) {
      setHint('Select Branch and Year');
      return;
    }
    setLoading(true);
    setError(null);
    setHint('');
    setSingleStudent(null);
    setSingleError('');
    try {
      const response = await fetch(`/api/clerk/students?year=${year}&branch=${branch}`);
      if (!response.ok) {
        setStudents([]);
        setHint('No students found for selected branch and year');
        return;
      }
      const data = await response.json();
      if (!data.students || data.students.length === 0) {
        setStudents([]);
        setHint('No students found for selected branch and year');
      } else {
        setStudents(data.students);
        setHint('');
      }
    } catch (err) {
      setStudents([]);
      setHint('No students found for selected branch and year');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (student) => {
    setEditingStudent(student.roll_no);
    setEditForm({
      name: student.name,
      father_name: student.father_name,
      gender: student.gender,
      category: student.category,
      mobile: student.mobile,
      date_of_birth: student.date_of_birth ? new Date(student.date_of_birth).toISOString().split('T')[0] : ''
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setUpdateLoading(true);
    const toastId = toast.loading('Updating student...');

    try {
      const res = await fetch(`/api/clerk/students/${editingStudent}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Student updated successfully!', { id: toastId });
        // Update local state to reflect changes without re-fetching
        setStudents(students.map(s => 
          s.roll_no === editingStudent ? { ...s, ...editForm } : s
        ));
        setTimeout(() => setEditingStudent(null), 1500);
      } else {
        toast.error(data.error || 'Failed to update student.', { id: toastId });
      }
    } catch (err) {
      console.error('Update error:', err);
      toast.error('An unexpected error occurred.', { id: toastId });
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleFetchSingleStudent = async () => {
    if (!rollNo.trim()) {
      setSingleError('Please enter a roll number.');
      return;
    }
    setSingleLoading(true);
    setSingleError('');
    setSingleStudent(null);
    setStudents([]); // Clear the student list
    try {
      const res = await fetch(`/api/clerk/students/${rollNo.trim()}`);
      if (!res.ok) {
        if (res.status === 404) {
          setSingleError('No student found for this roll number.');
        } else {
          setSingleError('Failed to fetch student.');
        }
        return;
      }
      const data = await res.json();
      setSingleStudent(data.student);
    } catch (err) {
      console.error('Fetch error:', err);
      setSingleError('An unexpected error occurred.');
    } finally {
      setSingleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />
      <Navbar clerkMode={true} />
      <main className="flex-1 p-4 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8">Clerk Dashboard</h1>
        {/* Search Controls */}
        <div className="bg-white p-4 rounded-lg shadow mb-8">
          {/* Branch and Year Search Row */}
          <div className="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0 mb-6">
            <div className="flex-1">
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
            <div className="flex-1">
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
            <div className="flex-shrink-0 flex items-end">
              <button
                onClick={handleFetchStudents}
                className="w-full md:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
                disabled={loading || !branch || !year}
              >
                {loading ? 'Loading...' : 'Fetch Students'}
              </button>
            </div>
          </div>
          
          {/* Roll Number Search Row */}
          <div className="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0 md:items-end">
            <div className="flex-1">
              <label htmlFor="rollno" className="block text-sm font-medium text-gray-700">Search by Roll Number</label>
              <input
                type="text"
                id="rollno"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                placeholder="Enter Roll Number"
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              />
            </div>
            <div className="flex-shrink-0">
              <button
                onClick={handleFetchSingleStudent}
                className="w-full md:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
                disabled={singleLoading || !rollNo.trim()}
              >
                {singleLoading ? 'Loading...' : 'Fetch Student'}
              </button>
            </div>
          </div>
        </div>
        {(!branch || !year) && (
          <div className="text-center text-gray-500 mb-4">{hint}</div>
        )}
        {hint && branch && year && (
          <div className="text-center text-gray-500 mb-4">{hint}</div>
        )}
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
                    value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
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
                    value={editForm.mobile}
                    onChange={(e) => setEditForm({...editForm, mobile: e.target.value})}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                  <input
                    type="date"
                    value={editForm.date_of_birth}
                    onChange={(e) => setEditForm({...editForm, date_of_birth: e.target.value})}
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
              </form>
            </div>
          </div>
        )}
        {singleError && (
          <div className="mt-8 text-center text-red-600">{singleError}</div>
        )}
        {/* Student List */}
        <div className="mt-8">
          {/* Desktop Table View */}
          <div className="hidden md:block">
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
                  {(singleStudent ? [singleStudent] : students).map((student) => (
                    <tr key={student.roll_no} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.roll_no}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.father_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.gender}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.category}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.mobile}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : 'N/A'}</td>
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
              {students.length === 0 && branch && year && !loading && !hint && (
                <div className="text-center py-10 text-gray-500">
                  No students found for selected branch and year.
                </div>
              )}
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {(singleStudent ? [singleStudent] : students).map((student) => (
              <div key={student.roll_no} className="bg-white rounded-lg shadow p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{student.name}</h3>
                    <p className="text-sm text-gray-600">Roll No: {student.roll_no}</p>
                  </div>
                  <button
                    onClick={() => handleEditClick(student)}
                    className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                  >
                    Edit
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Father:</span>
                    <p className="text-gray-600">{student.father_name}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Gender:</span>
                    <p className="text-gray-600">{student.gender}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Category:</span>
                    <p className="text-gray-600">{student.category}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Phone:</span>
                    <p className="text-gray-600">{student.mobile}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium text-gray-700">Date of Birth:</span>
                    <p className="text-gray-600">{student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : 'N/A'}</p>
                  </div>
                </div>
              </div>
            ))}
            {students.length === 0 && branch && year && !loading && !hint && (
              <div className="text-center py-10 text-gray-500 bg-white rounded-lg">
                No students found for selected branch and year.
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
