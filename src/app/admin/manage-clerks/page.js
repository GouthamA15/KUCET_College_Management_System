"use client";

import Header from '@/components/Header';
import AdminNavbar from '@/components/AdminNavbar';
import Footer from '@/components/Footer';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function ManageClerksPage() {
  const [clerks, setClerks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingClerkId, setEditingClerkId] = useState(null);
  const [editedClerk, setEditedClerk] = useState({});

  useEffect(() => {
    fetchClerks();
  }, []);

  const fetchClerks = async () => {
    try {
      const res = await fetch('/api/admin/clerks');
      if (!res.ok) {
        throw new Error('Failed to fetch clerks');
      }
      const data = await res.json();
      setClerks(data);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

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
      fetchClerks(); // Re-fetch clerks to update the list
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
      fetchClerks(); // Re-fetch clerks to update the list
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
          <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-8 text-center">
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
        <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-[#0b3578] mb-6">Manage Clerks</h1>
          {clerks.length === 0 ? (
            <p className="text-gray-600">No clerks found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200">
                <thead>
                  <tr>
                    <th className="py-2 px-4 border-b">ID</th>
                    <th className="py-2 px-4 border-b">Name</th>
                    <th className="py-2 px-4 border-b">Email</th>
                    <th className="py-2 px-4 border-b">Employee ID</th>
                    <th className="py-2 px-4 border-b">Role</th>
                    <th className="py-2 px-4 border-b">Active</th>
                    <th className="py-2 px-4 border-b">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clerks.map((clerk) => (
                    <tr key={clerk.id} className="hover:bg-gray-50">
                      <td className="py-2 px-4 border-b">{clerk.id}</td>
                      <td className="py-2 px-4 border-b">
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
                      <td className="py-2 px-4 border-b">
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
                      <td className="py-2 px-4 border-b">
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
                      <td className="py-2 px-4 border-b">
                        {editingClerkId === clerk.id ? (
                          <select
                            name="role"
                            value={editedClerk.role ?? ''}
                            onChange={handleChange}
                            className="w-full border rounded px-2 py-1"
                          >
                            <option value="scholarship">Scholarship</option>
                            <option value="admission">Admission</option>
                          </select>
                        ) : (
                          clerk.role
                        )}
                      </td>
                      <td className="py-2 px-4 border-b">
                        {editingClerkId === clerk.id ? (
                          <input
                            type="checkbox"
                            name="is_active"
                            checked={!!editedClerk.is_active}
                            onChange={handleChange}
                            className="form-checkbox h-5 w-5 text-indigo-600"
                          />
                        ) : (
                          clerk.is_active ? 'Yes' : 'No'
                        )}
                      </td>
                      <td className="py-2 px-4 border-b">
                        {editingClerkId === clerk.id ? (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleSave(clerk.id)}
                              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingClerkId(null)}
                              className="px-3 py-1 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEdit(clerk)}
                              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(clerk.id)}
                              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                            >
                              Delete
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
