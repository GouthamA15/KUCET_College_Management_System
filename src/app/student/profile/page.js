'use client';

import imageCompression from 'browser-image-compression';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import ImagePreviewModal from '@/components/ImagePreviewModal';
import Footer from '@/components/Footer';
import { formatDate } from '@/lib/date';
import { getBranchFromRoll, getCurrentStudyingYear, getCurrentAcademicYear, getAcademicYearForStudyYear } from '@/lib/rollNumber';
import { computeAcademicYear } from '@/app/lib/academicYear';
import Image from 'next/image';

export default function StudentProfile() {
  const router = useRouter();
  const [studentData, setStudentData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [isPhotoRemoved, setIsPhotoRemoved] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [originalMobile, setOriginalMobile] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');
  const [originalAddress, setOriginalAddress] = useState('');
  const fileInputRef = useRef(null);
  const [photoProcessing, setPhotoProcessing] = useState(false);

  // New state for email verification
  const [newEmail, setNewEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [emailVerifiedPendingSave, setEmailVerifiedPendingSave] = useState(false);
  const [emailLocked, setEmailLocked] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imagePreviewSrc, setImagePreviewSrc] = useState(null);

  // PASSWORD SETTING STATES
  const [isPasswordSet, setIsPasswordSet] = useState(true); // Default true to prevent flash
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const sanitizeDigits = (val, maxLen = 12) => {
    if (val == null) return '';
    return String(val).replace(/\D/g, '').slice(0, maxLen);
  };

  // Fee helpers (roll-number based)
  const SELF_FINANCE_BRANCHES = ['CSD', 'IT', 'CIVIL'];
  const isSelfFinanceBranch = (branch) => {
    if (!branch) return false;
    return SELF_FINANCE_BRANCHES.includes(String(branch).toUpperCase());
  };

  const computeTotalFee = (rollNo, application_no) => {
    const branch = getBranchFromRoll(rollNo);
    const isSelf = isSelfFinanceBranch(branch);
    const isScholar = (() => {
      if (!application_no) return false;
      return String(application_no).trim() !== String(rollNo);
    })();

    if (!isSelf) return 35000;
    return isScholar ? 35000 : 70000;
  };

  const fetchProfile = useCallback(async (rollno) => {
    try {
      const res = await fetch(`/api/student/${rollno}`);
      const data = await res.json();
      if (res.ok) {
        setStudentData(data);
        setMobile(sanitizeDigits(data.student.mobile, 12));
        setEmail(data.student.email);
        setNewEmail(data.student.email);
        const pdAddress = data.student.personal_details && data.student.personal_details.address ? data.student.personal_details.address : (data.student.address || '');
        setAddress(pdAddress);
        setOriginalMobile(sanitizeDigits(data.student.mobile, 12));
        setOriginalEmail(data.student.email);
          // start with email locked = false; if backend provides a flag in future, derive from that
          setEmailLocked(false);
        setOriginalAddress(pdAddress);
        setProfilePhoto(data.student.pfp);

        // CHECK IF PASSWORD IS SET
        try {
          const passRes = await fetch(`/api/student/set-password?rollno=${rollno}`);
          if (passRes.ok) {
            const passData = await passRes.json();
            setIsPasswordSet(passData.isPasswordSet);
          }
        } catch (e) {
          console.error("Error checking password status", e);
        }
      } else {
        toast.error(data.message || 'Unable to load profile. Please try again.');
      }
    } catch (error) {
      toast.error('Network error');
    }
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/student/me');
        if (res.ok) {
          const data = await res.json();
          fetchProfile(data.roll_no);
        } else {
          // Handle case where user is not authenticated
          router.replace('/');
        }
      } catch (error) {
        console.error('Failed to fetch user', error);
      }
    };
    fetchUser();
  }, [router, fetchProfile]);

  const handleLogout = async () => {
    try {
      await fetch('/api/student/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout failed', error);
    } finally {
      localStorage.removeItem('logged_in_student');
      sessionStorage.clear();
      router.replace('/');
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
        toast.error('Only JPG, JPEG, and PNG files are allowed.');
        return;
      }
      if (file.size > 2 * 1024 * 1024) { // 2MB limit for original file
        toast.error('Original file size should be less than 2MB.');
        return;
      }

      try {
        const options = {
          maxSizeMB: 0.06, // Target 60KB
          maxWidthOrHeight: 150, // Resizes to 150x150 (smallest dimension is 150)
          useWebWorker: true,
          fileType: "image/jpeg", // Ensure JPEG output for consistent size
        };
        const compressedFile = await imageCompression(file, options);

        const reader = new FileReader();
        reader.onload = () => {
          setPreviewPhoto(reader.result);
          setPhotoChanged(true);
          setIsPhotoRemoved(false);
        };
        reader.readAsDataURL(compressedFile);

        toast.success(`Image compressed to ${(compressedFile.size / 1024).toFixed(2)} KB.`);
      } catch (error) {
        toast.error('Image compression failed. Please try another image.');
        setPreviewPhoto(null);
      }
    }
  };

  const handleSendOtp = async () => {
    // Always send OTP to the current `newEmail` (this covers clerk-added emails too)
    setIsVerifying(true);
    try {
      const res = await fetch('/api/student/send-update-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rollno: studentData.student.roll_no,
          email: newEmail,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setIsOtpSent(true);
      } else {
        toast.error(data.message || 'Failed to send OTP.');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };
  
  const handleVerifyOtp = async () => {
    setIsVerifying(true);
    try {
      const res = await fetch('/api/student/verify-update-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rollno: studentData.student.roll_no,
          otp,
          email: newEmail,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setIsOtpVerified(true);
        setEmail(newEmail); // Update the main email state
        // Lock email after successful verification; user may explicitly choose to edit again
        setEmailLocked(true);
        // Mark that a verification happened and user may need to save other changes
        setEmailVerifiedPendingSave(true);
        // Refresh profile to pick up verified flag from server (do not rely solely on this for enabling Save)
        try {
          await fetchProfile(studentData.student.roll_no);
        } catch (e) {
          // ignore fetchProfile errors here
        }
      } else {
        toast.error(data.message || 'OTP verification failed.');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };


  const handleSave = async () => {
    if (newEmail !== originalEmail && !isOtpVerified) {
      toast.error('Please verify your new email address before saving.');
      return;
    }
    try {
      if (photoProcessing) {
        toast.error('Please wait for the photo to be processed.');
        return;
      }
      if (photoChanged) {
        const pfpToSend = previewPhoto || null;
        const response = await fetch('/api/student/upload-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roll_no: studentData.student.roll_no,
            pfp: pfpToSend,
          }),
        });
        const result = await response.json();
        if (!response.ok) {
          toast.error(result.message || 'Photo update failed. Try again.');
          return;
        }
        setPreviewPhoto(null);
        setPhotoChanged(false);
        setIsPhotoRemoved(false);
      }

      const response = await fetch('/api/student/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rollno: studentData.student.roll_no,
          phone: sanitizeDigits(mobile, 12),
          address: address,
          // Email is now updated via OTP verification, so not sent here
        }),
      });

      const result = await response.json();
        if (response.ok) {
        toast.success('Profile updated successfully!');
        setIsEditing(false);
        setOriginalMobile(sanitizeDigits(mobile, 12));
        setOriginalAddress(address);
        if (isOtpVerified) {
          setOriginalEmail(newEmail);
          // keep email locked after saving a verified email
          setEmailLocked(true);
        }
          // clear pending verified-save flag
          setEmailVerifiedPendingSave(false);
        // Reset OTP state
        setIsOtpSent(false);
        setIsOtpVerified(false);
        setOtp('');

        fetchProfile(studentData.student.roll_no);
      } else {
        toast.error(result.error || 'Failed to update profile.');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    }
  };

  const handlePasswordSave = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetch('/api/student/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rollno: studentData.student.roll_no,
          password: newPassword
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Password set successfully! Please use this for future logins.');
        setIsPasswordSet(true);
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(data.error || 'Failed to set password');
      }
    } catch (e) {
      toast.error('Network error');
    } finally {
      setPasswordSaving(false);
    }
  };

  if (!studentData) return null;

  const { student } = studentData;

  // Compute current studying year and fee aggregates for that year
  const currentStudyingYear = getCurrentStudyingYear(student.roll_no) || 1;
  const scholarshipForCurrentYear = (studentData.scholarship || []).find(s => Number(s.year) === Number(currentStudyingYear));
  const totalFeeForCurrentYear = computeTotalFee(student.roll_no, scholarshipForCurrentYear?.application_no);

  // Robust fees handling: accept fees array, and include rows without `year` if their date falls into the academic year range.
  const feesArray = Array.isArray(studentData.fees) ? studentData.fees : [];

  const academicYearLabel = getCurrentAcademicYear(student.roll_no) || null;
  // derive academic year start for current studying year
  const academicYearForStudy = getAcademicYearForStudyYear(student.roll_no, currentStudyingYear);
  let yearStart = null;
  if (academicYearForStudy) {
    const m = academicYearForStudy.match(/^(\d{4})/);
    if (m) yearStart = Number(m[1]);
  }

  const dateInAcademicYear = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(String(dateStr));
    if (isNaN(d)) return false;
    if (!yearStart) return false;
    // Academic year considered from June 1 of yearStart to May 31 of yearStart+1
    const start = new Date(yearStart, 5, 1);
    const end = new Date(yearStart + 1, 5, 1);
    return d >= start && d < end;
  };

  const totalPaidFromFees = feesArray.reduce((acc, fee) => {
    const feeYearMatches = fee && fee.year !== undefined && fee.year !== null && String(fee.year).trim() !== '' && Number(fee.year) === Number(currentStudyingYear);
    const feeDateMatches = !feeYearMatches && (dateInAcademicYear(fee.date ?? fee.transaction_date ?? fee.paid_at));
    if (feeYearMatches || feeDateMatches) {
      const amt = Number(fee.amount ?? fee.amount_paid ?? fee.paid_amount ?? 0);
      return acc + (isNaN(amt) ? 0 : amt);
    }
    return acc;
  }, 0);

  // Also include scholarship disbursed/amount_paid for the same year as payment
  const scholarshipPaid = (studentData.scholarship || []).filter(s => Number(s.year) === Number(currentStudyingYear)).reduce((acc, s) => {
    const a = Number(s.amount_disbursed ?? s.amount_paid ?? 0);
    return acc + (isNaN(a) ? 0 : a);
  }, 0);

  const totalPaidForCurrentYear = Number(totalPaidFromFees) + Number(scholarshipPaid);
  const pendingForCurrentYear = Math.max(0, Number(totalFeeForCurrentYear) - Number(totalPaidForCurrentYear));

  // If there are scholarship records but none for current year, prepare a short note
  const scholarshipYears = (studentData.scholarship || []).map(s => Number(s.year)).filter(y => !isNaN(y));
  const hasScholarshipOtherYears = scholarshipYears.length > 0 && !scholarshipYears.includes(Number(currentStudyingYear));

  const emailChanged = newEmail !== originalEmail;
  const trimmedEmail = (newEmail || '').trim();
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  const isEmailValid = emailRegex.test(trimmedEmail);
  let emailValidationMessage = '';
  if (emailTouched) {
    if (!trimmedEmail) {
      emailValidationMessage = 'Email cannot be empty.';
    } else if (!isEmailValid) {
      emailValidationMessage = 'Please enter a valid email address.';
    }
  }

  const hasChanges = mobile !== originalMobile || address !== originalAddress || photoChanged || (emailChanged && isOtpVerified);
  // Allow save if verification completed but profile refresh cleared change flags
  const effectiveHasChanges = hasChanges || emailVerifiedPendingSave;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <Navbar studentProfileMode={true} onLogout={handleLogout} activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8">
  <div className="max-w-5xl mx-auto">
    
    {/* --- START OF NEW WARNING SECTION --- */}
    {!isPasswordSet && (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-8 shadow-md rounded-r-lg">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="ml-3 w-full">
            <h3 className="text-lg font-medium text-red-800">Security Warning: Please set your password ASAP</h3>
            <p className="text-sm text-red-700 mt-1">You are currently logged in using your Date of Birth. For better security, please set a custom password immediately.</p>
            
            <div className="mt-4 bg-white p-4 rounded-md shadow-sm border border-red-100 max-w-md">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Set New Password</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">New Password</label>
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                    placeholder="Enter new password"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Confirm Password</label>
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                    placeholder="Confirm new password"
                  />
                </div>
                <button 
                  onClick={handlePasswordSave}
                  disabled={!newPassword || newPassword !== confirmPassword || passwordSaving}
                  className={`w-full py-2 px-4 rounded text-sm font-medium text-white transition-colors
                    ${(!newPassword || newPassword !== confirmPassword || passwordSaving) 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-red-600 hover:bg-red-700'}`}
                >
                  {passwordSaving ? 'Saving...' : 'Set Password'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    {/* --- END OF NEW WARNING SECTION --- */}
          <div className="border-b border-gray-200 relative">
            <nav className="hidden md:flex -mb-px space-x-8" aria-label="Tabs">
              <button onClick={() => setActiveTab('basic')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'basic' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                Basic Information
              </button>
              <button onClick={() => setActiveTab('scholarship')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'scholarship' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                Scholarship Details
              </button>
              <button onClick={() => setActiveTab('fees')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'fees' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                Fee Details
              </button>
              <button onClick={() => setActiveTab('academics')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'academics' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                Academic Details
              </button>
            </nav>

            <div className="md:hidden flex justify-between items-center py-4">
              <span className="text-lg font-semibold text-gray-800">Menu</span>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isMobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
            <div className="flex justify-end pr-4">
              <div>
                <div className="text-sm text-gray-500">Academic Year</div>
                <div className="font-medium">{getCurrentAcademicYear(student.roll_no) || '-'}</div>
              </div>
            </div>
            {isMobileMenuOpen && (
              <div className="md:hidden bg-white border-t border-gray-200">
                <button
                  onClick={() => { setActiveTab('basic'); setIsMobileMenuOpen(false); }}
                  className={`w-full text-left py-3 px-4 text-sm font-medium ${activeTab === 'basic' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                  Basic Information
                </button>
                <button
                  onClick={() => { setActiveTab('scholarship'); setIsMobileMenuOpen(false); }}
                  className={`w-full text-left py-3 px-4 text-sm font-medium ${activeTab === 'scholarship' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                  Scholarship Details
                </button>
                <button
                  onClick={() => { setActiveTab('fees'); setIsMobileMenuOpen(false); }}
                  className={`w-full text-left py-3 px-4 text-sm font-medium ${activeTab === 'fees' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                  Fee Details
                </button>
                <button
                  onClick={() => { setActiveTab('academics'); setIsMobileMenuOpen(false); }}
                  className={`w-full text-left py-3 px-4 text-sm font-medium ${activeTab === 'academics' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                  Academic Details
                </button>
              </div>
            )}
          </div>

          <div className="mt-8">
            {activeTab === 'basic' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">Basic Information</h2>
                  <button onClick={() => setIsEditing(!isEditing)} className="text-indigo-600 hover:text-indigo-800 p-2 rounded-full hover:bg-indigo-50">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
                {!isEditing ? (
                   <div className="bg-gray-50 rounded-lg p-6">
                    <div className="flex items-center space-x-6 mb-6">
                      <Image
                        src={profilePhoto || '/assets/default-avatar.svg'}
                        alt="Profile Pic"
                        width={96}
                        height={96}
                        onClick={(e) => { e.stopPropagation(); setImagePreviewOpen(true); setImagePreviewSrc(profilePhoto || '/assets/default-avatar.svg'); }}
                        className="w-20 h-20 md:w-24 md:h-24 object-cover rounded-full border-2 border-gray-300 cursor-pointer"
                      />
                      <div>
                        <h3 className="text-xl font-semibold text-gray-800">{student.name}</h3>
                        <p className="text-gray-600">{student.roll_no}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded shadow-sm">
                        <span className="text-sm font-medium text-gray-500">Father Name</span>
                        <p className="text-lg font-semibold text-gray-800">{(student.personal_details && student.personal_details.father_name) || student.father_name}</p>
                      </div>
                      <div className="bg-white p-4 rounded shadow-sm">
                        <span className="text-sm font-medium text-gray-500">Mother Name</span>
                        <p className="text-lg font-semibold text-gray-800">{(student.personal_details && student.personal_details.mother_name) || student.mother_name}</p>
                      </div>
                      <div className="bg-white p-4 rounded shadow-sm">
                        <span className="text-sm font-medium text-gray-500">Date of Birth</span>
                        <p className="text-lg font-semibold text-gray-800">{formatDate(student.date_of_birth)}</p>
                      </div>
                      <div className="bg-white p-4 rounded shadow-sm">
                        <span className="text-sm font-medium text-gray-500">Gender</span>
                        <p className="text-lg font-semibold text-gray-800">{student.gender}</p>
                      </div>
                        <div className="bg-white p-4 rounded shadow-sm md:col-span-2">
                        <span className="text-sm font-medium text-gray-500">Address</span>
                        <p className="text-lg font-semibold text-gray-800">{address}</p>
                      </div>
                      <div className="bg-white p-4 rounded shadow-sm">
                        <span className="text-sm font-medium text-gray-500">Mobile</span>
                        <p className="text-lg font-semibold text-gray-800">{mobile}</p>
                      </div>
                      <div className="bg-white p-4 rounded shadow-sm">
                        <span className="text-sm font-medium text-gray-500">Email</span>
                        <div className="flex items-center space-x-3">
                          <p className="text-lg font-semibold text-gray-800">{email}</p>
                          {!student.is_email_verified && (
                            <div className="ml-2 inline-flex items-center space-x-2">
                              <span className="text-yellow-700 bg-yellow-100 px-2 py-1 rounded text-sm">UNVERIFIED</span>
                              <button
                                onClick={handleSendOtp}
                                className="px-3 py-1 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700"
                                disabled={isVerifying}
                              >
                                {isVerifying ? 'Sending...' : 'Verify'}
                              </button>
                            </div>
                          )}
                        </div>
                        {!student.is_email_verified && (
                          <p className="text-sm text-yellow-800 mt-2">Your email is not verified. College notifications will not be sent.</p>
                        )}
                        {isOtpSent && !isOtpVerified && (
                          <div className="mt-2">
                            <label className="text-sm font-medium text-gray-500 block">Enter OTP</label>
                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                className="mt-1 border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                              <button
                                onClick={handleVerifyOtp}
                                disabled={isVerifying}
                                className="px-4 py-2 mt-1 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-400"
                              >
                                {isVerifying ? 'Verifying...' : 'Verify OTP'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="flex flex-col md:flex-row md:items-start md:space-x-6">
                      <div className="relative">
                      <div className="relative">
                        <Image
                          src={previewPhoto || profilePhoto || '/assets/default-avatar.svg'}
                          alt="Profile Pic"
                          width={96}
                          height={96}
                          onClick={(e) => { e.stopPropagation(); setImagePreviewOpen(true); setImagePreviewSrc(previewPhoto || profilePhoto || '/assets/default-avatar.svg'); }}
                          className={`w-20 h-20 md:w-24 md:h-24 object-cover rounded-full border-2 border-gray-300 ${isPhotoRemoved ? 'grayscale' : ''} cursor-pointer`}
                        />
                        {isPhotoRemoved && (
                          <span className="absolute inset-0 flex items-center justify-center text-red-500 text-4xl font-bold">✕</span>
                        )}
                      </div>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/jpg"
                          ref={fileInputRef}
                          onChange={async (e) => {
                            setPhotoProcessing(true);
                            await handlePhotoChange(e);
                            setPhotoProcessing(false);
                          }}
                          className="hidden"
                        />
                        <div className="flex space-x-2 mt-2">
                          {profilePhoto ? (
                            <>
                              <button
                                onClick={() => fileInputRef.current.click()}
                                className="text-sm text-blue-600 hover:underline cursor-pointer"
                              >
                                Change Photo
                              </button>
                              <button
                                onClick={() => {
                                  setIsPhotoRemoved(true);
                                  setPhotoChanged(true);
                                  setPreviewPhoto(null);
                                }}
                                className="text-sm text-red-600 hover:underline cursor-pointer"
                              >
                                Remove Photo
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => fileInputRef.current.click()}
                              className="text-sm text-blue-600 hover:underline cursor-pointer"
                            >
                              Upload Photo
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1 max-w-xs">
                          Note: Your profile photo will be used across Examination Branch, Scholarship records, ID verification, and official college documents. Please upload a clear passport-size photograph only.
                        </p>
                      </div>
                       <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded shadow-sm">
                          <span className="text-sm font-medium text-gray-500">Father Name</span>
                            <p className="text-lg font-semibold text-gray-800">{(student.personal_details && student.personal_details.father_name) || student.father_name}</p>
                        </div>
                        <div className="bg-white p-4 rounded shadow-sm">
                          <span className="text-sm font-medium text-gray-500">Mother Name</span>
                            <p className="text-lg font-semibold text-gray-800">{(student.personal_details && student.personal_details.mother_name) || student.mother_name}</p>
                        </div>
                        <div className="bg-white p-4 rounded shadow-sm">
                          <span className="text-sm font-medium text-gray-500">Date of Birth</span>
                          <p className="text-lg font-semibold text-gray-800">{formatDate(student.date_of_birth)}</p>
                        </div>
                        <div className="bg-white p-4 rounded shadow-sm">
                          <span className="text-sm font-medium text-gray-500">Gender</span>
                          <p className="text-lg font-semibold text-gray-800">{student.gender}</p>
                        </div>

                        <div className="bg-white p-4 rounded shadow-sm">
                          <label className="text-sm font-medium text-gray-500 block">Mobile</label>
                          <input
                            type="tel"
                            inputMode="numeric"
                            maxLength={12}
                            value={mobile}
                            onChange={(e) => setMobile(sanitizeDigits(e.target.value, 12))}
                            className="mt-1 border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="bg-white p-4 rounded shadow-sm md:col-span-2">
                          <label className="text-sm font-medium text-gray-500 block">Email</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="email"
                              value={newEmail}
                              onChange={(e) => {
                                setNewEmail(e.target.value);
                                setEmailTouched(true);
                                setIsOtpVerified(false);
                                setIsOtpSent(false);
                                setOtp('');
                              }}
                              onBlur={() => setEmailTouched(true)}
                              disabled={(isOtpSent && !isOtpVerified) || emailLocked}
                              className="mt-1 border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            {emailValidationMessage && (
                              <p className="text-sm text-red-600 mt-2">{emailValidationMessage}</p>
                            )}
                                  {emailLocked ? (
                                    <button
                                      onClick={() => {
                                        // allow user to edit again
                                        setEmailLocked(false);
                                        setIsOtpVerified(false);
                                        setIsOtpSent(false);
                                        setNewEmail(originalEmail);
                                        setOtp('');
                                      }}
                                      className="px-3 py-1 mt-1 text-sm font-medium text-indigo-700 bg-indigo-100 rounded-md hover:bg-indigo-200"
                                    >
                                      Edit Email
                                    </button>
                                  ) : (((!student.is_email_verified) || emailChanged) && !isOtpVerified && isEmailValid && (
                              <button
                                onClick={handleSendOtp}
                                disabled={isVerifying}
                                className="px-4 py-2 mt-1 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
                              >
                                {isVerifying ? 'Sending...' : 'Verify'}
                              </button>
                                  ))}
                          </div>
                           {isOtpSent && !isOtpVerified && (
                            <div className="mt-2">
                              <label className="text-sm font-medium text-gray-500 block">Enter OTP</label>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="text"
                                  value={otp}
                                  onChange={(e) => setOtp(e.target.value)}
                                  className="mt-1 border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <button
                                  onClick={handleVerifyOtp}
                                  disabled={isVerifying}
                                  className="px-4 py-2 mt-1 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-400"
                                >
                                  {isVerifying ? 'Verifying...' : 'Verify OTP'}
                                </button>
                              </div>
                            </div>
                          )}
                          {isOtpVerified && <p className="text-green-600 text-sm mt-2">Email verified successfully!</p>}
                        </div>
                        <div className="bg-white p-4 rounded shadow-sm md:col-span-2">
                          <label className="text-sm font-medium text-gray-500 block">Address</label>
                          <textarea
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            className="mt-1 border rounded px-3 py-2 w-full h-24 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="mt-6 flex justify-end space-x-4">
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setMobile(originalMobile);
                          setEmail(originalEmail);
                          setNewEmail(originalEmail);
                          setPreviewPhoto(null);
                          setPhotoChanged(false);
                          setIsPhotoRemoved(false);
                          setIsOtpSent(false);
                          setIsOtpVerified(false);
                          setOtp('');
                          setEmailVerifiedPendingSave(false);
                        }}
                        className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600 font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={!effectiveHasChanges || photoProcessing || (emailChanged && !isOtpVerified)}
                        className={`px-6 py-2 rounded font-medium ${
                          effectiveHasChanges && !photoProcessing && !(emailChanged && !isOtpVerified)
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {photoProcessing ? 'Processing...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'scholarship' && (
              <div>
                <h2 className="text-xl font-bold mb-4">Scholarship Details</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white border">
                    <thead>
                      <tr>
                        <th className="py-2 px-4 border-b text-left whitespace-nowrap">Year</th>
                        <th className="py-2 px-4 border-b text-left whitespace-nowrap">Proceedings No</th>
                        <th className="py-2 px-4 border-b text-left whitespace-nowrap">Amount Sanctioned</th>
                        <th className="py-2 px-4 border-b text-left whitespace-nowrap">Amount Disbursed</th>
                        <th className="py-2 px-4 border-b text-left whitespace-nowrap">Ch No</th>
                        <th className="py-2 px-4 border-b text-left whitespace-nowrap">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(studentData.scholarship || []).length > 0 ? (
                        studentData.scholarship.map((s, i) => (
                          <tr key={s.id || i}>
                            <td className="py-2 px-4 border-b whitespace-nowrap">{computeAcademicYear(student.roll_no, s.year) || `Year ${s.year}`}</td>
                            <td className="py-2 px-4 border-b whitespace-nowrap">{s.proceedings_no || '-'}</td>
                            <td className="py-2 px-4 border-b whitespace-nowrap">{s.amount_sanctioned ?? '-'}</td>
                            <td className="py-2 px-4 border-b whitespace-nowrap">{s.amount_disbursed ?? '-'}</td>
                            <td className="py-2 px-4 border-b whitespace-nowrap">{s.ch_no || '-'}</td>
                            <td className="py-2 px-4 border-b whitespace-nowrap">{formatDate(s.date) || '-'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="py-4 px-4 text-center text-gray-500">No scholarship records found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {activeTab === 'fees' && (
              <div>
                <h2 className="text-xl font-bold mb-4">Fee Details</h2>
                
                {/* Fee Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-blue-50 rounded-lg shadow">
                    <span className="text-sm font-medium text-blue-800">Total Fee ({computeAcademicYear(student.roll_no, currentStudyingYear) || `Year ${currentStudyingYear}`})</span>
                    <p className="text-2xl font-bold text-blue-900">₹{Number(totalFeeForCurrentYear).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg shadow">
                    <span className="text-sm font-medium text-green-800">Paid Fee</span>
                    <p className="text-2xl font-bold text-green-900">₹{Number(totalPaidForCurrentYear).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg shadow">
                    <span className="text-sm font-medium text-red-800">Pending Fee</span>
                    <p className="text-2xl font-bold text-red-900">₹{Number(pendingForCurrentYear).toLocaleString('en-IN')}</p>
                  </div>
                </div>

                {hasScholarshipOtherYears && (
                  <div className="mb-4 p-3 rounded bg-yellow-50 border border-yellow-100 text-yellow-800">
                    Scholarship records exist for {scholarshipYears.map(y => `Year ${y}`).join(', ')} but none apply to the current year (Year {currentStudyingYear}). These earlier scholarships do not affect this year's fee calculation.
                  </div>
                )}

                  {/* Fee Transactions Table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="py-2 px-4 border-b text-left whitespace-nowrap font-semibold text-gray-600">Academic Year</th>
                          <th className="py-2 px-4 border-b text-left whitespace-nowrap font-semibold text-gray-600">Transaction ID</th>
                          <th className="py-2 px-4 border-b text-left whitespace-nowrap font-semibold text-gray-600">Amount</th>
                          <th className="py-2 px-4 border-b text-left whitespace-nowrap font-semibold text-gray-600">Date</th>
                          <th className="py-2 px-4 border-b text-left whitespace-nowrap font-semibold text-gray-600">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                      {feesArray.length > 0 ? (
                        feesArray.map((fee, i) => (
                          <tr key={fee.id || i}>
                            <td className="py-2 px-4 border-b whitespace-nowrap">{computeAcademicYear(student.roll_no, fee.year) || (fee.date ? computeAcademicYear(student.roll_no, fee.year) : `Year ${fee.year ?? '-'}`)}</td>
                            <td className="py-2 px-4 border-b whitespace-nowrap">{fee.upit_no || fee.challan_no || fee.ch_no || fee.transaction_id || fee.id || '-'}</td>
                            <td className="py-2 px-4 border-b whitespace-nowrap">{(fee.amount ?? fee.amount_paid ?? fee.paid_amount) ? `₹${Number(fee.amount ?? fee.amount_paid ?? fee.paid_amount).toLocaleString('en-IN')}` : '-'}</td>
                            <td className="py-2 px-4 border-b whitespace-nowrap">{formatDate(fee.date ?? fee.transaction_date ?? fee.paid_at) || '-'}</td>
                            <td className="py-2 px-4 border-b whitespace-nowrap">
                              {(() => {
                                const status = fee.status ? String(fee.status) : ((fee.amount ?? fee.amount_paid ?? fee.paid_amount) ? 'Success' : 'Pending');
                                const stLower = String(status).toLowerCase();
                                const isSuccess = stLower.startsWith('s') || stLower === 'paid' || stLower === 'success';
                                return (
                                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${isSuccess ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                    {status}
                                  </span>
                                );
                              })()}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="py-4 px-4 text-center text-gray-500">No fee records found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {activeTab === 'academics' && (
              <div>
                <h2 className="text-xl font-bold mb-4">Academic Performance</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white border">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="py-2 px-4 border-b text-left whitespace-nowrap font-semibold text-gray-600">Academic Year</th>
                        <th className="py-2 px-4 border-b text-left whitespace-nowrap font-semibold text-gray-600">Semester</th>
                        <th className="py-2 px-4 border-b text-left whitespace-nowrap font-semibold text-gray-600">SGPA</th>
                        <th className="py-2 px-4 border-b text-left whitespace-nowrap font-semibold text-gray-600">CGPA</th>
                        <th className="py-2 px-4 border-b text-left whitespace-nowrap font-semibold text-gray-600">Backlogs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(studentData.academics || []).length > 0 ? (
                        studentData.academics.map((acad, i) => (
                          <tr key={acad.id || i}>
                            <td className="py-2 px-4 border-b whitespace-nowrap">{computeAcademicYear(student.roll_no, acad.year) || `Year ${acad.year}`}</td>
                            <td className="py-2 px-4 border-b whitespace-nowrap">{acad.semester || '-'}</td>
                            <td className="py-2 px-4 border-b whitespace-nowrap">{acad.sgpa || '-'}</td>
                            <td className="py-2 px-4 border-b whitespace-nowrap">{acad.cgpa || '-'}</td>
                            <td className="py-2 px-4 border-b whitespace-nowrap">{acad.backlogs || '0'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="py-4 px-4 text-center text-gray-500">No academic records found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <ImagePreviewModal src={imagePreviewSrc} alt="Profile preview" open={imagePreviewOpen} onClose={() => setImagePreviewOpen(false)} />
      <Footer />
    </div>
  );
}
