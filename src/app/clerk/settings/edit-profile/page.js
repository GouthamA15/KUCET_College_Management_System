'use client';

import { useEffect, useState, useRef } from 'react';
import { useClerk } from '@/context/ClerkContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import toast from 'react-hot-toast';

export default function ClerkEditProfilePage() {
  const router = useRouter();
  const { clerkData: clerk, refreshClerkData } = useClerk();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    employee_id: '',
    role: '',
    branch: ''
  });
  
  const [originalData, setOriginalData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pfpDataUrl, setPfpDataUrl] = useState(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  // Email Verification Workflow States
  const [emailVerified, setEmailVerified] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const fileInputRef = useRef(null);
  const signatureInputRef = useRef(null);

  useEffect(() => {
    if (clerk) {
      const data = {
        name: clerk.name || '',
        email: clerk.email || '',
        mobile: clerk.mobile || '',
        employee_id: clerk.employee_id || '',
        role: clerk.role || '',
        branch: clerk.branch || ''
      };
      setFormData(data);
      setOriginalData(JSON.parse(JSON.stringify(data)));
      setLoading(false);
    }
  }, [clerk]);

  const onFileSelect = (file, type) => {
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
        toast.error('File format rejected. Use JPG/PNG.');
        return;
      }
      if (file.size > 1 * 1024 * 1024) {
        toast.error('File exceeds 1MB limit.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (type === 'pfp') setPfpDataUrl(reader.result);
        else if (type === 'sig') setSignatureDataUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRequestEmailChange = async () => {
    setSendingOtp(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: originalData.email,
          purpose: 'Verification for Email Change'
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('OTP sent to current email address.');
        setShowOtpInput(true);
      } else {
        toast.error(data.error || 'Failed to send OTP');
      }
    } catch (e) {
      toast.error('Network error occurred.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      toast.error('Enter a valid 6-digit OTP');
      return;
    }
    setVerifyingOtp(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: originalData.email,
          submittedOtp: otpCode
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Identity verified. You can now update your email.');
        setEmailVerified(true);
        setShowOtpInput(false);
      } else {
        toast.error(data.error || 'Invalid OTP');
      }
    } catch (e) {
      toast.error('Verification failed.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const hasChanges = () => {
    if (!originalData) return false;
    if (pfpDataUrl || signatureDataUrl) return true;
    return (
      formData.name !== originalData.name ||
      (emailVerified && formData.email !== originalData.email) ||
      formData.mobile !== originalData.mobile
    );
  };

  const onSave = async () => {
    if (!hasChanges()) {
      toast.error('No modifications detected.');
      return;
    }

    setSaving(true);
    const toastId = toast.loading('Updating institutional records...');

    try {
      const payload = {};
      if (formData.name !== originalData.name) payload.name = formData.name;
      if (emailVerified && formData.email !== originalData.email) payload.email = formData.email;
      if (formData.mobile !== originalData.mobile) payload.mobile = formData.mobile;
      if (pfpDataUrl) payload.pfp = pfpDataUrl;
      if (signatureDataUrl) payload.signature = signatureDataUrl;

      const res = await fetch('/api/clerk/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Update failed');
      
      toast.success('Profile updated successfully.', { id: toastId });
      setPfpDataUrl(null);
      setSignatureDataUrl(null);
      setEmailVerified(false); // Reset after save
      await refreshClerkData();
    } catch (e) {
      toast.error(e.message || 'System error occurred.', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  if (loading && !clerk) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-slate-100 border-t-[#0b3578] rounded-full animate-spin"></div>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Loading Records</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div className="bg-white border border-slate-200 shadow-sm rounded-sm overflow-hidden">
        
        {/* Header */}
        <div className="bg-[#0b3578] px-6 py-5 border-b border-blue-900 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white uppercase tracking-tight">Staff Profile Settings</h1>
            <p className="text-blue-100 text-xs mt-1">Institutional Employee Information Management</p>
          </div>
          <div className="px-3 py-1 bg-blue-900/50 border border-blue-400 text-[10px] font-black text-white uppercase tracking-widest">
            {String(clerk?.role || 'Staff').toUpperCase()} Portal
          </div>
        </div>

        <div className="p-6 md:p-10">
          <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-12">
            
            {/* Left: Avatar & Signature */}
            <aside className="space-y-10">
              <div className="text-center">
                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Official Portrait</span>
                <div className="relative inline-block group">
                  <div className={`w-44 h-44 rounded-full border-4 ${pfpDataUrl ? 'border-[#0b3578]' : 'border-slate-100'} bg-slate-50 overflow-hidden flex items-center justify-center shadow-inner`}>
                    {(pfpDataUrl || clerk?.pfp) ? (
                      <Image 
                        src={pfpDataUrl || clerk?.pfp} 
                        alt="Profile" 
                        width={176} 
                        height={176} 
                        unoptimized 
                        className="object-cover w-full h-full" 
                      />
                    ) : (
                      <div className="text-slate-300 flex flex-col items-center">
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="text-[9px] font-bold uppercase mt-2">No Image</span>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => fileInputRef.current.click()}
                    className="absolute bottom-1 right-1 w-10 h-10 bg-[#0b3578] text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-900 transition-all border-2 border-white"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFileSelect(e.target.files[0], 'pfp')} />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verification Signature</label>
                <div className={`w-full h-24 border-2 ${signatureDataUrl ? 'border-[#0b3578] bg-blue-50/20' : 'border-dashed border-slate-200 bg-slate-50'} flex items-center justify-center relative group overflow-hidden rounded-sm`}>
                  {(signatureDataUrl || clerk?.signature) ? (
                    <Image 
                      src={signatureDataUrl || clerk?.signature} 
                      alt="Signature" 
                      width={200} 
                      height={96} 
                      unoptimized 
                      className="object-contain w-full h-full p-3" 
                    />
                  ) : (
                    <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Unrecorded</span>
                  )}
                  <button 
                    onClick={() => signatureInputRef.current.click()} 
                    className="absolute inset-0 bg-[#0b3578]/90 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-black uppercase tracking-widest"
                  >
                    Upload Signature
                  </button>
                </div>
                <input ref={signatureInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFileSelect(e.target.files[0], 'sig')} />
              </div>
            </aside>

            {/* Right: Form */}
            <div className="space-y-10">
              
              <section>
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2 mb-6 flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-[#0b3578] block"></span>
                  Personal Particulars
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name</label>
                    <input 
                      value={formData.name} 
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className={`w-full border px-4 py-3 text-sm font-bold outline-none transition-all ${formData.name !== originalData?.name ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200 hover:border-slate-300'}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee Contact Number</label>
                    <input 
                      value={formData.mobile} 
                      onChange={(e) => setFormData({...formData, mobile: e.target.value})}
                      className={`w-full border px-4 py-3 text-sm font-bold outline-none transition-all ${formData.mobile !== originalData?.mobile ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200 hover:border-slate-300'}`}
                      placeholder="Enter mobile number"
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Institutional Email</label>
                    <div className="flex flex-col md:flex-row gap-3">
                      <div className="flex-1 relative">
                        <input 
                          value={formData.email} 
                          disabled={!emailVerified}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                          className={`w-full border px-4 py-3 text-sm font-bold outline-none transition-all ${
                            emailVerified 
                              ? (formData.email !== originalData?.email ? 'border-amber-400 bg-amber-50/30' : 'border-blue-400 bg-blue-50/10') 
                              : 'bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed'
                          }`}
                        />
                        {emailVerified && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            <span className="text-[8px] font-black text-green-600 uppercase tracking-tighter">Unlocked</span>
                          </div>
                        )}
                      </div>

                      {!emailVerified && !showOtpInput && (
                        <button 
                          onClick={handleRequestEmailChange}
                          disabled={sendingOtp}
                          className="px-6 py-3 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50"
                        >
                          {sendingOtp ? 'Sending...' : 'Verify to Change'}
                        </button>
                      )}

                      {showOtpInput && (
                        <div className="flex gap-2">
                          <input 
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="6-DIGIT OTP"
                            className="w-32 border-2 border-[#0b3578] px-4 py-2 text-center text-sm font-black tracking-[0.2em] outline-none"
                          />
                          <button 
                            onClick={handleVerifyOtp}
                            disabled={verifyingOtp}
                            className="px-6 py-3 bg-[#0b3578] text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-900 transition-all"
                          >
                            {verifyingOtp ? '...' : 'Verify'}
                          </button>
                          <button 
                            onClick={() => { setShowOtpInput(false); setOtpCode(''); }}
                            className="px-4 py-3 text-slate-400 hover:text-rose-600 transition-all"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-[9px] text-slate-400 font-medium italic">
                      {emailVerified 
                        ? "* Identity confirmed. You may now input your new institutional email address."
                        : "* For security, changing your email requires OTP verification via your current registered address."}
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2 mb-6 flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-[#0b3578] block"></span>
                  Institutional Appointment
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee ID</label>
                    <input value={formData.employee_id} disabled className="w-full bg-slate-50 border border-slate-200 px-4 py-3 text-sm font-bold text-slate-400 cursor-not-allowed uppercase" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Designated Role</label>
                    <input value={formData.role.toUpperCase()} disabled className="w-full bg-slate-50 border border-slate-200 px-4 py-3 text-sm font-bold text-slate-400 cursor-not-allowed uppercase" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Department/Branch</label>
                    <input value={formData.branch || 'INSTITUTIONAL'} disabled className="w-full bg-slate-50 border border-slate-200 px-4 py-3 text-sm font-bold text-slate-400 cursor-not-allowed uppercase" />
                  </div>
                </div>
                <p className="mt-4 text-[10px] text-slate-400 font-medium italic">
                  * Appointment details are fixed by the administrative office. Contact Super Admin for role modifications.
                </p>
              </section>

              {/* Actions */}
              <div className="pt-8 flex items-center justify-end gap-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => router.back()} 
                  className="px-8 py-3 bg-slate-50 text-slate-500 font-bold uppercase tracking-widest hover:bg-slate-100 transition-all text-[10px]"
                >
                  Cancel
                </button>
                <button 
                  disabled={saving || !hasChanges()} 
                  onClick={onSave}
                  className="px-10 py-3 bg-[#0b3578] text-white font-bold uppercase tracking-widest hover:bg-blue-900 disabled:opacity-30 disabled:grayscale transition-all text-[10px] shadow-sm"
                >
                  {saving ? 'Processing...' : 'Apply Modifications'}
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
