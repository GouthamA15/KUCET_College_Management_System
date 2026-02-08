import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { parseDate } from '@/lib/date'; // Import parseDate

// Function to format YYYY-MM-DD to DD-MM-YYYY
const formatToDDMMYYYY = (dateString) => {
  if (!dateString || dateString === '0000-00-00') return ''; // Handle null or invalid date from API
  try {
    const date = new Date(dateString); // Parse YYYY-MM-DD
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (e) {
    console.error("Error formatting date to DD-MM-YYYY:", dateString, e);
    return '';
  }
};

// Function to handle DD-MM-YYYY input formatting
const handleDateInputChange = (setter) => (e) => {
  const raw = e.target.value;
  // strip non-digits
  const digits = raw.replace(/\D/g, '').slice(0, 8); // Max 8 digits for DDMMYYYY
  let formatted = digits;
  if (digits.length >= 5) {
    formatted = `${digits.slice(0,2)}-${digits.slice(2,4)}-${digits.slice(4)}`;
  } else if (digits.length >= 3) {
    formatted = `${digits.slice(0,2)}-${digits.slice(2)}`;
  }
  setter(formatted);
};

// Function to handle paste for DD-MM-YYYY input
const handleDatePaste = (setter) => (e) => {
  e.preventDefault();
  const paste = (e.clipboardData || window.clipboardData).getData('text') || '';
  const digits = paste.replace(/\D/g, '').slice(0, 8);
  let formatted = digits;
  if (digits.length >= 5) {
    formatted = `${digits.slice(0,2)}-${digits.slice(2,4)}-${digits.slice(4)}`;
  } else if (digits.length >= 3) {
    formatted = `${digits.slice(0,2)}-${digits.slice(2)}`;
  }
  setter(formatted);
};


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
        setFirstSemDate(formatToDDMMYYYY(data.first_sem_start_date));
        setSecondSemDate(formatToDDMMYYYY(data.second_sem_start_date));
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
      // Convert DD-MM-YYYY from state to YYYY-MM-DD for API
      const apiFirstSemDate = firstSemDate ? parseDate(firstSemDate) : null;
      const apiSecondSemDate = secondSemDate ? parseDate(secondSemDate) : null;

      // Validate parsed dates
      if (firstSemDate && !apiFirstSemDate) {
          toast.error('Invalid format for First Semester Start Date. Please use DD-MM-YYYY.');
          setIsSaving(false);
          return;
      }
      if (secondSemDate && !apiSecondSemDate) {
          toast.error('Invalid format for Second Semester Start Date. Please use DD-MM-YYYY.');
          setIsSaving(false);
          return;
      }
      
      const response = await fetch('/api/admin/college-info', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_sem_start_date: apiFirstSemDate ? apiFirstSemDate.toISOString().split('T')[0] : null,
          second_sem_start_date: apiSecondSemDate ? apiSecondSemDate.toISOString().split('T')[0] : null,
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
            First Semester Start Date (DD-MM-YYYY)
          </label>
          <input
            type="text" // Changed to text
            inputMode="numeric"
            id="firstSemDate"
            maxLength={10}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            placeholder="DD-MM-YYYY"
            value={firstSemDate}
            onKeyDown={(e) => {
              const allowedKeys = ['Backspace', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Delete', 'Home', 'End', '-'];
              if (allowedKeys.includes(e.key)) return;
              if (!/^[0-9]$/.test(e.key)) e.preventDefault();
            }}
            onChange={handleDateInputChange(setFirstSemDate)}
            onPaste={handleDatePaste(setFirstSemDate)}
            disabled={isSaving}
          />
        </div>
        <div>
          <label htmlFor="secondSemDate" className="block text-sm font-medium text-gray-700">
            Second Semester Start Date (DD-MM-YYYY)
          </label>
          <input
            type="text" // Changed to text
            inputMode="numeric"
            id="secondSemDate"
            maxLength={10}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            placeholder="DD-MM-YYYY"
            value={secondSemDate}
            onKeyDown={(e) => {
              const allowedKeys = ['Backspace', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Delete', 'Home', 'End', '-'];
              if (allowedKeys.includes(e.key)) return;
              if (!/^[0-9]$/.test(e.key)) e.preventDefault();
            }}
            onChange={handleDateInputChange(setSecondSemDate)}
            onPaste={handleDatePaste(setSecondSemDate)}
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
