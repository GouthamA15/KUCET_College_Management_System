'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { validateRollNo } from '@/lib/rollNumber'; // Import validateRollNo


export default function LoginPanel({ activePanel, onClose, onStudentLogin }) {
  const router = useRouter();
  const MAX_ROLL = 10;
  const MIN_ROLL = 10;
  const [studentForm, setStudentForm] = useState({ rollNumber: '', dob: '' });
  const [clerkForm, setClerkForm] = useState({ email: '', password: '' });
  const [adminForm, setAdminForm] = useState({ email: '', password: '' });
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentError, setStudentError] = useState('');
  const [studentRollNoError, setStudentRollNoError] = useState('');
  const [clerkError, setClerkError] = useState('');
  const [adminError, setAdminError] = useState('');
  // Password visibility toggles for all panels
  const [studentPasswordVisible, setStudentPasswordVisible] = useState(false);
  const [clerkPasswordVisible, setClerkPasswordVisible] = useState(false);
  const [adminPasswordVisible, setAdminPasswordVisible] = useState(false);

  // Internal forgot-password UI state
  // mode: 'login' | 'forgot-password'
  const [mode, setMode] = useState('login');
  // activeRole: 'student' | 'employee' (derived from activePanel)
  const activeRole = activePanel === 'student' ? 'student' : 'employee';

  // Student forgot-password states
  const [fpRollno, setFpRollno] = useState('');
  const [fpIsLoading, setFpIsLoading] = useState(false);
  const [fpIsCheckingStatus, setFpIsCheckingStatus] = useState(false);
  const [fpIsEligibleForReset, setFpIsEligibleForReset] = useState(false);
  const [fpShowDOBLoginMessage, setFpShowDOBLoginMessage] = useState(false);
  const [fpDisplayMessage, setFpDisplayMessage] = useState('');
  const [fpAttempted, setFpAttempted] = useState(false);
  const [fpRollnoValid, setFpRollnoValid] = useState(false);
  const [fpRollnoError, setFpRollnoError] = useState(''); // New state for specific roll number errors


  // Employee forgot-password states (used for clerk/admin)
  const [fpEmail, setFpEmail] = useState('');
  const [fpEmailLoading, setFpEmailLoading] = useState(false);
  const [fpEmailMessage, setFpEmailMessage] = useState('');
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
        window.location.assign('/student/profile');
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

  // --- Student forgot-password helpers (reused from src/app/forgot-password/student/page.js) ---
  const checkStudentStatus = useCallback(async (currentRollno) => {
    // This helper DOES NOT show any toasts. It only updates local UI state
    // and returns a structured result so the caller (the form) decides what
    // to show to the user. This prevents duplicate toasters.
    if (!currentRollno) {
      setFpIsEligibleForReset(false);
      setFpShowDOBLoginMessage(false);
      setFpDisplayMessage('');
      return { ok: false, status: null, data: null };
    }

    setFpIsCheckingStatus(true);
    let data = null;
    let status = null;
    try {
      const response = await fetch(`/api/auth/forgot-password/student?rollno=${currentRollno}`);
      status = response.status;
      data = await response.json().catch(() => null);

      if (response.ok) {
        if (data && data.is_email_verified && data.has_password_set) {
          setFpIsEligibleForReset(true);
          setFpShowDOBLoginMessage(false);
          setFpDisplayMessage('');
        } else {
          setFpIsEligibleForReset(false);
          setFpShowDOBLoginMessage(true);
          setFpDisplayMessage(
            "You haven't set a password and verified your email. Please login using your Date of Birth as password in (DD-MM-YYYY) format. If you need further assistance, contact support."
          );
        }
      } else {
        setFpIsEligibleForReset(false);
        setFpShowDOBLoginMessage(false);
        setFpDisplayMessage(data?.error || 'Unable to retrieve student status.');
      }
    } catch (error) {
      console.error('Error checking student status:', error);
      setFpIsEligibleForReset(false);
      setFpShowDOBLoginMessage(false);
      setFpDisplayMessage('Network error. Please try again.');
      return { ok: false, status: null, error: 'network' };
    } finally {
      setFpIsCheckingStatus(false);
    }

    return { ok: status >= 200 && status < 300, status, data };
  }, []);


  const handleForgotStudentSubmit = async (e) => {
    e.preventDefault();
    // Enforce client-side roll number validation: 10-11 alphanumeric characters
    const rn = (fpRollno || '').toString().trim();
    setFpAttempted(true);

    if (!fpRollnoValid || fpRollnoError) {
      // Error message is already set by onChange handler
      return;
    }

    setFpIsLoading(true);
    setFpDisplayMessage('');

    try {
      // First, check eligibility explicitly (GET)
      setFpIsCheckingStatus(true);
      const statusData = await checkStudentStatus(rn);

      // statusData is a structured result: { ok, status, data, error }
      if (statusData.error === 'network') {
        toast.error('Unable to verify student status');
        setFpDisplayMessage('Unable to verify student status.');
        return;
      }

      if (!statusData.ok) {
        // Handle expected business case: student not found
        const isNotFound = statusData.status === 404 || (statusData.data && typeof statusData.data.error === 'string' && /not\s*found/i.test(statusData.data.error));
        if (isNotFound) {
          // Single, specific toaster for this scenario
          toast.error('Student Not Found');
          setFpDisplayMessage('Student Not Found');
        } else {
          // Other failures: show a single local toaster
          toast.error(statusData.data?.error || 'Unable to verify student status');
          setFpDisplayMessage(statusData.data?.error || 'Unable to verify student status');
        }
        return;
      }

      if (statusData.data && statusData.data.is_email_verified && statusData.data.has_password_set) {
        // Eligible: send reset link (POST)
        const response = await fetch('/api/auth/forgot-password/student', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rollno: rn }),
        });
        const data = await response.json();
        if (response.ok) {
          toast.success(data.message);
          setFpDisplayMessage(data.message);
        } else {
          toast.error(data.error || 'An error occurred');
          setFpDisplayMessage(data.error || 'An error occurred');
        }
      } else {
        // Not eligible: show helper message (DOB login info)
        setFpShowDOBLoginMessage(true);
        setFpDisplayMessage(
          "Password reset not available. Please login using your Date of Birth as password. If you need further assistance, contact support."
        );
      }
    } catch (error) {
      toast.error('An error occurred');
      setFpDisplayMessage('An error occurred');
    } finally {
      setFpIsLoading(false);
      setFpIsCheckingStatus(false);
    }
  };

  // --- Employee forgot-password handler (reused from clerk page) ---
  const handleForgotEmployeeSubmit = async (e) => {
    e.preventDefault();
    setFpEmailLoading(true);
    setFpEmailMessage('');

    try {
      const response = await fetch('/api/auth/forgot-password/clerk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fpEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        setFpEmailMessage(data.message);
      } else {
        toast.error(data.error || 'An error occurred');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setFpEmailLoading(false);
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
          window.location.assign('/clerk/scholarship/dashboard');
        } else {
          // Treat everything else as admission/administrative by default
          window.location.assign('/clerk/admission/dashboard');
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
        window.location.assign('/admin/dashboard');
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
                
                {mode === 'login' ? (
                <form onSubmit={handleStudentSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Roll Number
                    </label>
                      <input
                      type="text"
                      value={studentForm.rollNumber ?? ''}
                      onChange={(e) => {
                        const v = String(e.target.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                        setStudentForm({ ...studentForm, rollNumber: v });
                        if (v.length > 0 && v.length === MAX_ROLL) {
                          const { isValid } = validateRollNo(v);
                          if (!isValid) {
                            setStudentRollNoError('Invalid Roll Number format.');
                          } else {
                            setStudentRollNoError('');
                          }
                        } else if (v.length > 0 && v.length !== MAX_ROLL) {
                          setStudentRollNoError(`Roll Number must be ${MAX_ROLL} characters long.`);
                        }
                        else {
                          setStudentRollNoError('');
                        }
                      }}
                      placeholder="Enter your Roll Number"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0b3578] focus:border-transparent transition-all duration-200 text-gray-800 placeholder-gray-400"
                      required
                      maxLength={MAX_ROLL}
                    />
                    {studentRollNoError && <div className="text-red-600 text-sm mt-1">{studentRollNoError}</div>}
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
                        value={studentForm.dob ?? ''}
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
                        <button
                          type="button"
                          onClick={() => { if (activeRole === 'student') { setMode('forgot-password'); setFpRollno(studentForm.rollNumber ?? ''); } }}
                          className="text-xs text-blue-500 hover:text-blue-700"
                        >
                          Forgot Password?
                        </button>
                      </div>
                  </div>
                  
                  <button
                    type="submit"
                    className="w-full bg-[#0b3578] text-white py-3 rounded-lg font-semibold hover:bg-[#0a2d66] transform hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl"
                    disabled={studentLoading || !!studentRollNoError}
                  >
                    {studentLoading ? 'Logging in...' : 'Login'}
                  </button>
                  {studentError && (
                    <div className="text-red-600 text-sm mt-2 text-center">{studentError}</div>
                  )}
                </form>
                ) : (
                  <form onSubmit={handleForgotStudentSubmit} className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Roll Number</label>
                      <input
                        type="text"
                        value={fpRollno ?? ''}
                        onChange={(e) => {
                          const v = String(e.target.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                          setFpRollno(v);
                          if (v.length === MAX_ROLL) {
                            const { isValid } = validateRollNo(v);
                            setFpRollnoValid(isValid);
                            if (!isValid) {
                              setFpRollnoError('Invalid Roll Number format.');
                            } else {
                              setFpRollnoError('');
                            }
                          } else {
                            setFpRollnoValid(false);
                            setFpRollnoError(`Roll Number must be exactly ${MAX_ROLL} characters long.`);
                          }
                        }}
                        placeholder="Enter your Roll Number"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0b3578] focus:border-transparent transition-all duration-200 text-gray-800 placeholder-gray-400"
                        required
                        disabled={fpIsCheckingStatus || fpIsLoading}
                        maxLength={MAX_ROLL}
                      />
                      {fpRollnoError && <div className="text-red-600 text-sm mt-1">{fpRollnoError}</div>}
                      <div className="text-right mt-2">
                        <button
                          type="button"
                          onClick={() => { setMode('login'); setFpAttempted(false); setFpDisplayMessage(''); setFpShowDOBLoginMessage(false); }}
                          className="inline-block font-medium text-sm text-blue-500 hover:text-blue-800"
                        >
                          Back to Login
                        </button>
                      </div>
                    </div>

                    {(fpRollno.length < MIN_ROLL) ? (
                      <p className="text-sm text-gray-500 text-center mt-4"></p>
                    ) : fpShowDOBLoginMessage && fpAttempted ? (
                      <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4" role="alert">
                        <p className="font-bold">Information</p>
                        <p>{fpDisplayMessage}</p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <button
                          type="submit"
                          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                          disabled={fpIsLoading || !fpRollnoValid || !!fpRollnoError}
                        >
                          {fpIsLoading ? 'Sending...' : 'Send Reset Link'}
                        </button>
                      </div>
                    )}

                    {fpDisplayMessage && !fpShowDOBLoginMessage && <p className="text-green-500 text-xs italic mt-4">{fpDisplayMessage}</p>}
                  </form>
                )}

                <p className="text-center text-xs text-gray-700 mt-4">
                  Note : Login by DOB will work only for the students who haven&apos;t set their password yet
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
                
                {mode === 'login' ? (
                <form onSubmit={handleClerkSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                      <input
                      type="email"
                      value={clerkForm.email ?? ''}
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
                        value={clerkForm.password ?? ''}
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
                      <button
                        type="button"
                        onClick={() => { if (activeRole === 'employee') { setMode('forgot-password'); setFpEmail(clerkForm.email ?? ''); } }}
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >
                        Forgot Password?
                      </button>
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
                ) : (
                  <form onSubmit={handleForgotEmployeeSubmit} className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                      <input
                        type="email"
                        value={fpEmail ?? ''}
                        onChange={(e) => setFpEmail(e.target.value)}
                        placeholder="Enter your email address"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent transition-all duration-200 text-gray-800 placeholder-gray-400"
                        required
                        disabled={fpEmailLoading}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      {EMAIL_REGEX.test((fpEmail || '').trim()) ? (
                        <button
                          type="submit"
                          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                          disabled={fpEmailLoading}
                        >
                          {fpEmailLoading ? 'Sending...' : 'Send Reset Link'}
                        </button>
                      ) : (
                        <p className="text-sm text-gray-500">&nbsp;</p>
                      )}

                      <button
                        type="button"
                        onClick={() => setMode('login')}
                        className="inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800"
                      >
                        Back to Login
                      </button>
                    </div>
                    {fpEmailMessage && <p className="text-green-500 text-xs italic mt-4">{fpEmailMessage}</p>}
                  </form>
                )}

                <p className="text-center text-xs text-gray-500 mt-4">
                  Make sure to Enter a Valid Email Address
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
                
                {mode === 'login' ? (
                <form onSubmit={handleAdminSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                      <input
                      type="email"
                      value={adminForm.email ?? ''}
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
                        value={adminForm.password ?? ''}
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
                      <button
                        type="button"
                        onClick={() => { if (activeRole === 'employee') { setMode('forgot-password'); setFpEmail(adminForm.email ?? ''); } }}
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >
                        Forgot Password?
                      </button>
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
                ) : (
                  <form onSubmit={handleForgotEmployeeSubmit} className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                      <input
                        type="email"
                        value={fpEmail ?? ''}
                        onChange={(e) => setFpEmail(e.target.value)}
                        placeholder="Enter your email address"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent transition-all duration-200 text-gray-800 placeholder-gray-400"
                        required
                        disabled={fpEmailLoading}
                      />
                    </div>
                      <div className="flex items-center justify-between">
                        {EMAIL_REGEX.test((fpEmail || '').trim()) ? (
                          <button
                            type="submit"
                            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                            disabled={fpEmailLoading}
                          >
                            {fpEmailLoading ? 'Sending...' : 'Send Reset Link'}
                          </button>
                        ) : (
                          <p className="text-sm text-gray-500">&nbsp;</p>
                        )}

                        <button
                          type="button"
                          onClick={() => setMode('login')}
                          className="inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800"
                        >
                          Back to Login
                        </button>
                      </div>
                    {fpEmailMessage && <p className="text-green-500 text-xs italic mt-4">{fpEmailMessage}</p>}
                  </form>
                )}

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
