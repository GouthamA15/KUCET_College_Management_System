'use client';
import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { getIntakeYear } from '@/lib/rollNumber';
import { COLLEGE_CONFIG } from '@/lib/college-config';
import { smoothScrollToTop } from '@/lib/scroll-utils';

const AdmissionPage = () => {
    const [admissionYear, setAdmissionYear] = useState('');
    const [form, setForm] = useState({
        entrance_exam: 'TG EAPCET',
        branch: 'CSE',
        name: '',
        father_name: '',
        mother_name: '',
        exam_rank: '',
        area_status: 'Local',
        category: 'OC',
        sub_caste: '',
        seat_allotted_category: '',
        dob: '',
        gender: 'Male',
        nationality: 'Indian',
        religion: '',
        mother_tongue: '',
        blood_group: '',
        ssc_marks: '',
        inter_diploma_marks: '',
        place_of_birth: '',
        father_occupation: '',
        annual_income: '',
        aadhaar_no: '',
        student_mobile: '',
        guardian_mobile: '',
        email: '',
        fee_reimbursement: 'NO',
        identification_mark_1: '',
        identification_mark_2: '',
        curr_house_no: '',
        curr_street: '',
        curr_apartment: '',
        curr_city: '',
        curr_state: '',
        curr_pincode: '',
        curr_country: 'India',
        perm_house_no: '',
        perm_street: '',
        perm_apartment: '',
        perm_city: '',
        perm_state: '',
        perm_pincode: '',
        perm_country: 'India',
        is_current_same_as_permanent: false,
    });

    const handleAddressChange = (field, value, isCurrent = true) => {
        setForm(prev => {
            const updated = { ...prev, [field]: value };
            if (isCurrent && prev.is_current_same_as_permanent) {
                const permField = field.replace('curr_', 'perm_');
                updated[permField] = value;
            }
            return updated;
        });
    };

    const handleCheckboxChange = (checked) => {
        setForm(prev => {
            const updated = {
                ...prev,
                is_current_same_as_permanent: checked
            };
            if (checked) {
                updated.perm_house_no = prev.curr_house_no;
                updated.perm_street = prev.curr_street;
                updated.perm_apartment = prev.curr_apartment;
                updated.perm_city = prev.curr_city;
                updated.perm_state = prev.curr_state;
                updated.perm_pincode = prev.curr_pincode;
                updated.perm_country = prev.curr_country;
            }
            return updated;
        });
    };
    const [files, setFiles] = useState({ pfp: null, signature: null });
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [_annualIncomeDisplay, _setAnnualIncomeDisplay] = useState('');

    const initialNameRef = useRef(form.name);

    // Persistence: Detect saved draft on mount
    useEffect(() => {
        const savedDraft = localStorage.getItem('admission_form_draft');
        if (savedDraft) {
            try {
                const { form: savedForm, admissionYear: savedYear } = JSON.parse(savedDraft);
                // Only prompt if the current form is essentially empty (to avoid annoying active users)
                if (!initialNameRef.current && savedForm?.name) {
                    toast((t) => (
                        <div className="flex flex-col gap-2 p-1">
                            <p className="text-sm font-bold text-indigo-900">Restore Unsaved Progress?</p>
                            <p className="text-xs text-gray-600">We found an incomplete application from your previous session.</p>
                            <div className="flex items-center gap-3 mt-1">
                                <button 
                                    onClick={() => {
                                        setForm(savedForm);
                                        if (savedYear) setAdmissionYear(savedYear);
                                        toast.dismiss(t.id);
                                        toast.success('Progress restored successfully!');
                                    }}
                                    className="bg-indigo-600 text-white px-4 py-1.5 rounded text-xs font-black uppercase tracking-wider shadow-sm hover:bg-indigo-700 transition-colors"
                                >
                                    Restore
                                </button>
                                <button 
                                    onClick={() => {
                                        localStorage.removeItem('admission_form_draft');
                                        toast.dismiss(t.id);
                                    }}
                                    className="text-gray-400 hover:text-red-500 text-[10px] font-bold uppercase tracking-widest transition-colors"
                                >
                                    Discard Draft
                                </button>
                            </div>
                        </div>
                    ), { 
                        duration: 15000, 
                        position: 'top-center',
                        style: {
                            border: '2px solid #e0e7ff',
                            padding: '12px',
                            color: '#1e1b4b',
                            maxWidth: '350px'
                        }
                    });
                }
            } catch (e) {
                console.error("Failed to parse saved draft", e);
            }
        }
    }, []);

    // Persistence: Debounced save to localStorage
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            // Only save if there's significant data and form isn't submitted
            const hasData = form.name || form.father_name || form.student_mobile || form.email;
            if (!submitted && hasData) {
                localStorage.setItem('admission_form_draft', JSON.stringify({ form, admissionYear }));
            }
        }, 1500);
        return () => clearTimeout(timeoutId);
    }, [form, admissionYear, submitted]);

    useEffect(() => {
        const id = setTimeout(() => {
            const year = getIntakeYear();
            if (form.entrance_exam === 'TG EAPCET') {
                setAdmissionYear(`${year}-${year + 4}`);
            } else if (form.entrance_exam === 'TG ECET') {
                setAdmissionYear(`${year}-${year + 3}`);
            }
        }, 0);

        return () => clearTimeout(id);
    }, [form.entrance_exam]);

    const formatAadhaar = (val) => {
        const digits = val.replace(/\D/g, '').slice(0, 12);
        return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    };

    const handleFileChange = async (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        let processedFile = file;
        try {
            const { compressImage } = await import('@/lib/image-compressor');
            processedFile = await compressImage(file, 1200, 1200, 0.6);
        } catch (err) {
            console.error('Image compression failed:', err);
        }

        if (processedFile.size > 1 * 1024 * 1024) {
            toast.error(`${type === 'pfp' ? 'Photo' : 'Signature'} is too large (Max 1MB).`);
            e.target.value = null;
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => setFiles(prev => ({ ...prev, [type]: reader.result }));
        reader.readAsDataURL(processedFile);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!files.pfp || !files.signature) {
            toast.error('Photograph and Signature are both required.');
            return;
        }

        if (form.student_mobile && form.guardian_mobile && form.student_mobile === form.guardian_mobile) {
            toast.error('Student Mobile Number and Father / Guardian Mobile Number cannot be the same.');
            return;
        }

        if (form.inter_diploma_marks) {
            const num = parseFloat(form.inter_diploma_marks);
            if (isNaN(num) || num < 0 || num > 1000) {
                toast.error('Intermediate/Diploma marks must be between 0 and 1000.');
                return;
            }
        }

        setLoading(true);
        const toastId = toast.loading('Submitting application...');

        const formatAddressFromFields = (house, apt, street, city, state, pin, country) => {
            return [house, apt, street, city, state, pin, country].map(v => String(v || '').trim()).filter(Boolean).join(', ');
        };

        const contact_address_str = formatAddressFromFields(
            form.curr_house_no, form.curr_apartment, form.curr_street, form.curr_city, form.curr_state, form.curr_pincode, form.curr_country
        );
        const permanent_address_str = formatAddressFromFields(
            form.perm_house_no, form.perm_apartment, form.perm_street, form.perm_city, form.perm_state, form.perm_pincode, form.perm_country
        );

        const payload = {
            ...form,
            aadhaar_no: form.aadhaar_no.replace(/\s/g, ''),
            annual_income: form.annual_income,
            admission_year: admissionYear,
            pfp: files.pfp,
            signature: files.signature,
            contact_address: contact_address_str,
            permanent_address: permanent_address_str,
        };

        try {
            const res = await fetch('/api/public/admission', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Submission failed.');
            toast.success('Application Submitted Successfully!', { id: toastId });
            localStorage.removeItem('admission_form_draft');
            setSubmitted(true);
            smoothScrollToTop({ behavior: 'smooth' });
        } catch (error) {
            toast.error(error.message, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    const inputClasses = "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all";
    const labelClasses = "block text-sm font-bold text-gray-700";

    if (submitted) {
        return (
            <>
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-8 text-center border-t-8 border-green-500">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-4xl mb-6">✓</div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">Success!</h2>
                    <p className="text-gray-600 mb-8">Your admission request has been submitted. The administration will verify your details and contact you for further steps.</p>
                    <button onClick={() => window.location.reload()} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition-colors">Submit Another Form</button>
                </div>
            </div>
            </>
        );
    }

    return (
        <>
        <div className="min-h-screen bg-slate-100 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-5xl mx-auto bg-white shadow-2xl rounded-sm overflow-hidden border border-gray-300">
                
                {/* Formal Header */}
                <div className="p-8 border-b-2 border-double border-gray-400 text-center bg-white">
                    <h1 className="text-3xl font-black uppercase tracking-widest text-gray-900">{admissionYear} of B.TECH</h1>
                    <p className="mt-2 text-lg font-bold text-indigo-800 uppercase underline decoration-2 underline-offset-4">
                        For Admission into I - Year B.Tech / M.Tech Branch
                    </p>
                    <p className="text-xs font-bold text-gray-500 mt-1">(CSE, CSD, ECE, EEE, CIVIL, IT or MECH)</p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-10">
                    
                    {/* Top Upload Section */}
                    <div className="flex flex-col md:flex-row justify-between items-start gap-8 bg-gray-50 p-6 rounded-lg border border-gray-200">
                        <div className="w-full md:w-auto">
                            <label className={labelClasses + " mb-2"}>Photograph <span className="text-red-500">*</span></label>
                            <div className="flex flex-col items-center">
                                <div className="w-32 h-40 border-2 border-dashed border-gray-400 bg-white flex items-center justify-center overflow-hidden mb-3">
                                    {files.pfp ? <Image src={files.pfp} alt="Student Photo" className="w-full h-full object-cover" width={128} height={160} unoptimized /> : <span className="text-[10px] text-gray-400 uppercase font-bold text-center p-2">Student Photo</span>}
                                </div>
                                <input required type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'pfp')} className="text-xs file:bg-indigo-50 file:text-indigo-700 file:border-0 file:rounded-full file:px-4 file:py-1 hover:file:bg-indigo-100" />
                            </div>
                        </div>
                        <div className="w-full md:w-auto">
                            <label className={labelClasses + " mb-2"}>Signature Photo <span className="text-red-500">*</span></label>
                            <div className="flex flex-col items-center">
                                <div className="w-56 h-20 border-2 border-dashed border-gray-400 bg-white flex items-center justify-center overflow-hidden mb-3">
                                    {files.signature ? <Image src={files.signature} alt="Signature Preview" className="w-full h-full object-contain" width={224} height={80} unoptimized /> : <span className="text-[10px] text-gray-400 uppercase font-bold">Signature Preview</span>}
                                </div>
                                <input required type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'signature')} className="text-xs file:bg-indigo-50 file:text-indigo-700 file:border-0 file:rounded-full file:px-4 file:py-1 hover:file:bg-indigo-100" />
                            </div>
                        </div>
                    </div>

                    {/* Numbered Form Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                        <div className="md:col-span-2 bg-indigo-50 p-3 rounded text-sm font-bold text-indigo-900 border-l-4 border-indigo-600 mb-2 uppercase tracking-wider">
                            Personal & Academic Information
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="student-name" className={labelClasses}>1. Name of the Student (as per memo) <span className="text-red-500">*</span></label>
                            <input id="student-name" required maxLength="50" value={form.name} onChange={e => setForm({...form, name: e.target.value.toUpperCase()})} className={inputClasses} placeholder="FULL NAME" />
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="father-name" className={labelClasses}>2. Father&apos;s Name (as per memo) <span className="text-red-500">*</span></label>
                            <input id="father-name" required maxLength="50" value={form.father_name} onChange={e => setForm({...form, father_name: e.target.value.toUpperCase()})} className={inputClasses} placeholder="FATHER&apos;S FULL NAME" />
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="mother-name" className={labelClasses}>3. Mother&apos;s Name (as per memo) <span className="text-red-500">*</span></label>
                            <input id="mother-name" required maxLength="50" value={form.mother_name} onChange={e => setForm({...form, mother_name: e.target.value.toUpperCase()})} className={inputClasses} placeholder="MOTHER&apos;S FULL NAME" />
                        </div>

                        <div className="space-y-1">
                            <label id="exam-branch-label" className={labelClasses}>4. Entrance Exam & Branch <span className="text-red-500">*</span></label>
                            <div className="grid grid-cols-2 gap-2">
                                <select required value={form.entrance_exam} onChange={e => setForm({...form, entrance_exam: e.target.value})} className={inputClasses} aria-labelledby="exam-branch-label">
                                    <option value="TG EAPCET">TG EAPCET</option>
                                    <option value="TG ECET">TG ECET</option>
                                </select>
                                <select required value={form.branch} onChange={e => setForm({...form, branch: e.target.value})} className={inputClasses} aria-label="Branch">
                                    {COLLEGE_CONFIG.branches.map(b => <option key={b.code} value={b.name}>{b.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="exam-rank" className={labelClasses}>5. TG ECET / TG EAPCET Rank Details <span className="text-red-500">*</span></label>
                            <input id="exam-rank" required type="number" min="1" max="200000" value={form.exam_rank} onChange={e => setForm({...form, exam_rank: e.target.value})} className={inputClasses} placeholder="ENTRANCE RANK" />
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="area-status" className={labelClasses}>6. Area</label>
                            <select id="area-status" value={form.area_status} onChange={e => setForm({...form, area_status: e.target.value})} className={inputClasses}>
                                <option value="Local">Local</option>
                                <option value="Non Local">Non Local</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="category" className={labelClasses}>7. Category <span className="text-red-500">*</span></label>
                            <select id="category" required value={form.category} onChange={e => setForm({...form, category: e.target.value})} className={inputClasses}>
                                {COLLEGE_CONFIG.categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="sub-caste" className={labelClasses}>8. Sub Caste <span className="text-red-500">*</span></label>
                            <input id="sub-caste" required maxLength="50" value={form.sub_caste} onChange={e => setForm({...form, sub_caste: e.target.value.toUpperCase()})} className={inputClasses} placeholder="SUB CASTE" />
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="seat-allotted" className={labelClasses}>9. Seat Allotted Category</label>
                            <input id="seat-allotted" maxLength="20" value={form.seat_allotted_category} onChange={e => setForm({...form, seat_allotted_category: e.target.value.toUpperCase()})} className={inputClasses} placeholder="e.g. OC_GEN_UR" />
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="dob" className={labelClasses}>10. Date of Birth <span className="text-red-500">*</span></label>
                            <input id="dob" required type="date" value={form.dob} onChange={e => setForm({...form, dob: e.target.value})} className={inputClasses} />
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="gender" className={labelClasses}>11. Gender <span className="text-red-500">*</span></label>
                            <select id="gender" required value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} className={inputClasses}>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="nationality" className={labelClasses}>12. Nationality <span className="text-red-500">*</span></label>
                            <input id="nationality" required maxLength="30" value={form.nationality} onChange={e => setForm({...form, nationality: e.target.value.toUpperCase()})} className={inputClasses} />
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="religion" className={labelClasses}>13. Religion <span className="text-red-500">*</span></label>
                            <select 
                                id="religion" 
                                required 
                                value={form.religion} 
                                onChange={e => setForm({...form, religion: e.target.value.toUpperCase()})} 
                                className={inputClasses}
                            >
                                <option value="">SELECT RELIGION</option>
                                {COLLEGE_CONFIG.religions.map(r => (
                                    <option key={r} value={r.toUpperCase()}>{r.toUpperCase()}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="mother-tongue" className={labelClasses}>14. Mother Tongue <span className="text-red-500">*</span></label>
                            <input id="mother-tongue" required maxLength="30" value={form.mother_tongue} onChange={e => setForm({...form, mother_tongue: e.target.value.toUpperCase()})} className={inputClasses} placeholder="MOTHER TONGUE" />
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="blood-group" className={labelClasses}>15. Blood Group</label>
                            <select id="blood-group" value={form.blood_group} onChange={e => setForm({...form, blood_group: e.target.value})} className={inputClasses}>
                                <option value="">Select Blood Group</option>
                                {COLLEGE_CONFIG.bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="ssc-marks" className={labelClasses}>16. SSC / 10th Marks <span className="text-red-500">*</span></label>
                            <input id="ssc-marks" required type="number" min="0" value={form.ssc_marks} onChange={e => setForm({...form, ssc_marks: e.target.value})} className={inputClasses} placeholder="TOTAL MARKS / CGPA" />
                        </div>

                        <div className="space-y-1 md:col-span-2">
                            <label htmlFor="inter-marks" className={labelClasses}>17. Intermediate (for TG EAPCET) / Diploma (for TG ECET) Marks <span className="text-red-500">*</span></label>
                            <input 
                                id="inter-marks" 
                                required 
                                type="number" 
                                min="0" 
                                max="1000" 
                                step="any" 
                                value={form.inter_diploma_marks} 
                                onChange={e => {
                                    let val = e.target.value;
                                    if (val !== '' && val !== '.') {
                                        const num = parseFloat(val);
                                        if (!isNaN(num)) {
                                            if (num > 1000) {
                                                val = '1000';
                                            } else if (num < 0) {
                                                val = '0';
                                            }
                                        }
                                    }
                                    setForm(prev => ({ ...prev, inter_diploma_marks: val }));
                                }} 
                                className={inputClasses} 
                                placeholder="MARKS OBTAINED" 
                            />
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="place-of-birth" className={labelClasses}>18. Place of Birth</label>
                            <input id="place-of-birth" maxLength="50" value={form.place_of_birth} onChange={e => setForm({...form, place_of_birth: e.target.value.toUpperCase()})} className={inputClasses} />
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="father-occupation" className={labelClasses}>19. Father&apos;s Occupation</label>
                            <input id="father-occupation" maxLength="50" value={form.father_occupation} onChange={e => setForm({...form, father_occupation: e.target.value.toUpperCase()})} className={inputClasses} />
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="annual-income" className={labelClasses}>20. Annual Income <span className="text-red-500">*</span></label>
                            <select 
                                id="annual-income"
                                required 
                                value={form.annual_income} 
                                onChange={e => setForm({...form, annual_income: e.target.value})}
                                className={inputClasses}
                            >
                                <option value="">Select Annual Income</option>
                                {COLLEGE_CONFIG.annualIncomes.map(income => (
                                    <option key={income} value={income}>{income}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="aadhaar" className={labelClasses}>21. Student Aadhaar Number <span className="text-red-500">*</span></label>
                            <input 
                                id="aadhaar"
                                required 
                                pattern="[0-9]{4}\s[0-9]{4}\s[0-9]{4}" 
                                title="Enter a valid 12-digit Aadhaar number" 
                                value={form.aadhaar_no} 
                                onChange={e => setForm({...form, aadhaar_no: formatAadhaar(e.target.value)})} 
                                maxLength={14} 
                                className={inputClasses} 
                                placeholder="XXXX XXXX XXXX" 
                            />
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="student-mobile" className={labelClasses}>22. Student Mobile Number <span className="text-red-500">*</span></label>
                            <input id="student-mobile" required pattern="[0-9]{10}" title="Enter a valid 10-digit mobile number" value={form.student_mobile} onChange={e => setForm({...form, student_mobile: e.target.value})} maxLength={10} className={inputClasses} />
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="guardian-mobile" className={labelClasses}>23. Father / Guardian Mobile Number <span className="text-red-500">*</span></label>
                            <input id="guardian-mobile" required pattern="[0-9]{10}" title="Enter a valid 10-digit mobile number" value={form.guardian_mobile} onChange={e => setForm({...form, guardian_mobile: e.target.value})} maxLength={10} className={inputClasses} />
                        </div>

                        <div className="space-y-1 md:col-span-2">
                            <label htmlFor="email" className={labelClasses}>24. Mail ID of the Student <span className="text-red-500">*</span></label>
                            <input id="email" type="email" required maxLength="50" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className={inputClasses} placeholder="example@email.com" />
                        </div>

                        <div className="space-y-1 md:col-span-2">
                            <label htmlFor="fee-reimbursement" className={labelClasses}>25. Whether you come under Fee-Reimbursement Category</label>
                            <select id="fee-reimbursement" value={form.fee_reimbursement} onChange={e => setForm({...form, fee_reimbursement: e.target.value})} className={inputClasses}>
                                <option value="NO">NO</option>
                                <option value="YES">YES</option>
                                <option value="GOV">GOV</option>
                            </select>
                        </div>

                        <div className="md:col-span-2 mt-4">
                            <label className={labelClasses + " mb-2"}>26. Identification Marks</label>
                            <table className="w-full border-collapse border border-gray-300 rounded-lg overflow-hidden">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="border border-gray-300 p-2 text-xs uppercase w-16">Slot</th>
                                        <th className="border border-gray-300 p-2 text-xs uppercase">Description of Mark</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="border border-gray-300 p-2 text-center font-bold">1</td>
                                        <td className="border border-gray-300 p-0">
                                            <input maxLength="100" value={form.identification_mark_1} onChange={e => setForm({...form, identification_mark_1: e.target.value})} className="w-full p-2 border-none focus:ring-0 text-sm" placeholder="Identification Mark 1" />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="border border-gray-300 p-2 text-center font-bold">2</td>
                                        <td className="border border-gray-300 p-0">
                                            <input maxLength="100" value={form.identification_mark_2} onChange={e => setForm({...form, identification_mark_2: e.target.value})} className="w-full p-2 border-none focus:ring-0 text-sm" placeholder="Identification Mark 2" />
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* 27. Contact / Current Address */}
                        <div className="md:col-span-2 bg-indigo-50 p-3 rounded text-sm font-bold text-indigo-900 border-l-4 border-indigo-600 mb-2 uppercase tracking-wider mt-4">
                            Contact / Current Address
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-2">
                            <div className="space-y-1">
                                <label htmlFor="curr_house_no" className={labelClasses}>House No. <span className="text-red-500">*</span></label>
                                <input id="curr_house_no" required maxLength="50" value={form.curr_house_no} onChange={e => handleAddressChange('curr_house_no', e.target.value.toUpperCase(), true)} className={inputClasses} placeholder="e.g. H.NO 1-2-3" />
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="curr_apartment" className={labelClasses}>Apartment / Suite / Address Line 2</label>
                                <input id="curr_apartment" maxLength="100" value={form.curr_apartment} onChange={e => handleAddressChange('curr_apartment', e.target.value.toUpperCase(), true)} className={inputClasses} placeholder="e.g. APARTMENT / AREA" />
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="curr_street" className={labelClasses}>Street Name <span className="text-red-500">*</span></label>
                                <input id="curr_street" required maxLength="100" value={form.curr_street} onChange={e => handleAddressChange('curr_street', e.target.value.toUpperCase(), true)} className={inputClasses} placeholder="e.g. STREET / ROAD" />
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="curr_city" className={labelClasses}>City / Town / Village <span className="text-red-500">*</span></label>
                                <input id="curr_city" required maxLength="100" value={form.curr_city} onChange={e => handleAddressChange('curr_city', e.target.value.toUpperCase(), true)} className={inputClasses} placeholder="e.g. CITY" />
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="curr_state" className={labelClasses}>State <span className="text-red-500">*</span></label>
                                <input id="curr_state" required maxLength="100" value={form.curr_state} onChange={e => handleAddressChange('curr_state', e.target.value.toUpperCase(), true)} className={inputClasses} placeholder="e.g. TELANGANA" />
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="curr_pincode" className={labelClasses}>PIN Code <span className="text-red-500">*</span></label>
                                <input id="curr_pincode" required pattern="[0-9]{6}" title="Enter a valid 6-digit PIN code" value={form.curr_pincode} onChange={e => handleAddressChange('curr_pincode', e.target.value.replace(/\D/g, ''), true)} maxLength={6} className={inputClasses} placeholder="e.g. 506009" />
                            </div>
                            <div className="space-y-1 md:col-span-2">
                                <label htmlFor="curr_country" className={labelClasses}>Country <span className="text-red-500">*</span></label>
                                <input id="curr_country" required maxLength="50" value={form.curr_country} onChange={e => handleAddressChange('curr_country', e.target.value.toUpperCase(), true)} className={inputClasses} placeholder="INDIA" />
                            </div>
                        </div>

                        {/* Checkbox: Same as Permanent */}
                        <div className="md:col-span-2 flex items-center gap-2 py-2">
                            <input 
                                type="checkbox" 
                                id="is_current_same_as_permanent" 
                                checked={form.is_current_same_as_permanent} 
                                onChange={e => handleCheckboxChange(e.target.checked)} 
                                className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" 
                            />
                            <label htmlFor="is_current_same_as_permanent" className="text-sm font-bold text-gray-700 select-none cursor-pointer">
                                Mark as permanent address
                            </label>
                        </div>

                        {/* 28. Permanent Address */}
                        <div className="md:col-span-2 bg-indigo-50 p-3 rounded text-sm font-bold text-indigo-900 border-l-4 border-indigo-600 mb-2 uppercase tracking-wider mt-4">
                            Permanent Address
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-2">
                            <div className="space-y-1">
                                <label htmlFor="perm_house_no" className={labelClasses}>House No. <span className="text-red-500">*</span></label>
                                <input id="perm_house_no" required maxLength="50" disabled={form.is_current_same_as_permanent} value={form.perm_house_no} onChange={e => handleAddressChange('perm_house_no', e.target.value.toUpperCase(), false)} className={inputClasses + " disabled:bg-gray-100 disabled:cursor-not-allowed"} placeholder="e.g. H.NO 1-2-3" />
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="perm_apartment" className={labelClasses}>Apartment / Suite / Address Line 2</label>
                                <input id="perm_apartment" maxLength="100" disabled={form.is_current_same_as_permanent} value={form.perm_apartment} onChange={e => handleAddressChange('perm_apartment', e.target.value.toUpperCase(), false)} className={inputClasses + " disabled:bg-gray-100 disabled:cursor-not-allowed"} placeholder="e.g. APARTMENT / AREA" />
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="perm_street" className={labelClasses}>Street Name <span className="text-red-500">*</span></label>
                                <input id="perm_street" required maxLength="100" disabled={form.is_current_same_as_permanent} value={form.perm_street} onChange={e => handleAddressChange('perm_street', e.target.value.toUpperCase(), false)} className={inputClasses + " disabled:bg-gray-100 disabled:cursor-not-allowed"} placeholder="e.g. STREET / ROAD" />
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="perm_city" className={labelClasses}>City / Town / Village <span className="text-red-500">*</span></label>
                                <input id="perm_city" required maxLength="100" disabled={form.is_current_same_as_permanent} value={form.perm_city} onChange={e => handleAddressChange('perm_city', e.target.value.toUpperCase(), false)} className={inputClasses + " disabled:bg-gray-100 disabled:cursor-not-allowed"} placeholder="e.g. CITY" />
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="perm_state" className={labelClasses}>State <span className="text-red-500">*</span></label>
                                <input id="perm_state" required maxLength="100" disabled={form.is_current_same_as_permanent} value={form.perm_state} onChange={e => handleAddressChange('perm_state', e.target.value.toUpperCase(), false)} className={inputClasses + " disabled:bg-gray-100 disabled:cursor-not-allowed"} placeholder="e.g. TELANGANA" />
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="perm_pincode" className={labelClasses}>PIN Code <span className="text-red-500">*</span></label>
                                <input id="perm_pincode" required pattern="[0-9]{6}" title="Enter a valid 6-digit PIN code" disabled={form.is_current_same_as_permanent} value={form.perm_pincode} onChange={e => handleAddressChange('perm_pincode', e.target.value.replace(/\D/g, ''), false)} maxLength={6} className={inputClasses + " disabled:bg-gray-100 disabled:cursor-not-allowed"} placeholder="e.g. 506009" />
                            </div>
                            <div className="space-y-1 md:col-span-2">
                                <label htmlFor="perm_country" className={labelClasses}>Country <span className="text-red-500">*</span></label>
                                <input id="perm_country" required maxLength="50" disabled={form.is_current_same_as_permanent} value={form.perm_country} onChange={e => handleAddressChange('perm_country', e.target.value.toUpperCase(), false)} className={inputClasses + " disabled:bg-gray-100 disabled:cursor-not-allowed"} placeholder="INDIA" />
                            </div>
                        </div>

                        
                    </div>

                    {/* Final Actions */}
                    <div className="pt-8 flex justify-end border-t border-gray-200">
<button type="submit" disabled={loading} className="bg-indigo-700 text-white font-bold py-3 px-8 rounded-md hover:bg-indigo-800 disabled:bg-gray-400 transition-all text-lg shadow-lg">
                            {loading ? 'Submitting...' : 'Submit Application'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
        </>
    );
};

export default AdmissionPage;


