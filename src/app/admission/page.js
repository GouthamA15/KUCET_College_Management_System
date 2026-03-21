'use client';
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { getEffectiveAcademicYear } from '@/lib/rollNumber';
import { COLLEGE_CONFIG } from '@/lib/college-config';
import Header from '@/components/Header';

const AdmissionPage = () => {
    const [admissionYear, setAdmissionYear] = useState('');
    const [form, setForm] = useState({
        entrance_exam: 'EAMCET',
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
        permanent_address: '',
    });
    const [files, setFiles] = useState({ pfp: null, signature: null });
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [annualIncomeDisplay, setAnnualIncomeDisplay] = useState('');

    useEffect(() => {
        const year = getEffectiveAcademicYear();
        if (form.entrance_exam === 'EAMCET') {
            setAdmissionYear(`${year}-${year + 4}`);
        } else if (form.entrance_exam === 'ECET') {
            setAdmissionYear(`${year}-${year + 3}`);
        }
    }, [form.entrance_exam]);

    const formatAadhaar = (val) => {
        const digits = val.replace(/\D/g, '').slice(0, 12);
        return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    };

    const formatIndianNumber = (digits) => {
        if (!digits) return '';
        const s = String(digits).replace(/\D/g, '');
        if (s.length <= 3) return s;
        const last3 = s.slice(-3);
        const rest = s.slice(0, -3);
        return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
    };

    const handleFileChange = (e, type) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 4 * 1024 * 1024) {
            toast.error(`${type === 'pfp' ? 'Photo' : 'Signature'} is too large (Max 4MB).`);
            e.target.value = null;
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => setFiles(prev => ({ ...prev, [type]: reader.result }));
        reader.readAsDataURL(file);
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

        setLoading(true);
        const toastId = toast.loading('Submitting application...');

        const payload = {
            ...form,
            aadhaar_no: form.aadhaar_no.replace(/\s/g, ''),
            annual_income: form.annual_income.toString().replace(/,/g, ''),
            admission_year: admissionYear,
            pfp: files.pfp,
            signature: files.signature,
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
            setSubmitted(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
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
            <Header />
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
        <Header />
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
                            <label className={labelClasses}>1. Name of the Student (as per memo) <span className="text-red-500">*</span></label>
                            <input required maxLength="50" value={form.name} onChange={e => setForm({...form, name: e.target.value.toUpperCase()})} className={inputClasses} placeholder="FULL NAME" />
                        </div>

                        <div className="space-y-1">
                            <label className={labelClasses}>2. Father&apos;s Name (as per memo) <span className="text-red-500">*</span></label>
                            <input required maxLength="50" value={form.father_name} onChange={e => setForm({...form, father_name: e.target.value.toUpperCase()})} className={inputClasses} placeholder="FATHER&apos;S FULL NAME" />
                        </div>

                        <div className="space-y-1">
                            <label className={labelClasses}>3. Mother&apos;s Name (as per memo) <span className="text-red-500">*</span></label>
                            <input required maxLength="50" value={form.mother_name} onChange={e => setForm({...form, mother_name: e.target.value.toUpperCase()})} className={inputClasses} placeholder="MOTHER&apos;S FULL NAME" />
                        </div>

                        <div className="space-y-1">
                            <label className={labelClasses}>4. Entrance Exam & Branch <span className="text-red-500">*</span></label>
                            <div className="grid grid-cols-2 gap-2">
                                <select required value={form.entrance_exam} onChange={e => setForm({...form, entrance_exam: e.target.value})} className={inputClasses}>
                                    <option value="EAMCET">EAMCET</option>
                                    <option value="ECET">ECET</option>
                                </select>
                                <select required value={form.branch} onChange={e => setForm({...form, branch: e.target.value})} className={inputClasses}>
                                    {COLLEGE_CONFIG.branches.map(b => <option key={b.code} value={b.name}>{b.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className={labelClasses}>5. ECET / EAMCET Rank Details <span className="text-red-500">*</span></label>
                            <input required type="number" min="1" max="200000" value={form.exam_rank} onChange={e => setForm({...form, exam_rank: e.target.value})} className={inputClasses} placeholder="ENTRANCE RANK" />
                        </div>

                        <div className="space-y-1">
                            <label className={labelClasses}>6. Area</label>
                            <select value={form.area_status} onChange={e => setForm({...form, area_status: e.target.value})} className={inputClasses}>
                                <option value="Local">Local</option>
                                <option value="Non Local">Non Local</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className={labelClasses}>7. Category <span className="text-red-500">*</span></label>
                            <select required value={form.category} onChange={e => setForm({...form, category: e.target.value})} className={inputClasses}>
                                {COLLEGE_CONFIG.categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className={labelClasses}>8. Sub Caste <span className="text-red-500">*</span></label>
                            <input required maxLength="50" value={form.sub_caste} onChange={e => setForm({...form, sub_caste: e.target.value.toUpperCase()})} className={inputClasses} placeholder="SUB CASTE" />
                        </div>

                        <div className="space-y-1">
                            <label className={labelClasses}>9. Seat Allotted Category <span className="text-red-500">*</span></label>
                            <input required maxLength="20" value={form.seat_allotted_category} onChange={e => setForm({...form, seat_allotted_category: e.target.value.toUpperCase()})} className={inputClasses} placeholder="e.g. OC_GEN_UR" />
                        </div>

                        <div className="space-y-1">
                            <label className={labelClasses}>10. Date of Birth <span className="text-red-500">*</span></label>
                            <input required type="date" value={form.dob} onChange={e => setForm({...form, dob: e.target.value})} className={inputClasses} />
                        </div>

                        <div className="space-y-1">
                            <label className={labelClasses}>11. Gender <span className="text-red-500">*</span></label>
                            <select required value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} className={inputClasses}>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className={labelClasses}>12. Nationality <span className="text-red-500">*</span></label>
                            <input required maxLength="30" value={form.nationality} onChange={e => setForm({...form, nationality: e.target.value.toUpperCase()})} className={inputClasses} />
                        </div>

                        <div className="space-y-1">
                            <label className={labelClasses}>13. Religion <span className="text-red-500">*</span></label>
                            <input required maxLength="30" value={form.religion} onChange={e => setForm({...form, religion: e.target.value.toUpperCase()})} className={inputClasses} placeholder="RELIGION" />
                        </div>

                        <div className="space-y-1">
                            <label className={labelClasses}>14. Mother Tongue <span className="text-red-500">*</span></label>
                            <input required maxLength="30" value={form.mother_tongue} onChange={e => setForm({...form, mother_tongue: e.target.value.toUpperCase()})} className={inputClasses} placeholder="MOTHER TONGUE" />
                        </div>

                        <div className="space-y-1">
                            <label className={labelClasses}>15. Blood Group</label>
                            <select value={form.blood_group} onChange={e => setForm({...form, blood_group: e.target.value})} className={inputClasses}>
                                <option value="">Select Blood Group</option>
                                {COLLEGE_CONFIG.bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className={labelClasses}>16. SSC / 10th Marks <span className="text-red-500">*</span></label>
                            <input required type="number" min="0" value={form.ssc_marks} onChange={e => setForm({...form, ssc_marks: e.target.value})} className={inputClasses} placeholder="TOTAL MARKS / CGPA" />
                        </div>

                        <div className="space-y-1 md:col-span-2">
                            <label className={labelClasses}>17. Intermediate (for EAMCET) / Diploma (for ECET) Marks <span className="text-red-500">*</span></label>
                            <input required type="number" min="0" value={form.inter_diploma_marks} onChange={e => setForm({...form, inter_diploma_marks: e.target.value})} className={inputClasses} placeholder="MARKS OBTAINED" />
                        </div>

                        <div className="space-y-1">
                            <label className={labelClasses}>18. Place of Birth</label>
                            <input maxLength="50" value={form.place_of_birth} onChange={e => setForm({...form, place_of_birth: e.target.value.toUpperCase()})} className={inputClasses} />
                        </div>

                        <div className="space-y-1">
                            <label className={labelClasses}>19. Father&apos;s Occupation</label>
                            <input maxLength="50" value={form.father_occupation} onChange={e => setForm({...form, father_occupation: e.target.value.toUpperCase()})} className={inputClasses} />
                        </div>

                        <div className="space-y-1">
                            <label className={labelClasses}>20. Annual Income <span className="text-red-500">*</span></label>
                            <input 
                                required 
                                type="text" 
                                inputMode="numeric"
                                value={annualIncomeDisplay} 
                                onChange={e => {
                                    const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
                                    setForm({...form, annual_income: raw});
                                    setAnnualIncomeDisplay(formatIndianNumber(raw));
                                }} 
                                className={inputClasses} 
                                placeholder="ANNUAL INCOME"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className={labelClasses}>21. Student Aadhaar Number <span className="text-red-500">*</span></label>
                            <input 
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
                            <label className={labelClasses}>22. Student Mobile Number <span className="text-red-500">*</span></label>
                            <input required pattern="[0-9]{10}" title="Enter a valid 10-digit mobile number" value={form.student_mobile} onChange={e => setForm({...form, student_mobile: e.target.value})} maxLength={10} className={inputClasses} />
                        </div>

                        <div className="space-y-1">
                            <label className={labelClasses}>23. Father / Guardian Mobile Number <span className="text-red-500">*</span></label>
                            <input required pattern="[0-9]{10}" title="Enter a valid 10-digit mobile number" value={form.guardian_mobile} onChange={e => setForm({...form, guardian_mobile: e.target.value})} maxLength={10} className={inputClasses} />
                        </div>

                        <div className="space-y-1 md:col-span-2">
                            <label className={labelClasses}>24. Mail ID of the Student <span className="text-red-500">*</span></label>
                            <input type="email" required maxLength="50" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className={inputClasses} placeholder="example@email.com" />
                        </div>

                        <div className="space-y-1 md:col-span-2">
                            <label className={labelClasses}>25. Whether you come under Fee-Reimbursement Category</label>
                            <select value={form.fee_reimbursement} onChange={e => setForm({...form, fee_reimbursement: e.target.value})} className={inputClasses}>
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

                        <div className="md:col-span-2">
                            <label className={labelClasses}>27. Permanent Address <span className="text-red-500">*</span></label>
                            <textarea required rows={4} maxLength="255" value={form.permanent_address} onChange={e => setForm({...form, permanent_address: e.target.value})} className={inputClasses} placeholder="Enter full permanent residential address..."></textarea>
                        </div>
                    </div>

                    <div className="pt-10 flex flex-col items-center gap-4">
                        <button type="submit" disabled={loading} className="w-full md:w-1/2 bg-indigo-700 text-white font-black py-4 rounded-sm shadow-xl hover:bg-indigo-800 disabled:opacity-50 transition-all uppercase tracking-widest text-lg">
                            {loading ? 'Submitting Application...' : 'Submit Admission Form'}
                        </button>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Note: Ensure all information is correct as per your academic documents.</p>
                    </div>
                </form>
            </div>
        </div>
        </>
    );
};

export default AdmissionPage;
