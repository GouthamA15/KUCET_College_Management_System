'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Mail, Briefcase, UserCircle, Search, CheckCircle } from 'lucide-react';
import ManageFacultyModal from './ManageFacultyModal';

export default function ActiveFacultyList() {
  const [facultyList, setFacultyList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [manageModal, setManageModal] = useState(null);

  const fetchFaculty = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/staff/hod/active-faculty');
      if (res.ok) {
        const data = await res.json();
        setFacultyList(data.data || []);
      } else {
        toast.error('Failed to load faculty list');
      }
    } catch (_e) {
      toast.error('An error occurred loading faculty');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFaculty();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48 border border-gray-200 rounded-lg bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0b3578]"></div>
      </div>
    );
  }



  const filtered = facultyList.filter(f => 
    f.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    f.employee_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status) => {
    if (status === 'ACTIVE') {
      return (
        <span className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-green-200 uppercase tracking-wider">
          <CheckCircle size={10} /> Active
        </span>
      );
    }
    if (status === 'DISABLED') {
      return (
        <span className="flex items-center gap-1 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[10px] font-bold border border-gray-200 uppercase tracking-wider">
          Disabled
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-yellow-200 uppercase tracking-wider">
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Active Faculty</h2>
          <p className="text-sm text-gray-500">All faculty members assigned to your department.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <Search size={16} />
          </div>
          <input
            type="text"
            className="pl-9 w-full border border-gray-300 rounded-md py-2 text-sm focus:ring-2 focus:ring-[#0b3578] focus:border-[#0b3578] outline-none"
            placeholder="Search by name or Employee ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(faculty => (
            <div key={faculty.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer relative group">
              <div className="absolute top-0 right-0 p-2.5">
                {getStatusBadge(faculty.account_status)}
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-[#0b3578]/10 text-[#0b3578] flex items-center justify-center font-bold text-lg uppercase shrink-0">
                  {faculty.name?.charAt(0) || 'F'}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 leading-tight text-sm group-hover:text-[#0b3578] transition-colors">{faculty.name}</h3>
                  <p className="text-[10px] text-gray-500 font-medium mt-0.5">{faculty.employee_id}</p>
                </div>
              </div>
              
              <div className="space-y-1.5 mt-2 pt-2.5 border-t border-gray-100">
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <Briefcase size={13} className="text-gray-400 shrink-0" />
                  <span className="truncate" title={faculty.designation}>{faculty.designation || 'Faculty Member'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <Mail size={13} className="text-gray-400 shrink-0" />
                  <span className="truncate" title={faculty.email}>{faculty.email}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <UserCircle size={13} className="text-gray-400 shrink-0" />
                  <span className="truncate">Dept: {faculty.department_code}</span>
                </div>
              </div>

              {/* Manage Action */}
              {(faculty.account_status === 'ACTIVE' || faculty.account_status === 'DISABLED') && (
                <div className="mt-3 pt-2.5 border-t border-gray-100 flex justify-end">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setManageModal(faculty); }}
                    className="text-[10px] font-semibold text-[#0b3578] hover:text-[#0a2d66] px-3 py-1 border border-[#0b3578] rounded-md transition-colors hover:bg-slate-50 cursor-pointer uppercase tracking-wider relative z-10"
                  >
                    Manage
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 p-8 border border-dashed border-gray-300 text-center rounded-lg">
          <p className="text-gray-500 font-medium">No active faculty found matching your search.</p>
        </div>
      )}

      {/* Confirmation Modal */}
      {manageModal && (
        <ManageFacultyModal 
          faculty={manageModal} 
          onClose={() => setManageModal(null)} 
          onSaved={() => {
            setManageModal(null);
            fetchFaculty();
          }} 
        />
      )}
    </div>
  );
}
