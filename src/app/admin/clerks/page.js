"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminClerksPage() {
  const [clerks, setClerks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingClerk, setEditingClerk] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', employee_id: '', is_active: 1 });
  const router = useRouter();

  const fetchClerks = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/clerks');
      if (res.ok) {
        const data = await res.json();
        setClerks(data);
      } else {
        setError('Failed to fetch clerks. You might need to log in as admin.');
        // Redirect logic moved to middleware/layout usually, but explicit here is fine
        router.push('/'); 
      }
    } catch (err) {
      console.error('Error fetching clerks:', err);
      setError('An unexpected error occurred while fetching clerks.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchClerks();
  }, [fetchClerks]);

  const handleDelete = async (clerkId) => {
    if (!window.confirm('Are you sure you want to delete this clerk?')) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/clerks/${clerkId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setMessage('Clerk deleted successfully!');
        fetchClerks(); // Re-fetch clerks to update the list
      } else {
        const data = await res.json();
        setMessage(data.error || 'Failed to delete clerk.');
      }
    } catch (err) {
      console.error('Error deleting clerk:', err);
      setMessage('An unexpected error occurred while deleting the clerk.');
    }
  };

  const handleEditClick = (clerk) => {
    setEditingClerk(clerk.id);
    setEditForm({
      name: clerk.name,
      email: clerk.email,
      employee_id: clerk.employee_id || '',
      is_active: clerk.is_active
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/admin/clerks/${editingClerk}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });

      if (res.ok) {
        setMessage('Clerk updated successfully!');
        setEditingClerk(null);
        fetchClerks();
      } else {
        const data = await res.json();
        setMessage(data.error || 'Failed to update clerk.');
      }
    } catch (err) {
      console.error('Error updating clerk:', err);
      setMessage('An unexpected error occurred while updating the clerk.');
    }
  };

  const setMessage = (msg) => {
    setError(msg);
    setTimeout(() => setError(''), 5000);
  };


  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading clerks...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Manage Clerks</h1>
        {error && <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-4" role="alert"><p>{error}</p></div>}
        
        {editingClerk && (
          <div className="mb-8 p-4 bg-gray-50 border rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Edit Clerk</h2>
            <form onSubmit={handleUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Employee ID</label>
                <input
                  type="text"
                  value={editForm.employee_id}
                  onChange={(e) => setEditForm({...editForm, employee_id: e.target.value})}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={editForm.is_active}
                  onChange={(e) => setEditForm({...editForm, is_active: parseInt(e.target.value)})}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value={1}>Active</option>
                  <option value={0}>Inactive</option>
                </select>
              </div>
              <div className="md:col-span-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingClerk(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">ID</th>
                <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Name</th>
                <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Email</th>
                <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Employee ID</th>
                <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Active</th>
                <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Created At</th>
                <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clerks.map((clerk) => (
                <tr key={clerk.id} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border-b text-sm text-gray-800">{clerk.id}</td>
                  <td className="py-2 px-4 border-b text-sm text-gray-800">{clerk.name}</td>
                  <td className="py-2 px-4 border-b text-sm text-gray-800">{clerk.email}</td>
                  <td className="py-2 px-4 border-b text-sm text-gray-800">{clerk.employee_id || 'N/A'}</td>
                  <td className="py-2 px-4 border-b text-sm text-gray-800">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${clerk.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {clerk.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-2 px-4 border-b text-sm text-gray-800">{new Date(clerk.created_at).toLocaleDateString()}</td>
                  <td className="py-2 px-4 border-b text-sm text-gray-800 space-x-2">
                    <button
                      onClick={() => handleEditClick(clerk)}
                      className="text-indigo-600 hover:text-indigo-900 font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(clerk.id)}
                      className="text-red-600 hover:text-red-900 font-semibold"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
