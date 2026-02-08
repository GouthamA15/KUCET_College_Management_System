"use client";

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function CollegeInfoEditor() {
  const [firstSemDate, setFirstSemDate] = useState('');
  const [secondSemDate, setSecondSemDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchCollegeInfo();
  }, []);

  const fetchCollegeInfo = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/public/college-info');
      const data = await response.json();
      if (response.ok) {
        setFirstSemDate(data.first_sem_start_date || '');
        setSecondSemDate(data.second_sem_start_date || '');
      } else {
        toast.error(data.error || 'Failed to fetch college info.');
      }
    } catch (error) {
      console.error('Error fetching college info:', error);
      toast.error('Network error while fetching college info.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/college-info', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_sem_start_date: firstSemDate || null,
          second_sem_start_date: secondSemDate || null,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || 'College info updated successfully!');
      } else {
        toast.error(data.error || 'Failed to update college info.');
      }
    } catch (error) {
      console.error('Error saving college info:', error);
      toast.error('Network error while saving college info.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-6 bg-white rounded-lg shadow-md">
        <p className="text-gray-600">Loading college info...</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mt-8">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Manage Semester Dates</h3>
      <div className="space-y-4">
        <div>
          <label htmlFor="firstSemDate" className="block text-sm font-medium text-gray-700">
            First Semester Start Date
          </label>
          <input
            type="date"
            id="firstSemDate"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            value={firstSemDate}
            onChange={(e) => setFirstSemDate(e.target.value)}
            disabled={isSaving}
          />
        </div>
        <div>
          <label htmlFor="secondSemDate" className="block text-sm font-medium text-gray-700">
            Second Semester Start Date
          </label>
          <input
            type="date"
            id="secondSemDate"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            value={secondSemDate}
            onChange={(e) => setSecondSemDate(e.target.value)}
            disabled={isSaving}
          />
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Dates'}
          </button>
        </div>
      </div>
    </div>
  );
}
