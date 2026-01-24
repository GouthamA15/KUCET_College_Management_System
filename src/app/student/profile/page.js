'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function StudentProfile() {
  const router = useRouter();
  const [studentData, setStudentData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [isPhotoRemoved, setIsPhotoRemoved] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [originalMobile, setOriginalMobile] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');
  const fileInputRef = useRef(null);
  const [photoProcessing, setPhotoProcessing] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('logged_in_student');
    if (!stored) {
      router.replace('/');
      return;
    }
    const stu = JSON.parse(stored);
    fetchProfile(stu.roll_no);
  }, [router]);

  const fetchProfile = async (rollno) => {
    try {
      const res = await fetch(`/api/student/${rollno}`);
      const data = await res.json();
      if (res.ok) {
        setStudentData(data);
        setMobile(data.student.mobile);
        setEmail(data.student.email);
        setOriginalMobile(data.student.mobile);
        setOriginalEmail(data.student.email);
        setProfilePhoto(data.student.pfp);
      } else {
        toast.error(data.message || 'Unable to load profile. Please try again.');        
      }
    } catch (error) {
      toast.error('Network error');
    }
  };

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
          const img = new Image();
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
                  // Compress the image further
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

  const handlePhotoUpload = async () => {
    if (!previewPhoto) return;
    try {
      const response = await fetch('/api/student/upload-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roll_no: studentData.student.roll_no,
          pfp: previewPhoto,
        }),
      });
      const result = await response.json();
      if (response.ok) {
        toast.success('Profile photo updated successfully!');
        setPreviewPhoto(null);
      } else {
        toast.error(result.message || 'Photo upload failed. Try again.');
      }
    } catch (error) {
      toast.error('Photo upload failed. Try again.');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const handleSave = async () => {
    try {
      if (photoProcessing) {
        toast.error('Please wait for the photo to be processed.');
        return;
      }
      // Handle photo change or remove
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

      // Update mobile and email
      const response = await fetch('/api/student/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rollno: studentData.student.roll_no,
          phone: mobile,
          email: email,
        }),
      });
      const result = await response.json();
      if (response.ok) {
        toast.success('Profile updated successfully!');
        setIsEditing(false);
        fetchProfile(studentData.student.roll_no);
      } else {
        toast.error(result.message || 'Failed to update contact details.');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    }
  };

  if (!studentData) return null;

  const { student } = studentData;

  const hasChanges = mobile !== originalMobile || email !== originalEmail || photoChanged;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <Navbar studentProfileMode={true} onLogout={handleLogout} />

      <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto bg-white rounded-lg shadow-lg p-8">
          <div className="border-b border-gray-200 relative">
            {/* Desktop Tabs */}
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

            {/* Mobile Hamburger Menu */}
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

            {/* Mobile Menu Dropdown */}
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
                      <img
                        src={profilePhoto || '/assets/default-avatar.svg'}
                        alt="Profile Pic"
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
                        <p className="text-lg font-semibold text-gray-800">{student.father_name}</p>
                      </div>
                      <div className="bg-white p-4 rounded shadow-sm">
                        <span className="text-sm font-medium text-gray-500">Mother Name</span>
                        <p className="text-lg font-semibold text-gray-800">{student.mother_name}</p>
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
                        <p className="text-lg font-semibold text-gray-800">{student.address}</p>
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
                        <img
                          src={previewPhoto || profilePhoto || '/assets/default-avatar.svg'}
                          alt="Profile Pic"
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
                          <p className="text-lg font-semibold text-gray-800">{student.father_name}</p>
                        </div>
                        <div className="bg-white p-4 rounded shadow-sm">
                          <span className="text-sm font-medium text-gray-500">Mother Name</span>
                          <p className="text-lg font-semibold text-gray-800">{student.mother_name}</p>
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
                          <p className="text-lg font-semibold text-gray-800">{student.address}</p>
                        </div>
                        <div className="bg-white p-4 rounded shadow-sm">
                          <label className="text-sm font-medium text-gray-500 block">Mobile</label>
                          <input
                            type="text"
                            value={mobile}
                            onChange={(e) => setMobile(e.target.value)}
                            className="mt-1 border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="bg-white p-4 rounded shadow-sm">
                          <label className="text-sm font-medium text-gray-500 block">Email</label>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1 border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                          setPreviewPhoto(null);
                          setPhotoChanged(false);
                          setIsPhotoRemoved(false);
                        }}
                        className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600 font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={!hasChanges || photoProcessing}
                        className={`px-6 py-2 rounded font-medium ${
                          hasChanges && !photoProcessing
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
                      <tr>
                        <td className="py-2 px-4 border-b whitespace-nowrap">2023-24</td>
                        <td className="py-2 px-4 border-b whitespace-nowrap">Pending</td>
                        <td className="py-2 px-4 border-b whitespace-nowrap">Pending</td>
                        <td className="py-2 px-4 border-b whitespace-nowrap">Pending</td>
                        <td className="py-2 px-4 border-b whitespace-nowrap">Pending</td>
                        <td className="py-2 px-4 border-b whitespace-nowrap">Pending</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {activeTab === 'fees' && (
              <div>
                <h2 className="text-xl font-bold mb-4">Fee Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-100 rounded shadow">
                    <span className="font-semibold">Total Fee:</span> ₹70000
                  </div>
                  <div className="p-4 bg-gray-100 rounded shadow">
.
                    <span className="font-semibold">Paid:</span> ₹70000
                  </div>
                  <div className="p-4 bg-gray-100 rounded shadow">
                    <span className="font-semibold">Pending:</span> ₹0
                  </div>
                  <div className="p-4 bg-gray-100 rounded shadow">
                    <span className="font-semibold">Last Payment Date:</span> Pending    
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'academics' && (
              <div>
                <h2 className="text-xl font-bold mb-4">Academic Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="font-semibold">Course:</span> B.Tech
                  </div>
                  <div>
                    <span className="font-semibold">Branch:</span> CSE
                  </div>
                  <div>
                    <span className="font-semibold">Current Year:</span> 2
                  </div>
                  <div>
                    <span className="font-semibold">Attendance:</span> 78%
                  </div>
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