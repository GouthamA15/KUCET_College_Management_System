'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import toast from 'react-hot-toast';

export default function StudentProfilePage() {
  const router = useRouter();
  const [studentData, setStudentData] = useState(null);
  const [activeTab, setActiveTab] = useState('basic');

  useEffect(() => {
    const stored = localStorage.getItem('logged_in_student');
    if (!stored) {
      router.replace('/');
      return;
    }
    const stu = JSON.parse(stored);
    fetchProfile(stu.rollno);
  }, [router]);

  const fetchProfile = async (rollno) => {
    try {
      const res = await fetch(`/api/student/${rollno}`);
      const data = await res.json();
      if (res.ok) {
        setStudentData(data);
      } else {
        toast.error(data.message || 'Failed to fetch profile');
      }
    } catch (error) {
      toast.error('Network error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('logged_in_student');
    sessionStorage.clear();
    router.replace('/');
  };

  if (!studentData) return null;

  const { student, scholarship, fees, academics } = studentData;

  const renderTable = (title, data, columns) => (
    <div className="mt-6">
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col} className="py-2 px-4 border-b text-left">{col.replace('_', ' ')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index}>
                {columns.map((col) => (
                  <td key={col} className="py-2 px-4 border-b">{row[col]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <Navbar studentProfileMode={true} onLogout={handleLogout} />

      <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center space-x-6">
            <img
              src="/assets/default-avatar.svg"
              alt="Profile Pic"
              className="w-24 h-24 object-cover rounded-full border-2 border-blue-200"
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{student.name}</h1>
              <p className="text-gray-600">{student.roll_no}</p>
            </div>
          </div>

          <div className="mt-8 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button onClick={() => setActiveTab('basic')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'basic' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                Basic Information
              </button>
              <button onClick={() => setActiveTab('scholarship')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'scholarship' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                Scholarship
              </button>
              <button onClick={() => setActiveTab('fees')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'fees' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                Fees
              </button>
              <button onClick={() => setActiveTab('academics')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'academics' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                Academics
              </button>
            </nav>
          </div>

          <div className="mt-8">
            {activeTab === 'basic' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {Object.entries(student).map(([key, value]) => (
                  <div key={key}>
                    <span className="font-semibold capitalize">{key.replace('_', ' ')}:</span> {value}
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'scholarship' && renderTable('Scholarship Details', scholarship, ['year', 'proceedings_no', 'amount_sanctioned', 'amount_disbursed', 'ch_no', 'date'])}
            {activeTab === 'fees' && renderTable('Fee Details', fees, ['year', 'challan_type', 'challan_no', 'date', 'amount'])}
            {activeTab === 'academics' && renderTable('Academic Details', academics, ['year', 'marks_secured', 'total_marks', 'percentage', 'division'])}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}