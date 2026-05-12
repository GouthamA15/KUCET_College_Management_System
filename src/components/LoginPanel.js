'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { validateRollNo } from '@/lib/rollNumber'; // Import validateRollNo
import { signIn } from "next-auth/react";

export default function LoginPanel({ activePanel, onClose, onStudentLogin }) {
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

  // Remember Me states
  const [studentRememberMe, setStudentRememberMe] = useState(false);
  const [clerkRememberMe, setClerkRememberMe] = useState(false);
  const [adminRememberMe, setAdminRememberMe] = useState(false);

  // mode: 'login' | 'forgot-password'
  const [mode, setMode] = useState('login');
  // activeRole: 'student' | 'employee' (derived from activePanel)
  const activeRole = activePanel === 'student' ? 'student' : 'employee';

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
        body: JSON.stringify({ 
          rollno: studentForm.rollNumber, 
          dob: dobForServer,
          rememberMe: studentRememberMe 
        }),
      });
      const data = await res.json();
      if (res.ok && data.student) {
        toast.success('Login successful!', { id: toastId });
        // Trigger a hard reload to "/" so proxy.js runs and redirects server-side
        window.location.replace('/');
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

  const handleEmployeeSubmit = async (e) => {
    e.preventDefault();
    const isClerk = activePanel === 'clerk';
    const errorSetter = isClerk ? setClerkError : setAdminError;
    const formData = isClerk ? clerkForm : adminForm;
    const rememberMe = isClerk ? clerkRememberMe : adminRememberMe;

    errorSetter('');
    const toastId = toast.loading('Logging in...');
    try {
      const res = await fetch('/api/auth/employee-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          rememberMe
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Login successful!', { id: toastId });
        window.location.replace('/');
      } else {
        toast.error(data.error || 'Login failed', { id: toastId });
        errorSetter(data.error || 'Login failed');
      }
    } catch (error) {
      toast.error('An unexpected error occurred', { id: toastId });
      errorSetter('An unexpected error occurred');
    }
  };

  if (!activePanel) return null;

  return (
    <div 
      id="login-panels" 
      className="fixed top-0 left-0 w-full h-full z-[100] flex items-center justify-center p-4 lg:p-8 overflow-y-auto bg-slate-900/60 animate-fadeIn"
      style={{ position: 'fixed', zIndex: 1000 }}
      onClick={(e) => {
        if (e.target.id === 'login-panels') onClose();
      }}
    >
      <div className="w-full max-w-md relative animate-slideUp">
        <div className="bg-gradient-to-b from-[#0b3578] to-[#1a4a8f] rounded-2xl shadow-2xl overflow-hidden border border-white/10">
          <div className="py-8 lg:py-10 px-6 md:px-8">
          
          {/* Student Login Panel */}
          <div 
            className={`transition-all duration-400 ease-out ${
              activePanel === 'student' 
                ? 'opacity-100 transform translate-y-0' 
                : 'opacity-0 transform -translate-y-4 absolute inset-0 pointer-events-none'
            }`}
          >
            {activePanel === 'student' && (
              <div className="bg-white rounded-xl border shadow-sm p-6 md:p-8">
                <div className="text-center mb-6 space-y-1">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-50 rounded mb-2">
                    <svg className="w-6 h-6 text-[#0b3578]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-semibold text-[#0b3578]">Student Login</h2>
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
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#0b3578] focus:border-transparent transition-all duration-150 text-gray-800 placeholder-gray-400 text-sm"
                      required
                      maxLength={MAX_ROLL}
                    />
                    {studentRollNoError && <div className="text-red-600 text-sm mt-1">{studentRollNoError}</div>}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                      <span className="block text-xs text-gray-500 font-normal mt-0.5">
                        First time user ? Use your DOB in the format : DD-MM-YYYY(ex: &quot;31-12-2000&quot;) as password
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type={studentPasswordVisible ? 'text' : 'password'}
                        value={studentForm.dob ?? ''}
                        onChange={(e) => setStudentForm({ ...studentForm, dob: e.target.value })}
                        placeholder="Enter Password"
                        className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#0b3578] focus:border-transparent transition-all duration-150 text-gray-800 text-sm"
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
                    <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center">
                          <input
                            id="student-remember-me"
                            type="checkbox"
                            checked={studentRememberMe}
                            onChange={(e) => setStudentRememberMe(e.target.checked)}
                            className="h-4 w-4 text-[#0b3578] focus:ring-[#0b3578] border-gray-300 rounded"
                          />
                          <label htmlFor="student-remember-me" className="ml-2 block text-xs text-gray-700">
                            Remember Me
                          </label>
                        </div>
                        <button
                          type="button"
                          onClick={() => { if (activeRole === 'student') { setMode('forgot-password'); setFpRollno(studentForm.rollNumber ?? ''); } }}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Forgot Password?
                        </button>
                      </div>
                  </div>
                  
                  <button
                    type="submit"
                    className="w-full mt-2 bg-[#0b3578] text-white py-2.5 rounded-md font-medium hover:bg-[#0a2d66] transition-colors duration-150 text-sm"
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
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#0b3578] focus:border-transparent transition-all duration-150 text-gray-800 placeholder-gray-400 text-sm"
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
                          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-md focus:outline-none text-sm"
                          disabled={fpIsLoading || !fpRollnoValid || !!fpRollnoError}
                        >
                          {fpIsLoading ? 'Sending...' : 'Send Reset Link'}
                        </button>
                      </div>
                    )}

                    {fpDisplayMessage && !fpShowDOBLoginMessage && <p className="text-green-500 text-xs italic mt-4">{fpDisplayMessage}</p>}
                  </form>
                )}

                <p className="mt-6 text-center text-xs text-gray-600">
                  Note : Login by DOB will work only for the students who haven&apos;t set their password yet
                </p>
              </div>
            )}
          </div>

          {/* Unified Employee Login Panel (Clerk/Admin) */}
          <div 
            className={`transition-all duration-400 ease-out ${
              (activePanel === 'clerk' || activePanel === 'admin')
                ? 'opacity-100 transform translate-y-0' 
                : 'opacity-0 transform -translate-y-4 absolute inset-0 pointer-events-none'
            }`}
          >
            {(activePanel === 'clerk' || activePanel === 'admin') && (
              <div className="bg-white rounded-xl border shadow-sm p-6 md:p-8">
                <div className="text-center mb-6 space-y-1">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-green-50 rounded mb-2">
                    <svg className="w-6 h-6 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-semibold text-[#0b3578]">Employee Login</h2>
                  <p className="text-gray-500 text-sm mt-1">Institutional staff portal</p>
                </div>
                
                {mode === 'login' ? (
                <div>
                  <button
                    onClick={() => {
                      // Browser Google login
                      const base = (process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/$/, '');
                      const callbackUrl = base ? `${base}/api/auth/google-complete` : '/api/auth/google-complete';
                      return signIn('google', { callbackUrl });
                    }}
                    className="w-full flex items-center justify-center bg-white border border-gray-300 text-gray-700 py-2.5 rounded-md font-medium hover:bg-gray-50 transition-all duration-150 mb-4"
                  >
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 48 48" aria-hidden>
                      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                      <path fill="#FF3D00" d="M6.306 14.691c-1.413 3.453-2.306 7.243-2.306 11.309C4 28.061 5.484 31.402 7.727 34.091l5.657-5.657C12.015 26.68 11.231 25.158 11.231 24s.784-2.68 2.14-3.64l-5.657-5.657z" />
                      <path fill="#4CAF50" d="M24 48c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 40.776 26.753 42 24 42c-5.223 0-9.641-3.343-11.303-7.918l-5.657-5.657C10.237 43.945 16.598 48 24 48z" />
                      <path fill="#1976D2" d="M43.611 20.083L43.595 20L42 20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 36.372 44 30.636 44 24c0-1.341-.138-2.65-.389-3.917z" />
                    </svg>
                    Sign in with Google
                  </button>

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="px-2 bg-white text-gray-500">Or</span>
                    </div>
                  </div>
                <form onSubmit={handleEmployeeSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                      <input
                      type="email"
                      value={activePanel === 'clerk' ? clerkForm.email : adminForm.email}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (activePanel === 'clerk') setClerkForm({ ...clerkForm, email: val });
                        else setAdminForm({ ...adminForm, email: val });
                      }}
                      placeholder="Enter your email"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-600 focus:border-transparent transition-all duration-150 text-gray-800 placeholder-gray-400 text-sm"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={(activePanel === 'clerk' ? clerkPasswordVisible : adminPasswordVisible) ? 'text' : 'password'}
                        value={activePanel === 'clerk' ? clerkForm.password : adminForm.password}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (activePanel === 'clerk') setClerkForm({ ...clerkForm, password: val });
                          else setAdminForm({ ...adminForm, password: val });
                        }}
                        placeholder="Enter your password"
                        className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-600 focus:border-transparent transition-all duration-150 text-gray-800 placeholder-gray-400 text-sm"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (activePanel === 'clerk') setClerkPasswordVisible(v => !v);
                          else setAdminPasswordVisible(v => !v);
                        }}
                        aria-label="Toggle password visibility"
                        className="absolute inset-y-0 right-2 flex items-center justify-center px-2 text-gray-500 hover:text-gray-700 focus:outline-none"
                      >
                        {(activePanel === 'clerk' ? clerkPasswordVisible : adminPasswordVisible) ? (
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
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center">
                        <input
                          id="employee-remember-me"
                          type="checkbox"
                          checked={activePanel === 'clerk' ? clerkRememberMe : adminRememberMe}
                          onChange={(e) => {
                            const val = e.target.checked;
                            if (activePanel === 'clerk') setClerkRememberMe(val);
                            else setAdminRememberMe(val);
                          }}
                          className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                        />
                        <label htmlFor="employee-remember-me" className="ml-2 block text-xs text-gray-700">
                          Remember Me
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setMode('forgot-password'); setFpEmail(activePanel === 'clerk' ? clerkForm.email : adminForm.email); }}
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  </div>
                  
                  <button
                    type="submit"
                    className="w-full mt-2 bg-green-700 text-white py-2.5 rounded-md font-medium hover:bg-green-800 transition-colors duration-150 text-sm"
                  >
                    Login
                  </button>
                  {(activePanel === 'clerk' ? clerkError : adminError) && (
                    <div className="text-red-600 text-sm mt-2 text-center">{activePanel === 'clerk' ? clerkError : adminError}</div>
                  )}
                </form>
                </div>
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
                  Authorized personnel only
                </p>
              </div>
            )}
          </div>

          </div>
        </div>
        
        {/* Close button */}
        <button 
          onClick={onClose}
          className="block mx-auto mt-6 text-white/80 hover:text-white text-sm transition-colors duration-200 group"
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Close Panel
          </span>
        </button>
      </div>
    </div>
  );
}
