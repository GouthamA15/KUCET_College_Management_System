'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/components/Footer';
import Image from 'next/image';
import { getBranchFromRoll, getCurrentAcademicYear } from '@/lib/rollNumber';
import { formatDate } from '@/lib/date';

export default function EditProfilePage() {
  const router = useRouter();
  const [student, setStudent] = useState(null);
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [pfpDataUrl, setPfpDataUrl] = useState(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [originalMobile, setOriginalMobile] = useState('');
  const [originalAddress, setOriginalAddress] = useState('');
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);
  const editBtnRef = useRef(null);

  const displayedPhoto = pfpDataUrl ? pfpDataUrl : photoRemoved ? null : student?.pfp || null;

  useEffect(() => {
    if (displayedPhoto) {
      setImageLoading(true);
    }
  }, [displayedPhoto]);

  const loadProfile = useCallback(async () => {
    try {
      const meRes = await fetch('/api/student/me');
      if (!meRes.ok) return;
      const me = await meRes.json();
      const profRes = await fetch(`/api/student/${me.roll_no}`);
      if (!profRes.ok) return;
      const data = await profRes.json();
      setStudent(data.student);
      const initialMobile = data.student?.mobile || '';
      const initialAddress = data.student?.personal_details?.address || data.student?.address || '';
      setMobile(initialMobile);
      setAddress(initialAddress);
      setOriginalMobile(initialMobile);
      setOriginalAddress(initialAddress);
      setPhotoRemoved(false);
      setPfpDataUrl(null);
    } catch {}
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // Close photo menu when clicking outside
  useEffect(() => {
    const handleOutside = (e) => {
      if (!photoMenuOpen) return;
      const t = e.target;
      if (menuRef.current && menuRef.current.contains(t)) return;
      if (editBtnRef.current && editBtnRef.current.contains(t)) return;
      setPhotoMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [photoMenuOpen]);

  const onSave = async () => {
    if (!student) return;
    setSaving(true);
    setMessage(null);
    try {
      // Upload photo first if changed
      if (pfpDataUrl || photoRemoved) {
        const upRes = await fetch('/api/student/upload-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roll_no: student.roll_no, pfp: pfpDataUrl || null })
        });
        if (!upRes.ok) throw new Error('Photo upload failed');
      }

      // Update text fields only if changed
      const phoneChanged = mobile !== originalMobile;
      const addressChanged = address !== originalAddress;
      if (phoneChanged || addressChanged) {
        const updRes = await fetch('/api/student/update-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rollno: student.roll_no, phone: mobile, address })
        });
        if (!updRes.ok) throw new Error('Failed to update profile');
      }
      setMessage({ type: 'success', text: 'Profile updated successfully.' });
      await loadProfile();
      setPfpDataUrl(null);
      setPhotoRemoved(false);
    } catch (e) {
      setMessage({ type: 'error', text: e.message || 'Something went wrong.' });
    } finally {
      setSaving(false);
    }
  };

  const onPhotoSelect = (file) => {
    setPhotoFile(file || null);
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
        setMessage({ type: 'error', text: 'Only JPG, JPEG, and PNG files are allowed.' });
        return;
      }
      if (file.size > 4 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'File size must be less than 4MB.' });
        return;
      }

      const reader = new FileReader();
      reader.onload = () => setPfpDataUrl(reader.result);
      reader.readAsDataURL(file);
      setMessage(null);
    } else {
      setPfpDataUrl(null);
    }
    setPhotoRemoved(false);
    setPhotoMenuOpen(false);
  };

  const hasChanges = () => {
    const phoneChanged = mobile !== originalMobile;
    const addressChanged = address !== originalAddress;
    const photoChanged = !!pfpDataUrl || photoRemoved;
    return phoneChanged || addressChanged || photoChanged;
  };

  const cancelChanges = () => {
    // Navigate back to the profile page as requested
    router.push('/student/profile');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col overflow-hidden">
      <Header />
      <Navbar studentProfileMode={true} activeTab={'menu'} onLogout={async () => { await fetch('/api/student/logout', { method: 'POST' }); location.href = '/'; }} />

      <main className="flex-1 flex items-start justify-center px-6 py-6">
        <div className="w-full max-w-6xl bg-white shadow-xl rounded-lg p-6">
          <h1 className="text-2xl font-bold mb-6">Edit Profile</h1>

          {!student ? (
            <div className="text-gray-600">Loading...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-10">
              {/* Left: Photo */}
              <div className="flex flex-col items-center md:items-start">
                {/* Parent container: relative; inner circle handles overflow. */}
                <div className="relative w-44">
                  <div className="w-44 h-44 rounded-full border-4 border-gray-300 overflow-hidden flex items-center justify-center bg-gray-100 relative">
                    {displayedPhoto ? (
                      <>
                        {imageLoading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 z-10 space-y-2">
                                <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
                                <span className="text-xs text-gray-500 font-medium">Image is loading...</span>
                            </div>
                        )}
                        <Image 
                            src={displayedPhoto} 
                            alt="Profile Photo" 
                            width={176} 
                            height={176} 
                            unoptimized
                            className={`object-cover w-full h-full transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`} 
                            onLoad={() => setImageLoading(false)}
                        />
                      </>
                    ) : (
                      <div className="text-gray-500">Profile Picture</div>
                    )}
                  </div>
                  {/* Edit icon positioned slightly outside bottom-right */}
                  <button
                    ref={editBtnRef}
                    type="button"
                    onClick={() => setPhotoMenuOpen((v) => !v)}
                    className="absolute -bottom-2 right-1 w-9 h-9 rounded-full bg-[#0b3578] text-white shadow-lg flex items-center justify-center ring-2 ring-white hover:bg-[#0a2d66] z-50 cursor-pointer transition-colors duration-200 ease-out focus:outline-none"
                    aria-label="Edit photo"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.33H5v-.92l8.06-8.06.92.92L5.92 19.58zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                    </svg>
                  </button>
                  {/* Photo menu: outside the image, to the right */}
                  {photoMenuOpen && (
                    <div
                      ref={menuRef}
                      className={
                        "absolute z-50 bg-white shadow-lg rounded-md border w-48 text-sm " +
                        /* Mobile: centered below avatar. Desktop (md+): positioned to the right */
                        "left-1/2 transform -translate-x-1/2 top-full mt-2 md:left-[calc(100%+12px)] md:translate-x-0 md:top-auto md:bottom-0 md:mt-0"
                      }
                    >
                      {!displayedPhoto ? (
                        <button onClick={() => fileInputRef.current?.click()} className="mx-1 my-0.5 w-[calc(100%-0.5rem)] text-left px-3 py-2 rounded cursor-pointer transition-colors duration-150 ease-out hover:bg-gray-50 hover:shadow-sm">Choose a Photo</button>
                      ) : (
                        <>
                          <button onClick={() => fileInputRef.current?.click()} className="mx-1 my-0.5 w-[calc(100%-0.5rem)] text-left px-3 py-2 rounded cursor-pointer transition-colors duration-150 ease-out hover:bg-gray-50 hover:shadow-sm">Replace Photo</button>
                          <button onClick={() => { setPhotoRemoved(true); setPfpDataUrl(null); setPhotoMenuOpen(false); }} className="mx-1 my-0.5 w-[calc(100%-0.5rem)] text-left px-3 py-2 rounded cursor-pointer transition-colors duration-150 ease-out text-red-600 hover:bg-red-50 hover:shadow-sm">Remove Photo</button>
                        </>
                      )}
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => onPhotoSelect(e.target.files?.[0] || null)} className="hidden" />
                </div>

                {/* Read-only details */}
                <div className="mt-6 w-full text-sm space-y-2">
                  <div><span className="font-semibold">Roll Number:</span> <span className="ml-1">{student.roll_no}</span></div>
                  <div><span className="font-semibold">Name:</span> <span className="ml-1">{student.name}</span></div>
                  <div><span className="font-semibold">Father Name:</span> <span className="ml-1">{student.personal_details?.father_name || student.father_name || '-'}</span></div>
                  <div><span className="font-semibold">Mother Name:</span> <span className="ml-1">{student.personal_details?.mother_name || student.mother_name || '-'}</span></div>
                  <div><span className="font-semibold">Date Of Birth:</span> <span className="ml-1">{student.date_of_birth ? formatDate(student.date_of_birth) : '-'}</span></div>
                </div>
              </div>

              {/* Right: Form */}
              <div className="flex flex-col">
                <div className="border rounded-lg p-5">
                  <div className="text-base font-semibold mb-4">Edit Details</div>
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium mb-1">Phone No:</label>
                      <input value={mobile} onChange={(e) => setMobile(e.target.value)} className="border rounded-md w-full max-w-md px-3 py-2" placeholder="Enter phone number" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Address:</label>
                      <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={4} className="border rounded-md w-full max-w-xl px-3 py-2" placeholder="Enter address" />
                    </div>
                  </div>
                </div>

                <p className="text-sm text-gray-700 mt-4">Note: If any other data is incorrect please make a request and approach a clerk in the office room to edit them</p>

                {/* Action buttons bottom-right */}
                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" onClick={cancelChanges} className="px-4 py-2 rounded border bg-white hover:bg-gray-50">Cancel</button>
                  {hasChanges() && (
                    <button disabled={saving} onClick={onSave} className="px-4 py-2 rounded bg-[#0b3578] text-white hover:bg-[#0a2d66] disabled:opacity-60">{saving ? 'Saving...' : 'Save Changes'}</button>
                  )}
                </div>
                {message && (
                  <div className={`mt-3 text-sm ${message.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>{message.text}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}