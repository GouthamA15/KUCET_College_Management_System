"use client";

import { useState } from 'react';
import { useAdmin } from '@/context/AdminContext';
import toast from 'react-hot-toast';

import PendingClerkRequests from '@/components/admin/PendingClerkRequests';

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
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-full max-w-6xl mx-auto bg-white border border-slate-200 shadow-sm p-4 sm:p-8 text-center">
          <p className="text-slate-500 animate-pulse uppercase text-xs font-bold tracking-widest">Loading clerks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-2 sm:p-4">
      <div className="w-full max-w-6xl mx-auto">
        <PendingClerkRequests onRequestAction={refreshClerks} />

        <div className="bg-white border border-slate-200 shadow-sm p-4 sm:p-6 lg:p-8">
          <h1 className="text-xl sm:text-2xl font-bold text-[#0b3578] mb-6 uppercase tracking-tight">Active Clerks Directory</h1>
        {clerks.length === 0 ? (
          <p className="text-slate-500 italic text-sm">No clerks found.</p>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full bg-white border border-slate-200">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="py-3 px-4 border-b border-slate-200 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">ID</th>
                    <th className="py-3 px-4 border-b border-slate-200 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Name</th>
                    <th className="py-3 px-4 border-b border-slate-200 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest text-sm">Email</th>
                    <th className="py-3 px-4 border-b border-slate-200 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest text-sm">Emp ID</th>
                    <th className="py-3 px-4 border-b border-slate-200 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Role</th>
                    <th className="py-3 px-4 border-b border-slate-200 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">HOD / Branch</th>
                    <th className="py-3 px-4 border-b border-slate-200 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active</th>
                    <th className="py-3 px-4 border-b border-slate-200 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clerks.map((clerk) => (
                    <tr key={clerk.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 text-[11px] text-slate-400 font-mono">#{clerk.id}</td>
                      <td className="py-3 px-4 text-xs font-bold text-slate-800">
                        {editingClerkId === clerk.id ? (
                          <input
                            type="text"
                            name="name"
                            value={editedClerk.name ?? ''}
                            onChange={handleChange}
                            className="w-full border border-slate-200 rounded px-2 py-1 text-xs"
                          />
                        ) : (
                          clerk.name
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 max-w-[150px] truncate">
                        {editingClerkId === clerk.id ? (
                          <input
                            type="email"
                            name="email"
                            value={editedClerk.email ?? ''}
                            onChange={handleChange}
                            className="w-full border border-slate-200 rounded px-2 py-1 text-xs"
                          />
                        ) : (
                          clerk.email
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {editingClerkId === clerk.id ? (
                          <input
                            type="text"
                            name="employee_id"
                            value={editedClerk.employee_id ?? ''}
                            onChange={handleChange}
                            className="w-full border border-slate-200 rounded px-2 py-1 text-xs"
                          />
                        ) : (
                          clerk.employee_id
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {editingClerkId === clerk.id ? (
                          <select
                            name="role"
                            value={editedClerk.role ?? ''}
                            onChange={handleChange}
                            className="w-full border border-slate-200 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-tight"
                          >
                            <option value="scholarship">Scholarship</option>
                            <option value="admission">Admission</option>
                            <option value="faculty">Faculty</option>
                          </select>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 border border-slate-100 px-1.5 py-0.5 rounded">{clerk.role}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {editingClerkId === clerk.id ? (
                          <div className="flex flex-col gap-2 min-w-[150px]">
                            {editedClerk.role === 'faculty' && (
                              <div className="flex items-center gap-2">
                                <label className="text-[10px] text-slate-400 font-black uppercase">HOD</label>
                                <input
                                  type="checkbox"
                                  name="is_hod"
                                  checked={!!editedClerk.is_hod}
                                  onChange={handleChange}
                                  className="form-checkbox h-3.5 w-3.5 text-[#0b3578]"
                                />
                                <select
                                  name="branch"
                                  value={editedClerk.branch ?? ''}
                                  onChange={handleChange}
                                  className="border border-slate-200 rounded px-1 py-1 text-[9px] font-bold uppercase"
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
                            <span className="text-slate-600 uppercase tracking-widest text-[10px] font-black">{clerk.branch || '-'}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {editingClerkId === clerk.id ? (
                          <input
                            type="checkbox"
                            name="is_active"
                            checked={!!editedClerk.is_active}
                            onChange={handleChange}
                            className="form-checkbox h-3.5 w-3.5 text-[#0b3578]"
                          />
                        ) : (
                          <span className={`text-[10px] font-black uppercase tracking-widest ${clerk.is_active ? 'text-green-600' : 'text-red-500'}`}>
                            {clerk.is_active ? 'Active' : 'Offline'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {editingClerkId === clerk.id ? (
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => handleSave(clerk.id)}
                              className="px-2 py-1 bg-[#0b3578] text-white rounded hover:bg-[#0a2d66] text-[9px] font-black uppercase tracking-wider transition-all"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingClerkId(null)}
                              className="px-2 py-1 bg-slate-100 text-slate-400 rounded hover:bg-slate-200 text-[9px] font-black uppercase tracking-wider transition-all"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => handleEdit(clerk)}
                              className="p-1.5 text-slate-400 hover:text-[#0b3578] hover:bg-blue-50 rounded-lg transition-all"
                              title="Edit Clerk"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(clerk.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50"
                              title="Delete Clerk"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden flex flex-col gap-4">
              {clerks.map((clerk) => (
                <div key={clerk.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                  {editingClerkId === clerk.id ? (
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 block">Name</label>
                        <input
                          type="text"
                          name="name"
                          value={editedClerk.name ?? ''}
                          onChange={handleChange}
                          className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 block">Email</label>
                        <input
                          type="email"
                          name="email"
                          value={editedClerk.email ?? ''}
                          onChange={handleChange}
                          className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 block">Emp ID</label>
                        <input
                          type="text"
                          name="employee_id"
                          value={editedClerk.employee_id ?? ''}
                          onChange={handleChange}
                          className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 block">Role</label>
                          <select
                            name="role"
                            value={editedClerk.role ?? ''}
                            onChange={handleChange}
                            className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs font-bold uppercase"
                          >
                            <option value="scholarship">Scholarship</option>
                            <option value="admission">Admission</option>
                            <option value="faculty">Faculty</option>
                          </select>
                        </div>
                        <div className="flex items-center h-full pt-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              name="is_active"
                              checked={!!editedClerk.is_active}
                              onChange={handleChange}
                              className="form-checkbox h-4 w-4 text-[#0b3578]"
                            />
                            <span className="text-xs font-bold text-slate-600">Active</span>
                          </label>
                        </div>
                      </div>
                      
                      {editedClerk.role === 'faculty' && (
                        <div className="bg-slate-50 p-3 rounded border border-slate-200 flex flex-col gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              name="is_hod"
                              checked={!!editedClerk.is_hod}
                              onChange={handleChange}
                              className="form-checkbox h-4 w-4 text-[#0b3578]"
                            />
                            <span className="text-xs font-bold text-slate-600">Is HOD?</span>
                          </label>
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 block">Branch</label>
                            <select
                              name="branch"
                              value={editedClerk.branch ?? ''}
                              onChange={handleChange}
                              className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs font-bold uppercase"
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
                        </div>
                      )}

                      <div className="flex gap-2 mt-2 pt-3 border-t border-slate-100">
                        <button
                          onClick={() => handleSave(clerk.id)}
                          className="flex-1 py-2 bg-[#0b3578] text-white rounded hover:bg-[#0a2d66] text-xs font-black uppercase tracking-wider transition-all"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingClerkId(null)}
                          className="flex-1 py-2 bg-slate-100 text-slate-500 rounded hover:bg-slate-200 text-xs font-black uppercase tracking-wider transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-bold text-slate-800">{clerk.name}</h3>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${clerk.is_active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                              {clerk.is_active ? 'Active' : 'Offline'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 font-mono">Emp ID: {clerk.employee_id} | ID: #{clerk.id}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEdit(clerk)}
                            className="p-2 text-slate-400 hover:text-[#0b3578] hover:bg-blue-50 rounded-lg transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(clerk.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="truncate">{clerk.email}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 bg-slate-50 border border-slate-200 px-2 py-1 rounded shadow-sm">{clerk.role}</span>
                        {clerk.is_hod && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-black uppercase shadow-sm border border-blue-200">HOD</span>}
                        {clerk.branch && <span className="bg-slate-100 text-slate-700 uppercase tracking-widest text-[10px] font-black px-2 py-1 rounded shadow-sm border border-slate-200">{clerk.branch}</span>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}