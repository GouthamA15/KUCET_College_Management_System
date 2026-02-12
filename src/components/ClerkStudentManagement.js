"use client";
import React, { useState, useEffect } from 'react';
import BulkImportStudents from '@/components/BulkImportStudents';
import AddNewStudent from './clerk/student-management/AddNewStudent';
import FetchStudent from './clerk/student-management/FetchStudent';
import ViewEditStudent from './clerk/student-management/ViewEditStudent';

export default function ClerkStudentManagement() {
  const [activeAction, setActiveAction] = useState(null);
  const [fetchedStudent, setFetchedStudent] = useState(null);
  const [personalFull, setPersonalFull] = useState({});
  const [academicsList, setAcademicsList] = useState([]);
  const [feesList, setFeesList] = useState([]);
  const [feeDetails, setFeeDetails] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [originalEditValues, setOriginalEditValues] = useState(null);
  const [originalPersonalFull, setOriginalPersonalFull] = useState(null);
  const [originalAcademicsList, setOriginalAcademicsList] = useState(null);

  useEffect(() => {
    if (activeAction === null) {
      // Cleanup logic if necessary
    }
  }, [activeAction]);
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-semibold mb-4">Student Management</h2>
      <div className="flex flex-col md:flex-row md:space-x-2 space-y-3 md:space-y-0 mb-4">
        <button onClick={() => setActiveAction(prev => (prev === 'add' ? null : 'add'))} className={`w-full md:w-auto text-center px-3 py-3 rounded ${activeAction === 'add' ? 'bg-indigo-600 text-white' : 'bg-gray-100'} cursor-pointer whitespace-nowrap`}>Add New Student</button>
        <button onClick={() => setActiveAction(prev => (prev === 'import' ? null : 'import'))} className={`w-full md:w-auto text-center px-3 py-3 rounded ${activeAction === 'import' ? 'bg-indigo-600 text-white' : 'bg-gray-100'} cursor-pointer whitespace-nowrap`}>Import From Excel</button>
        <button onClick={() => setActiveAction(prev => (prev === 'fetch' ? null : 'fetch'))} className={`w-full md:w-auto text-center px-3 py-3 rounded ${activeAction === 'fetch' ? 'bg-indigo-600 text-white' : 'bg-gray-100'} cursor-pointer whitespace-nowrap`}>Fetch Student</button>
        <button onClick={() => { if (fetchedStudent) setActiveAction(prev => (prev === 'view' ? null : 'view')); }} disabled={!fetchedStudent} className={`w-full md:w-auto text-center px-3 py-3 rounded ${activeAction === 'view' ? 'bg-indigo-600 text-white' : 'bg-gray-100'} ${!fetchedStudent ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} whitespace-nowrap`}>View / Edit Student</button>
      </div>

      {activeAction === 'add' && <AddNewStudent />}
      {activeAction === 'import' && <BulkImportStudents onReset={() => {}} onImportSuccess={() => {}} />}
      {activeAction === 'fetch' && <FetchStudent 
                                      setActiveAction={setActiveAction} 
                                      setFetchedStudent={setFetchedStudent} 
                                      setPersonalFull={setPersonalFull}
                                      setAcademicsList={setAcademicsList}
                                      setFeesList={setFeesList}
                                      setFeeDetails={setFeeDetails}
                                      setEditValues={setEditValues}
                                      setOriginalEditValues={setOriginalEditValues}
                                      setOriginalPersonalFull={setOriginalPersonalFull}
                                      setOriginalAcademicsList={setOriginalAcademicsList}
                                      />}
      {activeAction === 'view' && <ViewEditStudent 
                                      fetchedStudent={fetchedStudent} 
                                      setActiveAction={setActiveAction}
                                      />}
    </div>
  );
}