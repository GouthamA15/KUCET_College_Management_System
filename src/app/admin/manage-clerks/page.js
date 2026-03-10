"use client";

import Header from '@/components/Header';
import AdminNavbar from '@/components/AdminNavbar';
import Footer from '@/components/Footer';
import { useState } from 'react';
import { useAdmin } from '@/context/AdminContext';
import toast from 'react-hot-toast';

export default function ManageClerksPage() {
  const { clerks, loading, refreshClerks } = useAdmin();
  const [editingClerkId, setEditingClerkId] = useState(null);
  const [editedClerk, setEditedClerk] = useState({});

  const handleEdit = (clerk) => {
    setEditingClerkId(clerk.id);
    setEditedClerk({ ...clerk });
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditedClerk((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = async (id) => {
    const toastId = toast.loading('Saving changes...');
    try {
      const res = await fetch(`/api/admin/clerks/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editedClerk),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update clerk');
      }

      toast.success('Clerk updated successfully!', { id: toastId });
      setEditingClerkId(null);
      setEditedClerk({});
      refreshClerks();
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this clerk?')) {
      return;
    }

    const toastId = toast.loading('Deleting clerk...');
    try {
      const res = await fetch(`/api/admin/clerks/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete clerk');
      }

      toast.success('Clerk deleted successfully!', { id: toastId });
      refreshClerks();
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <AdminNavbar />
        <main className="min-h-screen bg-gray-100 flex flex-col items-center py-8">
          <div className="w-full max-w-6xl mx-auto bg-white rounded-xl shadow-lg p-8 text-center">
            <p>Loading clerks...</p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <AdminNavbar />
      <main className="min-h-screen bg-gray-100 flex flex-col items-center py-8">
        <div className="w-full max-w-6xl mx-auto bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-[#0b3578] mb-6">Manage Clerks</h1>
          {clerks.length === 0 ? (
            <p className="text-gray-600">No clerks found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200">
                <thead>
                  <tr>
                    <th className="py-2 px-4 border-b text-left">ID</th>
                    <th className="py-2 px-4 border-b text-left">Name</th>
                    <th className="py-2 px-4 border-b text-left text-sm">Email</th>
                    <th className="py-2 px-4 border-b text-left text-sm">Emp ID</th>
                    <th className="py-2 px-4 border-b text-left">Role</th>
                    <th className="py-2 px-4 border-b text-left">HOD / Branch</th>
                    <th className="py-2 px-4 border-b text-center">Active</th>
                    <th className="py-2 px-4 border-b text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clerks.map((clerk) => (
                    <tr key={clerk.id} className="hover:bg-gray-50">
                      <td className="py-2 px-4 border-b text-sm">{clerk.id}</td>
                      <td className="py-2 px-4 border-b text-sm">
                        {editingClerkId === clerk.id ? (
                          <input
                            type="text"
                            name="name"
                            value={editedClerk.name ?? ''}
                            onChange={handleChange}
                            className="w-full border rounded px-2 py-1"
                          />
                        ) : (
                          clerk.name
                        )}
                      </td>
                      <td className="py-2 px-4 border-b text-sm max-w-[150px] truncate">
                        {editingClerkId === clerk.id ? (
                          <input
                            type="email"
                            name="email"
                            value={editedClerk.email ?? ''}
                            onChange={handleChange}
                            className="w-full border rounded px-2 py-1"
                          />
                        ) : (
                          clerk.email
                        )}
                      </td>
                      <td className="py-2 px-4 border-b text-sm">
                        {editingClerkId === clerk.id ? (
                          <input
                            type="text"
                            name="employee_id"
                            value={editedClerk.employee_id ?? ''}
                            onChange={handleChange}
                            className="w-full border rounded px-2 py-1"
                          />
                        ) : (
                          clerk.employee_id
                        )}
                      </td>
                      <td className="py-2 px-4 border-b text-sm">
                        {editingClerkId === clerk.id ? (
                          <select
                            name="role"
                            value={editedClerk.role ?? ''}
                            onChange={handleChange}
                            className="w-full border rounded px-2 py-1"
                          >
                            <option value="scholarship">Scholarship</option>
                            <option value="admission">Admission</option>
                            <option value="faculty">Faculty</option>
                          </select>
                        ) : (
                          <span className="capitalize">{clerk.role}</span>
                        )}
                      </td>
                      <td className="py-2 px-4 border-b text-sm">
                        {editingClerkId === clerk.id ? (
                          <div className="flex flex-col gap-2 min-w-[150px]">
                            {editedClerk.role === 'faculty' && (
                              <div className="flex items-center gap-2">
                                <label className="text-[10px] text-gray-500 font-bold">HOD</label>
                                <input
                                  type="checkbox"
                                  name="is_hod"
                                  checked={!!editedClerk.is_hod}
                                  onChange={handleChange}
                                  className="form-checkbox h-4 w-4"
                                />
                                <select
                                  name="branch"
                                  value={editedClerk.branch ?? ''}
                                  onChange={handleChange}
                                  className="border rounded px-1 py-1 text-[10px]"
                                >
                                  <option value="">None</option>
                                  <option value="CSE">CSE</option>
                                  <option value="ECE">ECE</option>
                                  <option value="EEE">EEE</option>
                                  <option value="MECH">MECH</option>
                                  <option value="CIVIL">CIVIL</option>
                                  <option value="CSD">CSD</option>
                                  <option value="IT">IT</option>
                                </select>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {clerk.is_hod ? <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[9px] font-black uppercase">HOD</span> : null}
                            <span className="text-gray-600 uppercase tracking-tighter text-[10px] font-bold">{clerk.branch || '-'}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-4 border-b text-center">
                        {editingClerkId === clerk.id ? (
                          <input
                            type="checkbox"
                            name="is_active"
                            checked={!!editedClerk.is_active}
                            onChange={handleChange}
                            className="form-checkbox h-4 w-4 text-blue-600"
                          />
                        ) : (
                          <span className={clerk.is_active ? 'text-green-600 font-bold' : 'text-red-500'}>
                            {clerk.is_active ? 'Yes' : 'No'}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4 border-b">
                        {editingClerkId === clerk.id ? (
                          <div className="flex space-x-1">
                            <button
                              onClick={() => handleSave(clerk.id)}
                              className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-[10px] font-bold uppercase"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingClerkId(null)}
                              className="px-2 py-1 bg-gray-400 text-white rounded hover:bg-gray-500 text-[10px] font-bold uppercase"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="flex space-x-1">
                            <button
                              onClick={() => handleEdit(clerk)}
                              className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-[10px] font-bold uppercase"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(clerk.id)}
                              className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-[10px] font-bold uppercase"
                            >
                              Del
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
