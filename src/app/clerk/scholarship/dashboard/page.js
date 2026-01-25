"use client";

import { useState } from 'react';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import NonScholarshipView from './NonScholarshipView';
import FullScholarshipView from './FullScholarshipView';
import PartialScholarshipView from './PartialScholarshipView';

export default function ScholarshipDashboard() {
  const handleLogout = () => {
    document.cookie = 'clerk_auth=; Max-Age=0; path=/;';
    document.cookie = 'clerk_logged_in=; Max-Age=0; path=/;';
    sessionStorage.removeItem('clerk_authenticated');
    window.location.replace('/');
  };
  const [rollNo, setRollNo] = useState('');
  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scholarshipType, setScholarshipType] = useState(null);

  const getBranchFromRollNo = (rollNo) => {
    const lastPart = rollNo.includes('T') ? rollNo.slice(-4) : rollNo.slice(-5);
    const branchCode = lastPart.substring(0, 2);
    const branchMap = {
      '09': 'CSE',
      '30': 'CSD',
      '15': 'ECE',
      '12': 'EEE',
      '00': 'CIVIL',
      '18': 'IT',
      '03': 'MECH',
    };
    return branchMap[branchCode] || 'Unknown';
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStudentData(null);
    setScholarshipType(null);
    const toastId = toast.loading('Searching for student...');

    try {
      const res = await fetch(`/api/clerk/scholarship/${rollNo}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch student data');
      }

      setStudentData(data);
      
      if (data.scholarship.length === 0 || data.scholarship[0]?.application_no === data.student.roll_no) {
        setScholarshipType('non');
      } else {
        const branch = getBranchFromRollNo(data.student.roll_no);
        if (['CSE', 'ECE', 'EEE', 'MECH'].includes(branch)) {
          setScholarshipType('full');
        } else if (['CSD', 'CIVIL', 'IT'].includes(branch)) {
          setScholarshipType('partial');
        } else {
            setScholarshipType('unknown');
        }
      }

      toast.success('Student found!', { id: toastId });
    } catch (error) {
      toast.error(error.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (updatedData) => {
    setLoading(true);
    const toastId = toast.loading('Updating student data...');

    try {
      const res = await fetch(`/api/clerk/scholarship/${rollNo}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update student data');
      }

      toast.success('Student data updated successfully!', { id: toastId });
      // Refresh data
      handleSearch(new Event('submit'));
    } catch (error) {
      toast.error(error.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const renderDashboard = () => {
    if (!studentData) return null;

    switch (scholarshipType) {
      case 'non':
        return <NonScholarshipView student={studentData.student} />;
      case 'full':
        return (
          <FullScholarshipView
            student={studentData.student}
            scholarshipData={studentData.scholarship}
            onUpdate={(data) => handleUpdate({ scholarship: data })}
          />
        );
      case 'partial':
        return (
          <PartialScholarshipView
            student={studentData.student}
            scholarshipData={studentData.scholarship}
            feeData={studentData.fees}
            onUpdate={(data) => handleUpdate(data)}
          />
        );
      default:
        return <p>Could not determine scholarship type for this student.</p>;
    }
  };

  return (
    <>
      <Header />
      <Navbar clerkMode={true} clerkMinimal={true} onLogout={handleLogout} />
      <main className="min-h-screen bg-gray-100 flex flex-col items-center py-8">
        <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-[#0b3578] mb-6">Scholarship Dashboard</h1>
          <form onSubmit={handleSearch} className="flex gap-4 mb-8">
            <input
              type="text"
              value={rollNo}
              onChange={(e) => setRollNo(e.target.value)}
              placeholder="Enter Roll Number"
              className="flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#0b3578] hover:bg-[#0a2d66] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>

          {renderDashboard()}
        </div>
      </main>
      <Footer />
    </>
  );
}