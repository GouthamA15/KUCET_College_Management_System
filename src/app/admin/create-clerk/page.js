"use client";


import Header from '@/components/Header';
import AdminNavbar from '@/components/AdminNavbar';
import Footer from '@/components/Footer';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function CreateClerkPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [employee_id, setEmployeeId] = useState('');
  const [role, setRole] = useState('scholarship'); // Default to scholarship
  
    const handleSubmit = async (e) => {
      e.preventDefault();
      const toastId = toast.loading('Creating clerk...');
  
      try {
        const res = await fetch('/api/admin/create-clerk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name, email, password, employee_id, role }),
        });
  
        const data = await res.json();
  
        if (res.ok && data.success) {
          toast.success(`Clerk created successfully! Clerk ID: ${data.clerkId}`, { id: toastId });
          setName('');
          setEmail('');
          setPassword('');
          setEmployeeId('');
          setRole('scholarship'); // Reset role to default after creation
        } else {
          if (res.status === 409) {
             toast.error('A clerk with this email already exists.', { id: toastId });
          } else {
             toast.error(data.error || 'Failed to create clerk.', { id: toastId });
          }
        }
      } catch (error) {
        console.error('Error creating clerk:', error);
        toast.error('An unexpected error occurred.', { id: toastId });
      }
    };
  
    return (
      <>
        <Header />
        <AdminNavbar />
        <main className="min-h-screen bg-gray-100 flex flex-col items-center py-8">
          <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-center text-gray-900">Create New Clerk Account</h2>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="name" className="text-sm font-medium text-gray-700">Name</label>
                <input id="name" name="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
              </div>
              <div>
                <label htmlFor="email" className="text-sm font-medium text-gray-700">Email address</label>
                <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
              </div>
              <div>
                <label htmlFor="password" className="text-sm font-medium text-gray-700">Temporary Password</label>
                <input id="password" name="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
              </div>
              <div>
              <label htmlFor="name" className="text-sm font-medium text-gray-700">Employee ID</label>
                <input id="employee_id" name="employee_id" type="text" required value={employee_id} onChange={(e) => setEmployeeId(e.target.value)} className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
              </div>
              <div>
                <label htmlFor="role" className="text-sm font-medium text-gray-700">Role</label>
                <select id="role" name="role" value={role} onChange={(e) => setRole(e.target.value)} className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  <option value="scholarship">Scholarship Clerk</option>
                  <option value="admission">Administrative  Clerk</option>
                </select>
              </div>            <div>
              <button type="submit" className="flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">Create Clerk</button>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </>
  );
}
