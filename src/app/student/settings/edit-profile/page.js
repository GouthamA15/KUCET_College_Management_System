'use client';

import { useEffect, useState, useRef } from 'react';
import { useStudent } from '@/context/StudentContext';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { getAssetUrl } from '@/lib/assets';
import { createPortal } from 'react-dom';
import { Info, X, Camera, UploadCloud, FileText } from 'lucide-react';

export default function EditProfilePage() {
  const { studentData, loading: contextLoading, profileDetails, refreshProfile } = useStudent();
  
  const [formData, setFormData] = useState({
    student: {},
    personal: {}
  });
  const [originalData, setOriginalData] = useState(null);
  
  const [saving, setSaving] = useState(false);
  
  const [pfpDataUrl, setPfpDataUrl] = useState(null);
  const [currentPfp, setCurrentPfp] = useState(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState(null);
  const [currentSignature, setCurrentSignature] = useState(null);
  const [proofDataUrl, setProofDataUrl] = useState(null);
  
  const [latestRequest, setLatestRequest] = useState(null);
  const [history, setHistory] = useState([]);
  
  const [activeTab, setActiveTab] = useState('edit');
  const [isInitializing, setIsInitializing] = useState(true);

  // Help Icon / Bottom Sheet state
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  const fileInputRef = useRef(null);
  const signatureInputRef = useRef(null);
  const proofInputRef = useRef(null);

  const displayedPhoto = pfpDataUrl === 'REMOVE' ? null : (pfpDataUrl || getAssetUrl(currentPfp) || null);
  const displayedSignature = signatureDataUrl === 'REMOVE' ? null : (signatureDataUrl || getAssetUrl(currentSignature));

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

  async function fetchProfileData(isSubmit = false) {
    try {
      const res = await fetch('/api/student/signature');
      if (res.ok) {
        const data = await res.json();
        setCurrentSignature(data.signature);
        setCurrentPfp(data.pfp);
        setLatestRequest(data.latestRequest);
        setHistory(data.history || (data.latestRequest ? [data.latestRequest] : []));
        
        if (data.details) {
          setFormData({
            student: data.details.student || {},
            personal: data.details.personal || {}
          });
          setOriginalData(JSON.parse(JSON.stringify(data.details)));
        }

        if (!isSubmit) {
            const hist = data.history || (data.latestRequest ? [data.latestRequest] : []);
            if (hist.length > 0 && hist.some(h => h.status === 'pending')) {
                setActiveTab('history');
            } else {
                setActiveTab('edit');
            }
        }
      }
    } catch (err) {
      console.error('Failed to fetch profile data:', err);
    } finally {
      setIsInitializing(false);
    }
  }

  useEffect(() => {
    if (profileDetails) {
      // eslint-disable-next-line
      setCurrentSignature(profileDetails.signature);
      setCurrentPfp(profileDetails.pfp);
      setLatestRequest(profileDetails.latestRequest);
      setHistory(profileDetails.history || (profileDetails.latestRequest ? [profileDetails.latestRequest] : []));
      
      if (profileDetails.details) {
        setFormData({
          student: profileDetails.details.student || {},
          personal: profileDetails.details.personal || {}
        });
        setOriginalData(JSON.parse(JSON.stringify(profileDetails.details)));
      }

      const hist = profileDetails.history || (profileDetails.latestRequest ? [profileDetails.latestRequest] : []);
      if (hist.length > 0 && hist.some(h => h.status === 'pending')) {
          setActiveTab('history');
      } else {
          setActiveTab('edit');
      }
      setIsInitializing(false);
    } else if (!contextLoading) {
      // Fallback if not cached somehow
      fetchProfileData();
    }
     
  }, [profileDetails, contextLoading]);

  const getChangedData = () => {
    if (!originalData) return null;
    const changes = {};
    
    // Editable student fields
    if (formData.student.name !== originalData.student.name) {
      changes.name = formData.student.name;
    }

    // Editable personal fields
    const spd_fields = [
      'father_name', 'mother_name', 'dob',
      'curr_house_no', 'curr_street', 'curr_apartment', 'curr_city', 'curr_state', 'curr_pincode',
      'perm_house_no', 'perm_street', 'perm_apartment', 'perm_city', 'perm_state', 'perm_pincode',
      'is_current_same_as_permanent'
    ];
    spd_fields.forEach(field => {
      if (formData.personal[field] !== originalData.personal[field]) {
        changes[field] = formData.personal[field];
      }
    });

    const addressChanged = ['curr_house_no', 'curr_street', 'curr_apartment', 'curr_city', 'curr_state', 'curr_pincode',
      'perm_house_no', 'perm_street', 'perm_apartment', 'perm_city', 'perm_state', 'perm_pincode'
    ].some(field => formData.personal[field] !== originalData.personal[field]);

    if (addressChanged) {
        changes.curr_country = 'India';
        changes.perm_country = 'India';
    }

    return Object.keys(changes).length > 0 ? changes : null;
  };

  const onSave = async () => {
    if (latestRequest && latestRequest.status === 'pending') {
        toast.error('A pending request is already under review.');
        return;
    }

    const changedData = getChangedData();
    if (!changedData && !pfpDataUrl && !signatureDataUrl && !proofDataUrl) {
        toast.error('No modifications detected.');
        return;
    }

    const needsProof = !!changedData;
    if (needsProof && !proofDataUrl) {
        toast.error('Verification proof is mandatory for personal or address updates.');
        return;
    }

    setSaving(true);
    const toastId = toast.loading('Submitting request...');

    try {
        const res = await fetch('/api/student/signature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            signature: signatureDataUrl || null,
            pfp: pfpDataUrl || null,
            data: changedData,
            proof: proofDataUrl || null
          })
        });
        
        const resData = await res.json();
        if (!res.ok) throw new Error(resData.error || 'Submission failed');
        
        setPfpDataUrl(null);
        setSignatureDataUrl(null);
        setProofDataUrl(null);
        toast.success('Official update request submitted successfully.', { id: toastId });
        await refreshProfile();
        setActiveTab('history');
    } catch (e) {
      toast.error(e.message || 'System error occurred.', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const onFileSelect = async (file, type) => {
    if (latestRequest && latestRequest.status === 'pending') {
      toast.error('Pending request exists. System locked.');
      return;
    }

    if (file) {
      if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'].includes(file.type)) {
        toast.error('File format rejected. Use JPG/PNG/PDF.');
        return;
      }

      let processedFile = file;
      if (file.type.startsWith('image/')) {
        try {
          const { compressImage } = await import('@/lib/image-compressor');
          processedFile = await compressImage(file, 1200, 1200, 0.6);
        } catch (err) {
          console.error('Image compression failed:', err);
        }
      }

      if (processedFile.size > 5 * 1024 * 1024) {
        toast.error('File exceeds 5MB limit.');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = () => {
        if (type === 'pfp') setPfpDataUrl(reader.result);
        else if (type === 'sig') setSignatureDataUrl(reader.result);
        else if (type === 'proof') setProofDataUrl(reader.result);
      };
      reader.readAsDataURL(processedFile);
    }
  };

  const updateField = (section, field, value) => {
    setFormData(prev => ({
        ...prev,
        [section]: {
            ...prev[section],
            [field]: value
        }
    }));
  };

  const handleCheckboxChange = (checked) => {
    setFormData(prev => {
      const personal = { 
        ...prev.personal, 
        is_current_same_as_permanent: checked 
      };
      if (checked) {
        personal.perm_house_no = prev.personal.curr_house_no || '';
        personal.perm_street = prev.personal.curr_street || '';
        personal.perm_apartment = prev.personal.curr_apartment || '';
        personal.perm_city = prev.personal.curr_city || '';
        personal.perm_state = prev.personal.curr_state || '';
        personal.perm_pincode = prev.personal.curr_pincode || '';
        personal.perm_country = 'India';
      }
      return { ...prev, personal };
    });
  };

  const handleAddressChange = (field, value) => {
    setFormData(prev => {
      const personal = { 
        ...prev.personal, 
        [field]: value 
      };
      if (prev.personal.is_current_same_as_permanent && field.startsWith('curr_')) {
        const permField = field.replace('curr_', 'perm_');
        personal[permField] = value;
      }
      return { ...prev, personal };
    });
  };

  if (isInitializing || (!studentData && contextLoading)) {
    return (
      <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
        <header className="mb-4">
          <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-gray-800">Edit Profile</h1>
              <div className="text-slate-400 p-1 rounded-full"><Info size={20} className="shrink-0" /></div>
          </div>
          <p className="text-sm text-gray-600 mt-1">Update your personal information and submit profile update requests.</p>
        </header>

        <div className="flex items-center gap-2 mb-3">
          <button className="px-3 py-2 rounded-md text-sm transition-colors bg-[#0b3578] text-white">Edit</button>
          <button className="px-3 py-2 rounded-md text-sm transition-colors bg-white border text-gray-500 cursor-not-allowed">History</button>
        </div>

        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="w-full md:w-[40%] lg:w-[30%] space-y-4">
             <div className="h-64 skeleton-shimmer rounded-lg border border-gray-200"></div>
             <div className="h-32 skeleton-shimmer rounded-lg border border-gray-200"></div>
             <div className="h-48 skeleton-shimmer rounded-lg border border-gray-200"></div>
          </div>
          <div className="w-full md:w-[60%] lg:w-[70%] space-y-4">
             <div className="h-56 skeleton-shimmer rounded-lg border border-gray-200"></div>
             <div className="h-96 skeleton-shimmer rounded-lg border border-gray-200"></div>
          </div>
        </div>
      </div>
    );
  }

  const isPending = latestRequest && latestRequest.status === 'pending';

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
        <h3 id="help-sheet-title" className="text-lg font-bold text-[#0b2447] mb-3">Edit Profile Information</h3>
        <div className="text-sm text-slate-700 space-y-4 mb-6 leading-relaxed">
          <p className="text-slate-600">
            Submit a formal request to update your personal details or contact information. Please note the following guidelines:
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Only selected information can be edited.</li>
            <li>Upload supporting documents when applicable.</li>
            <li>Changes require institutional approval.</li>
            <li>Review normally takes 1–3 working days.</li>
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
                  <h4 className="text-sm font-bold text-[#0b2447] mb-2">Edit Profile Information</h4>
                  <p className="text-xs text-slate-600 leading-relaxed mb-3">
                    Submit a formal request to update your personal details or contact information. Please note the following guidelines:
                  </p>
                  <ul className="text-xs text-slate-600 leading-relaxed list-disc pl-4 space-y-1">
                    <li>Only selected information can be edited.</li>
                    <li>Upload supporting documents when applicable.</li>
                    <li>Changes require institutional approval.</li>
                    <li>Review normally takes 1–3 working days.</li>
                  </ul>
                </div>
              )}
            </div>
        </div>
        <p className="text-sm text-gray-600 mt-1">Update your personal information and submit profile update requests.</p>
      </header>

      {isPending && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-md text-sm font-medium flex items-center gap-2 shadow-sm mb-4">
          <Info className="w-5 h-5 shrink-0" />
          <span>You already have a profile update request under review. New requests cannot be submitted until it is processed.</span>
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setActiveTab('edit')} className={`px-3 py-2 rounded-md text-sm transition-colors ${activeTab === 'edit' ? 'bg-[#0b3578] text-white' : 'bg-white border hover:bg-gray-50'}`}>Edit</button>
        <button onClick={() => setActiveTab('history')} className={`px-3 py-2 rounded-md text-sm transition-colors ${activeTab === 'history' ? 'bg-[#0b3578] text-white' : 'bg-white border hover:bg-gray-50'}`}>History</button>
      </div>

      <div className="animate-in fade-in duration-300">
        {activeTab === 'edit' && (
          <div className={`flex flex-col md:flex-row gap-6 items-start transition-all duration-300 ${isPending ? 'opacity-50 pointer-events-none grayscale-[0.2]' : ''}`}>
            
            {/* Left Column (Profile, Signature, Documents) */}
            <div className="w-full md:w-[40%] lg:w-[30%] space-y-4 shrink-0 md:sticky md:top-6">
              
              {/* Profile Picture Card */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm flex flex-col items-center">
                <div 
                  className="w-36 h-36 rounded-full border-4 border-gray-100 bg-gray-50 overflow-hidden relative group shadow-sm flex items-center justify-center cursor-pointer"
                  onClick={() => !isPending && fileInputRef.current?.click()}
                >
                  {displayedPhoto ? (
                    <Image unoptimized src={displayedPhoto} alt="Profile" width={144} height={144} className="object-cover w-full h-full" />
                  ) : (
                    <span className="text-gray-300 text-4xl">👤</span>
                  )}
                  {!isPending && (
                    <div className="absolute inset-0 bg-black/50 text-white opacity-0 md:group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-xs font-semibold">
                      <Camera size={20} className="mb-1" />
                      Change Photo
                    </div>
                  )}
                </div>
                {!isPending && (
                  <div className="flex flex-col sm:flex-row gap-2 mt-4 w-full">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="md:hidden text-xs font-medium text-[#0b3578] border border-[#0b3578] rounded-md px-3 py-1.5 hover:bg-blue-50 transition-colors flex-1"
                    >
                      Change Photo
                    </button>
                    {(displayedPhoto || currentPfp) && pfpDataUrl !== 'REMOVE' && (
                      <button 
                        onClick={() => setPfpDataUrl('REMOVE')}
                        className="text-xs font-medium text-red-600 border border-red-200 rounded-md px-3 py-1.5 hover:bg-red-50 transition-colors flex-1 md:w-full"
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>
                )}
                {!isPending && <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/jpg" className="hidden" onChange={(e) => onFileSelect(e.target.files[0], 'pfp')} />}
              </div>

              {/* Signature Card */}
              <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                <h3 className="text-xs font-semibold text-gray-800 uppercase tracking-wide mb-3">Signature</h3>
                <div 
                  className={`w-full h-24 border-2 border-dashed ${isPending ? 'border-gray-200 bg-gray-50 cursor-not-allowed' : 'border-gray-300 bg-gray-50 hover:bg-gray-100 cursor-pointer'} flex flex-col items-center justify-center relative group overflow-hidden rounded-md transition-colors`} 
                  onClick={() => !isPending && signatureInputRef.current.click()}
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
                {!isPending && <input ref={signatureInputRef} type="file" accept="image/jpeg,image/png,image/jpg" className="hidden" onChange={(e) => onFileSelect(e.target.files[0], 'sig')} />}
              </div>

              {/* Supporting Documents Card */}
              <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                <h3 className="text-xs font-semibold text-gray-800 uppercase tracking-wide mb-1">Supporting Documents</h3>
                <p className="text-[11px] text-gray-500 mb-3">Upload proof for personal/address changes.</p>
                <div 
                    onClick={() => !isPending && proofInputRef.current.click()}
                    className={`w-full h-32 border-2 border-dashed ${isPending ? 'border-gray-200 bg-gray-50 cursor-not-allowed' : 'border-gray-300 bg-gray-50 hover:bg-gray-100 cursor-pointer'} transition-colors rounded-md flex flex-col items-center justify-center p-4 relative`}
                >
                    <FileText size={24} className="text-gray-400 mb-2" />
                    <span className="text-xs font-semibold text-gray-700">Browse Files</span>
                    <span className="text-[10px] text-gray-500 mt-1 text-center">Accepted: PDF, JPG, PNG<br/>Max 5 MB</span>
                    
                    {proofDataUrl && (
                        <div className="absolute inset-0 bg-white p-2 border border-blue-400 rounded-md flex flex-col z-10 shadow-sm">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-bold text-blue-700 truncate px-1">Document Attached</span>
                                <button onClick={(e) => { e.stopPropagation(); setProofDataUrl(null); }} className="text-red-500 text-[10px] font-bold hover:bg-red-50 px-2 py-0.5 rounded">Remove</button>
                            </div>
                            <div className="flex-1 flex items-center justify-center overflow-hidden bg-gray-50 rounded">
                                {proofDataUrl.startsWith('data:image') ? (
                                    <Image unoptimized src={proofDataUrl} width={100} height={60} alt="Proof" className="object-contain max-h-full" />
                                ) : (
                                    <FileText size={32} className="text-blue-500" />
                                )}
                            </div>
                        </div>
                    )}
                </div>
                {!isPending && <input ref={proofInputRef} type="file" accept="image/jpeg,image/png,image/jpg,application/pdf" className="hidden" onChange={(e) => onFileSelect(e.target.files[0], 'proof')} />}
              </div>
            </div>
            
            {/* Right Column (Editable Information) */}
            <div className="w-full md:w-[60%] lg:w-[70%] space-y-4">
              
              {/* Personal Information */}
              <section className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Personal Information</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Student Name</label>
                    <input disabled={isPending} value={formData.student.name || ''} onChange={e => updateField('student', 'name', e.target.value)} className="w-full border border-gray-300 px-3 py-1.5 text-sm rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400 transition-shadow" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Father Name</label>
                    <input disabled={isPending} value={formData.personal.father_name || ''} onChange={e => updateField('personal', 'father_name', e.target.value)} className="w-full border border-gray-300 px-3 py-1.5 text-sm rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400 transition-shadow" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Mother Name</label>
                    <input disabled={isPending} value={formData.personal.mother_name || ''} onChange={e => updateField('personal', 'mother_name', e.target.value)} className="w-full border border-gray-300 px-3 py-1.5 text-sm rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400 transition-shadow" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Date of Birth</label>
                    <input disabled={isPending} type="date" value={formData.personal.dob ? new Date(formData.personal.dob).toISOString().split('T')[0] : ''} onChange={e => updateField('personal', 'dob', e.target.value)} className="w-full border border-gray-300 px-3 py-1.5 text-sm rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400 transition-shadow" />
                  </div>
                </div>
              </section>

              {/* Address Information */}
              <section className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Address Information</h2>
                </div>
                
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xs font-semibold text-gray-700 mb-3 border-b border-gray-100 pb-1">Current Address</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">
                      <div className="space-y-1">
                        <label className="text-[11px] text-gray-500 font-medium">House Number</label>
                        <input disabled={isPending} value={formData.personal.curr_house_no || ''} onChange={e => handleAddressChange('curr_house_no', e.target.value)} className="w-full border border-gray-300 px-2.5 py-1.5 text-xs rounded focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-gray-500 font-medium">Street</label>
                        <input disabled={isPending} value={formData.personal.curr_street || ''} onChange={e => handleAddressChange('curr_street', e.target.value)} className="w-full border border-gray-300 px-2.5 py-1.5 text-xs rounded focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-gray-500 font-medium">Apartment</label>
                        <input disabled={isPending} value={formData.personal.curr_apartment || ''} onChange={e => handleAddressChange('curr_apartment', e.target.value)} className="w-full border border-gray-300 px-2.5 py-1.5 text-xs rounded focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-gray-500 font-medium">City</label>
                        <input disabled={isPending} value={formData.personal.curr_city || ''} onChange={e => handleAddressChange('curr_city', e.target.value)} className="w-full border border-gray-300 px-2.5 py-1.5 text-xs rounded focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-gray-500 font-medium">State</label>
                        <input disabled={isPending} value={formData.personal.curr_state || ''} onChange={e => handleAddressChange('curr_state', e.target.value)} className="w-full border border-gray-300 px-2.5 py-1.5 text-xs rounded focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-gray-500 font-medium">PIN Code</label>
                        <input disabled={isPending} value={formData.personal.curr_pincode || ''} onChange={e => handleAddressChange('curr_pincode', e.target.value)} className="w-full border border-gray-300 px-2.5 py-1.5 text-xs rounded focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400" />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-gray-50 p-2.5 rounded border border-gray-200">
                    <input 
                      disabled={isPending}
                      type="checkbox" 
                      id="is_current_same_as_permanent" 
                      checked={!!formData.personal.is_current_same_as_permanent} 
                      onChange={e => handleCheckboxChange(e.target.checked)} 
                      className="h-4 w-4 text-[#0b3578] border-gray-300 rounded focus:ring-[#0b3578] disabled:opacity-50 cursor-pointer" 
                    />
                    <label htmlFor="is_current_same_as_permanent" className="text-xs font-semibold text-gray-700 cursor-pointer select-none">
                      Current Address is same as Permanent Address
                    </label>
                  </div>

                  {!formData.personal.is_current_same_as_permanent && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-700 mb-3 border-b border-gray-100 pb-1">Permanent Address</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">
                        <div className="space-y-1">
                          <label className="text-[11px] text-gray-500 font-medium">House Number</label>
                          <input disabled={isPending} value={formData.personal.perm_house_no || ''} onChange={e => updateField('personal', 'perm_house_no', e.target.value)} className="w-full border border-gray-300 px-2.5 py-1.5 text-xs rounded focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] text-gray-500 font-medium">Street</label>
                          <input disabled={isPending} value={formData.personal.perm_street || ''} onChange={e => updateField('personal', 'perm_street', e.target.value)} className="w-full border border-gray-300 px-2.5 py-1.5 text-xs rounded focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] text-gray-500 font-medium">Apartment</label>
                          <input disabled={isPending} value={formData.personal.perm_apartment || ''} onChange={e => updateField('personal', 'perm_apartment', e.target.value)} className="w-full border border-gray-300 px-2.5 py-1.5 text-xs rounded focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] text-gray-500 font-medium">City</label>
                          <input disabled={isPending} value={formData.personal.perm_city || ''} onChange={e => updateField('personal', 'perm_city', e.target.value)} className="w-full border border-gray-300 px-2.5 py-1.5 text-xs rounded focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] text-gray-500 font-medium">State</label>
                          <input disabled={isPending} value={formData.personal.perm_state || ''} onChange={e => updateField('personal', 'perm_state', e.target.value)} className="w-full border border-gray-300 px-2.5 py-1.5 text-xs rounded focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] text-gray-500 font-medium">PIN Code</label>
                          <input disabled={isPending} value={formData.personal.perm_pincode || ''} onChange={e => updateField('personal', 'perm_pincode', e.target.value)} className="w-full border border-gray-300 px-2.5 py-1.5 text-xs rounded focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Submit Action */}
              {!isPending && (
                <div className="flex justify-end gap-3 pt-2">
                  <button 
                    onClick={() => {
                        setFormData(JSON.parse(JSON.stringify(originalData)));
                        setPfpDataUrl(null);
                        setSignatureDataUrl(null);
                        setProofDataUrl(null);
                    }} 
                    className="px-5 py-2.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors font-medium shadow-sm"
                  >
                    Reset Changes
                  </button>
                  <button 
                    onClick={onSave}
                    disabled={saving}
                    className="px-6 py-2.5 text-sm text-white bg-[#0b3578] rounded-md hover:bg-blue-900 transition-colors disabled:opacity-50 font-medium shadow-sm flex items-center justify-center gap-2"
                  >
                    {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {saving ? 'Submitting...' : 'Submit Profile Update'}
                  </button>
                </div>
              )}
            </div>
            
          </div>
        )}

        {activeTab === 'history' && (
          <div className="border border-gray-300 rounded-md bg-white p-5 shadow-sm">
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Profile Update History</h2>
              <p className="text-xs text-gray-600 mt-1">Track your submitted requests and their statuses.</p>
            </div>
            
            {history.length > 0 ? (
              <div className="space-y-4">
                {history.map((req, i) => {
                  const hasDataChanges = req.new_data && Object.keys(req.new_data).length > 0;
                  const hasMediaChanges = req.new_pfp || req.new_signature;
                  
                  const getModifiedHeadings = (dataObj) => {
                    if (!dataObj) return [];
                    const headings = new Set();
                    const keys = Object.keys(dataObj);
                    
                    if (keys.some(k => ['name', 'father_name', 'mother_name', 'dob'].includes(k))) {
                        headings.add('Personal Information');
                    }
                    if (keys.some(k => k.startsWith('curr_') || k === 'is_current_same_as_permanent')) {
                        headings.add('Current Address');
                    }
                    if (keys.some(k => k.startsWith('perm_'))) {
                        headings.add('Permanent Address');
                    }
                    
                    return Array.from(headings);
                  };
                  
                  const modifiedHeadings = getModifiedHeadings(req.new_data);

                  return (
                    <div key={i} className="flex flex-col border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center p-4 border-b border-gray-100 bg-white gap-3">
                        <div>
                          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">{new Date(req.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                          <div className="text-sm font-semibold text-gray-800">Profile Modification Request</div>
                        </div>
                        <div className="self-start sm:self-auto">
                            <span className={`text-[11px] px-3 py-1.5 rounded-md font-bold uppercase tracking-wide border ${
                                req.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-xs' :
                                req.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-xs' :
                                'bg-rose-50 text-rose-700 border-rose-200 shadow-xs'
                            }`}>
                                {req.status}
                            </span>
                        </div>
                      </div>
                      
                      <div className="p-4 space-y-3">
                        {hasDataChanges && modifiedHeadings.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                                Information Updates
                            </span>
                            <div className="flex flex-wrap gap-2">
                                {modifiedHeadings.map(heading => (
                                    <span key={heading} className="text-[10px] font-semibold text-[#0b3578] bg-blue-50 border border-blue-100 px-2 py-1 rounded">
                                        {heading}
                                    </span>
                                ))}
                            </div>
                          </div>
                        )}
                        
                        {hasMediaChanges && (
                          <div className="space-y-2 mt-3">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full"></span>
                                Media Updates
                            </span>
                            <div className="flex gap-3">
                                {req.new_pfp && (
                                    <div className="text-xs font-medium text-purple-700 bg-purple-50 border border-purple-100 px-3 py-1.5 rounded-md flex items-center gap-2">
                                        📷 Profile Picture
                                    </div>
                                )}
                                {req.new_signature && (
                                    <div className="text-xs font-medium text-purple-700 bg-purple-50 border border-purple-100 px-3 py-1.5 rounded-md flex items-center gap-2">
                                        ✍️ Signature
                                    </div>
                                )}
                            </div>
                          </div>
                        )}

                        {req.proof_url && (
                          <div className="mt-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-md inline-flex items-center gap-2">
                            📎 Evidence Provided
                          </div>
                        )}

                        {req.rejection_reason && (
                          <div className="text-xs text-rose-700 mt-4 bg-rose-50 p-3 rounded-md border border-rose-200 flex items-start gap-2 shadow-sm">
                            <span className="text-rose-500 mt-0.5">⚠️</span>
                            <div>
                                <span className="font-bold block mb-1">Rejection Rationale:</span> 
                                {req.rejection_reason}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <div className="text-gray-300 mb-4 text-5xl">📄</div>
                <h3 className="text-sm font-semibold text-gray-800 mb-2">No Profile Update Requests</h3>
                <p className="text-xs text-gray-500 mb-6">You haven&apos;t submitted any profile update requests yet.</p>
                <button 
                  onClick={() => setActiveTab('edit')}
                  className="px-5 py-2.5 text-sm text-[#0b3578] border-2 border-[#0b3578] rounded-md hover:bg-blue-50 transition-colors font-semibold shadow-sm"
                >
                  Create First Request
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {typeof document !== 'undefined' && isBottomSheetOpen && isMobileDevice && createPortal(bottomSheet, document.body)}
    </div>
  );
}
