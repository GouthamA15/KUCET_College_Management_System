'use client';

import { useEffect, useState, useRef } from 'react';
import { useStaff } from '@/context/StaffContext';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { createPortal } from 'react-dom';
import { getAssetUrl, invalidateAssetCache } from '@/lib/assets';
import { useRouter } from 'next/navigation';
import { Camera, UploadCloud, Info, X } from 'lucide-react';

export default function ClerkEditProfilePage() {
  const router = useRouter();
  const { clerkData: clerk, refreshClerkData } = useStaff();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    employee_id: '',
    role: '',
    branch: '',
    address: ''
  });
  
  const [originalData, setOriginalData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pfpDataUrl, setPfpDataUrl] = useState(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  // Help Icon / Bottom Sheet state
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  const fileInputRef = useRef(null);
  const signatureInputRef = useRef(null);

  const displayedPhoto = pfpDataUrl === 'REMOVE' ? null : (pfpDataUrl || getAssetUrl(clerk?.pfp) || null);
  const displayedSignature = signatureDataUrl === 'REMOVE' ? null : (signatureDataUrl || getAssetUrl(clerk?.signature));

  useEffect(() => {
    // Resize listener for Info Popover vs Bottom Sheet
    const handleResize = () => setIsMobileDevice(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent scroll when bottom sheet is open
  useEffect(() => {
    if (isBottomSheetOpen && isMobileDevice) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isBottomSheetOpen, isMobileDevice]);

  useEffect(() => {
    refreshClerkData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (clerk) {
      const data = {
        name: clerk.name || '',
        email: clerk.email || '',
        mobile: clerk.mobile || '',
        employee_id: clerk.employee_id || '',
        role: clerk.role || '',
        branch: clerk.branch || '',
        address: clerk.address || ''
      };
      const id = setTimeout(() => {
        setFormData(data);
        setOriginalData(JSON.parse(JSON.stringify(data)));
        setLoading(false);
      }, 0);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [clerk]);

  const onFileSelect = async (file, type) => {
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type)) {
        toast.error('File format rejected. Use JPG/PNG/WEBP.');
        return;
      }

      let processedFile = file;
      try {
        const { compressImage } = await import('@/lib/image-compressor');
        processedFile = await compressImage(file, 1200, 1200, 0.6);
      } catch (err) {
        console.error('Image compression failed:', err);
      }

      if (processedFile.size >= 1 * 1024 * 1024) {
        toast.error('File exceeds 1MB limit.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (type === 'pfp') setPfpDataUrl(reader.result);
        else if (type === 'sig') setSignatureDataUrl(reader.result);
      };
      reader.readAsDataURL(processedFile);
    }
  };

  const hasChanges = () => {
    if (!originalData) return false;
    if (pfpDataUrl || signatureDataUrl) return true;
    
    return (
      formData.name !== originalData.name ||
      formData.mobile !== originalData.mobile ||
      formData.address !== originalData.address
    );
  };

  const onSave = async () => {
    if (!hasChanges()) {
      toast.error('No modifications detected.');
      return;
    }

    if (formData.name.trim().length < 3) {
      toast.error('Name must be at least 3 characters long.');
      return;
    }
    if (formData.name.length > 50) {
      toast.error('Name cannot exceed 50 characters.');
      return;
    }
    if (!/^[a-zA-Z\s]*$/.test(formData.name)) {
      toast.error('Name can only contain letters and spaces.');
      return;
    }
    if (formData.mobile.length !== 10) {
      toast.error('Mobile number must be exactly 10 digits.');
      return;
    }
    if (formData.address.length > 255) {
      toast.error('Address cannot exceed 255 characters.');
      return;
    }

    setSaving(true);
    const toastId = toast.loading('Updating institutional records...');

    try {
      const payload = { /* empty */ };
      if (formData.name !== originalData.name) payload.name = formData.name;
      if (formData.mobile !== originalData.mobile) payload.mobile = formData.mobile;
      if (formData.address !== originalData.address) payload.address = formData.address;
      if (pfpDataUrl) payload.pfp = pfpDataUrl;
      if (signatureDataUrl) payload.signature = signatureDataUrl;

      const res = await fetch('/api/staff/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Update failed');
      
      toast.success('Profile updated successfully.', { id: toastId });
      invalidateAssetCache(originalData?.pfp);
      invalidateAssetCache(originalData?.signature);
      setPfpDataUrl(null);
      setSignatureDataUrl(null);
      await refreshClerkData();
      
      if (clerk?.role) {
        router.push(`/staff/${clerk.role}/profile`);
      }
    } catch (e) {
      toast.error(e.message || 'System error occurred.', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !clerk) {
    return (
      <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
        <header className="mb-4">
          <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-gray-800">Edit Profile</h1>
              <div className="text-slate-400 p-1 rounded-full"><Info size={20} className="shrink-0" /></div>
          </div>
          <p className="text-sm text-gray-600 mt-1">Update your staff information and profile assets.</p>
        </header>

        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="w-full md:w-[40%] lg:w-[30%] space-y-4">
             <div className="h-64 skeleton-shimmer rounded-lg border border-gray-200"></div>
             <div className="h-32 skeleton-shimmer rounded-lg border border-gray-200"></div>
          </div>
          <div className="w-full md:w-[60%] lg:w-[70%] space-y-4">
             <div className="h-56 skeleton-shimmer rounded-lg border border-gray-200"></div>
             <div className="h-56 skeleton-shimmer rounded-lg border border-gray-200"></div>
          </div>
        </div>
      </div>
    );
  }

  const bottomSheet = (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300">
      <div className="absolute inset-0 cursor-pointer" onClick={() => setIsBottomSheetOpen(false)} />
      <div 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="help-sheet-title" 
        className="relative bg-white w-full rounded-t-2xl shadow-2xl p-6 border-t border-slate-200 z-10 animate-slideUp max-h-[90vh] overflow-y-auto"
      >
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-5" />
        <button 
          onClick={() => setIsBottomSheetOpen(false)}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors p-1"
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
        <h3 id="help-sheet-title" className="text-lg font-bold text-[#0b2447] mb-3">Staff Profile Information</h3>
        <div className="text-sm text-slate-700 space-y-4 mb-6 leading-relaxed">
          <p className="text-slate-600">
            Manage your institutional profile and verify your contact details. Please note:
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Your role and branch are assigned by the administration.</li>
            <li>To update your email, navigate to the Security / Authentication tab.</li>
            <li>Profile photos and signatures are used for official documentation.</li>
            <li>Updates are applied immediately upon successful submission.</li>
          </ul>
        </div>
        <button 
          onClick={() => setIsBottomSheetOpen(false)} 
          className="w-full bg-[#0b3578] text-white py-3 rounded-lg font-semibold text-sm hover:bg-[#0a2d66] active:bg-[#092554] transition-colors focus:outline-none"
        >
          Got It
        </button>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
      <header className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold text-gray-800">Edit Profile</h1>
                <div 
                  className="relative inline-flex items-center"
                  onMouseEnter={() => !isMobileDevice && setIsHovered(true)}
                  onMouseLeave={() => !isMobileDevice && setIsHovered(false)}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      if (isMobileDevice) {
                        setIsBottomSheetOpen(true);
                      }
                    }}
                    className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100 focus:outline-none flex items-center justify-center cursor-pointer"
                    aria-label="Help Information"
                  >
                    <Info size={20} className="shrink-0" />
                  </button>

                  {isHovered && !isMobileDevice && (
                    <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-xl p-4 z-50 text-left animate-slideDown">
                      <h4 className="text-sm font-bold text-[#0b2447] mb-2">Staff Profile Information</h4>
                      <p className="text-xs text-slate-600 leading-relaxed mb-3">
                        Manage your institutional profile and verify your contact details. Please note:
                      </p>
                      <ul className="text-xs text-slate-600 leading-relaxed list-disc pl-4 space-y-1">
                        <li>Your role and branch are assigned by administration.</li>
                        <li>To update your email, use the Security tab.</li>
                        <li>Photos/signatures are used for official documents.</li>
                        <li>Updates are applied immediately upon save.</li>
                      </ul>
                    </div>
                  )}
                </div>
            </div>
            <p className="text-sm text-gray-600 mt-1">Update your staff information and profile assets.</p>
          </div>
          <div className="px-3 py-1 bg-blue-50 border border-blue-200 rounded-md text-xs font-semibold text-blue-700 uppercase tracking-widest hidden sm:block">
            {String(clerk?.role || 'Staff').toUpperCase()} Portal
          </div>
        </div>
      </header>

      <div className="animate-in fade-in duration-300">
        <div className="flex flex-col md:flex-row gap-6 items-start transition-all duration-300">
          
          {/* Left Column (Profile, Signature) */}
          <div className="w-full md:w-[40%] lg:w-[30%] space-y-4 shrink-0 md:sticky md:top-6">
            
            {/* Profile Picture Card */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm flex flex-col items-center">
              <div 
                className="w-36 h-36 rounded-full border-4 border-gray-100 bg-gray-50 overflow-hidden relative group shadow-sm flex items-center justify-center cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                {displayedPhoto ? (
                  <Image unoptimized src={displayedPhoto} alt="Profile" width={144} height={144} className="object-cover w-full h-full" />
                ) : (
                  <span className="text-gray-300 text-4xl">👤</span>
                )}
                <div className="absolute inset-0 bg-black/50 text-white opacity-0 md:group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-xs font-semibold">
                  <Camera size={20} className="mb-1" />
                  Change Photo
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 mt-4 w-full">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="md:hidden text-xs font-medium text-[#0b3578] border border-[#0b3578] rounded-md px-3 py-1.5 hover:bg-blue-50 transition-colors flex-1"
                >
                  Change Photo
                </button>
                {(displayedPhoto || clerk?.pfp) && pfpDataUrl !== 'REMOVE' && (
                  <button 
                    onClick={() => setPfpDataUrl('REMOVE')}
                    className="text-xs font-medium text-red-600 border border-red-200 rounded-md px-3 py-1.5 hover:bg-red-50 transition-colors flex-1 md:w-full"
                  >
                    Remove Photo
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/jpg,image/webp" className="hidden" onChange={(e) => onFileSelect(e.target.files[0], 'pfp')} />
            </div>

            {/* Signature Card */}
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              <h3 className="text-xs font-semibold text-gray-800 uppercase tracking-wide mb-3">Signature</h3>
              <div 
                className="w-full h-24 border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 cursor-pointer flex flex-col items-center justify-center relative group overflow-hidden rounded-md transition-colors"
                onClick={() => signatureInputRef.current.click()}
              >
                {displayedSignature ? (
                  <Image unoptimized src={displayedSignature} alt="Signature" width={200} height={80} className="object-contain w-full h-full p-2" />
                ) : (
                  <>
                    <UploadCloud size={20} className="text-gray-400 mb-1" />
                    <span className="text-gray-500 text-xs font-medium">Upload Signature</span>
                  </>
                )}
              </div>
              <input ref={signatureInputRef} type="file" accept="image/jpeg,image/png,image/jpg,image/webp" className="hidden" onChange={(e) => onFileSelect(e.target.files[0], 'sig')} />
            </div>
          </div>
          
          {/* Right Column (Editable Information) */}
          <div className="w-full md:w-[60%] lg:w-[70%] space-y-4">
            
            {/* Institutional Information (Read Only) */}
            <section className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Institutional Appointment</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Employee ID</label>
                  <input value={formData.employee_id} disabled className="w-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm rounded-md outline-none text-gray-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Institutional Email</label>
                  <input 
                    value={formData.email} 
                    disabled 
                    className="w-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm rounded-md outline-none text-gray-500" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Department / Branch</label>
                  <input value={formData.branch || 'INSTITUTIONAL'} disabled className="w-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm rounded-md outline-none text-gray-500 uppercase" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Designated Role</label>
                  <input 
                    value={formData.role.toUpperCase()} 
                    disabled 
                    className="w-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm rounded-md outline-none text-gray-500" 
                  />
                </div>
              </div>
              <p className="mt-4 text-[10px] text-gray-400 font-medium italic">
                * Appointment details are fixed by the administrative office. Email modifications require security authentication.
              </p>
            </section>

            {/* Personal Information */}
            <section className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Personal Details</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Full Name</label>
                  <input 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    maxLength={50}
                    className="w-full border border-gray-300 px-3 py-1.5 text-sm rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Mobile Number</label>
                  <input 
                    value={formData.mobile} 
                    onChange={e => setFormData({...formData, mobile: e.target.value.replace(/\D/g, '').slice(0, 10)})} 
                    maxLength={10}
                    placeholder="10-digit mobile number"
                    className="w-full border border-gray-300 px-3 py-1.5 text-sm rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow" 
                  />
                </div>
                
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-medium text-gray-600">Permanent Address</label>
                  <textarea 
                    value={formData.address} 
                    onChange={e => setFormData({...formData, address: e.target.value})} 
                    rows={3}
                    maxLength={255}
                    placeholder="Enter permanent residential address"
                    className="w-full border border-gray-300 px-3 py-2 text-sm rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow" 
                  />
                </div>
              </div>
            </section>

            {/* Submit Action */}
            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => {
                  setFormData(JSON.parse(JSON.stringify(originalData)));
                  setPfpDataUrl(null);
                  setSignatureDataUrl(null);
                }} 
                className="px-5 py-2.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors font-medium shadow-sm"
              >
                Reset Changes
              </button>
              <button 
                onClick={onSave}
                disabled={saving || !hasChanges()}
                className="px-6 py-2.5 text-sm text-white bg-[#0b3578] rounded-md hover:bg-blue-900 transition-colors disabled:opacity-50 font-medium shadow-sm flex items-center justify-center gap-2"
              >
                {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {saving ? 'Processing...' : 'Apply Modifications'}
              </button>
            </div>
            
          </div>
        </div>
      </div>

      {typeof document !== 'undefined' && isBottomSheetOpen && isMobileDevice && createPortal(bottomSheet, document.body)}
    </div>
  );
}

