"use client";

import { useState } from 'react';
import { useAdmin } from '@/context/AdminContext';
import toast from 'react-hot-toast';

export default function CreateClerkPage() {
  const { refreshClerks } = useAdmin();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [employee_id, setEmployeeId] = useState('');
  const [role, setRole] = useState('scholarship'); 
  
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
          setRole('scholarship'); 
          refreshClerks();
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
      <div className="flex flex-col items-center p-2 sm:p-4">
        <div className="w-full max-w-md p-4 sm:p-6 lg:p-8 space-y-8 bg-white border border-slate-200 shadow-sm">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-[#0b3578] uppercase tracking-tight">Create Clerk Account</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">New Employee Credentialing</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Full Name</label>
              <input 
                id="name" 
                name="name" 
                type="text" 
                required 
                value={name ?? ''} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="e.g. Dr. Ramesh Kumar"
                className="block w-full px-3 py-2 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[#0b3578] transition-all text-xs" 
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Email address</label>
              <input 
                id="email" 
                name="email" 
                type="email" 
                autoComplete="email" 
                required 
                value={email ?? ''} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="official@kucet.ac.in"
                className="block w-full px-3 py-2 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[#0b3578] transition-all text-xs" 
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Temporary Password</label>
              <input 
                id="password" 
                name="password" 
                type="password" 
                required 
                value={password ?? ''} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="••••••••"
                className="block w-full px-3 py-2 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[#0b3578] transition-all text-xs font-mono" 
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="employee_id" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Employee ID</label>
              <input 
                id="employee_id" 
                name="employee_id" 
                type="text" 
                required 
                value={employee_id ?? ''} 
                onChange={(e) => setEmployeeId(e.target.value)} 
                placeholder="e.g. KUCET-2024-F01"
                className="block w-full px-3 py-2 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[#0b3578] transition-all text-xs" 
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="role" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Designated Role</label>
              <select 
                id="role" 
                name="role" 
                value={role ?? ''} 
                onChange={(e) => setRole(e.target.value)} 
                className="block w-full px-3 py-2 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[#0b3578] transition-all text-xs font-bold uppercase tracking-tighter"
              >
                <option value="scholarship">Scholarship Clerk</option>
                <option value="admission">Administrative Clerk</option>
                <option value="faculty">Academic Faculty</option>
              </select>
            </div>

            <div className="pt-2">
              <button 
                type="submit" 
                className="flex justify-center w-full px-4 py-2 text-xs font-bold text-white bg-[#0b3578] hover:bg-[#0a2d66] rounded transition-all uppercase tracking-widest shadow-sm"
              >
                Initialize Account
              </button>
            </div>
          </form>
        </div>
      </div>
    );
}