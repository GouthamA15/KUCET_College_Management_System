"use client";

import { useState } from 'react';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function AdmissionDashboard() {
  const [formData, setFormData] = useState({
    // Initialize with all the fields from the images
    name: '',
    father_name: '',
    mother_name: '',
    date_of_birth: '',
    place_of_birth: '',
    gender: '',
    nationality: '',
    religion: '',
    caste: '',
    sub_caste: '',
    category: '',
    address: '',
    mobile: '',
    email: '',
    qualifying_exam: '',
    scholarship_status: 'Not Applied',
    fee_payment_details: '',
    course: '',
    branch: '',
    admission_type: 'regular',
    mother_tongue: '',
    father_occupation: '',
    student_aadhar_no: '',
    father_guardian_mobile_no: '',
    fee_reimbursement_category: 'No',
    identification_marks: '',
    present_address: '',
    permanent_address: '',
    apaar_id: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const toastId = toast.loading('Adding new student...');

    try {
      const res = await fetch('/api/clerk/admission/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add student');
      }

      toast.success('Student added successfully!', { id: toastId });
      // Clear form
      setFormData({
        name: '',
        father_name: '',
        mother_name: '',
        date_of_birth: '',
        place_of_birth: '',
        gender: '',
        nationality: '',
        religion: '',
        caste: '',
        sub_caste: '',
        category: '',
        address: '',
        mobile: '',
        email: '',
        qualifying_exam: '',
        scholarship_status: 'Not Applied',
        fee_payment_details: '',
        course: '',
        branch: '',
        admission_type: 'regular',
        mother_tongue: '',
        father_occupation: '',
        student_aadhar_no: '',
        father_guardian_mobile_no: '',
        fee_reimbursement_category: 'No',
        identification_marks: '',
        present_address: '',
        permanent_address: '',
        apaar_id: '',
      });
    } catch (error) {
      toast.error(error.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-100 flex flex-col items-center py-8">
        <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-[#0b3578] mb-6">Add New Student</h1>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Render form fields based on formData state */}
            {Object.keys(formData).map((key) => (
              <div key={key}>
                <label htmlFor={key} className="block text-sm font-medium text-gray-700 capitalize">
                  {key.replace(/_/g, ' ')}
                </label>
                <input
                  type={key.includes('date') ? 'date' : key.includes('email') ? 'email' : 'text'}
                  name={key}
                  id={key}
                  value={formData[key]}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  required
                />
              </div>
            ))}
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#0b3578] hover:bg-[#0a2d66] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {loading ? 'Adding...' : 'Add Student'}
              </button>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </>
  );
}