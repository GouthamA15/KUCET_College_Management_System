"use client";

import React, { useState } from "react";
import { User, Briefcase, Building2, MapPin, CheckSquare, ChevronRight, AlertCircle, CheckCircle2, Upload, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";


const DEPARTMENTS = [
  { value: "CSE", label: "Computer Science & Engineering" },
  { value: "CE", label: "Civil Engineering" },
  { value: "ECE", label: "Electronics & Communication Engineering" },
  { value: "EEE", label: "Electrical & Electronics Engineering" },
  { value: "MECH", label: "Mechanical Engineering" },
];

const PROGRAMS_MAP = {
  "CSE": [
    { value: "CSE", label: "CSE" },
    { value: "CSD", label: "CSD" },
    { value: "IT", label: "IT" }
  ],
  "CE": [{ value: "CIVIL", label: "CIVIL" }],
  "ECE": [{ value: "ECE", label: "ECE" }],
  "EEE": [{ value: "EEE", label: "EEE" }],
  "MECH": [{ value: "MECH", label: "MECH" }],
};

const DESIGNATION_SHORTCUTS = {
  "FACULTY": [
    "Assistant Professor",
    "Associate Professor",
    "Professor",
    "Guest Faculty",
    "Contractual Faculty"
  ],
  "NON_TEACHING": [
    "Junior Assistant",
    "Senior Assistant",
    "Office Superintendent",
    "Attender",
    "Data Entry Operator",
    "Record Assistant"
  ]
};

export default function StaffRegistrationPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    mobile: "",
    staffCategory: "",
    requestedRole: "",
    designation: "",
    department: "",
    programs: [],
    address: "",
    declaration: false,
  });

  const [files, setFiles] = useState({ pfp: null, signature: null });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const [emailState, setEmailState] = useState({
    status: 'IDLE', // IDLE, SENDING, SENT, VERIFYING, VERIFIED
    otp: '',
    verificationToken: '',
    error: '',
    cooldown: 0
  });

  React.useEffect(() => {
    if (emailState.cooldown > 0) {
      const timer = setTimeout(() => {
        setEmailState(prev => ({ ...prev, cooldown: prev.cooldown - 1 }));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [emailState.cooldown]);

  const validate = () => {
    const newErrors = {};

    if (!formData.fullName.trim()) newErrors.fullName = "Full Name is required";
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }
    if (!formData.mobile.trim()) {
      newErrors.mobile = "Mobile Number is required";
    } else if (!/^\d{10}$/.test(formData.mobile)) {
      newErrors.mobile = "Invalid mobile number (10 digits)";
    }
    
    if (!formData.staffCategory) newErrors.staffCategory = "Staff Category is required";
    if (!formData.requestedRole) newErrors.requestedRole = "Requested Role is required";
    if (!formData.designation.trim()) newErrors.designation = "Designation is required";
    
    if (formData.staffCategory === "FACULTY") {
      if (!formData.department) {
        newErrors.department = "Department is required";
      }
      if (formData.programs.length === 0) {
        newErrors.programs = "At least one program/branch must be selected";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSendOtp = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setErrors(prev => ({ ...prev, email: 'Please enter a valid email first' }));
      return;
    }
    
    setEmailState(prev => ({ ...prev, status: 'SENDING', error: '' }));
    try {
      const res = await fetch('/api/public/staff-registration/email/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to send OTP');
      
      setEmailState(prev => ({ 
        ...prev, 
        status: 'SENT', 
        cooldown: 60,
        error: '' 
      }));
    } catch (err) {
      setEmailState(prev => ({ ...prev, status: 'IDLE', error: err.message }));
    }
  };

  const handleVerifyOtp = async () => {
    if (!emailState.otp || emailState.otp.length < 6) return;
    
    setEmailState(prev => ({ ...prev, status: 'VERIFYING', error: '' }));
    try {
      const res = await fetch('/api/public/staff-registration/email/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, otp: emailState.otp })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to verify OTP');
      
      setEmailState(prev => ({ 
        ...prev, 
        status: 'VERIFIED', 
        verificationToken: data.verificationToken,
        error: '' 
      }));
    } catch (err) {
      setEmailState(prev => ({ ...prev, status: 'SENT', error: err.message }));
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'email') {
      if (emailState.status !== 'IDLE') {
        setEmailState({ status: 'IDLE', otp: '', verificationToken: '', error: '', cooldown: 0 });
      }
    }

    if (name === "staffCategory") {
      setFormData((prev) => {
        const newData = { 
          ...prev, 
          staffCategory: value,
          requestedRole: "",
          department: "",
          programs: []
        };
        return newData;
      });
      if (errors.staffCategory) setErrors((prev) => ({ ...prev, staffCategory: null }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
      if (errors[name]) {
        setErrors((prev) => ({ ...prev, [name]: null }));
      }
    }
  };

  const handleDepartmentChange = (e) => {
    const value = e.target.value;
    
    // Auto-select the program if there's only one (e.g. for CE, ECE, EEE, MECH)
    const deptPrograms = value ? PROGRAMS_MAP[value] : [];
    const autoPrograms = value !== "CSE" && deptPrograms && deptPrograms.length > 0 
                         ? [deptPrograms[0].value] 
                         : [];

    setFormData((prev) => ({
      ...prev,
      department: value,
      programs: autoPrograms,
    }));
    if (errors.department) {
      setErrors((prev) => ({ ...prev, department: null, programs: null }));
    }
  };

  const handleProgramToggle = (program) => {
    setFormData((prev) => {
      const isSelected = prev.programs.includes(program);
      const newPrograms = isSelected
        ? prev.programs.filter((p) => p !== program)
        : [...prev.programs, program];
      return { ...prev, programs: newPrograms };
    });
    if (errors.programs) {
      setErrors((prev) => ({ ...prev, programs: null }));
    }
  };

  const handleDeclarationToggle = () => {
    setFormData((prev) => ({ ...prev, declaration: !prev.declaration }));
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      setFiles((prev) => ({ ...prev, [type]: file }));
    }
  };

  const [apiError, setApiError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    
    if (emailState.status !== 'VERIFIED') {
      setErrors(prev => ({ ...prev, email: 'Please verify your email address before submitting.' }));
      return;
    }

    setIsSubmitting(true);
    setApiError(null);
    
    const isFaculty = formData.staffCategory === 'FACULTY';
    
    const payload = {
      fullName: formData.fullName,
      email: formData.email,
      mobile: formData.mobile,
      designation: formData.designation,
      requested_role: formData.requestedRole,
      staff_category: formData.staffCategory,
      address: formData.address,
      verificationToken: emailState.verificationToken,
      academic_affiliations: isFaculty ? [
        {
          department_code: formData.department,
          program_codes: [...formData.programs]
        }
      ] : []
    };
    
    try {
      const response = await fetch('/api/public/staff-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit registration');
      }
      
      setIsSuccess(true);
    } catch (err) {
      setApiError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="bg-institutional min-h-screen py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-8 text-center animate-slideUp">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Registration Submitted</h2>
          <p className="text-slate-600 mb-8">
            Your staff registration request has been submitted successfully and is pending approval.
          </p>
          <Link
            href="/"
            className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-[#0b3578] hover:bg-[#0a2d66] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0b3578] w-full"
          >
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  const availablePrograms = formData.department ? PROGRAMS_MAP[formData.department] : [];
  
  // Submit disabled logic
  const isSubmitDisabled = 
    !formData.declaration || 
    isSubmitting ||
    emailState.status !== 'VERIFIED' ||
    (formData.staffCategory === "FACULTY" && (!formData.department || formData.programs.length === 0));

  return (
    <div className="bg-institutional min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Formal Header Section */}
        <div className="relative border-b border-gray-200 bg-white">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600"></div>
          <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-8 lg:py-10">
            <div className="flex flex-row items-center justify-between gap-3 sm:gap-6">
              <div className="w-14 h-14 sm:w-20 sm:h-20 lg:w-24 lg:h-24 shrink-0 flex items-center justify-center">
                <Image src="/assets/ku-logo.png" alt="University Logo" width={96} height={96} className="w-full h-full object-contain" priority />
              </div>
              <div className="flex-1 text-center">
                <h2 className="text-[14px] sm:text-[18px] lg:text-2xl font-black text-[#0b3578] tracking-tight sm:tracking-wide leading-tight uppercase">
                  Kakatiya University College of Engineering and Technology
                </h2>
                <p className="text-[11px] sm:text-sm text-gray-600 font-medium mt-1 sm:mt-2">Warangal, Telangana - 506009</p>
              </div>
              <div className="w-14 h-14 sm:w-20 sm:h-20 lg:w-24 lg:h-24 shrink-0 flex items-center justify-center">
                <Image src="/assets/Naac_A+.png" alt="NAAC Logo" width={96} height={96} className="w-full h-full object-contain" priority />
              </div>
            </div>
            
            <div className="mt-5 sm:mt-8 text-center">
              <h1 className="text-[13px] sm:text-lg lg:text-2xl font-black text-gray-900 uppercase tracking-tight sm:tracking-wide whitespace-nowrap overflow-hidden text-ellipsis px-2">
                Institutional Staff Registration
              </h1>
              <p className="text-[10px] sm:text-xs font-semibold text-gray-600 mt-2 bg-gray-50 border border-gray-200 inline-block px-3 sm:px-4 py-1 sm:py-1.5 rounded-full shadow-sm">
                Faculty &amp; Staff Onboarding Portal
              </p>
            </div>
          </div>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="px-6 py-8 md:px-12 md:py-10">
          
          {/* Section 1: Personal Information */}
          <div className="mb-10 pb-10 border-b border-slate-200">
            <div className="flex items-center mb-6">
              <User className="h-5 w-5 text-[#0b3578] mr-2" />
              <h2 className="text-lg font-semibold text-slate-900 uppercase tracking-wider">Personal Information</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="col-span-1 md:col-span-2">
                <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-[#0b3578] focus:border-[#0b3578] outline-none transition-colors ${errors.fullName ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}
                  placeholder="As per official records"
                />
                {errors.fullName && <p className="mt-1 text-xs text-red-500 flex items-center"><AlertCircle className="h-3 w-3 mr-1"/>{errors.fullName}</p>}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Official Email <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={emailState.status === 'VERIFIED'}
                    className={`flex-1 px-4 py-2 border rounded-md focus:ring-2 focus:ring-[#0b3578] focus:border-[#0b3578] outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-500 ${errors.email ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}
                    placeholder="name@kucet.ac.in"
                  />
                  {emailState.status === 'VERIFIED' ? (
                    <div className="flex gap-2">
                      <div className="flex items-center px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-md whitespace-nowrap">
                        <CheckCircle2 className="w-4 h-4 mr-1.5" />
                        <span className="text-sm font-medium">Verified</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEmailState({ status: 'IDLE', otp: '', verificationToken: '', error: '', cooldown: 0 })}
                        className="px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                        title="Change Email"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) || emailState.status === 'SENDING' || emailState.cooldown > 0}
                      className="px-4 py-2 bg-slate-100 border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap transition-colors"
                    >
                      {emailState.status === 'SENDING' ? 'Sending...' : emailState.cooldown > 0 ? `Resend (${emailState.cooldown}s)` : 'Verify Email'}
                    </button>
                  )}
                </div>
                {errors.email && <p className="mt-1 text-xs text-red-500 flex items-center"><AlertCircle className="h-3 w-3 mr-1"/>{errors.email}</p>}
                
                {emailState.error && (
                  <p className="mt-1 text-xs text-red-500 flex items-center"><AlertCircle className="h-3 w-3 mr-1"/>{emailState.error}</p>
                )}

                {(emailState.status === 'SENT' || emailState.status === 'VERIFYING') && (
                  <div className="mt-3 p-4 bg-blue-50 border border-blue-100 rounded-md">
                    <p className="text-sm text-slate-700 mb-2">Verification code sent to your email.</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter 6-digit OTP"
                        value={emailState.otp}
                        onChange={(e) => setEmailState(prev => ({ ...prev, otp: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                        className="flex-1 px-3 py-1.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-[#0b3578] outline-none text-center tracking-widest font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={emailState.otp.length < 6 || emailState.status === 'VERIFYING'}
                        className="px-4 py-1.5 bg-[#0b3578] text-white rounded-md text-sm font-medium hover:bg-[#0a2d66] disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        {emailState.status === 'VERIFYING' ? 'Verifying...' : 'Verify OTP'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="mobile" className="block text-sm font-medium text-slate-700 mb-1">Mobile Number <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  id="mobile"
                  name="mobile"
                  value={formData.mobile}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-[#0b3578] focus:border-[#0b3578] outline-none transition-colors ${errors.mobile ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}
                  placeholder="10 digit number"
                  maxLength={10}
                />
                {errors.mobile && <p className="mt-1 text-xs text-red-500 flex items-center"><AlertCircle className="h-3 w-3 mr-1"/>{errors.mobile}</p>}
              </div>
            </div>
          </div>

          {/* Section 2: Staff Information */}
          <div className="mb-10 pb-10 border-b border-slate-200">
            <div className="flex items-center mb-6">
              <Briefcase className="h-5 w-5 text-[#0b3578] mr-2" />
              <h2 className="text-lg font-semibold text-slate-900 uppercase tracking-wider">Staff Information</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="staffCategory" className="block text-sm font-medium text-slate-700 mb-1">Staff Category <span className="text-red-500">*</span></label>
                <select
                  id="staffCategory"
                  name="staffCategory"
                  value={formData.staffCategory}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-[#0b3578] focus:border-[#0b3578] outline-none transition-colors bg-white ${errors.staffCategory ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}
                >
                  <option value="">-- Select Category --</option>
                  <option value="FACULTY">Teaching</option>
                  <option value="NON_TEACHING">Non-Teaching</option>
                </select>
                {errors.staffCategory && <p className="mt-1 text-xs text-red-500 flex items-center"><AlertCircle className="h-3 w-3 mr-1"/>{errors.staffCategory}</p>}
              </div>

              {formData.staffCategory && (
                <div className="animate-fadeIn">
                  <label htmlFor="requestedRole" className="block text-sm font-medium text-slate-700 mb-1">Requested Role <span className="text-red-500">*</span></label>
                  <select
                    id="requestedRole"
                    name="requestedRole"
                    value={formData.requestedRole}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-[#0b3578] focus:border-[#0b3578] outline-none transition-colors bg-white ${errors.requestedRole ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}
                  >
                    <option value="">-- Select Role --</option>
                    {formData.staffCategory === 'FACULTY' ? (
                      <option value="FACULTY">Faculty</option>
                    ) : (
                      <>
                        <option value="ADMISSION_STAFF">Admission Staff</option>
                        <option value="SCHOLARSHIP_STAFF">Scholarship Staff</option>
                      </>
                    )}
                  </select>
                  {errors.requestedRole && <p className="mt-1 text-xs text-red-500 flex items-center"><AlertCircle className="h-3 w-3 mr-1"/>{errors.requestedRole}</p>}
                </div>
              )}

              <div className="md:col-span-2">
                <label htmlFor="designation" className="block text-sm font-medium text-slate-700 mb-1">Designation <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  id="designation"
                  name="designation"
                  value={formData.designation}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-[#0b3578] focus:border-[#0b3578] outline-none transition-colors ${errors.designation ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}
                  placeholder="e.g. Assistant Professor"
                />
                {errors.designation && <p className="mt-1 text-xs text-red-500 flex items-center"><AlertCircle className="h-3 w-3 mr-1"/>{errors.designation}</p>}
                
                {formData.staffCategory && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {DESIGNATION_SHORTCUTS[formData.staffCategory].map(shortcut => {
                      const isSelected = formData.designation === shortcut;
                      return (
                        <button
                          key={shortcut}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setFormData(prev => ({ ...prev, designation: '' }));
                            } else {
                              setFormData(prev => ({ ...prev, designation: shortcut }));
                              setErrors(prev => ({ ...prev, designation: null }));
                            }
                          }}
                          className={`inline-flex items-center px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-medium border transition-colors ${
                            isSelected 
                              ? 'bg-blue-50 border-[#0b3578] text-[#0b3578]'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {shortcut}
                          {isSelected && <X className="ml-1 h-3 w-3" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Academic Affiliation (Only for Faculty) */}
          {formData.staffCategory === "FACULTY" && (
            <div className="mb-10 pb-10 border-b border-slate-200 animate-fadeIn">
              <div className="flex items-center mb-6">
                <Building2 className="h-5 w-5 text-[#0b3578] mr-2" />
                <h2 className="text-lg font-semibold text-slate-900 uppercase tracking-wider">Academic Affiliation</h2>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label htmlFor="department" className="block text-sm font-medium text-slate-700 mb-1">Department <span className="text-red-500">*</span></label>
                  <select
                    id="department"
                    name="department"
                    value={formData.department}
                    onChange={handleDepartmentChange}
                    className={`w-full md:w-1/2 px-4 py-2 border rounded-md focus:ring-2 focus:ring-[#0b3578] focus:border-[#0b3578] outline-none transition-colors bg-white ${errors.department ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}
                  >
                    <option value="">-- Select Department --</option>
                    {DEPARTMENTS.map(dept => (
                      <option key={dept.value} value={dept.value}>{dept.label}</option>
                    ))}
                  </select>
                  {errors.department && <p className="mt-1 text-xs text-red-500 flex items-center"><AlertCircle className="h-3 w-3 mr-1"/>{errors.department}</p>}
                </div>

                {formData.department === 'CSE' && (
                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg animate-fadeIn">
                    <label className="block text-sm font-medium text-slate-800 mb-3">
                      Programs / Branches <span className="text-red-500">*</span>
                      <span className="text-xs text-slate-500 font-normal ml-2">(Select all that apply)</span>
                    </label>
                    
                    {availablePrograms && availablePrograms.length > 0 ? (
                      <div className="flex flex-wrap gap-3">
                        {availablePrograms.map(programObj => {
                          const isSelected = formData.programs.includes(programObj.value);
                          return (
                            <button
                              key={programObj.value}
                              type="button"
                              onClick={() => handleProgramToggle(programObj.value)}
                              className={`flex items-center px-4 py-2 rounded-md border text-sm font-medium transition-all duration-200 ${
                                isSelected 
                                  ? 'bg-[#0b3578] border-[#0b3578] text-white shadow-sm' 
                                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400'
                              }`}
                            >
                              {isSelected ? (
                                <CheckSquare className="h-4 w-4 mr-2" />
                              ) : (
                                <div className="h-4 w-4 mr-2 border border-slate-400 rounded-sm" />
                              )}
                              {programObj.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500 italic p-2">
                        No programs available for this department.
                      </div>
                    )}
                    {errors.programs && <p className="mt-3 text-xs text-red-500 flex items-center"><AlertCircle className="h-3 w-3 mr-1"/>{errors.programs}</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 4: Additional Information */}
          <div className="mb-10 pb-10 border-b border-slate-200">
            <div className="flex items-center mb-6">
              <MapPin className="h-5 w-5 text-[#0b3578] mr-2" />
              <h2 className="text-lg font-semibold text-slate-900 uppercase tracking-wider">Additional Information</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="md:col-span-2">
                <label htmlFor="address" className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-[#0b3578] focus:border-[#0b3578] outline-none transition-colors resize-none"
                  placeholder="Residential address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Profile Photo</label>
                <div className="flex items-center">
                  <label className="cursor-pointer flex items-center justify-center px-4 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus-within:ring-2 focus-within:ring-[#0b3578]">
                    <Upload className="h-4 w-4 mr-2 text-slate-400" />
                    {files.pfp ? files.pfp.name : "Upload Photo"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'pfp')} />
                  </label>
                </div>
                <p className="mt-1 text-xs text-slate-500">Max size: 1MB. Format: JPG, PNG.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Signature</label>
                <div className="flex items-center">
                  <label className="cursor-pointer flex items-center justify-center px-4 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus-within:ring-2 focus-within:ring-[#0b3578]">
                    <Upload className="h-4 w-4 mr-2 text-slate-400" />
                    {files.signature ? files.signature.name : "Upload Signature"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'signature')} />
                  </label>
                </div>
                <p className="mt-1 text-xs text-slate-500">Max size: 1MB. Format: JPG, PNG.</p>
              </div>
            </div>
          </div>

          {/* Section 5: Declaration */}
          <div className="mb-10">
            <div className="bg-[#f8fafc] border border-slate-200 rounded-lg p-6">
              <h3 className="text-md font-semibold text-slate-800 mb-4">Declaration</h3>
              <p className="text-sm text-slate-600 mb-5 italic border-l-4 border-[#0b3578] pl-4">
                &quot;I hereby declare that all information provided by me in this application is true and correct to the best of my knowledge and belief.&quot;
              </p>
              
              <label className="flex items-start cursor-pointer group">
                <div className="flex-shrink-0 h-5 w-5 mt-0.5">
                  <input
                    type="checkbox"
                    checked={formData.declaration}
                    onChange={handleDeclarationToggle}
                    className="h-5 w-5 text-[#0b3578] focus:ring-[#0b3578] border-slate-300 rounded cursor-pointer transition-colors"
                  />
                </div>
                <span className="ml-3 text-sm font-medium text-slate-800 group-hover:text-slate-900 transition-colors">
                  I accept the declaration and submit my registration request.
                </span>
              </label>
            </div>
          </div>

          {apiError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start animate-fadeIn">
              <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{apiError}</p>
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <p className="text-xs text-slate-500">
              Please review all information carefully before submission.
            </p>
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className={`flex items-center justify-center px-8 py-3 rounded-md text-sm font-bold uppercase tracking-wide transition-all duration-200 shadow-sm
                ${!isSubmitDisabled
                  ? 'bg-[#0b3578] hover:bg-[#0a2d66] text-white cursor-pointer shadow-md' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }
              `}
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing
                </span>
              ) : (
                <span className="flex items-center">
                  Submit Registration Request
                  <ChevronRight className="ml-1 h-4 w-4" />
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
