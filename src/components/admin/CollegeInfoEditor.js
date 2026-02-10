
// src/components/admin/CollegeInfoEditor.js
"use client";

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export default function CollegeInfoEditor() {
  const [firstSemMonth, setFirstSemMonth] = useState('');
  const [firstSemDay, setFirstSemDay] = useState('');
  const [secondSemMonth, setSecondSemMonth] = useState('');
  const [secondSemDay, setSecondSemDay] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCollegeInfo();
  }, []);

  const fetchCollegeInfo = async () => {
    try {
      const res = await fetch('/api/public/college-info');
      if (res.ok) {
        const data = await res.json();
        if (data.collegeInfo) {
          setFirstSemMonth(data.collegeInfo.first_sem_start_month || '');
          setFirstSemDay(data.collegeInfo.first_sem_start_day || '');
          setSecondSemMonth(data.collegeInfo.second_sem_start_month || '');
          setSecondSemDay(data.collegeInfo.second_sem_start_day || '');
        }
      } else {
        toast.error('Failed to fetch college info.');
      }
    } catch (error) {
      console.error('Error fetching college info:', error);
      toast.error('Network error while fetching college info.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/college-info', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          first_sem_start_month: firstSemMonth === '' ? null : parseInt(firstSemMonth),
          first_sem_start_day: firstSemDay === '' ? null : parseInt(firstSemDay),
          second_sem_start_month: secondSemMonth === '' ? null : parseInt(secondSemMonth),
          second_sem_start_day: secondSemDay === '' ? null : parseInt(secondSemDay),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'College info updated successfully!');
        // Re-fetch to ensure UI is in sync
        fetchCollegeInfo();
      } else {
        toast.error(data.error || 'Failed to update college info.');
      }
    } catch (error) {
      console.error('Error saving college info:', error);
      toast.error('Network error while saving college info.');
    } finally {
      setSaving(false);
    }
  };

  const renderMonthOptions = () => {
    const months = [];
    for (let i = 1; i <= 12; i++) {
      months.push(<option key={i} value={i}>{String(i).padStart(2, '0')}</option>);
    }
    return months;
  };

  const renderDayOptions = () => {
    const days = [];
    for (let i = 1; i <= 31; i++) {
      days.push(<option key={i} value={i}>{String(i).padStart(2, '0')}</option>);
    }
    return days;
  };


  if (loading) {
    return <div className="text-center text-gray-600">Loading college information...</div>;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md max-w-md mx-auto">
      <h3 className="text-lg font-semibold text-[#0b3578] mb-4">Semester Start Dates (Month/Day)</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">First Semester Start:</label>
          <div className="mt-1 flex space-x-2">
            <select
              value={firstSemMonth}
              onChange={(e) => setFirstSemMonth(e.target.value)}
              className="mt-1 block w-1/2 p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="">Month</option>
              {renderMonthOptions()}
            </select>
            <select
              value={firstSemDay}
              onChange={(e) => setFirstSemDay(e.target.value)}
              className="mt-1 block w-1/2 p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="">Day</option>
              {renderDayOptions()}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Second Semester Start:</label>
          <div className="mt-1 flex space-x-2">
            <select
              value={secondSemMonth}
              onChange={(e) => setSecondSemMonth(e.target.value)}
              className="mt-1 block w-1/2 p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="">Month</option>
              {renderMonthOptions()}
            </select>
            <select
              value={secondSemDay}
              onChange={(e) => setSecondSemDay(e.target.value)}
              className="mt-1 block w-1/2 p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="">Day</option>
              {renderDayOptions()}
            </select>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
            saving ? 'bg-gray-400' : 'bg-[#0b3578] hover:bg-[#0a2d66]'
          } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0b3578]`}
        >
          {saving ? 'Saving...' : 'Save Semester Dates'}
        </button>
      </div>
    </div>
  );
}
