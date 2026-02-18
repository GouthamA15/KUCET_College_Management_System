'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useStudent } from '@/context/StudentContext';
import { useRouter } from 'next/navigation';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/components/Footer';
import Image from 'next/image';

export default function EditProfilePage() {
  const router = useRouter();
  const { studentData, setStudentData, loading: contextLoading, refreshData } = useStudent();
  const student = studentData?.student;

  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [originalMobile, setOriginalMobile] = useState('');
  const [originalAddress, setOriginalAddress] = useState('');
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  
  // Profile/Signature States
  const [pfpDataUrl, setPfpDataUrl] = useState(null);
  const [currentPfp, setCurrentPfp] = useState(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState(null);
  const [currentSignature, setCurrentSignature] = useState(null);
  const [latestRequest, setLatestRequest] = useState(null);

  const fileInputRef = useRef(null);
  const signatureInputRef = useRef(null);
  const menuRef = useRef(null);
  const editBtnRef = useRef(null);

  const displayedPhoto = pfpDataUrl || currentPfp || null;
  const displayedSignature = signatureDataUrl || currentSignature;

  useEffect(() => {
    if (displayedPhoto) {
      setImageLoading(true);
    }
  }, [displayedPhoto]);

  useEffect(() => {
    if (student) {
      const initialMobile = student.mobile || '';
      const initialAddress = student.personal_details?.address || student.address || '';
      setMobile(initialMobile);
      setAddress(initialAddress);
      setOriginalMobile(initialMobile);
      setOriginalAddress(initialAddress);
      fetchProfileData();
    }
  }, [student]);

  async function fetchProfileData() {
    try {
      const res = await fetch('/api/student/signature');
      if (res.ok) {
        const data = await res.json();
        setCurrentSignature(data.signature);
        setCurrentPfp(data.pfp);
        setLatestRequest(data.latestRequest);
      }
    } catch (err) {
      console.error('Failed to fetch profile data:', err);
    }
  }

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
      // 1. Profile/Signature Update Request (Merged)
      if (pfpDataUrl || signatureDataUrl) {
        const res = await fetch('/api/student/signature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            signature: signatureDataUrl || null,
            pfp: pfpDataUrl || null
          })
        });
        if (!res.ok) throw new Error('Update request failed');
        setPfpDataUrl(null);
        setSignatureDataUrl(null);
        await fetchProfileData();
      }

      // 2. Text fields Update (Still direct if you want, or request-based)
      // Request requested direct edit for text fields, but only PFP/Sig require approval
      const phoneChanged = mobile !== originalMobile;
      const addressChanged = address !== originalAddress;
      if (phoneChanged || addressChanged) {
        const updRes = await fetch('/api/student/update-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rollno: student.roll_no, phone: mobile, address })
        });
        if (!updRes.ok) throw new Error('Failed to update details');
        setOriginalMobile(mobile);
        setOriginalAddress(address);
      }
      
      setMessage({ type: 'success', text: 'Changes saved.' + ((pfpDataUrl || signatureDataUrl) ? ' Profile update request sent for clerk approval.' : '') });
      await refreshData();
    } catch (e) {
      setMessage({ type: 'error', text: e.message || 'Something went wrong.' });
    } finally {
      setSaving(false);
    }
  };

  const onPhotoSelect = (file) => {
    if (latestRequest && latestRequest.status === 'pending') {
      setMessage({ type: 'error', text: 'You already have a pending profile update request. Please wait for the clerk to review it.' });
      return;
    }

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
    }
    setPhotoMenuOpen(false);
  };

  const onSignatureSelect = (file) => {
    if (latestRequest && latestRequest.status === 'pending') {
      setMessage({ type: 'error', text: 'You already have a pending profile update request. Please wait for clerk approval.' });
      return;
    }

    if (file) {
      if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
        setMessage({ type: 'error', text: 'Only JPG, JPEG, and PNG files are allowed for signature.' });
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'Signature file size must be less than 2MB.' });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => setSignatureDataUrl(reader.result);
      reader.readAsDataURL(file);
      setMessage(null);
    }
  };

  const hasChanges = () => {
    const phoneChanged = mobile !== originalMobile;
    const addressChanged = address !== originalAddress;
    const pfpChanged = !!pfpDataUrl;
    const signatureChanged = !!signatureDataUrl;
    return phoneChanged || addressChanged || pfpChanged || signatureChanged;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col overflow-hidden">
      <Header />
      <Navbar studentProfileMode={true} activeTab={'menu'} onLogout={async () => { await fetch('/api/student/logout', { method: 'POST' }); location.href = '/'; }} />

      <main className="flex-1 flex items-start justify-center px-6 py-6 overflow-y-auto">
        <div className="w-full max-w-6xl bg-white shadow-xl rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Edit Profile</h1>
            {latestRequest && (
                <div className={`px-4 py-1.5 rounded-full text-xs font-bold border ${
                    latestRequest.status === 'pending' ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse' : 
                    latestRequest.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' : 'hidden'
                }`}>
                    {latestRequest.status === 'pending' ? '⏳ Profile Update Pending' : '❌ Request Rejected'}
                </div>
            )}
          </div>

          {!studentData && contextLoading ? (
            <div className="text-gray-600">Loading...</div>
          ) : !studentData ? (
            <div className="text-gray-600">Student not found.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-10">
              {/* Left Column: Photo & Signature */}
              <div className="flex flex-col items-center md:items-start">
                {/* Photo Section */}
                <div className="relative w-44">
                  <div className={`w-44 h-44 rounded-full border-4 ${pfpDataUrl ? 'border-indigo-400' : 'border-gray-300'} overflow-hidden flex items-center justify-center bg-gray-100 relative transition-colors`}>
                    {displayedPhoto ? (
                      <>
                        {imageLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                                <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
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
                      <div className="text-gray-400 text-xs text-center px-4">Upload Profile Picture</div>
                    )}
                    {pfpDataUrl && (
                        <div className="absolute top-2 right-2 bg-indigo-600 text-white text-[8px] px-1.5 py-0.5 rounded-full uppercase font-bold tracking-wider shadow-sm">New</div>
                    )}
                  </div>
                  <button
                    ref={editBtnRef}
                    type="button"
                    onClick={() => setPhotoMenuOpen((v) => !v)}
                    className="absolute -bottom-2 right-1 w-9 h-9 rounded-full bg-[#0b3578] text-white shadow-lg flex items-center justify-center ring-2 ring-white hover:bg-[#0a2d66] z-50 focus:outline-none transition-transform hover:scale-105"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.33H5v-.92l8.06-8.06.92.92L5.92 19.58zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                  </button>
                  {photoMenuOpen && (
                    <div ref={menuRef} className="absolute z-50 bg-white shadow-xl rounded-md border w-48 text-sm left-1/2 -translate-x-1/2 top-full mt-2 md:left-[calc(100%+12px)] md:translate-x-0 md:bottom-0">
                      <button onClick={() => fileInputRef.current?.click()} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-2">
                        <span>📷</span> Upload Photo
                      </button>
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => onPhotoSelect(e.target.files?.[0] || null)} className="hidden" />
                </div>

                {/* Signature Section */}
                <div className="mt-8 w-full flex flex-col items-center md:items-start">
                  <div className="text-sm font-semibold mb-2 text-gray-700">Signature</div>
                  <div className={`w-44 h-24 border-2 ${signatureDataUrl ? 'border-indigo-400 border-solid bg-indigo-50/30' : 'border-dashed border-gray-300 bg-gray-50'} rounded flex items-center justify-center overflow-hidden relative group transition-all`}>
                    {displayedSignature ? (
                      <Image src={displayedSignature} alt="Signature" width={176} height={96} unoptimized className="object-contain w-full h-full" />
                    ) : (
                      <span className="text-xs text-gray-400">No signature uploaded</span>
                    )}
                    <button onClick={() => signatureInputRef.current?.click()} className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs font-bold">
                      {displayedSignature ? 'Update Signature' : 'Upload Signature'}
                    </button>
                    {signatureDataUrl && (
                        <div className="absolute top-1 right-1 bg-indigo-600 text-white text-[8px] px-1 py-0.5 rounded-full uppercase font-bold tracking-wider">New</div>
                    )}
                  </div>
                  <input ref={signatureInputRef} type="file" accept="image/*" onChange={(e) => onSignatureSelect(e.target.files?.[0] || null)} className="hidden" />
                  
                  {latestRequest && latestRequest.status === 'rejected' && (
                    <div className="mt-3 w-44 p-3 bg-red-50 border border-red-200 rounded text-[10px] text-red-700 leading-relaxed shadow-sm">
                      <div className="font-bold flex items-center gap-1 mb-1">
                          <span>❌</span> REJECTION REASON:
                      </div>
                      <p className="font-medium">{latestRequest.rejection_reason || 'Please provide a clearer image.'}</p>
                    </div>
                  )}
                  <p className="mt-4 text-[10px] text-gray-500 text-center md:text-left leading-relaxed">
                    Note: Changes to your profile photo and signature must be approved by the admission office.
                  </p>
                </div>

                <div className="mt-6 w-full text-sm space-y-2 border-t pt-6">
                  <div><span className="font-semibold text-gray-600">Roll No:</span> <span className="ml-1 text-gray-900 font-medium">{student.roll_no}</span></div>
                  <div><span className="font-semibold text-gray-600">Name:</span> <span className="ml-1 text-gray-900 font-medium">{student.name}</span></div>
                </div>
              </div>

              {/* Right Column: Form */}
              <div className="flex flex-col">
                <div className="border rounded-xl p-6 bg-white shadow-sm">
                  <div className="text-lg font-bold mb-5 flex items-center gap-2">
                      <span className="w-1.5 h-6 bg-indigo-600 rounded-full"></span>
                      Contact & Address
                  </div>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Phone Number:</label>
                      <input 
                        value={mobile} 
                        onChange={(e) => setMobile(e.target.value)} 
                        className="border border-gray-300 rounded-lg w-full max-w-md px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        placeholder="Enter 10-digit mobile number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Mailing Address:</label>
                      <textarea 
                        value={address} 
                        onChange={(e) => setAddress(e.target.value)} 
                        rows={5} 
                        className="border border-gray-300 rounded-lg w-full max-w-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        placeholder="Enter full residential address"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-end gap-4">
                  <button 
                    type="button" 
                    onClick={() => router.push('/student/profile')} 
                    className="px-6 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={saving || !hasChanges()} 
                    onClick={onSave} 
                    className="px-8 py-2.5 rounded-lg bg-[#0b3578] text-white font-bold hover:bg-[#0a2d66] disabled:opacity-40 disabled:cursor-not-allowed shadow-md transition-all active:scale-95"
                  >
                    {saving ? 'Saving...' : 'Submit Changes'}
                  </button>
                </div>
                {message && (
                  <div className={`mt-4 text-sm p-4 rounded-lg border font-medium flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    <span>{message.type === 'success' ? '✅' : '⚠️'}</span>
                    {message.text}
                  </div>
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
