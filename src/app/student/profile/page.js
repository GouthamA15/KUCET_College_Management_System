'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useStudent } from '@/context/StudentContext';
// Client-side router is not used for auth; server handles redirects
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/components/Footer';
import Image from 'next/image';
import SetPasswordModal from '@/components/SetPasswordModal';
import { getBranchFromRoll, getEntryYearFromRoll, getAdmissionTypeFromRoll, getResolvedCurrentAcademicYear, getBatchFromRoll } from '@/lib/rollNumber';
import { calculateYearAndSemester } from '@/lib/academic-utils';
import { formatDate } from '@/lib/date';
import { computeAcademicYear, isYearAllowed } from '@/app/lib/academicYear';
import toast from 'react-hot-toast'; // Added toast
import Loading from './loading';

export default function StudentProfileNew() {
  const { studentData, collegeInfo, setStudentData, loading: contextLoading, refreshData } = useStudent();
  const [activeTab, setActiveTab] = useState('personal');

  // State variables for editing functionality
  const [isEditing, setIsEditing] = useState(false);
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [isPhotoRemoved, setIsPhotoRemoved] = useState(false);
  const fileInputRef = useRef(null);
  const [photoProcessing, setPhotoProcessing] = useState(false);

  // State for email verification flow
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
  const [imageLoading, setImageLoading] = useState(true);

  // Store original values for cancellation/comparison
  const [originalMobile, setOriginalMobile] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');
  const [originalAddress, setOriginalAddress] = useState('');


  // PASSWORD SETTING STATES
  const [isPasswordSet, setIsPasswordSet] = useState(true); // Default true to prevent flash
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false); // Added for SetPasswordModal

  const sanitizeDigits = (val, maxLen = 12) => {
    if (val == null) return '';
    return String(val).replace(/\D/g, '').slice(0, maxLen);
  };

  useEffect(() => {
    if (studentData) {
      setMobile(studentData.student.mobile || '');
      setEmail(studentData.student.email || '');
      setNewEmail(studentData.student.email || ''); // Initialize newEmail with current email
      setAddress(studentData.student.personal_details?.address || '');
      setOriginalMobile(studentData.student.mobile || '');
      setOriginalEmail(studentData.student.email || '');
      setOriginalAddress(studentData.student.personal_details?.address || '');
      setProfilePhoto(studentData.student.pfp);
      setEmailLocked(!!studentData.student.is_email_verified);

      // CHECK IF PASSWORD IS SET
      const checkPassword = async () => {
        try {
          const passRes = await fetch(`/api/student/set-password?rollno=${studentData.student.roll_no}`);
          if (passRes.ok) {
            const passData = await passRes.json();
            setIsPasswordSet(passData.isPasswordSet);
          }
        } catch (e) {
          console.error("Error checking password status", e);
        }
      };
      checkPassword();
    }
  }, [studentData]);

  const handleLogout = async () => {
    try {
      await fetch('/api/student/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout failed', error);
    } finally {
      localStorage.removeItem('logged_in_student');
      sessionStorage.clear();
      window.location.replace('/');
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
        toast.error('Only JPG, JPEG, and PNG files are allowed.');
        return;
      }
      if (file.size > 4 * 1024 * 1024) { // 4MB limit
        toast.error('File size must be less than 4MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setPreviewPhoto(reader.result);
        setPhotoChanged(true);
        setIsPhotoRemoved(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendOtp = async () => {
    // Client-side uniqueness check before sending OTP
    if (newEmail && newEmail !== originalEmail) {
      const uniquenessRes = await fetch(`/api/student/check-email-uniqueness?email=${encodeURIComponent(newEmail)}&currentRollno=${studentData.student.roll_no}`);
      const uniquenessData = await uniquenessRes.json();
      if (!uniquenessData.isUnique) {
        toast.error(uniquenessData.message || 'This email is already in use.');
        return;
      }
    }

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
        if (!isPasswordSet) {
          setShowSetPasswordModal(true);
        } else {
          setIsOtpVerified(true);
          setEmail(newEmail); // Update the main email state
          setEmailLocked(true);
          setEmailVerifiedPendingSave(true);
          refreshData();
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

        refreshData();
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

  const onPasswordSet = () => {
    setShowSetPasswordModal(false);
    setIsOtpVerified(true);
    setEmail(newEmail);
    setEmailLocked(true);
    setEmailVerifiedPendingSave(true);
    refreshData();
  };


  if (!studentData && contextLoading) return <Loading />;
  if (!studentData) return null;
  const { student } = studentData;

  const branch = getBranchFromRoll(student.roll_no);
  const courseLabel = branch ? `B. Tech (${branch})` : 'B. Tech';
  const { yearOfStudy, semesterLabel } = calculateYearAndSemester(student.roll_no, collegeInfo);
  let currentAcademicYearLabel = null;
  try { currentAcademicYearLabel = getResolvedCurrentAcademicYear(student.roll_no); } catch { currentAcademicYearLabel = null; }
  let batchString = null;
  try { batchString = getBatchFromRoll(student.roll_no); } catch { batchString = null }

  // Determine allowed span (3 for lateral, 4 for regular)
  const maxYears = (() => {
    let n = 4;
    for (let y = 4; y >= 3; y--) { if (isYearAllowed(student.roll_no, y)) { n = y; break; } }
    return n;
  })();

  const scholarshipByYear = {};
  // Map scholarship records (new schema uses `academic_year`, older schema used numeric `year`).
  (studentData.scholarship || []).forEach((s) => {
    for (let y = 1; y <= maxYears; y++) {
      const acadLabel = computeAcademicYear(student.roll_no, y);
      if (!acadLabel) continue;
      const matchesYearIndex = s.year && Number(s.year) === y;
      const matchesAcademicLabel = s.academic_year && String(s.academic_year) === String(acadLabel);
      if (matchesYearIndex || matchesAcademicLabel) {
        scholarshipByYear[y] = {
          // normalize to UI expected keys
          proceedings_no: s.proceeding_no ?? s.proceedings_no ?? s.proceedingNo ?? '',
          amount_sanctioned: s.sanctioned_amount ?? s.amount_sanctioned ?? s.sanctionedAmount ?? '',
          amount_disbursed: s.amount_disbursed ?? '',
          date: s.sanction_date ?? s.sanctionDate ?? s.date ?? null,
        };
        break;
      }
    }
  });

  const rows = Array.from({ length: maxYears }, (_, i) => {
    const y = i + 1;
    const acad = computeAcademicYear(student.roll_no, y);
    const rec = scholarshipByYear[y];
    const formatDateSlash = (val) => {
      if (!val) return '';
      try {
        const dFmt = formatDate(val);
        if (dFmt && typeof dFmt === 'string') return dFmt.replaceAll('-', '/');
        const d = new Date(val);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      } catch {
        return String(val);
      }
    };
    return {
      labelYear: acad ?? `Year ${y}`,
      proceedings_no: rec?.proceedings_no ?? '',
      amount_sanctioned: rec?.amount_sanctioned ?? '',
      amount_disbursed: rec?.amount_disbursed ?? '',
      date: rec?.date ? formatDateSlash(rec.date) : '',
    };
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col overflow-hidden">
      <Header />
      {/* Student navbar with profile context */}
      <Navbar studentProfileMode={true} activeTab={'profile'} onLogout={handleLogout} />
      {showSetPasswordModal && (
        <SetPasswordModal
          rollno={studentData.student.roll_no}
          email={newEmail}
          onPasswordSet={onPasswordSet}
        />
      )}
      {/* Warning bar section: full-width, between Navbar and Profile Card */}
      {(!student.email || !student.is_email_verified || !student.password_hash) && (
        <div className="w-full flex justify-center px-6 pt-4">
          <div className="w-full max-w-6xl">
            <div className="border border-yellow-300 bg-yellow-50 text-yellow-800 rounded-md p-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="text-sm">
                  {(!student.email) && (
                    <span>⚠️ Email not added. Please set your email and password to use portal features.</span>
                  )}
                  {(student.email && !student.is_email_verified) && (
                    <span>⚠️ Email verification required. Please verify your email to use portal features.</span>
                  )}
                  {(!student.password_hash && student.email && student.is_email_verified) && (
                    <span>⚠️ Password not set. Please set a password to continue.</span>
                  )}
                </div>
                {/* Link to security settings to add/verify email */}
                <a href="/student/settings/security" className="inline-flex items-center text-sm font-semibold text-blue-700 hover:underline">Go to Security & Privacy</a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main card container: fixed height, centered, no scroll */}
      <main className="flex-1 flex items-start justify-center px-6 py-6">
        <div className="w-full max-w-6xl bg-white shadow-xl rounded-lg p-6 overflow-hidden">
          {/* Two-column header zone */}
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8">
            {/* Left section: photo + identity */}
            <div className="flex flex-col items-center md:items-start">
              <div className="w-40 h-40 rounded-full border-4 border-gray-300 overflow-hidden flex items-center justify-center bg-gray-100 relative">
                {student.pfp ? (
                  <>
                    {imageLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 z-10 space-y-2">
                            <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
                            <span className="text-xs text-gray-500 font-medium">Image is loading...</span>
                        </div>
                    )}
                    <Image 
                        src={student.pfp} 
                        alt="Profile Photo" 
                        width={160} 
                        height={160} 
                        unoptimized
                        className={`object-cover w-full h-full transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                        onLoad={() => setImageLoading(false)}
                    />
                  </>
                ) : (
                  <div className="text-gray-500">Profile Pic</div>
                )}
              </div>
              <div className="mt-6 text-center md:text-left">
                <div className="text-3xl font-bold leading-tight">{student.name}</div>
                <div className="mt-1 text-lg font-semibold tracking-wide text-gray-800">{student.roll_no}</div>
              </div>
            </div>

            {/* Right section: academic basics */}
            <div className="flex flex-col justify-start">
              <div className="space-y-1">
                <div className="text-xl font-semibold">{courseLabel}</div>
                <div className="text-blue-700 font-semibold">Year: {yearOfStudy} | Semester: {semesterLabel}</div>
                {currentAcademicYearLabel && (
                  <><div className="text-blue-700 font-semibold">Academic Year: {currentAcademicYearLabel} (Current Academic)</div>
                  <div className="text-blue-700 font-semibold">Batch: {batchString}</div>
                </>
                )}
              </div>

              {/* Tabs card below */}
              <div className="mt-6 border rounded-lg">
                {/* Tabs header */}
                <div className="flex border-b bg-gray-50 rounded-t-lg">
                  <button
                    onClick={() => setActiveTab('personal')}
                    className={`px-4 py-3 text-sm font-medium border-b-2 ${activeTab === 'personal' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-600 hover:text-gray-800'}`}
                  >
                    Personal Tab
                  </button>
                  <button
                    onClick={() => setActiveTab('scholarship')}
                    className={`px-4 py-3 text-sm font-medium border-b-2 ${activeTab === 'scholarship' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-600 hover:text-gray-800'}`}
                  >
                    Scholarship Details
                  </button>
                </div>

                {/* Tab body */}
                <div className="p-4 min-h-70">
                  {activeTab === 'personal' && (
                    <div className="space-y-3 text-[16px]">
                      <div><span className="font-semibold">Father Name:</span> <span className="ml-2">{student.personal_details?.father_name ?? '-'}</span></div>
                      <div><span className="font-semibold">Mother Name:</span> <span className="ml-2">{student.personal_details?.mother_name ?? '-'}</span></div>
                      <div><span className="font-semibold">Date of Birth:</span> <span className="ml-2">{student.date_of_birth ? formatDate(student.date_of_birth).replaceAll('-', '/') : '-'}</span></div>
                      <div><span className="font-semibold">Phone:</span> <span className="ml-2">{student.mobile ?? '-'}</span></div>
                      <div><span className="font-semibold">Address:</span> <span className="ml-2">{student.personal_details?.address ?? student.address ?? '-'}</span></div>
                      <div><span className="font-semibold">Email:</span> <span className="ml-2">{student.email || '-'}</span></div>
                    </div>
                  )}

                  {activeTab === 'scholarship' && (
                    <>
                      {/* Desktop/Tablet: Keep fixed table layout */}
                      <div className="hidden md:block overflow-x-hidden">
                        <div className="rounded-md overflow-hidden">
                          <table className="table-fixed w-full border-collapse text-sm">
                            <colgroup>
                              <col style={{ width: '7.5rem' }} />
                              <col style={{ width: '45%' }} />
                              <col style={{ width: '16%' }} />
                              <col style={{ width: '16%' }} />
                              <col style={{ width: '12%' }} />
                            </colgroup>
                            <thead className="bg-gray-100">
                              <tr className="border border-gray-300">
                                <th className="text-left py-2 px-3 border-r border-gray-300">Year</th>
                                <th className="text-left py-2 px-3 border-r border-gray-300">Proceedings No</th>
                                <th className="text-right py-2 px-3 border-r border-gray-300">Amount Sanctioned</th>
                                <th className="text-right py-2 px-3 border-r border-gray-300">Amount Distributed</th>
                                <th className="text-left py-2 px-3">Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((r, idx) => (
                                <tr key={idx} className="border-x border-b border-gray-300">
                                  <td className="py-2 px-3 border-r border-gray-300 align-top">{r.labelYear}</td>
                                  <td className="py-2 px-3 border-r border-gray-300 whitespace-normal wrap-break-word align-top">{r.proceedings_no || '\u00A0'}</td>
                                  <td className="py-2 px-3 border-r border-gray-300 text-right align-top">{r.amount_sanctioned ? `₹ ${r.amount_sanctioned}` : '\u00A0'}</td>
                                  <td className="py-2 px-3 border-r border-gray-300 text-right align-top">{r.amount_disbursed ? `₹ ${r.amount_disbursed}` : '\u00A0'}</td>
                                  <td className="py-2 px-3 align-top">{r.date || '\u00A0'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {/* Outer table border */}
                          <div className="pointer-events-none border border-gray-300 rounded-md mt-[calc(100%-100%)]" />
                        </div>
                      </div>

                      {/* Mobile: Card-based layout, no horizontal table */}
                      <div className="block md:hidden">
                        <div className="space-y-3">
                          {rows.map((r, idx) => (
                            <div key={idx} className="border border-gray-300 rounded-md bg-white p-3 shadow-sm">
                              {/* Year - prominent */}
                              <div className="flex items-center justify-between">
                                <div className="text-sm font-semibold text-gray-700">Year</div>
                                <div className="text-sm font-semibold text-blue-700">{r.labelYear}</div>
                              </div>

                              {/* Proceedings No - stack to avoid ugly wrapping */}
                              <div className="mt-2">
                                <div className="text-xs font-medium text-gray-600">Proceedings No</div>
                                <div className="text-sm text-gray-800 whitespace-normal wrap-break-word leading-relaxed">{r.proceedings_no || '-'}</div>
                              </div>

                              {/* Amounts & Date - label left, value right */}
                              <div className="mt-2 flex items-center justify-between">
                                <div className="text-sm font-medium text-gray-700">Amount Sanctioned</div>
                                <div className="text-sm font-semibold">{r.amount_sanctioned ? `₹ ${r.amount_sanctioned}` : '-'}</div>
                              </div>
                              <div className="mt-2 flex items-center justify-between">
                                <div className="text-sm font-medium text-gray-700">Amount Distributed</div>
                                <div className="text-sm font-semibold">{r.amount_disbursed ? `₹ ${r.amount_disbursed}` : '-'}</div>
                              </div>
                              <div className="mt-2 flex items-center justify-between">
                                <div className="text-sm font-medium text-gray-700">Date</div>
                                <div className="text-sm">{r.date || '-'}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}