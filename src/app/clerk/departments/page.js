"use client";
import { useClerk } from '@/context/ClerkContext';
import { BookOpen, Monitor, Cpu, Zap, PenTool } from 'lucide-react';

export default function ClerkDepartmentsPage() {
  const { clerkData } = useClerk();

  const departments = [
    { code: 'CSE', name: 'Computer Science and Engineering', icon: <Monitor className="w-8 h-8 text-blue-500" /> },
    { code: 'IT', name: 'Information Technology', icon: <Monitor className="w-8 h-8 text-indigo-500" /> },
    { code: 'ECE', name: 'Electronics and Communication', icon: <Zap className="w-8 h-8 text-yellow-500" /> },
    { code: 'EEE', name: 'Electrical and Electronics', icon: <Zap className="w-8 h-8 text-orange-500" /> },
    { code: 'MECH', name: 'Mechanical Engineering', icon: <PenTool className="w-8 h-8 text-slate-500" /> },
    { code: 'CIVIL', name: 'Civil Engineering', icon: <BookOpen className="w-8 h-8 text-emerald-500" /> },
    { code: 'MINING', name: 'Mining Engineering', icon: <PenTool className="w-8 h-8 text-amber-600" /> },
  ];

  return (
    <div className="max-w-7xl mx-auto w-full p-4 md:p-6">
      <h1 className="text-2xl md:text-3xl font-bold mb-6 text-slate-800 border-b pb-4">
        Institutional Departments
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.map((dept) => (
          <div key={dept.code} className="bg-white border rounded-lg p-6 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow">
            <div className="mb-4 bg-slate-50 p-4 rounded-full">
              {dept.icon}
            </div>
            <h2 className="text-xl font-bold text-slate-800">{dept.code}</h2>
            <p className="text-slate-600 mt-2">{dept.name}</p>
            <div className="mt-4 pt-4 border-t w-full">
              <span className="text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                Active Department
              </span>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-8 bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800">
        <strong>Note:</strong> As a {clerkData?.role} clerk, your access is limited to cross-departmental student records and institutional requests. To manage specific branch settings, please contact the respective Head of Department (HOD).
      </div>
    </div>
  );
}
