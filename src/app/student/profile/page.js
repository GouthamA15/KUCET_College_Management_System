'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { formatDate } from '@/lib/date';
import { getBranchFromRoll, getCurrentStudyingYear, getAcademicYear } from '@/lib/rollNumber';
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
  const [emailLocked, setEmailLocked] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  const sanitizeDigits = (val, maxLen = 12) => {
    if (val == null) return '';
    return String(val).replace(/\D/g, '').slice(0, maxLen);
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
      } else {
        toast.error(data.message || 'Unable to load profile. Please try again.');
      }
    } catch (error) {
      toast.error('Network error');
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('logged_in_student');
    if (!stored) {
      router.replace('/');
      return;
    }
    const stu = JSON.parse(stored);
    fetchProfile(stu.roll_no);
  }, [router, fetchProfile]);

  const handleLogout = () => {
    localStorage.removeItem('logged_in_student');
    sessionStorage.clear();
    router.replace('/');
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
        toast.error('Only JPG, JPEG, and PNG files are allowed.');
        return;
      }

      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new window.Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const size = Math.min(img.width, img.height);
            canvas.width = 150;
            canvas.height = 150;

            const x = (img.width - size) / 2;
            const y = (img.height - size) / 2;

            ctx.drawImage(img, x, y, size, size, 0, 0, 150, 150);

            canvas.toBlob(
              (blob) => {
                if (blob.size > 60 * 1024) {
                  const quality = (60 * 1024) / blob.size;
                  canvas.toBlob(
                    (compressedBlob) => {
                      const reader = new FileReader();
                      reader.onload = () => {
                        setPreviewPhoto(reader.result);
                        setPhotoChanged(true);
                        setIsPhotoRemoved(false);
                        resolve(reader.result);
                      };
                      reader.readAsDataURL(compressedBlob);
                    },
                    'image/jpeg',
                    quality
                  );
                } else {
                  const reader = new FileReader();
                  reader.onload = () => {
                    setPreviewPhoto(reader.result);
                    setPhotoChanged(true);
                    setIsPhotoRemoved(false);
                    resolve(reader.result);
                  };
                  reader.readAsDataURL(blob);
                }
              },
              'image/jpeg',
              0.9
            );
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleSendOtp = async () => {
    if (newEmail === originalEmail) {
      toast.error("You haven't changed your email address.");
      return;
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
        setIsOtpVerified(true);
        setEmail(newEmail); // Update the main email state
        // Lock email after successful verification; user may explicitly choose to edit again
        setEmailLocked(true);
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

  if (!studentData) return null;

  const { student } = studentData;

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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <Navbar studentProfileMode={true} onLogout={handleLogout} />

      <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto bg-white rounded-lg shadow-lg p-8">
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
                <div className="font-medium">{getAcademicYear(student.roll_no) || '-'}</div>
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
                        className="w-20 h-20 md:w-24 md:h-24 object-cover rounded-full border-2 border-gray-300"
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
                        <p className="text-lg font-semibold text-gray-800">{email}</p>
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
                          className={`w-20 h-20 md:w-24 md:h-24 object-cover rounded-full border-2 border-gray-300 ${isPhotoRemoved ? 'grayscale' : ''}`}
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
                                  ) : (emailChanged && !isOtpVerified && isEmailValid && (
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
                        }}
                        className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600 font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={!hasChanges || photoProcessing || (emailChanged && !isOtpVerified)}
                        className={`px-6 py-2 rounded font-medium ${
                          hasChanges && !photoProcessing && !(emailChanged && !isOtpVerified)
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
                    <span className="text-sm font-medium text-blue-800">Total Fee</span>
                    <p className="text-2xl font-bold text-blue-900">₹70,000</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg shadow">
                    <span className="text-sm font-medium text-green-800">Total Paid</span>
                    <p className="text-2xl font-bold text-green-900">
                      ₹{studentData.fees.reduce((acc, fee) => acc + (fee.amount || 0), 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg shadow">
                    <span className="text-sm font-medium text-red-800">Pending Fee</span>
                    <p className="text-2xl font-bold text-red-900">
                      ₹{(70000 - studentData.fees.reduce((acc, fee) => acc + (fee.amount || 0), 0)).toLocaleString()}
                    </p>
                  </div>
                </div>

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
                      {(studentData.fees || []).length > 0 ? (
                        studentData.fees.map((fee, i) => (
                          <tr key={fee.id || i}>
                            <td className="py-2 px-4 border-b whitespace-nowrap">{computeAcademicYear(student.roll_no, fee.year) || `Year ${fee.year}`}</td>
                            <td className="py-2 px-4 border-b whitespace-nowrap">{fee.transaction_id || '-'}</td>
                            <td className="py-2 px-4 border-b whitespace-nowrap">₹{fee.amount ? fee.amount.toLocaleString() : '-'}</td>
                            <td className="py-2 px-4 border-b whitespace-nowrap">{formatDate(fee.date) || '-'}</td>
                            <td className="py-2 px-4 border-b whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${fee.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                {fee.status || 'N/A'}
                              </span>
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
      <Footer />
    </div>
  );
}
