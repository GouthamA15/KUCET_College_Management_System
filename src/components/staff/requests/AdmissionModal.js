'use client';
import React, { useCallback, _useRef } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { COLLEGE_CONFIG } from '@/lib/college-config';
import { getAssetUrl } from '@/lib/assets';

export const BLOOD_GROUP_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export const EditableField = React.memo(function EditableField({
    label,
    name,
    type = 'text',
    fullWidth = false,
    options = null,
    inputMode,
    maxLength,
    isEditing,
    value,
    onChange,
    min,
    max,
    step,
}) {
    const handleChange = useCallback(
        (e) => {
            onChange(name, e.target.value);
        },
        [name, onChange]
    );

    const baseClass = 'block w-full border px-3 py-2 text-xs font-bold transition-all rounded-sm';
    const activeClass = 'border-blue-400 bg-white focus:ring-2 focus:ring-blue-100 outline-none uppercase shadow-sm';
    const readOnlyClass = 'border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-tight';

    return (
        <div className={`${fullWidth ? 'md:col-span-2 col-span-1' : ''}`}>
            <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-widest">{label}</label>
            {options ? (
                <select
                    value={value || ''}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={`${baseClass} ${isEditing ? activeClass : readOnlyClass}`}
                >
                    <option value="">SELECT</option>
                    {options.map((o) => (
                        <option key={o} value={o}>
                            {o.toUpperCase()}
                        </option>
                    ))}
                </select>
            ) : type === 'textarea' ? (
                <textarea
                    value={value || ''}
                    onChange={handleChange}
                    disabled={!isEditing}
                    rows={3}
                    maxLength={maxLength}
                    className={`${baseClass} ${isEditing ? activeClass : readOnlyClass} resize-none`}
                />
            ) : (
                <input
                    type={type}
                    value={value || ''}
                    onChange={handleChange}
                    disabled={!isEditing}
                    inputMode={inputMode}
                    maxLength={maxLength}
                    min={min}
                    max={max}
                    step={step}
                    className={`${baseClass} ${isEditing ? activeClass : readOnlyClass}`}
                />
            )}
        </div>
    );
});

export function MediaSection({ detail, isEditing, onFieldChange }) {
    const handleFileChange = (e, name) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 1 * 1024 * 1024) {
            alert('File size exceeds 1MB limit.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            onFieldChange(name, reader.result);
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="space-y-6">
            <div className="border border-slate-200 bg-white p-4 shadow-sm rounded-sm">
                <div className="mb-3 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Identification Photo</span>
                    {isEditing && (
                        <label className="cursor-pointer bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-[9px] font-black border border-blue-200 hover:bg-blue-100 transition-all uppercase tracking-widest">
                            Replace
                            <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*"
                                onChange={(e) => handleFileChange(e, 'pfp')} 
                            />
                        </label>
                    )}
                </div>
                <div className="w-full bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden" style={{ aspectRatio: '3 / 4' }}>
                    {detail.pfp ? (
                        <div className="w-full h-full relative">
                            <Image src={getAssetUrl(detail.pfp)} alt="Student Photo" fill className="object-cover" unoptimized onError={(e) => { e.target.style.display = 'none'; if (e.target.parentNode) e.target.parentNode.innerHTML = '<div class="flex items-center justify-center w-full h-full text-[9px] font-bold text-slate-400 uppercase">Image Unavailable</div>'; }} />
                        </div>
                    ) : (
                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">No Record Found</span>
                    )}
                </div>
            </div>
            <div className="border border-slate-200 bg-white p-4 shadow-sm rounded-sm">
                <div className="mb-3 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Specimen Signature</span>
                    {isEditing && (
                        <label className="cursor-pointer bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-[9px] font-black border border-blue-200 hover:bg-blue-100 transition-all uppercase tracking-widest">
                            Replace
                            <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*"
                                onChange={(e) => handleFileChange(e, 'signature')} 
                            />
                        </label>
                    )}
                </div>
                <div className="w-full h-24 bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden">
                    {detail.signature ? (
                        <div className="w-full h-full relative p-2">
                            <Image src={getAssetUrl(detail.signature)} alt="Signature" fill className="object-contain" unoptimized />
                        </div>
                    ) : (
                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">No Record Found</span>
                    )}
                </div>
            </div>
        </div>
    );
}

export function PersonalDetailsSection({ editForm, isEditing, onFieldChange }) {
    return (
        <section className="border border-slate-200 bg-white p-6 space-y-5 shadow-sm rounded-sm">
            <div className="border-b border-slate-100 pb-2 mb-2 flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">01</span>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Primary Identity Record</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <EditableField label="Full Name" name="name" value={editForm.name} isEditing={isEditing} onChange={onFieldChange} />
                <EditableField label="Gender" name="gender" value={editForm.gender} isEditing={isEditing} onChange={onFieldChange} />
                <EditableField label="Father's Name" name="father_name" value={editForm.father_name} isEditing={isEditing} onChange={onFieldChange} />
                <EditableField label="Mother's Name" name="mother_name" value={editForm.mother_name} isEditing={isEditing} onChange={onFieldChange} />
                <EditableField label="Date of Birth" name="dob" type="date" value={editForm.dob} isEditing={isEditing} onChange={onFieldChange} />
                <EditableField label="Nationality" name="nationality" value={editForm.nationality} isEditing={isEditing} onChange={onFieldChange} />
                <EditableField 
                    label="Religion" 
                    name="religion" 
                    value={editForm.religion} 
                    isEditing={isEditing} 
                    onChange={onFieldChange} 
                    options={COLLEGE_CONFIG.religions}
                />
                <EditableField label="Mother Tongue" name="mother_tongue" value={editForm.mother_tongue} isEditing={isEditing} onChange={onFieldChange} />
                <EditableField
                    label="Blood Group"
                    name="blood_group"
                    options={BLOOD_GROUP_OPTIONS}
                    value={editForm.blood_group}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Aadhaar Number"
                    name="aadhaar_no"
                    type="text"
                    inputMode="numeric"
                    maxLength={12}
                    value={editForm.aadhaar_no}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
            </div>
        </section>
    );
}

export function AcademicSection({ editForm, isEditing, onFieldChange }) {
    return (
        <section className="border border-slate-200 bg-white p-6 space-y-5 shadow-sm rounded-sm">
            <div className="border-b border-slate-100 pb-2 mb-2 flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">02</span>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Academic & Institutional Credentials</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <EditableField
                    label="Entrance Exam"
                    name="entrance_exam"
                    value={editForm.entrance_exam}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Entrance Rank"
                    name="exam_rank"
                    type="number"
                    value={editForm.exam_rank}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="SSC / 10th Marks"
                    name="ssc_marks"
                    value={editForm.ssc_marks}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Inter / Diploma Marks"
                    name="inter_diploma_marks"
                    type="number"
                    min="0"
                    max="1000"
                    step="any"
                    value={editForm.inter_diploma_marks}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Branch Preference"
                    name="branch"
                    options={COLLEGE_CONFIG.branches.map((b) => b.name)}
                    value={editForm.branch}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Social Category"
                    name="category"
                    options={COLLEGE_CONFIG.categories}
                    value={editForm.category}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Sub Caste"
                    name="sub_caste"
                    value={editForm.sub_caste}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Seat Allotted Under"
                    name="seat_allotted_category"
                    value={editForm.seat_allotted_category}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Area Residence Status"
                    name="area_status"
                    options={['Local', 'Non Local']}
                    value={editForm.area_status}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Fee Reimbursement Authorization"
                    name="fee_reimbursement"
                    options={['YES', 'NO', 'GOV']}
                    value={editForm.fee_reimbursement}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
            </div>
        </section>
    );
}

export function ContactSection({ editForm, isEditing, onFieldChange }) {
    const handleCheckboxChange = (e) => {
        const checked = e.target.checked;
        onFieldChange('is_current_same_as_permanent', checked);
        if (checked) {
            onFieldChange('perm_house_no', editForm.curr_house_no || '');
            onFieldChange('perm_street', editForm.curr_street || '');
            onFieldChange('perm_apartment', editForm.curr_apartment || '');
            onFieldChange('perm_city', editForm.curr_city || '');
            onFieldChange('perm_state', editForm.curr_state || '');
            onFieldChange('perm_pincode', editForm.curr_pincode || '');
            onFieldChange('perm_country', editForm.curr_country || 'India');
        }
    };

    const handleAddressFieldChange = (field, value) => {
        onFieldChange(field, value);
        if (editForm.is_current_same_as_permanent && field.startsWith('curr_')) {
            const permField = field.replace('curr_', 'perm_');
            onFieldChange(permField, value);
        }
    };

    const isSame = !!editForm.is_current_same_as_permanent;

    return (
        <section className="border border-slate-200 bg-white p-6 space-y-5 shadow-sm rounded-sm">
            <div className="border-b border-slate-100 pb-2 mb-2 flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">03</span>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Contact & Communication Registry</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <EditableField
                    label="Primary Mobile No"
                    name="student_mobile"
                    value={editForm.student_mobile}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Guardian Mobile No"
                    name="guardian_mobile"
                    value={editForm.guardian_mobile}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Digital Mail Identity"
                    name="email"
                    fullWidth
                    value={editForm.email}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Visible Identification Mark 01"
                    name="identification_mark_1"
                    type="textarea"
                    fullWidth
                    value={editForm.identification_mark_1}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
                <EditableField
                    label="Visible Identification Mark 02"
                    name="identification_mark_2"
                    type="textarea"
                    fullWidth
                    value={editForm.identification_mark_2}
                    isEditing={isEditing}
                    onChange={onFieldChange}
                />
            </div>

            {/* Current Address */}
            <div className="border-t border-slate-100 pt-4">
                <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-4">
                    Current Address {isSame && "(Same as Permanent)"}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <EditableField
                        label="House No"
                        name="curr_house_no"
                        value={editForm.curr_house_no}
                        isEditing={isEditing}
                        onChange={handleAddressFieldChange}
                    />
                    <EditableField
                        label="Apartment / Landmark"
                        name="curr_apartment"
                        value={editForm.curr_apartment}
                        isEditing={isEditing}
                        onChange={handleAddressFieldChange}
                    />
                    <EditableField
                        label="Street"
                        name="curr_street"
                        value={editForm.curr_street}
                        isEditing={isEditing}
                        onChange={handleAddressFieldChange}
                    />
                    <EditableField
                        label="City"
                        name="curr_city"
                        value={editForm.curr_city}
                        isEditing={isEditing}
                        onChange={handleAddressFieldChange}
                    />
                    <EditableField
                        label="State"
                        name="curr_state"
                        value={editForm.curr_state}
                        isEditing={isEditing}
                        onChange={handleAddressFieldChange}
                    />
                    <EditableField
                        label="Pincode"
                        name="curr_pincode"
                        value={editForm.curr_pincode}
                        isEditing={isEditing}
                        onChange={handleAddressFieldChange}
                    />
                    <EditableField
                        label="Country"
                        name="curr_country"
                        value={editForm.curr_country}
                        isEditing={isEditing}
                        onChange={handleAddressFieldChange}
                        fullWidth
                    />
                </div>
            </div>

            {/* Sync Checkbox */}
            <div className="flex items-center gap-2 py-2">
                <input
                    type="checkbox"
                    id="modal_is_current_same_as_permanent"
                    checked={isSame}
                    disabled={!isEditing}
                    onChange={handleCheckboxChange}
                    className="h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                />
                <label htmlFor="modal_is_current_same_as_permanent" className="text-xs font-bold text-slate-700 select-none cursor-pointer disabled:cursor-not-allowed">
                    Mark as permanent address
                </label>
            </div>

            {/* Permanent Address */}
            <div className="border-t border-slate-100 pt-4">
                <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-4">
                    Permanent Address
                </h4>
                {!isSame ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <EditableField
                            label="House No"
                            name="perm_house_no"
                            value={editForm.perm_house_no}
                            isEditing={isEditing}
                            onChange={onFieldChange}
                        />
                        <EditableField
                            label="Apartment / Landmark"
                            name="perm_apartment"
                            value={editForm.perm_apartment}
                            isEditing={isEditing}
                            onChange={onFieldChange}
                        />
                        <EditableField
                            label="Street"
                            name="perm_street"
                            value={editForm.perm_street}
                            isEditing={isEditing}
                            onChange={onFieldChange}
                        />
                        <EditableField
                            label="City"
                            name="perm_city"
                            value={editForm.perm_city}
                            isEditing={isEditing}
                            onChange={onFieldChange}
                        />
                        <EditableField
                            label="State"
                            name="perm_state"
                            value={editForm.perm_state}
                            isEditing={isEditing}
                            onChange={onFieldChange}
                        />
                        <EditableField
                            label="Pincode"
                            name="perm_pincode"
                            value={editForm.perm_pincode}
                            isEditing={isEditing}
                            onChange={onFieldChange}
                        />
                        <EditableField
                            label="Country"
                            name="perm_country"
                            value={editForm.perm_country}
                            isEditing={isEditing}
                            onChange={onFieldChange}
                            fullWidth
                        />
                    </div>
                ) : (
                    <div className="text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-100 p-3 rounded-sm uppercase tracking-wide">
                        Permanent address is synchronized with current address.
                    </div>
                )}
            </div>
        </section>
    );
}

export function AdmissionModal({
    detail,
    editForm,
    isEditing,
    onFieldChange,
    onToggleEditing,
    onClose,
    onSave,
    onVerify,
    onReject,
    processing,
    rejectionMode,
    setRejectionMode,
    rejectionReason,
    setRejectionReason,
    verifyLabel = "Validate & Authenticate"
}) {
    const modal = (
        <div className="fixed inset-0 z-[9998] bg-slate-900/60 backdrop-blur-sm flex items-stretch justify-center p-4 font-sans">
            <div className="bg-slate-50 border border-slate-300 w-full max-w-6xl h-full flex flex-col shadow-2xl rounded-sm">
                {/* Header */}
                <div className="px-4 sm:px-8 py-5 border-b border-slate-200 bg-white flex items-center justify-between">
                    <div>
                        <div className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-1">Audit Environment</div>
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Institutional Admission Review</h2>
                        <div className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mt-1">
                          Applicant: <span className="text-slate-800">{detail.name}</span> • Year {detail.admission_year} • Intake Rank {detail.exam_rank}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {!rejectionMode && (
                            <button
                                type="button"
                                onClick={onToggleEditing}
                                className="px-4 py-2 border-2 border-slate-800 bg-white text-[10px] font-black text-slate-800 uppercase tracking-widest hover:bg-slate-50 transition-all rounded-sm shadow-sm"
                            >
                                {isEditing ? '🔒 Lock Record' : '✍️ Edit Record'}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex items-center justify-center w-10 h-10 border-2 border-slate-200 bg-white text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all rounded-sm shadow-sm"
                            aria-label="Close admission review modal"
                            title="Close"
                        >
                            <span className="text-lg leading-none font-black">×</span>
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-8">
                    {rejectionMode ? (
                        <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto space-y-8 animate-fadeIn">
                            <div className="text-center space-y-3">
                                <span className="text-5xl block grayscale mb-2">🚫</span>
                                <h3 className="text-lg font-black text-rose-700 uppercase tracking-tight">Application Rejection Memo</h3>
                                <p className="text-[11px] text-slate-500 font-bold leading-relaxed uppercase tracking-wider">Specify professional reason for rejection. This memo will be dispatched to the applicant&apos;s registered electronic mail.</p>
                            </div>
                            <div className="w-full">
                                <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest">Rejection Rationale</label>
                                <textarea
                                    className="w-full border-2 border-slate-200 p-5 text-xs font-bold focus:border-rose-500 outline-none bg-white rounded-sm shadow-inner transition-all resize-none"
                                    rows={6}
                                    placeholder="e.g. Identity documentation mismatch, Illegible photography, or Credential verification failure."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                />
                            </div>
                            <div className="flex w-full gap-4">
                                <button
                                    onClick={() => { setRejectionMode(false); setRejectionReason(''); }}
                                    className="flex-1 px-6 py-3 border-2 border-slate-200 bg-white text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 rounded-sm transition-all shadow-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={onReject}
                                    disabled={processing || !rejectionReason.trim()}
                                    className="flex-1 px-6 py-3 bg-rose-700 text-white text-[10px] font-black uppercase tracking-widest hover:bg-rose-800 disabled:opacity-50 rounded-sm shadow-lg shadow-rose-100 transition-all active:scale-95"
                                >
                                    {processing ? 'Processing...' : 'Authorize Rejection'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-10 h-full">
                            <div className="space-y-6">
                                <MediaSection detail={detail} isEditing={isEditing} onFieldChange={onFieldChange} />
                            </div>
                            <div className="space-y-10">
                                <PersonalDetailsSection editForm={editForm} isEditing={isEditing} onFieldChange={onFieldChange} />
                                <AcademicSection editForm={editForm} isEditing={isEditing} onFieldChange={onFieldChange} />
                                <ContactSection editForm={editForm} isEditing={isEditing} onFieldChange={onFieldChange} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {!rejectionMode && (
                    <div className="px-4 sm:px-8 py-5 border-t border-slate-200 bg-white flex justify-between items-center">
                        <button
                            type="button"
                            onClick={() => setRejectionMode(true)}
                            className="px-6 py-2.5 border-2 border-rose-100 bg-rose-50 text-rose-700 text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all rounded-sm shadow-sm"
                        >
                            Issue Rejection
                        </button>
                        
                        <div className="flex gap-4">
                            {isEditing ? (
                                <button
                                    type="button"
                                    onClick={onSave}
                                    disabled={processing}
                                    className="px-4 sm:px-8 py-2.5 border-2 border-amber-500 bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 disabled:opacity-60 transition-all rounded-sm shadow-lg shadow-amber-100 active:scale-95"
                                >
                                    {processing ? 'Saving Audit...' : 'Commit Changes'}
                                </button>
                            ) : onVerify ? (
                                <button
                                    type="button"
                                    onClick={onVerify}
                                    disabled={processing}
                                    className="px-4 sm:px-8 py-2.5 bg-[#0b3578] text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-900 disabled:opacity-60 transition-all rounded-sm shadow-lg shadow-blue-100 active:scale-95"
                                >
                                    {processing ? 'Finalizing...' : verifyLabel}
                                </button>
                            ) : null}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
