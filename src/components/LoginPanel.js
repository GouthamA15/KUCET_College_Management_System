'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { validateRollNo } from '@/lib/rollNumber'; // Import validateRollNo
import { getDashboardPathByRole } from '@/lib/path-utils';
import { invalidateAssetCache } from '@/lib/assets';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPanel({ activePanel, onClose, _onStudentLogin, variant = 'modal', dismissable = true }) {
  const MAX_ROLL = 10;
  const MIN_ROLL = 10;
  const router = useRouter();
  
  useEffect(() => {
    // Eagerly prefetch registration routes to prevent compilation delay upon click
    router.prefetch('/staff-registration');
    router.prefetch('/admission');
  }, [router]);

  const [studentForm, setStudentForm] = useState({ rollNumber: '', dob: '' });
  const [staffForm, setStaffForm] = useState({ email: '', password: '' });
  const [adminForm, setAdminForm] = useState({ email: '', password: '' });
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentError, setStudentError] = useState('');
  const [studentRollNoError, setStudentRollNoError] = useState('');
  const [staffError, setStaffError] = useState('');
  const [adminError, setAdminError] = useState('');
  // Password visibility toggles for all panels
  const [studentPasswordVisible, setStudentPasswordVisible] = useState(false);
  const [staffPasswordVisible, setStaffPasswordVisible] = useState(false);
  const [adminPasswordVisible, setAdminPasswordVisible] = useState(false);

  // Remember Me states
  const [studentRememberMe, setStudentRememberMe] = useState(false);
  const [staffRememberMe, setStaffRememberMe] = useState(false);
  const [adminRememberMe, setAdminRememberMe] = useState(false);

  // mode: 'login' | 'forgot-password'
  const [mode, setMode] = useState('login');
  // activeRole: 'student' | 'employee' (derived from activePanel)
  const activeRole = activePanel === 'student' ? 'student' : 'employee';

  const [fpRollno, setFpRollno] = useState('');
  const [fpIsLoading, setFpIsLoading] = useState(false);
  const [fpIsCheckingStatus, setFpIsCheckingStatus] = useState(false);
  const [_fpIsEligibleForReset, setFpIsEligibleForReset] = useState(false);
  const [fpShowDOBLoginMessage, setFpShowDOBLoginMessage] = useState(false);
  const [fpDisplayMessage, setFpDisplayMessage] = useState('');
  const [fpAttempted, setFpAttempted] = useState(false);
  const [fpRollnoValid, setFpRollnoValid] = useState(false);
  const [fpRollnoError, setFpRollnoError] = useState(''); // New state for specific roll number errors


  // Employee forgot-password states (used for staff/admin)
  const [fpEmail, setFpEmail] = useState('');
  const [fpEmailLoading, setFpEmailLoading] = useState(false);
  const [fpEmailMessage, setFpEmailMessage] = useState('');
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // First Login Password Change States
  const [firstLoginPassForm, setFirstLoginPassForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [firstLoginPassLoading, setFirstLoginPassLoading] = useState(false);
  const [pendingTargetPath, setPendingTargetPath] = useState('');

  const handleFirstLoginPassSubmit = async (e) => {
    e.preventDefault();
    if (firstLoginPassForm.newPassword !== firstLoginPassForm.confirmPassword) {
      toast.error('New password and confirm password do not match.');
      return;
    }

    setFirstLoginPassLoading(true);
    const toastId = toast.loading('Updating password...');
    try {
      const res = await fetch('/api/auth/change-password/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldPassword: firstLoginPassForm.oldPassword,
          newPassword: firstLoginPassForm.newPassword
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Password updated successfully! Redirecting...', { id: toastId });
        window.location.replace(pendingTargetPath || '/staff');
      } else {
        toast.error(data.error || 'Failed to update password', { id: toastId });
      }
    } catch (_err) {
      toast.error('Network error updating password', { id: toastId });
    } finally {
      setFirstLoginPassLoading(false);
    }
  };

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
        invalidateAssetCache();
        try {
          if (typeof window !== 'undefined' && 'caches' in window) {
            caches.keys().then(names => Promise.all(names.map(n => caches.delete(n)))).catch(() => {});
          }
        } catch (_err) {
          // ignore cache deletion error on login
        }
        toast.success('Login successful!', { id: toastId });
        window.location.replace('/student');
      } else {
        toast.error(data.error || 'Login failed', { id: toastId });
        setStudentError(data.error || 'Login failed');
      }
    } catch (_err) {
      toast.error('Network error', { id: toastId });
      setStudentError('Network error');
    } finally {
      setStudentLoading(false);
    }
  };

  // --- Student forgot-password helpers (reused from src/app/forgot-password/student/page.js) ---
  const _checkStudentStatus = useCallback(async (currentRollno) => {
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


  const applyForgotRollno = useCallback((value) => {
    const v = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    setFpRollno(v);

    if (!v) {
      setFpRollnoValid(false);
      setFpRollnoError('');
      return;
    }

    if (v.length !== MAX_ROLL) {
      setFpRollnoValid(false);
      setFpRollnoError(`Roll Number must be exactly ${MAX_ROLL} characters long.`);
      return;
    }

    const { isValid } = validateRollNo(v);
    setFpRollnoValid(isValid);
    setFpRollnoError(isValid ? '' : 'Invalid Roll Number format.');
  }, [MAX_ROLL]);

  const openForgotPasswordForStudent = useCallback(() => {
    if (activeRole !== 'student') return;

    const value = String(studentForm.rollNumber || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    setFpRollno(value);

    if (!value) {
      setFpRollnoValid(false);
      setFpRollnoError('');
      setMode('forgot-password');
      return;
    }

    if (value.length !== MAX_ROLL) {
      setFpRollnoValid(false);
      setFpRollnoError(`Roll Number must be exactly ${MAX_ROLL} characters long.`);
      setMode('forgot-password');
      return;
    }

    const { isValid } = validateRollNo(value);
    setFpRollnoValid(isValid);
    setFpRollnoError(isValid ? '' : 'Invalid Roll Number format.');
    setMode('forgot-password');
  }, [activeRole, MAX_ROLL, studentForm.rollNumber]);

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

    const parseJsonResponse = async (response) => {
      const text = await response.text();
      if (!text) return {};

      try {
        return JSON.parse(text);
      } catch (_error) {
        return { message: 'Unable to process your request. Please try again.' };
      }
    };

    try {
      // First, check eligibility explicitly (GET)
      setFpIsCheckingStatus(true);
      const statusResponse = await fetch(`/api/auth/forgot-password/student?rollno=${encodeURIComponent(rn)}`);
      const statusData = await parseJsonResponse(statusResponse);

      if (!statusResponse.ok) {
        const statusMessage = statusData?.error || statusData?.message || 'Unable to verify student status.';
        toast.error(statusMessage);
        setFpDisplayMessage(statusMessage);
        return;
      }

      if (statusData && statusData.is_email_verified && statusData.has_password_set) {
        // Eligible: send reset link (POST)
        const response = await fetch('/api/auth/forgot-password/student', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rollno: rn }),
        });
        const data = await parseJsonResponse(response);
        const serverMessage = data?.message || data?.error || 'Unable to process your request. Please try again.';

        if (response.ok) {
          toast.success(serverMessage);
          setFpDisplayMessage(serverMessage);
        } else {
          toast.error(serverMessage);
          setFpDisplayMessage(serverMessage);
        }
      } else {
        // Not eligible: show helper message (DOB login info)
        setFpShowDOBLoginMessage(true);
        setFpDisplayMessage(
          "Password reset not available. Please login using your Date of Birth as password. If you need further assistance, contact support."
        );
      }
    } catch (_error) {
      toast.error('Unable to process your request. Please try again.');
      setFpDisplayMessage('Unable to process your request. Please try again.');
    } finally {
      setFpIsLoading(false);
      setFpIsCheckingStatus(false);
    }
  };

  // --- Employee forgot-password handler ---
  const handleForgotEmployeeSubmit = async (e) => {
    e.preventDefault();
    setFpEmailLoading(true);
    setFpEmailMessage('');

    try {
      const response = await fetch('/api/auth/forgot-password/staff', {
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
    } catch (_error) {
      toast.error('An error occurred');
    } finally {
      setFpEmailLoading(false);
    }
  };

  const handleEmployeeSubmit = async (e) => {
    e.preventDefault();
    const isStaff = activePanel === 'staff';
    const errorSetter = isStaff ? setStaffError : setAdminError;
    const formData = isStaff ? staffForm : adminForm;
    const rememberMe = isStaff ? staffRememberMe : adminRememberMe;

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
        invalidateAssetCache();
        try {
          if (typeof window !== 'undefined' && 'caches' in window) {
            caches.keys().then(names => Promise.all(names.map(n => caches.delete(n)))).catch(() => {});
          }
        } catch (_err) {
          // ignore cache deletion error on login
        }
        toast.success('Login successful!', { id: toastId });
        const targetRole = data.role || (isStaff ? 'staff' : 'admin');
        let targetPath = getDashboardPathByRole(targetRole);
        if (targetPath === '/') {
          targetPath = targetRole === 'admin' ? '/admin/dashboard' : '/staff';
        }

        if (data.mustChangePassword) {
          setPendingTargetPath(targetPath);
          setFirstLoginPassForm((prev) => ({ ...prev, oldPassword: formData.password }));
          setMode('first-login-pass');
          toast.success('Temporary password detected. Please set a new password to continue.', { id: toastId });
          return;
        }

        window.location.replace(targetPath);
      } else {
        toast.error(data.error || 'Login failed', { id: toastId });
        errorSetter(data.error || 'Login failed');
      }
    } catch (_error) {
      toast.error('An unexpected error occurred', { id: toastId });
      errorSetter('An unexpected error occurred');
    }
  };

  if (!activePanel) return null;

  const isModal = variant === 'modal';
  const isEmbedded = !isModal;

  return (
    <div
      id={isModal ? 'login-panels' : undefined}
      className={isModal
        ? 'fixed top-0 left-0 w-full h-full z-100 flex items-center justify-center p-4 lg:p-8 overflow-y-auto bg-slate-900/60 animate-fadeIn'
        : 'w-full'}
      style={isModal ? { position: 'fixed', zIndex: 1000 } : undefined}
      onClick={isModal && dismissable ? (e) => {
        if (e.target.id === 'login-panels') onClose();
      } : undefined}
    >
      <div className={isModal ? 'w-full max-w-md relative animate-slideUp' : 'w-full'}>
        <div className={isModal
          ? 'bg-linear-to-b from-[#0b3578] to-[#1a4a8f] rounded-2xl shadow-2xl overflow-hidden border border-white/10'
          : 'bg-transparent border-0 shadow-none rounded-none'}>
          <div className={isModal ? 'py-8 lg:py-10 px-6 md:px-8' : 'p-0'}>
          
          {/* Student Login Panel */}
          <div 
            className={`transition-all duration-400 ease-out ${
              activePanel === 'student' 
                ? 'opacity-100 transform translate-y-0' 
                : 'opacity-0 transform -translate-y-4 absolute inset-0 pointer-events-none'
            }`}
          >
            {activePanel === 'student' && (
              <div className={isModal ? 'bg-white rounded-xl border shadow-sm p-6 md:p-8' : 'bg-white rounded-sm border border-slate-200 shadow-none p-4 sm:p-5'}>
                <div className={isModal ? 'flex items-start justify-between gap-4 mb-6' : 'flex items-start justify-between gap-3 mb-4'}>
                  <div>
                    <h2 className={isModal ? 'text-2xl font-semibold text-[#0b3578]' : 'text-lg font-bold tracking-wide text-slate-900 uppercase'}>
                      Student Login
                    </h2>
                    <p className={isModal ? 'text-gray-500 text-sm mt-1' : 'text-xs text-slate-600'}>
                      Enter roll number and password.
                    </p>
                  </div>
                  <div className={isModal ? 'inline-flex items-center justify-center w-12 h-12 bg-blue-50 rounded' : 'inline-flex items-center justify-center w-10 h-10 bg-blue-50 rounded-sm shrink-0'}>
                    <svg className={isModal ? 'w-6 h-6 text-[#0b3578]' : 'w-5 h-5 text-[#0b3578]'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                    </svg>
                  </div>
                </div>
                {mode === 'login' ? (
                <form onSubmit={handleStudentSubmit} className={isEmbedded ? 'space-y-4' : 'space-y-5'}>
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
                      {isEmbedded ? (
                        <span className="block text-[11px] text-gray-500 font-normal mt-0.5">
                          First-time login: use DOB (DD-MM-YYYY)
                        </span>
                      ) : (
                        <span className="block text-xs text-gray-500 font-normal mt-0.5">
                          First time user ? Use your DOB in the format : DD-MM-YYYY(ex: &quot;31-12-2000&quot;) as password
                        </span>
                      )}
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
                    <div className={isEmbedded ? 'flex items-center justify-between mt-2' : 'flex items-center justify-between mt-2'}>
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
                          onClick={openForgotPasswordForStudent}
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
                        onChange={(e) => applyForgotRollno(e.target.value)}
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

                <div className={isModal ? 'mt-6 text-center text-sm relative z-20' : 'mt-4 text-center text-xs relative z-20'}>
                  <span className="text-gray-600">New User? </span>
                  <Link 
                    href="/admission" 
                    className="font-semibold text-[#0b3578] hover:text-[#1a4a8f] hover:underline transition-colors duration-200 cursor-pointer relative z-50 inline-block py-2 -my-2 px-1 -mx-1"
                  >
                    Register for Admission &rarr;
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Unified Staff Login Panel (Staff/Admin) */}
          <div 
            className={`transition-all duration-400 ease-out ${
              (activePanel === 'staff' || activePanel === 'admin')
                ? 'opacity-100 transform translate-y-0' 
                : 'opacity-0 transform -translate-y-4 absolute inset-0 pointer-events-none'
            }`}
          >
            {(activePanel === 'staff' || activePanel === 'admin') && (
              <div className={isModal ? 'bg-white rounded-xl border shadow-sm p-6 md:p-8' : 'bg-white rounded-sm border border-slate-200 shadow-none p-4 sm:p-5'}>
                <div className={isModal ? 'flex items-start justify-between gap-4 mb-6' : 'flex items-start justify-between gap-3 mb-4'}>
                  <div>
                    <h2 className={isModal ? 'text-2xl font-semibold text-[#0b3578]' : 'text-lg font-bold tracking-wide text-slate-900 uppercase'}>
                      Staff Login
                    </h2>
                    <p className={isModal ? 'text-gray-500 text-sm mt-1' : 'text-xs text-slate-600'}>
                      Sign in with your email and password.
                    </p>
                  </div>
                  <div className={isModal ? 'inline-flex items-center justify-center w-12 h-12 bg-green-50 rounded' : 'inline-flex items-center justify-center w-10 h-10 bg-green-50 rounded-sm shrink-0'}>
                    <svg className={isModal ? 'w-6 h-6 text-green-700' : 'w-5 h-5 text-green-700'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
                
                {mode === 'login' ? (
                <form onSubmit={handleEmployeeSubmit} className={isEmbedded ? 'space-y-4' : 'space-y-5'}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                      <input
                      type="email"
                      value={activePanel !== 'admin' ? staffForm.email : adminForm.email}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (activePanel !== 'admin') setStaffForm({ ...staffForm, email: val });
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
                        type={(activePanel !== 'admin' ? staffPasswordVisible : adminPasswordVisible) ? 'text' : 'password'}
                        value={activePanel !== 'admin' ? staffForm.password : adminForm.password}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (activePanel !== 'admin') setStaffForm({ ...staffForm, password: val });
                          else setAdminForm({ ...adminForm, password: val });
                        }}
                        placeholder="Enter your password"
                        className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-600 focus:border-transparent transition-all duration-150 text-gray-800 placeholder-gray-400 text-sm"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (activePanel !== 'admin') setStaffPasswordVisible(v => !v);
                          else setAdminPasswordVisible(v => !v);
                        }}
                        aria-label="Toggle password visibility"
                        className="absolute inset-y-0 right-2 flex items-center justify-center px-2 text-gray-500 hover:text-gray-700 focus:outline-none"
                      >
                        {(activePanel !== 'admin' ? staffPasswordVisible : adminPasswordVisible) ? (
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
                          checked={activePanel !== 'admin' ? staffRememberMe : adminRememberMe}
                          onChange={(e) => {
                            const val = e.target.checked;
                            if (activePanel !== 'admin') setStaffRememberMe(val);
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
                        onClick={() => { setMode('forgot-password'); setFpEmail(activePanel !== 'admin' ? staffForm.email : adminForm.email); }}
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
                  {(activePanel !== 'admin' ? staffError : adminError) && (
                    <div className="text-red-600 text-sm mt-2 text-center">{activePanel !== 'admin' ? staffError : adminError}</div>
                  )}

                  {activePanel !== 'admin' && (
                    <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between text-xs relative z-20">
                      <span className="text-gray-600">New Staff Member?</span>
                      <Link
                        href="/staff-registration"
                        className="font-bold text-[#0b3578] hover:text-blue-800 hover:underline relative z-50 inline-block py-2 -my-2 px-1 -mx-1"
                      >
                        Register Yourself &rarr;
                      </Link>
                    </div>
                  )}
                </form>
                ) : mode === 'first-login-pass' ? (
                  <form onSubmit={handleFirstLoginPassSubmit} className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded text-xs leading-relaxed">
                      <strong>Security Policy Requirement:</strong> You logged in with a temporary password. You must change your password before continuing.
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Current Temporary Password</label>
                      <input
                        type="password"
                        value={firstLoginPassForm.oldPassword}
                        onChange={(e) => setFirstLoginPassForm({ ...firstLoginPassForm, oldPassword: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-[#0b3578]"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">New Password</label>
                      <input
                        type="password"
                        value={firstLoginPassForm.newPassword}
                        onChange={(e) => setFirstLoginPassForm({ ...firstLoginPassForm, newPassword: e.target.value })}
                        placeholder="At least 8 characters (Uppercase, lowercase, digit, special char)"
                        className="w-full px-3 py-2 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-[#0b3578]"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Confirm New Password</label>
                      <input
                        type="password"
                        value={firstLoginPassForm.confirmPassword}
                        onChange={(e) => setFirstLoginPassForm({ ...firstLoginPassForm, confirmPassword: e.target.value })}
                        placeholder="Re-enter new password"
                        className="w-full px-3 py-2 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-[#0b3578]"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={firstLoginPassLoading}
                      className="w-full bg-[#0b3578] hover:bg-[#0a2d66] text-white py-2.5 rounded font-semibold text-xs transition-colors"
                    >
                      {firstLoginPassLoading ? 'Updating Password...' : 'Update Password & Access Dashboard'}
                    </button>
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

                <p className={isModal ? 'text-center text-xs text-gray-500 mt-4' : 'text-center text-[11px] text-gray-500 mt-3 hidden sm:block'}>
                  Authorized personnel only
                </p>
              </div>
            )}
          </div>

          </div>
        </div>
        
        {/* Close button (modal only) */}
        {isModal && dismissable && (
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
        )}
      </div>
    </div>
  );
}
