'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';
// DOB will be a controlled numeric text input (DD-MM-YYYY)


export default function LoginPanel({ activePanel, onClose, onStudentLogin }) {
  const router = useRouter();
  const [studentForm, setStudentForm] = useState({ rollNumber: '', dob: '' });
  const [clerkForm, setClerkForm] = useState({ email: '', password: '' });
  const [adminForm, setAdminForm] = useState({ email: '', password: '' });
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentError, setStudentError] = useState('');
  const [clerkError, setClerkError] = useState('');
  const [adminError, setAdminError] = useState('');
  // Password visibility toggles for all panels
  const [studentPasswordVisible, setStudentPasswordVisible] = useState(false);
  const [clerkPasswordVisible, setClerkPasswordVisible] = useState(false);
  const [adminPasswordVisible, setAdminPasswordVisible] = useState(false);

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    setStudentLoading(true);
    setStudentError('');
    const toastId = toast.loading('Logging in...');
    try {
      // convert DD-MM-YYYY -> YYYY-MM-DD for server
      let dobForServer = '';
      if (studentForm.dob) {
        const p = studentForm.dob.split('-');
        if (p.length === 3) {
          const dd = p[0].padStart(2, '0');
          const mm = p[1].padStart(2, '0');
          const yyyy = p[2];
          dobForServer = `${yyyy}-${mm}-${dd}`;
        } else {
          dobForServer = studentForm.dob;
        }
      }

      const res = await fetch('/api/student/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollno: studentForm.rollNumber, dob: dobForServer }),
      });
      const data = await res.json();
      if (res.ok && data.student) {
        toast.success('Login successful!', { id: toastId });
        // Redirect to the student profile page
        router.replace('/student/profile');
      } else {
        toast.error(data.error || 'Login failed', { id: toastId });
        setStudentError(data.error || 'Login failed');
      }
    } catch (err) {
      toast.error('Network error', { id: toastId });
      setStudentError('Network error');
    } finally {
      setStudentLoading(false);
    }
  };

  const handleClerkSubmit = async (e) => {
    e.preventDefault();
    setClerkError('');
    const toastId = toast.loading('Logging in...');
    try {
      const res = await fetch('/api/clerk/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clerkForm),
      });

      const data = await res.json(); // Parse JSON to get error message

      if (res.ok) {
        toast.success('Login successful!', { id: toastId });
        // Prefer explicit role from response; fallback to generic
        const role = (data.role || '').toString().toLowerCase();
        if (role.includes('scholar')) {
          router.replace('/clerk/scholarship/dashboard');
        } else {
          // Treat everything else as admission/administrative by default
          router.replace('/clerk/admission/dashboard');
        }
      } else {
        toast.error(data.message || 'Clerk login failed', { id: toastId });
        setClerkError(data.message || 'Clerk login failed');
        console.error('Clerk login failed:', data.message);
      }
    } catch (error) {
      toast.error('An unexpected error occurred', { id: toastId });
      setClerkError('An unexpected error occurred');
      console.error('An error occurred during clerk login:', error);
    }
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setAdminError('');
    const toastId = toast.loading('Logging in...');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(adminForm),
      });
      
      const data = await res.json();

      if (res.ok) {
        toast.success('Login successful!', { id: toastId });
        router.replace('/admin/dashboard');
      } else {
        toast.error(data.message || 'Admin login failed', { id: toastId });
        setAdminError(data.message || 'Admin login failed');
        console.error('Admin login failed:', data.message);
      }
    } catch (error) {
      toast.error('An unexpected error occurred', { id: toastId });
      setAdminError('An unexpected error occurred');
      console.error('An error occurred during admin login:', error);
    }
  };

  if (!activePanel) return null;

  return (
    <div id="login-panels"
      className={`overflow-hidden transition-all duration-500 ease-out ${
        activePanel ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
      }`}
    >
      <div className="bg-gradient-to-b from-[#0b3578] to-[#1a4a8f] py-8 px-4">
        <div className="max-w-md mx-auto">
          
          {/* Student Login Panel */}
          <div 
            className={`transition-all duration-400 ease-out ${
              activePanel === 'student' 
                ? 'opacity-100 transform translate-y-0' 
                : 'opacity-0 transform -translate-y-4 absolute pointer-events-none'
            }`}
          >
            {activePanel === 'student' && (
              <div className="bg-white rounded-xl shadow-2xl p-8 animate-slideDown">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                    <svg className="w-8 h-8 text-[#0b3578]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-[#0b3578]">Student Login</h2>
                  <p className="text-gray-500 text-sm mt-1">Access your academic portal</p>
                </div>
                
                <form onSubmit={handleStudentSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Roll Number
                    </label>
                    <input
                      type="text"
                      value={studentForm.rollNumber}
                      onChange={(e) => setStudentForm({ ...studentForm, rollNumber: e.target.value.toUpperCase() })}
                      placeholder="Enter your Roll Number"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0b3578] focus:border-transparent transition-all duration-200 text-gray-800 placeholder-gray-400"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                      <span className="block text-xs text-gray-500 font-normal mt-0.5">
                        First time user ? Use your DOB in the format : DD-MM-YYYY
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type={studentPasswordVisible ? 'text' : 'password'}
                        value={studentForm.dob}
                        onChange={(e) => setStudentForm({ ...studentForm, dob: e.target.value })}
                        placeholder="Enter Password"
                        className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0b3578] focus:border-transparent transition-all duration-200 text-gray-800"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setStudentPasswordVisible((v) => !v)}
                        aria-label={studentPasswordVisible ? 'Hide password' : 'Show password'}
                        className="absolute inset-y-0 right-2 flex items-center justify-center px-2 text-gray-500 hover:text-gray-700 focus:outline-none"
                      >
                        {studentPasswordVisible ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                          </svg>
                        ) : (
                          // eye icon
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <div className="text-right mt-2">
                      <Link href="/forgot-password/student" className="text-xs text-blue-500 hover:text-blue-700">
                        Forgot Password?
                      </Link>
                    </div>
                  </div>
                  
                  <button
                    type="submit"
                    className="w-full bg-[#0b3578] text-white py-3 rounded-lg font-semibold hover:bg-[#0a2d66] transform hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl"
                    disabled={studentLoading}
                  >
                    {studentLoading ? 'Logging in...' : 'Login'}
                  </button>
                  {studentError && (
                    <div className="text-red-600 text-sm mt-2 text-center">{studentError}</div>
                  )}
                </form>
                
                <p className="text-center text-xs text-gray-700 mt-4">
                  Note : Login by DOB will work only for the students who haven't set their password yet
                </p>
              </div>
            )}
          </div>

          {/* Clerk Login Panel */}
          <div 
            className={`transition-all duration-400 ease-out ${
              activePanel === 'clerk' 
                ? 'opacity-100 transform translate-y-0' 
                : 'opacity-0 transform -translate-y-4 absolute pointer-events-none'
            }`}
          >
            {activePanel === 'clerk' && (
              <div className="bg-white rounded-xl shadow-2xl p-8 animate-slideDown">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                    <svg className="w-8 h-8 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-[#0b3578]">Employee Login</h2>
                  <p className="text-gray-500 text-sm mt-1">Administrative staff portal</p>
                </div>
                
                <form onSubmit={handleClerkSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={clerkForm.email}
                      onChange={(e) => setClerkForm({ ...clerkForm, email: e.target.value })}
                      placeholder="Enter your email"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent transition-all duration-200 text-gray-800 placeholder-gray-400"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={clerkPasswordVisible ? 'text' : 'password'}
                        value={clerkForm.password}
                        onChange={(e) => setClerkForm({ ...clerkForm, password: e.target.value })}
                        placeholder="Enter your password"
                        className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent transition-all duration-200 text-gray-800 placeholder-gray-400"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setClerkPasswordVisible((v) => !v)}
                        aria-label={clerkPasswordVisible ? 'Hide password' : 'Show password'}
                        className="absolute inset-y-0 right-2 flex items-center justify-center px-2 text-gray-500 hover:text-gray-700 focus:outline-none"
                      >
                        {clerkPasswordVisible ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <div className="text-right mt-2">
                      <Link href="/forgot-password/clerk" className="text-xs text-blue-500 hover:text-blue-700">
                        Forgot Password?
                      </Link>
                    </div>
                  </div>
                  
                  <button
                    type="submit"
                    className="w-full bg-green-700 text-white py-3 rounded-lg font-semibold hover:bg-green-800 transform hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    Login
                  </button>
                  {clerkError && (
                    <div className="text-red-600 text-sm mt-2 text-center">{clerkError}</div>
                  )}
                </form>
                
                <p className="text-center text-xs text-gray-500 mt-4">
                  Contact admin if you forgot your password
                </p>
              </div>
            )}
          </div>

          {/* Super Admin Login Panel */}
          <div 
            className={`transition-all duration-400 ease-out ${
              activePanel === 'admin' 
                ? 'opacity-100 transform translate-y-0' 
                : 'opacity-0 transform -translate-y-4 absolute pointer-events-none'
            }`}
          >
            {activePanel === 'admin' && (
              <div className="bg-white rounded-xl shadow-2xl p-8 animate-slideDown">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                    <svg className="w-8 h-8 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-[#0b3578]">Super Admin</h2>
                  <p className="text-gray-500 text-sm mt-1">System administrator access</p>
                </div>
                
                <form onSubmit={handleAdminSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={adminForm.email}
                      onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                      placeholder="Enter admin email"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent transition-all duration-200 text-gray-800 placeholder-gray-400"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={adminPasswordVisible ? 'text' : 'password'}
                        value={adminForm.password}
                        onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                        placeholder="Enter admin password"
                        className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent transition-all duration-200 text-gray-800 placeholder-gray-400"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setAdminPasswordVisible((v) => !v)}
                        aria-label={adminPasswordVisible ? 'Hide password' : 'Show password'}
                        className="absolute inset-y-0 right-2 flex items-center justify-center px-2 text-gray-500 hover:text-gray-700 focus:outline-none"
                      >
                        {adminPasswordVisible ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <div className="text-right mt-2">
                      <Link href="/forgot-password/admin" className="text-xs text-blue-500 hover:text-blue-700">
                        Forgot Password?
                      </Link>
                    </div>
                  </div>
                  
                  <button
                    type="submit"
                    className="w-full bg-red-700 text-white py-3 rounded-lg font-semibold hover:bg-red-800 transform hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    Login
                  </button>
                  {adminError && (
                    <div className="text-red-600 text-sm mt-2 text-center">{adminError}</div>
                  )}
                </form>
                
                <p className="text-center text-xs text-gray-500 mt-4">
                  Authorized personnel only
                </p>
              </div>
            )}
          </div>

        </div>
        
        {/* Close button */}
        <button 
          onClick={onClose}
          className="block mx-auto mt-6 text-white/80 hover:text-white text-sm transition-colors duration-200"
        >
          ✕ Close Panel
        </button>
      </div>
    </div>
  );
}
