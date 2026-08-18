"use client";
import React, { useState } from 'react';
import BulkImportStudents from '@/components/BulkImportStudents';
import AddNewStudent from './staff/student-management/AddNewStudent';
import FetchStudent from './staff/student-management/FetchStudent';
import ViewEditStudent from './staff/student-management/ViewEditStudent';
import ExportStudents from './staff/student-management/ExportStudents';
import StudentHistoryCard from './staff/student-management/StudentHistoryCard';

export default function ClerkStudentManagement({ clerkId }) {
  const [activeAction, setActiveAction] = useState('fetch');
  const [fetchedStudent, setFetchedStudent] = useState(null);
  const [_personalFull, setPersonalFull] = useState({ /* empty */ });
  const [_academicsList, setAcademicsList] = useState([]);
  const [_feesList, setFeesList] = useState([]);
  const [_feeDetails, setFeeDetails] = useState(null);
  const [_editValues, setEditValues] = useState({ /* empty */ });
  const [_originalEditValues, setOriginalEditValues] = useState(null);
  const [_originalPersonalFull, setOriginalPersonalFull] = useState(null);
  const [_originalAcademicsList, setOriginalAcademicsList] = useState(null);
  
  const operations = [
    { id: 'fetch', title: 'Search Student' },
    { id: 'add', title: 'Add Student' },
    { id: 'view', title: 'Edit Student', disabled: !fetchedStudent },
    { id: 'import', title: 'Import Records' },
    { id: 'export', title: 'Export Records' },
    { id: 'history', title: 'Student History' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {operations.map(op => (
          <button
            key={op.id}
            onClick={() => { if (!op.disabled) setActiveAction(op.id); }}
            disabled={op.disabled}
            className={`px-3 py-2 rounded-md text-sm transition-colors ${
              activeAction === op.id
                ? 'bg-[#0b3578] text-white shadow-sm'
                : op.disabled
                  ? 'bg-gray-50 border border-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {op.title}
          </button>
        ))}
      </div>

      <div className="border border-slate-200 rounded-md bg-gradient-to-br from-white via-slate-50 to-slate-100 p-4 shadow-sm">
        {activeAction === 'add' && <AddNewStudent />}
        {activeAction === 'import' && <BulkImportStudents onReset={() => { /* empty */ }} onImportSuccess={() => { /* empty */ }} />}
        {activeAction === 'export' && <ExportStudents />}
        {activeAction === 'fetch' && (
          <FetchStudent 
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
          />
        )}
        {activeAction === 'view' && (
          <ViewEditStudent 
            fetchedStudent={fetchedStudent} 
            setFetchedStudent={setFetchedStudent}
            setActiveAction={setActiveAction}
          />
        )}
        {activeAction === 'history' && (
          <StudentHistoryCard currentClerkId={clerkId} />
        )}
      </div>
    </div>
  );
}