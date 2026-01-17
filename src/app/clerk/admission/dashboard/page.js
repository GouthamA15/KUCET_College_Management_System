
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AddStudentPage() {
  const [formData, setFormData] = useState({
    admission_no: '',
    roll_no: '',
    name: '',
    father_name: '',
    mother_name: '',
    date_of_birth: '',
    gender: '',
    religion: '',
    caste: '',
    sub_caste: '',
    category: '',
    address: '',
    mobile: '',
    email: '',
    qualifying_exam: '',
    scholarship_status: '',
    fee_payment_details: ''
  });
  const [error, setError] = useState(null);
  const router = useRouter();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const response = await fetch('/api/clerk/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add student');
      }

      router.push('/clerk/admission/dashboard');
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">Add New Student</h1>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.keys(formData).map((key) => (
            <div key={key}>
              <label htmlFor={key} className="block text-sm font-medium text-gray-700 capitalize">
                {key.replace('_', ' ')}
              </label>
              <input
                type={key === 'date_of_birth' ? 'date' : 'text'}
                id={key}
                name={key}
                value={formData[key]}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
          ))}
          <div className="md:col-span-2">
            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Add Student
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
