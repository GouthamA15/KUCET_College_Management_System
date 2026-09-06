'use client';
import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { COLLEGE_CONFIG } from '@/lib/college-config';
import { getAssetUrl } from '@/lib/assets';
import { X, CheckCircle, XCircle } from 'lucide-react';

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

    const baseClass = 'block w-full border px-3 py-2 text-sm font-medium transition-colors rounded-md';
    const activeClass = `border-gray-300 bg-white focus:ring-2 focus:ring-[#0b3578] focus:border-[#0b3578] outline-none shadow-sm`;
    const readOnlyClass = `border-gray-200 bg-gray-50 text-gray-700`;

    let resolvedValue = value || '';
    if (options && value) {
        const match = options.find(o => String(o).toLowerCase() === String(value).toLowerCase());
        if (match) resolvedValue = match;
    }

    return (
        <div className={`${fullWidth ? 'md:col-span-2 col-span-1' : ''}`}>
            <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1.5 tracking-wide">{label}</label>
            {options ? (
                <select
                    value={resolvedValue}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={`${baseClass} ${isEditing ? activeClass : readOnlyClass}`}
                >
                    <option value="">SELECT</option>
                    {options.map((o) => (
                        <option key={o} value={o}>
                            {String(o)}
                        </option>
                    ))}
                </select>
            ) : type === 'textarea' ? (
                <textarea
                    value={resolvedValue}
                    onChange={handleChange}
                    disabled={!isEditing}
                    rows={3}
                    maxLength={maxLength}
                    className={`${baseClass} ${isEditing ? activeClass : readOnlyClass} resize-none`}
                />
            ) : (
                <input
                    type={type}
                    value={resolvedValue}
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
    const [failedPfp, setFailedPfp] = useState(null);
    const [failedSig, setFailedSig] = useState(null);

    const imgError = Boolean(detail.pfp) && failedPfp === detail.pfp;
    const sigError = Boolean(detail.signature) && failedSig === detail.signature;

    const handleFileChange = (e, name) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 1 * 1024 * 1024) {
            alert('File size exceeds 1MB limit.');
            return;
        }

        if (name === 'pfp') setFailedPfp(null);
        if (name === 'signature') setFailedSig(null);

        const reader = new FileReader();
        reader.onloadend = () => {
            onFieldChange(name, reader.result);
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                        Identification Photo
                    </h4>
                    {isEditing && (
                        <label className="cursor-pointer bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold border border-blue-200 hover:bg-blue-100 transition-colors">
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
                <div className="w-full bg-gray-50 border border-gray-200 rounded-md flex items-center justify-center overflow-hidden" style={{ aspectRatio: '3 / 4' }}>
                    {detail.pfp && !imgError ? (
                        <div className="w-full h-full relative">
                            <Image 
                                src={getAssetUrl(detail.pfp)} 
                                alt="Student Photo" 
                                fill 
                                sizes="180px" 
                                className="object-cover" 
                                unoptimized 
                                onError={() => setFailedPfp(detail.pfp)} 
                            />
                        </div>
                    ) : (
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                            {imgError ? 'Image Unavailable' : 'No Record Found'}
                        </span>
                    )}
                </div>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                        Specimen Signature
                    </h4>
                    {isEditing && (
                        <label className="cursor-pointer bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold border border-blue-200 hover:bg-blue-100 transition-colors">
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
                <div className="w-full h-24 bg-gray-50 border border-gray-200 rounded-md flex items-center justify-center overflow-hidden">
                    {detail.signature && !sigError ? (
                        <div className="w-full h-full relative p-2">
                            <Image 
                                src={getAssetUrl(detail.signature)} 
                                alt="Signature" 
                                fill 
                                sizes="240px" 
                                className="object-contain" 
                                unoptimized 
                                onError={() => setFailedSig(detail.signature)}
                            />
                        </div>
                    ) : (
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                            {sigError ? 'Image Unavailable' : 'No Record Found'}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

export function PersonalDetailsSection({ editForm, isEditing, onFieldChange }) {
    return (
        <section className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2 border-b border-gray-100 pb-3 mb-4">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                Primary Identity Record
            </h4>
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
        <section className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2 border-b border-gray-100 pb-3 mb-4">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                Academic & Institutional Credentials
            </h4>
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
                    options={['Local', 'Non-Local']}
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
        <section className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2 border-b border-gray-100 pb-3 mb-4">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                Contact & Communication Registry
            </h4>
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
                    type="email"
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
            <div className="border-t border-gray-100 pt-4 mt-6">
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">
                    Current Address {isSame && "(Same as Permanent)"}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <EditableField label="House No" name="curr_house_no" value={editForm.curr_house_no} isEditing={isEditing} onChange={handleAddressFieldChange} />
                    <EditableField label="Apartment / Landmark" name="curr_apartment" value={editForm.curr_apartment} isEditing={isEditing} onChange={handleAddressFieldChange} />
                    <EditableField label="Street" name="curr_street" value={editForm.curr_street} isEditing={isEditing} onChange={handleAddressFieldChange} />
                    <EditableField label="City" name="curr_city" value={editForm.curr_city} isEditing={isEditing} onChange={handleAddressFieldChange} />
                    <EditableField label="State" name="curr_state" value={editForm.curr_state} isEditing={isEditing} onChange={handleAddressFieldChange} />
                    <EditableField label="Pincode" name="curr_pincode" value={editForm.curr_pincode} isEditing={isEditing} onChange={handleAddressFieldChange} />
                    <EditableField label="Country" name="curr_country" value={editForm.curr_country} isEditing={isEditing} onChange={handleAddressFieldChange} fullWidth />
                </div>
            </div>

            {/* Sync Checkbox */}
            <div className="flex items-center gap-2 py-3">
                <input
                    type="checkbox"
                    id="modal_is_current_same_as_permanent"
                    checked={isSame}
                    disabled={!isEditing}
                    onChange={handleCheckboxChange}
                    className="h-4 w-4 text-[#0b3578] border-gray-300 rounded focus:ring-[#0b3578] cursor-pointer disabled:cursor-not-allowed"
                />
                <label htmlFor="modal_is_current_same_as_permanent" className="text-sm font-medium text-gray-700 select-none cursor-pointer disabled:cursor-not-allowed">
                    Mark as permanent address
                </label>
            </div>

            {/* Permanent Address */}
            <div className="border-t border-gray-100 pt-4 mt-2">
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">
                    Permanent Address
                </h4>
                {!isSame ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <EditableField label="House No" name="perm_house_no" value={editForm.perm_house_no} isEditing={isEditing} onChange={onFieldChange} />
                        <EditableField label="Apartment / Landmark" name="perm_apartment" value={editForm.perm_apartment} isEditing={isEditing} onChange={onFieldChange} />
                        <EditableField label="Street" name="perm_street" value={editForm.perm_street} isEditing={isEditing} onChange={onFieldChange} />
                        <EditableField label="City" name="perm_city" value={editForm.perm_city} isEditing={isEditing} onChange={onFieldChange} />
                        <EditableField label="State" name="perm_state" value={editForm.perm_state} isEditing={isEditing} onChange={onFieldChange} />
                        <EditableField label="Pincode" name="perm_pincode" value={editForm.perm_pincode} isEditing={isEditing} onChange={onFieldChange} />
                        <EditableField label="Country" name="perm_country" value={editForm.perm_country} isEditing={isEditing} onChange={onFieldChange} fullWidth />
                    </div>
                ) : (
                    <div className="text-sm font-medium text-gray-500 bg-gray-50 border border-gray-200 p-4 rounded-md">
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
    restorationMode = false,
    setRestorationMode = () => {},
    restorationReason = '',
    setRestorationReason = () => {},
    onRestore,
    verifyLabel = "Approve Record"
}) {
    if (typeof document === 'undefined') return null;

    const modal = (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 sm:p-8">
            <div 
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>
            
            <div className="relative bg-white border border-gray-200 w-full max-w-6xl h-full max-h-[95vh] flex flex-col shadow-2xl rounded-xl overflow-hidden animate-fadeInUp">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white sticky top-0 z-10">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Review Admission Record</h3>
                        <p className="text-xs text-gray-500 font-mono mt-1">
                            Applicant: <span className="font-semibold text-gray-800">{detail.name}</span> • Year {detail.admission_year} • Rank: {detail.exam_rank} • Status: <span className={`font-bold ${detail.status === 'REJECTED' ? 'text-rose-600' : 'text-[#0b3578]'}`}>{detail.status || 'DRAFT'}</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {!rejectionMode && !restorationMode && detail.status !== 'REJECTED' && (
                            <button
                                type="button"
                                onClick={onToggleEditing}
                                className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm font-medium text-[#0b3578] hover:bg-gray-50 transition-colors shadow-sm"
                            >
                                {isEditing ? '🔒 Lock Record' : '✍️ Edit Record'}
                            </button>
                        )}
                        <button 
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                    {restorationMode ? (
                        <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto space-y-6 animate-fadeIn">
                            <div className="text-center space-y-2">
                                <span className="text-5xl block mb-4">🔄</span>
                                <h3 className="text-xl font-bold text-gray-900">Restore Application</h3>
                                <p className="text-sm text-gray-600 leading-relaxed">Specify the rationale for restoring this application back to the active queue.</p>
                            </div>
                            <div className="w-full">
                                <textarea
                                    className="w-full border border-gray-300 rounded-md p-4 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none shadow-inner resize-none transition-all placeholder:text-gray-400"
                                    rows={5}
                                    placeholder="e.g. Missing certificates verified; Candidate provided corrected documentation."
                                    value={restorationReason}
                                    onChange={(e) => setRestorationReason(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="flex w-full gap-3 mt-4">
                                <button
                                    onClick={() => { setRestorationMode(false); setRestorationReason(''); }}
                                    className="flex-1 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors shadow-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={onRestore}
                                    disabled={processing || !restorationReason.trim()}
                                    className="flex-1 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
                                >
                                    {processing ? 'Restoring...' : 'Authorize Restoration'}
                                </button>
                            </div>
                        </div>
                    ) : rejectionMode ? (
                        <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto space-y-6 animate-fadeIn">
                            <div className="text-center space-y-2">
                                <XCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-gray-900">Application Rejection</h3>
                                <p className="text-sm text-gray-600 leading-relaxed">Specify the reason for rejection. This record will remain preserved in the operational database.</p>
                            </div>
                            <div className="w-full">
                                <textarea
                                    className="w-full border border-gray-300 rounded-md p-4 text-sm focus:ring-2 focus:ring-rose-100 focus:border-rose-500 outline-none shadow-inner resize-none transition-all placeholder:text-gray-400"
                                    rows={5}
                                    placeholder="e.g. Identity documentation mismatch, Illegible photography, or Credential verification failure."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="flex w-full gap-3 mt-4">
                                <button
                                    onClick={() => { setRejectionMode(false); setRejectionReason(''); }}
                                    className="flex-1 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors shadow-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={onReject}
                                    disabled={processing || !rejectionReason.trim()}
                                    className="flex-1 py-2.5 text-sm font-semibold text-white bg-rose-600 rounded-md hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-sm"
                                >
                                    {processing ? 'Processing...' : 'Issue Rejection'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 max-w-5xl mx-auto">
                            {/* Rejection Alert Banner */}
                            {detail.status === 'REJECTED' && (
                                <div className="bg-rose-50 border border-rose-200 p-4 rounded-lg shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <XCircle className="w-5 h-5 text-rose-600 mt-0.5" />
                                        <div>
                                            <h4 className="text-sm font-bold text-rose-900">Application Status: REJECTED</h4>
                                            <p className="text-sm text-rose-700 mt-1">
                                                <strong>Reason:</strong> {detail.rejection_reason || 'Information provided was incomplete or inconsistent with documents.'}
                                            </p>
                                            {detail.rejected_at && (
                                                <p className="text-xs text-rose-500 mt-1 font-medium">
                                                    Rejected on: {new Date(detail.rejected_at).toLocaleString()}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {onRestore && (
                                        <button
                                            type="button"
                                            onClick={() => setRestorationMode(true)}
                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-md shadow-sm transition-colors whitespace-nowrap"
                                        >
                                            🔄 Restore Application
                                        </button>
                                    )}
                                </div>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
                                <div className="space-y-6">
                                    <MediaSection detail={detail} isEditing={isEditing} onFieldChange={onFieldChange} />
                                </div>
                                <div className="space-y-6">
                                    <PersonalDetailsSection editForm={editForm} isEditing={isEditing} onFieldChange={onFieldChange} />
                                    <AcademicSection editForm={editForm} isEditing={isEditing} onFieldChange={onFieldChange} />
                                    <ContactSection editForm={editForm} isEditing={isEditing} onFieldChange={onFieldChange} />
                                    
                                    {/* Status History & Audit Trail */}
                                    {detail.status_history && detail.status_history.length > 0 && (
                                        <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm space-y-4">
                                            <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2 border-b border-gray-100 pb-3 mb-4">
                                                <div className="w-1.5 h-1.5 bg-slate-500 rounded-full"></div>
                                                Lifecycle Status History & Audit Trail
                                            </h4>
                                            <div className="space-y-4 pl-1">
                                                {detail.status_history.map((h, i) => (
                                                    <div key={h.id || i} className="flex items-start gap-4 text-sm pb-4 border-b border-gray-100 last:border-b-0 last:pb-0">
                                                        <div className="w-2 h-2 rounded-full bg-[#0b3578] mt-1.5 flex-shrink-0" />
                                                        <div className="flex-1">
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-semibold text-gray-800">
                                                                    {h.old_status ? `${h.old_status} ➔ ` : ''}{h.new_status}
                                                                </span>
                                                                <span className="text-xs text-gray-500 font-mono bg-gray-50 px-2 py-0.5 rounded">
                                                                    {new Date(h.created_at).toLocaleString()}
                                                                </span>
                                                            </div>
                                                            {h.reason && <p className="text-gray-600 mt-1 italic text-sm">{h.reason}</p>}
                                                            {h.staff_name && (
                                                                <p className="text-xs text-gray-400 font-medium mt-1">
                                                                    Actor: {h.staff_name} ({h.changed_by_user_type})
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {!rejectionMode && !restorationMode && (
                    <div className="bg-white border-t border-gray-200 p-4 sticky bottom-0 z-10 flex gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                        {detail.status !== 'REJECTED' ? (
                            <button
                                type="button"
                                onClick={() => setRejectionMode(true)}
                                className="flex-1 flex items-center justify-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 py-2.5 rounded-lg font-bold text-sm transition-colors shadow-sm"
                            >
                                <XCircle className="w-4 h-4" /> Reject
                            </button>
                        ) : onRestore ? (
                            <button
                                type="button"
                                onClick={() => setRestorationMode(true)}
                                className="flex-[2] flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg font-bold text-sm transition-colors shadow-md"
                            >
                                🔄 Restore Application
                            </button>
                        ) : <div className="flex-1" />}
                        
                        {isEditing ? (
                            <button
                                type="button"
                                onClick={onSave}
                                disabled={processing}
                                className="flex-[2] flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 shadow-md"
                            >
                                {processing ? 'Saving Audit...' : 'Commit Changes'}
                            </button>
                        ) : detail.status !== 'REJECTED' && onVerify ? (
                            <button
                                type="button"
                                onClick={onVerify}
                                disabled={processing}
                                className="flex-[2] flex items-center justify-center gap-2 bg-[#0b3578] hover:bg-blue-900 text-white py-2.5 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 shadow-md"
                            >
                                <CheckCircle className="w-4 h-4" /> {processing ? 'Finalizing...' : verifyLabel}
                            </button>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}
