'use client';

import React, { useState, useEffect, useCallback } from 'react';

export default function StudentInternshipClient() {
  const [activeTab, setActiveTab] = useState('my-internships'); // 'my-internships' | 'opportunities' | 'register-external' | 'completion'
  const [loading, setLoading] = useState(true);
  const [internships, setInternships] = useState([]);
  const [stats, setStats] = useState({ total: 0, approved: 0, pending: 0, completed: 0, action_required: 0 });
  const [opportunities, setOpportunities] = useState([]);
  const [loadingOpps, setLoadingOpps] = useState(false);
  const [oppSearch, setOppSearch] = useState('');
  const [oppCategory, _setOppCategory] = useState('ALL');
  const [oppMode, setOppMode] = useState('ALL');
  const [eligibilityFilter, setEligibilityFilter] = useState('ALL'); // 'ALL' | 'ELIGIBLE_ONLY'

  // Modals & Drawers
  const [selectedInternship, setSelectedInternship] = useState(null);
  const [_detailLoading, setDetailLoading] = useState(false);
  const [applyModalOpp, setApplyModalOpp] = useState(null);
  const [completionModalInternship, setCompletionModalInternship] = useState(null);
  const [resubmitModalInternship, setResubmitModalInternship] = useState(null);
  const [uploadDocModalInternship, setUploadDocModalInternship] = useState(null);

  // Form Submissions
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);

  // External Registration Form State
  const [externalForm, setExternalForm] = useState({
    company_name: '',
    company_website: '',
    company_location: '',
    industry: '',
    role_title: '',
    description: '',
    mode: 'HYBRID',
    start_date: '',
    end_date: '',
    duration: '3 Months',
    stipend: '',
    supervisor_name: '',
    supervisor_email: '',
    supervisor_phone: '',
    skills_acquired: '',
    offer_letter_file: null,
    offer_letter_filename: '',
  });

  // Autocomplete companies
  const [companySuggestions, setCompanySuggestions] = useState([]);
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);

  // Documents Tab State
  const [studentDocuments, setStudentDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Overlap Warning State
  const [overlapWarning, setOverlapWarning] = useState(null);

  // Withdrawal Request Modal State
  const [withdrawalModalInternship, setWithdrawalModalInternship] = useState(null);
  const [withdrawalReason, setWithdrawalReason] = useState('');

  // Apply Form State
  const [applyForm, setApplyForm] = useState({
    statement_of_interest: '',
    resume_file: null,
  });

  // Completion Form State
  const [completionForm, setCompletionForm] = useState({
    actual_completion_date: '',
    remarks: '',
    certificate_file: null,
    certificate_filename: '',
    report_file: null,
    report_filename: '',
  });

  // Resubmit Form State
  const [resubmitForm, setResubmitForm] = useState({
    remarks: '',
    new_doc_type: 'OFFER_LETTER',
    new_doc_file: null,
    new_doc_filename: '',
  });

  // Document Upload Form State
  const [uploadDocForm, setUploadDocForm] = useState({
    document_type: 'JOINING_LETTER',
    file: null,
    filename: '',
  });

  // Fetch student internships list
  const fetchInternships = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/student/internships', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const json = await res.json();
        setInternships(json.data.internships || []);
        setStats(json.data.stats || { total: 0, approved: 0, pending: 0, completed: 0, action_required: 0 });
      }
    } catch (err) {
      console.error('Failed to load internships:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch opportunities
  const fetchOpportunities = useCallback(async () => {
    try {
      setLoadingOpps(true);
      const params = new URLSearchParams();
      if (oppSearch) params.set('search', oppSearch);
      if (oppCategory !== 'ALL') params.set('category', oppCategory);
      if (oppMode !== 'ALL') params.set('mode', oppMode);
      if (eligibilityFilter !== 'ALL') params.set('eligibilityFilter', eligibilityFilter);

      const res = await fetch(`/api/student/internships/opportunities?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setOpportunities(json.data.opportunities || []);
      }
    } catch (err) {
      console.error('Failed to load opportunities:', err);
    } finally {
      setLoadingOpps(false);
    }
  }, [oppSearch, oppCategory, oppMode, eligibilityFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchInternships();
  }, [fetchInternships]);

  useEffect(() => {
    if (activeTab === 'opportunities') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchOpportunities();
    }
  }, [activeTab, fetchOpportunities]);

  // Fetch Student Documents
  const fetchStudentDocuments = useCallback(async () => {
    try {
      setLoadingDocs(true);
      const res = await fetch('/api/student/internships/documents');
      if (res.ok) {
        const json = await res.json();
        setStudentDocuments(json.data || []);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  const checkLiveOverlap = async (startDate, endDate) => {
    if (!startDate || !endDate) {
      setOverlapWarning(null);
      return;
    }
    try {
      const res = await fetch(`/api/student/internships/check-overlap?start_date=${startDate}&end_date=${endDate}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data?.hasOverlap) {
          setOverlapWarning(json.data.overlappingInternships);
        } else {
          setOverlapWarning(null);
        }
      }
    } catch (_e) {
      // Non-fatal
    }
  };

  useEffect(() => {
    if (activeTab === 'documents') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchStudentDocuments();
    }
  }, [activeTab, fetchStudentDocuments]);

  // Handle Withdrawal Request
  const handleWithdrawalSubmit = async (e) => {
    e.preventDefault();
    if (!withdrawalModalInternship || !withdrawalReason.trim()) return;
    try {
      setSubmitting(true);
      const res = await fetch(`/api/student/internships/${withdrawalModalInternship.id}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: withdrawalReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to submit withdrawal request');
      setFormSuccess('Withdrawal request submitted successfully for coordinator review.');
      setWithdrawalModalInternship(null);
      setWithdrawalReason('');
      fetchInternships();
    } catch (err) {
      setFormError(err.message || 'Error submitting withdrawal request');
    } finally {
      setSubmitting(false);
    }
  };

  // Search company suggestions for autocomplete
  const handleCompanySearch = async (val) => {
    setExternalForm(prev => ({ ...prev, company_name: val }));
    if (!val || val.trim().length < 2) {
      setCompanySuggestions([]);
      setShowCompanySuggestions(false);
      return;
    }
    try {
      const res = await fetch(`/api/student/internships/companies?q=${encodeURIComponent(val.trim())}`);
      if (res.ok) {
        const json = await res.json();
        setCompanySuggestions(json.data || []);
        setShowCompanySuggestions(true);
      }
    } catch (_e) {
      // Non-fatal
    }
  };

  const handleSelectCompany = (comp) => {
    setExternalForm(prev => ({
      ...prev,
      company_name: comp.company_name,
      company_website: comp.website || prev.company_website,
      company_location: comp.location || prev.company_location,
      industry: comp.industry || prev.industry,
    }));
    setShowCompanySuggestions(false);
  };

  // Helper to read file to base64
  const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // View Internship Detail
  const handleViewDetail = async (id) => {
    try {
      setDetailLoading(true);
      const res = await fetch(`/api/student/internships/${id}`);
      if (res.ok) {
        const json = await res.json();
        setSelectedInternship(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Submit External Registration
  const handleExternalSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!externalForm.company_name || !externalForm.role_title || !externalForm.start_date || !externalForm.end_date) {
      setFormError('Please fill in all mandatory fields marked with an asterisk (*).');
      return;
    }

    if (!externalForm.offer_letter_file) {
      setFormError('Please upload your official internship offer letter document.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        company_name: externalForm.company_name,
        company_website: externalForm.company_website || null,
        company_location: externalForm.company_location || null,
        industry: externalForm.industry || null,
        role_title: externalForm.role_title,
        description: externalForm.description || null,
        mode: externalForm.mode,
        stage: externalForm.stage || 'UPCOMING',
        start_date: externalForm.start_date,
        end_date: externalForm.end_date,
        duration: externalForm.duration || null,
        stipend: externalForm.stipend || null,
        supervisor_name: externalForm.supervisor_name || null,
        supervisor_email: externalForm.supervisor_email || null,
        supervisor_phone: externalForm.supervisor_phone || null,
        skills_acquired: externalForm.skills_acquired || null,
        offer_letter_file: externalForm.offer_letter_file,
        offer_letter_filename: externalForm.offer_letter_filename || 'Offer_Letter.pdf',
      };

      const res = await fetch('/api/student/internships/external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to submit external internship registration');
      }

      setFormSuccess('Your external internship registration and offer letter were submitted successfully! The Internship Coordinator will review your submission.');
      setExternalForm({
        company_name: '',
        company_website: '',
        company_location: '',
        industry: '',
        role_title: '',
        description: '',
        mode: 'HYBRID',
        start_date: '',
        end_date: '',
        duration: '3 Months',
        stipend: '',
        supervisor_name: '',
        supervisor_email: '',
        supervisor_phone: '',
        skills_acquired: '',
        offer_letter_file: null,
        offer_letter_filename: '',
      });
      fetchInternships();
      setTimeout(() => setActiveTab('my-internships'), 1500);
    } catch (err) {
      setFormError(err.message || 'Error submitting registration');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Application to Opportunity
  const handleApplySubmit = async (e) => {
    e.preventDefault();
    if (!applyModalOpp) return;
    setFormError(null);
    setFormSuccess(null);

    try {
      setSubmitting(true);
      const res = await fetch(`/api/student/internships/opportunities/${applyModalOpp.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statement_of_interest: applyForm.statement_of_interest || null,
          resume_file: applyForm.resume_file || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to submit application');
      }

      setFormSuccess('Application submitted successfully!');
      setTimeout(() => {
        setApplyModalOpp(null);
        setApplyForm({ statement_of_interest: '', resume_file: null });
        fetchOpportunities();
        fetchInternships();
      }, 1000);
    } catch (err) {
      setFormError(err.message || 'Application submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Completion Certificate
  const handleCompletionSubmit = async (e) => {
    e.preventDefault();
    if (!completionModalInternship) return;
    setFormError(null);

    if (!completionForm.actual_completion_date) {
      setFormError('Actual completion date is required.');
      return;
    }
    if (!completionForm.certificate_file) {
      setFormError('Completion certificate is required.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/student/internships/${completionModalInternship.id}/completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actual_completion_date: completionForm.actual_completion_date,
          remarks: completionForm.remarks || null,
          certificate_file: completionForm.certificate_file,
          certificate_filename: completionForm.certificate_filename || 'Completion_Certificate.pdf',
          report_file: completionForm.report_file || null,
          report_filename: completionForm.report_filename || 'Internship_Report.pdf',
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to submit completion');
      }

      setFormSuccess('Completion certificate submitted for coordinator verification!');
      setTimeout(() => {
        setCompletionModalInternship(null);
        setCompletionForm({
          actual_completion_date: '',
          remarks: '',
          certificate_file: null,
          certificate_filename: '',
          report_file: null,
          report_filename: '',
        });
        fetchInternships();
      }, 1000);
    } catch (err) {
      setFormError(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Resubmit Information
  const handleResubmitSubmit = async (e) => {
    e.preventDefault();
    if (!resubmitModalInternship) return;
    setFormError(null);

    try {
      setSubmitting(true);
      const newDocs = [];
      if (resubmitForm.new_doc_file) {
        newDocs.push({
          document_type: resubmitForm.new_doc_type,
          file: resubmitForm.new_doc_file,
          filename: resubmitForm.new_doc_filename,
        });
      }

      const res = await fetch(`/api/student/internships/${resubmitModalInternship.id}/resubmit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          remarks: resubmitForm.remarks || null,
          new_documents: newDocs,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to submit response');
      }

      setFormSuccess('Response submitted successfully to coordinator!');
      setTimeout(() => {
        setResubmitModalInternship(null);
        setResubmitForm({ remarks: '', new_doc_type: 'OFFER_LETTER', new_doc_file: null, new_doc_filename: '' });
        fetchInternships();
      }, 1000);
    } catch (err) {
      setFormError(err.message || 'Failed to resubmit');
    } finally {
      setSubmitting(false);
    }
  };

  // Upload Additional Document
  const handleUploadDocSubmit = async (e) => {
    e.preventDefault();
    if (!uploadDocModalInternship) return;
    setFormError(null);

    if (!uploadDocForm.file) {
      setFormError('Please select a file to upload.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/student/internships/${uploadDocModalInternship.id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_type: uploadDocForm.document_type,
          file: uploadDocForm.file,
          filename: uploadDocForm.filename || 'document.pdf',
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to upload document');
      }

      setFormSuccess('Document uploaded successfully!');
      setTimeout(() => {
        setUploadDocModalInternship(null);
        setUploadDocForm({ document_type: 'JOINING_LETTER', file: null, filename: '' });
        if (selectedInternship?.id === uploadDocModalInternship.id) {
          handleViewDetail(selectedInternship.id);
        }
        fetchInternships();
      }, 1000);
    } catch (err) {
      setFormError(err.message || 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Badge helpers
  const getAppStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">Approved</span>;
      case 'SUBMITTED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">Submitted</span>;
      case 'UNDER_REVIEW':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">Under Review</span>;
      case 'ADDITIONAL_INFO_REQUIRED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Action Required</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">Rejected</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">{status}</span>;
    }
  };

  const getCompletionBadge = (status) => {
    switch (status) {
      case 'VERIFIED_COMPLETED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">Verified Completed</span>;
      case 'SUBMITTED_FOR_VERIFICATION':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">Verification Pending</span>;
      case 'ADDITIONAL_DOCS_REQUESTED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Docs Requested</span>;
      case 'VERIFICATION_REJECTED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">Verification Rejected</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">Not Submitted</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 px-4 sm:px-6">
      {/* Header Banner */}
      <div className="bg-linear-to-r from-slate-900 via-[#0b3578] to-slate-900 text-white rounded-2xl p-6 lg:p-8 shadow-xl border border-blue-900/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-200 border border-blue-400/30 mb-3">
              Official Academic Module
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
              Student Internship Portal
            </h1>
            <p className="text-sm text-blue-200/80 mt-2 max-w-2xl">
              Discover official college-published opportunities, register self-identified external internships, upload offer letters, and submit verified completion certificates.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setActiveTab('register-external')}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition-colors flex items-center gap-1.5"
            >
              <span>+</span> Register External Offer
            </button>
            <button
              onClick={() => setActiveTab('opportunities')}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors flex items-center gap-1.5"
            >
              <span>🔍</span> Explore Opportunities
            </button>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Internships</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Approved</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">{stats.approved}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Under Review</p>
          <p className="text-2xl font-black text-blue-700 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-bold text-teal-600 uppercase tracking-wider">Verified Completed</p>
          <p className="text-2xl font-black text-teal-700 mt-1">{stats.completed}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs col-span-2 md:col-span-1">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Action Required</p>
          <p className="text-2xl font-black text-amber-700 mt-1">{stats.action_required}</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab('my-internships')}
          className={`py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'my-internships'
              ? 'border-[#0b3578] text-[#0b3578]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          My Internships ({internships.length})
        </button>
        <button
          onClick={() => setActiveTab('opportunities')}
          className={`py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'opportunities'
              ? 'border-[#0b3578] text-[#0b3578]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Explore Opportunities
        </button>
        <button
          onClick={() => setActiveTab('register-external')}
          className={`py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'register-external'
              ? 'border-[#0b3578] text-[#0b3578]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Register External Internship
        </button>
        <button
          onClick={() => setActiveTab('completion')}
          className={`py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'completion'
              ? 'border-[#0b3578] text-[#0b3578]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Completion & Verification
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className={`py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'documents'
              ? 'border-[#0b3578] text-[#0b3578]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          My Internship Documents
        </button>
      </div>

      {/* TAB 1: MY INTERNSHIPS */}
      {activeTab === 'my-internships' && (
        <div className="space-y-4">
          {loading ? (
            <div className="p-12 text-center text-slate-500 text-sm animate-pulse">Loading internships...</div>
          ) : internships.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200">
              <span className="text-4xl">💼</span>
              <h3 className="text-base font-bold text-slate-800 mt-3">No Internships Recorded</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                You haven&apos;t registered any internships yet. You can apply for college opportunities or register an external internship offer letter.
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <button
                  onClick={() => setActiveTab('register-external')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0b3578] text-white hover:bg-blue-800"
                >
                  Register External Offer
                </button>
                <button
                  onClick={() => setActiveTab('opportunities')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-800 hover:bg-slate-200"
                >
                  Browse Opportunities
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {internships.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {item.registration_type === 'INTERNAL_APPLICATION' ? 'Internal' : 'External'}
                      </span>
                      {getAppStatusBadge(item.application_status)}
                    </div>

                    <h3 className="font-bold text-base text-slate-900 line-clamp-1">{item.role_title}</h3>
                    <p className="text-xs font-medium text-slate-600 mt-0.5">{item.company_name}</p>

                    <div className="mt-3 space-y-1.5 text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <span>🗓️</span>
                        <span>{item.start_date} to {item.end_date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>📍</span>
                        <span>{item.mode} {item.company_location ? `• ${item.company_location}` : ''}</span>
                      </div>
                      {item.stipend && (
                        <div className="flex items-center gap-2 font-semibold text-slate-700">
                          <span>💰</span>
                          <span>{item.stipend}</span>
                        </div>
                      )}
                    </div>

                    {/* Action required notice */}
                    {item.application_status === 'ADDITIONAL_INFO_REQUIRED' && (
                      <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                        <p className="font-bold">Coordinator requested information:</p>
                        <p className="mt-0.5 line-clamp-2">{item.additional_info_instructions || 'Please review instructions and update documents.'}</p>
                      </div>
                    )}

                    {/* Overlap Warning */}
                    {item.has_overlap_warning && (
                      <div className="mt-2.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-center gap-1.5 font-medium">
                        <span>⚠️</span>
                        <span>Date range overlaps with another registered internship</span>
                      </div>
                    )}

                    {/* Withdrawal Requested Notice */}
                    {item.application_status === 'WITHDRAWAL_REQUESTED' && (
                      <div className="mt-2.5 p-2 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-800 font-semibold">
                        Withdrawal Requested: Awaiting coordinator decision
                      </div>
                    )}

                    {/* Completion status */}
                    {item.application_status === 'APPROVED' && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">Completion:</span>
                        {getCompletionBadge(item.completion_status)}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                    <button
                      onClick={() => handleViewDetail(item.id)}
                      className="text-xs font-bold text-[#0b3578] hover:underline"
                    >
                      View Details & Timeline →
                    </button>

                    <div className="flex items-center gap-2">
                      {item.application_status === 'ADDITIONAL_INFO_REQUIRED' && (
                        <button
                          onClick={() => setResubmitModalInternship(item)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400"
                        >
                          Respond
                        </button>
                      )}

                      {item.completion_status === 'ADDITIONAL_DOCS_REQUESTED' && (
                        <button
                          onClick={() => setResubmitModalInternship(item)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400"
                        >
                          Upload Corrected Docs
                        </button>
                      )}

                      {item.application_status === 'APPROVED' && item.completion_status === 'NOT_SUBMITTED' && (
                        <button
                          onClick={() => setCompletionModalInternship(item)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500"
                        >
                          Submit Certificate
                        </button>
                      )}

                      {item.application_status === 'APPROVED' && (
                        <button
                          onClick={() => {
                            setWithdrawalModalInternship(item);
                            setWithdrawalReason('');
                          }}
                          className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 hover:underline px-1"
                        >
                          Request Withdrawal
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: EXPLORE OPPORTUNITIES */}
      {activeTab === 'opportunities' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap gap-3 items-center justify-between">
            <div className="flex-1 min-w-[240px]">
              <input
                type="text"
                placeholder="Search opportunities by title, skills, company..."
                value={oppSearch}
                onChange={(e) => setOppSearch(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0b3578] focus:outline-hidden"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={oppMode}
                onChange={(e) => setOppMode(e.target.value)}
                className="text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0b3578]"
              >
                <option value="ALL">All Modes</option>
                <option value="ONLINE">Remote / Online</option>
                <option value="OFFLINE">Onsite / Offline</option>
                <option value="HYBRID">Hybrid</option>
              </select>

              <select
                value={eligibilityFilter}
                onChange={(e) => setEligibilityFilter(e.target.value)}
                className="text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0b3578]"
              >
                <option value="ALL">All Opportunities</option>
                <option value="ELIGIBLE_ONLY">Eligible For Me</option>
              </select>
            </div>
          </div>

          {loadingOpps ? (
            <div className="p-12 text-center text-slate-500 text-sm animate-pulse">Loading opportunities...</div>
          ) : opportunities.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200">
              <span className="text-4xl">🔎</span>
              <h3 className="text-base font-bold text-slate-800 mt-3">No Opportunities Found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                No active published opportunities match your criteria at this time. Check back later or register an external internship.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {opportunities.map((opp) => (
                <div
                  key={opp.id}
                  className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-100">
                        {opp.category}
                      </span>
                      {opp.is_eligible ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          ✓ Eligible
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                          ✕ Ineligible
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-lg text-slate-900">{opp.title}</h3>
                    <p className="text-xs font-semibold text-[#0b3578]">{opp.company_name}</p>

                    <p className="text-xs text-slate-600 mt-2 line-clamp-3">{opp.description}</p>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
                      <div>📍 <span className="font-medium text-slate-700">{opp.mode} {opp.location ? `(${opp.location})` : ''}</span></div>
                      <div>⏳ <span className="font-medium text-slate-700">Deadline: {opp.deadline}</span></div>
                      {opp.stipend && <div>💰 <span className="font-medium text-slate-700">{opp.stipend}</span></div>}
                      {opp.min_cgpa && <div>🎓 <span className="font-medium text-slate-700">Min CGPA: {opp.min_cgpa}</span></div>}
                    </div>

                    {!opp.is_eligible && opp.ineligibility_reasons?.length > 0 && (
                      <div className="mt-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                        <p className="font-bold">Eligibility Notice:</p>
                        <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                          {opp.ineligibility_reasons.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500">{opp.openings_count} opening(s)</span>

                    {opp.already_applied ? (
                      <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                        Already Applied ({opp.student_application_status})
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setApplyModalOpp(opp);
                          setFormError(null);
                        }}
                        disabled={!opp.is_eligible}
                        className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#0b3578] text-white hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Apply Now
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: REGISTER EXTERNAL INTERNSHIP */}
      {activeTab === 'register-external' && (
        <div className="bg-white rounded-2xl p-6 lg:p-8 border border-slate-200 shadow-sm max-w-3xl mx-auto">
          <div className="border-b border-slate-100 pb-4 mb-6">
            <h2 className="text-xl font-bold text-slate-900">Register Self-Identified Internship</h2>
            <p className="text-xs text-slate-500 mt-1">
              If you secured an internship independently with an external company, submit your details and official offer letter for verification by the designated Internship Coordinator.
            </p>
          </div>

          {formError && (
            <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium">
              {formError}
            </div>
          )}

          {formSuccess && (
            <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
              {formSuccess}
            </div>
          )}

          <form onSubmit={handleExternalSubmit} className="space-y-5">
            {/* Company Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0b3578]">1. Organization Details</h3>
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 mb-1">Company / Organization Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Google India, Infosys, Tech Mahindra"
                  value={externalForm.company_name}
                  onChange={(e) => handleCompanySearch(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0b3578]"
                />
                {showCompanySuggestions && companySuggestions.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {companySuggestions.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectCompany(c)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b border-slate-100 last:border-0"
                      >
                        <p className="font-bold text-slate-800">{c.company_name}</p>
                        <p className="text-[11px] text-slate-500">{c.location || 'Location not specified'}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Company Website</label>
                  <input
                    type="url"
                    placeholder="https://company.com"
                    value={externalForm.company_website}
                    onChange={(e) => setExternalForm(p => ({ ...p, company_website: e.target.value }))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0b3578]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Office Location / City</label>
                  <input
                    type="text"
                    placeholder="e.g. Hyderabad, Bangalore, Remote"
                    value={externalForm.company_location}
                    onChange={(e) => setExternalForm(p => ({ ...p, company_location: e.target.value }))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0b3578]"
                  />
                </div>
              </div>
            </div>

            {/* Internship Role Details */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0b3578]">2. Internship Role & Schedule</h3>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Role / Job Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Software Engineering Intern, ML Research Trainee"
                  value={externalForm.role_title}
                  onChange={(e) => setExternalForm(p => ({ ...p, role_title: e.target.value }))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0b3578]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Work Mode *</label>
                  <select
                    value={externalForm.mode}
                    onChange={(e) => setExternalForm(p => ({ ...p, mode: e.target.value }))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0b3578]"
                  >
                    <option value="HYBRID">Hybrid</option>
                    <option value="ONLINE">Remote / Online</option>
                    <option value="OFFLINE">Onsite / In-Office</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Internship Stage *</label>
                  <select
                    value={externalForm.stage || 'UPCOMING'}
                    onChange={(e) => setExternalForm(p => ({ ...p, stage: e.target.value }))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0b3578]"
                  >
                    <option value="UPCOMING">Upcoming (Pre-start)</option>
                    <option value="ONGOING">Currently Ongoing</option>
                    <option value="COMPLETED">Already Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={externalForm.start_date}
                    onChange={(e) => {
                      const val = e.target.value;
                      setExternalForm(p => ({ ...p, start_date: val }));
                      checkLiveOverlap(val, externalForm.end_date);
                    }}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0b3578]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={externalForm.end_date}
                    onChange={(e) => {
                      const val = e.target.value;
                      setExternalForm(p => ({ ...p, end_date: val }));
                      checkLiveOverlap(externalForm.start_date, val);
                    }}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0b3578]"
                  />
                </div>
              </div>

              {overlapWarning && overlapWarning.length > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-800">
                    <span>⚠️</span>
                    <span>Date Overlap Warning</span>
                  </div>
                  <p>
                    This date range overlaps with existing registered internship(s):
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 font-medium">
                    {overlapWarning.map((ov, i) => (
                      <li key={i}>
                        {ov.role_title} at {ov.company_name} (Overlap: {ov.overlap_start} to {ov.overlap_end})
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-amber-700 italic">
                    Note: Overlapping dates do not block registration. You may proceed; this will be highlighted for coordinator review.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Duration</label>
                  <input
                    type="text"
                    placeholder="e.g. 8 Weeks, 3 Months, 6 Months"
                    value={externalForm.duration}
                    onChange={(e) => setExternalForm(p => ({ ...p, duration: e.target.value }))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0b3578]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Monthly Stipend</label>
                  <input
                    type="text"
                    placeholder="e.g. ₹15,000 / month, Unpaid"
                    value={externalForm.stipend}
                    onChange={(e) => setExternalForm(p => ({ ...p, stipend: e.target.value }))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0b3578]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Key Responsibilities / Role Description</label>
                <textarea
                  rows={2}
                  placeholder="Briefly describe what you will work on..."
                  value={externalForm.description}
                  onChange={(e) => setExternalForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0b3578]"
                />
              </div>
            </div>

            {/* Supervisor Contact */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0b3578]">3. Company Supervisor / HR Contact</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Supervisor Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Ramesh Kumar"
                    value={externalForm.supervisor_name}
                    onChange={(e) => setExternalForm(p => ({ ...p, supervisor_name: e.target.value }))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0b3578]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Official Email</label>
                  <input
                    type="email"
                    placeholder="supervisor@company.com"
                    value={externalForm.supervisor_email}
                    onChange={(e) => setExternalForm(p => ({ ...p, supervisor_email: e.target.value }))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0b3578]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={externalForm.supervisor_phone}
                    onChange={(e) => setExternalForm(p => ({ ...p, supervisor_phone: e.target.value }))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0b3578]"
                  />
                </div>
              </div>
            </div>

            {/* Document Upload */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0b3578]">4. Official Offer Letter (Mandatory) *</h3>
              <div className="p-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-center">
                <input
                  type="file"
                  required
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 10 * 1024 * 1024) {
                        alert('File too large. Maximum size is 10MB.');
                        return;
                      }
                      const b64 = await readFileAsBase64(file);
                      setExternalForm(p => ({
                        ...p,
                        offer_letter_file: b64,
                        offer_letter_filename: file.name,
                      }));
                    }
                  }}
                  className="hidden"
                  id="offer-letter-upload"
                />
                <label
                  htmlFor="offer-letter-upload"
                  className="cursor-pointer inline-flex flex-col items-center gap-1"
                >
                  <span className="text-2xl">📄</span>
                  <span className="text-xs font-bold text-[#0b3578] hover:underline">
                    {externalForm.offer_letter_filename || 'Choose Offer Letter (PDF, Max 10MB)'}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {externalForm.offer_letter_file ? 'File selected ✓' : 'Upload the official letter signed by the company'}
                  </span>
                </label>
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('my-internships')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 rounded-xl text-xs font-bold text-white bg-[#0b3578] hover:bg-blue-800 disabled:opacity-50 shadow-sm"
              >
                {submitting ? 'Submitting Registration...' : 'Submit For Approval'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: COMPLETION & VERIFICATION */}
      {activeTab === 'completion' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-xs text-blue-900">
            <p className="font-bold">Completion Verification Workflow:</p>
            <p className="mt-0.5">
              Once you finish an approved internship, upload your final completion certificate issued by the organization. The college Internship Coordinator will review and mark your official academic completion.
            </p>
          </div>

          {internships.filter(i => i.application_status === 'APPROVED').length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200">
              <span className="text-4xl">🎓</span>
              <h3 className="text-base font-bold text-slate-800 mt-3">No Approved Internships Ready for Completion</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Only internships with status &apos;Approved&apos; can be submitted for completion verification.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {internships
                .filter(i => i.application_status === 'APPROVED')
                .map((item) => (
                  <div
                    key={item.id}
                    className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-base text-slate-900">{item.role_title}</h4>
                        <span className="text-xs text-slate-500">• {item.company_name}</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Duration: {item.start_date} to {item.end_date} ({item.mode})
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-600">Verification Status:</span>
                        {getCompletionBadge(item.completion_status)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewDetail(item.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200"
                      >
                        Details
                      </button>
                      <button
                        onClick={() => setCompletionModalInternship(item)}
                        className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500"
                      >
                        {item.completion_status === 'NOT_SUBMITTED' ? 'Upload Certificate' : 'Update Certificate'}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: MY INTERNSHIP DOCUMENTS */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Document Repository</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Centralized vault of all your uploaded internship letters, certificates, and verification reports.
              </p>
            </div>
            <button
              onClick={fetchStudentDocuments}
              disabled={loadingDocs}
              className="px-3 py-1.5 text-xs font-bold text-[#0b3578] bg-blue-50 hover:bg-blue-100 rounded-lg shrink-0 self-start sm:self-auto"
            >
              {loadingDocs ? 'Refreshing...' : '↻ Refresh Vault'}
            </button>
          </div>

          {loadingDocs ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-[#0b3578]" />
              <p className="text-xs font-semibold text-slate-500 mt-3">Loading document repository...</p>
            </div>
          ) : studentDocuments.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200">
              <span className="text-4xl">📁</span>
              <h3 className="text-base font-bold text-slate-800 mt-3">No Documents Uploaded Yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Documents you upload while registering internships, responding to queries, or submitting completion certificates will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Document</th>
                      <th className="px-4 py-3">Internship / Company</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Version</th>
                      <th className="px-4 py-3">Uploaded</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {studentDocuments.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900 flex items-center gap-2">
                          <span className="text-base">📄</span>
                          <span className="truncate max-w-[180px] sm:max-w-[240px]" title={doc.original_filename}>
                            {doc.original_filename}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">{doc.role_title || 'Internship'}</p>
                          <p className="text-[11px] text-slate-500">{doc.company_name || 'Organization'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {doc.document_type?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                          v{doc.version || 1}
                        </td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                          {doc.created_at ? new Date(doc.created_at).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            doc.verification_status === 'VERIFIED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : doc.verification_status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {doc.verification_status || 'PENDING'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <a
                            href={`/api/assets/view/${doc.storage_key}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-[#0b3578] hover:bg-blue-50 rounded"
                          >
                            <span>View</span>
                            <span>↗</span>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DETAIL MODAL / DRAWER */}
      {selectedInternship && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl p-6">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-800">
                  {selectedInternship.registration_type}
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-1">{selectedInternship.role_title}</h2>
                <p className="text-xs font-semibold text-[#0b3578]">{selectedInternship.company_name}</p>
              </div>
              <button
                onClick={() => setSelectedInternship(null)}
                className="text-slate-400 hover:text-slate-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="mt-4 space-y-5 text-xs">
              {/* Status Section */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold">Application Status</span>
                  <div className="mt-0.5">{getAppStatusBadge(selectedInternship.application_status)}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold">Internship Lifecycle</span>
                  <div className="mt-0.5 font-bold text-slate-800">{selectedInternship.internship_status}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold">Completion Verification</span>
                  <div className="mt-0.5">{getCompletionBadge(selectedInternship.completion_status)}</div>
                </div>
              </div>

              {/* Coordinator Remarks */}
              {selectedInternship.coordinator_remarks && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <p className="font-bold text-emerald-900">Coordinator Remarks:</p>
                  <p className="text-emerald-800 mt-0.5">{selectedInternship.coordinator_remarks}</p>
                </div>
              )}

              {/* Instructions if Additional Info Required */}
              {selectedInternship.application_status === 'ADDITIONAL_INFO_REQUIRED' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-amber-900">Coordinator Action Instructions:</p>
                    <p className="text-amber-800 mt-0.5">{selectedInternship.additional_info_instructions}</p>
                  </div>
                  <button
                    onClick={() => {
                      setResubmitModalInternship(selectedInternship);
                      setSelectedInternship(null);
                    }}
                    className="px-3 py-1 bg-amber-500 text-slate-950 font-bold rounded-lg shrink-0 text-xs hover:bg-amber-400"
                  >
                    Respond
                  </button>
                </div>
              )}

              {/* Schedule and Mode */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-slate-400">Start Date:</span>
                  <p className="font-bold text-slate-800">{selectedInternship.start_date}</p>
                </div>
                <div>
                  <span className="text-slate-400">End Date:</span>
                  <p className="font-bold text-slate-800">{selectedInternship.end_date}</p>
                </div>
                <div>
                  <span className="text-slate-400">Mode:</span>
                  <p className="font-bold text-slate-800">{selectedInternship.mode}</p>
                </div>
                <div>
                  <span className="text-slate-400">Stipend:</span>
                  <p className="font-bold text-slate-800">{selectedInternship.stipend || 'Unpaid'}</p>
                </div>
              </div>

              {/* Supervisor Info */}
              {(selectedInternship.supervisor_name || selectedInternship.supervisor_email) && (
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="font-bold text-slate-800 mb-1">Company Supervisor / Contact:</p>
                  <p className="text-slate-600">
                    {selectedInternship.supervisor_name} • {selectedInternship.supervisor_email} • {selectedInternship.supervisor_phone}
                  </p>
                </div>
              )}

              {/* Documents List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-900 text-sm">Associated Documents ({selectedInternship.documents?.length || 0})</h4>
                  <button
                    onClick={() => {
                      setUploadDocModalInternship(selectedInternship);
                    }}
                    className="text-xs font-bold text-[#0b3578] hover:underline"
                  >
                    + Upload Additional Document
                  </button>
                </div>

                {selectedInternship.documents?.length === 0 ? (
                  <p className="text-slate-400 italic">No documents uploaded.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedInternship.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50"
                      >
                        <div className="flex items-center gap-2">
                          <span>📄</span>
                          <div>
                            <p className="font-bold text-slate-800">{doc.original_filename}</p>
                            <p className="text-[10px] text-slate-500">
                              {doc.document_type} • v{doc.version} • Status: {doc.verification_status}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={`/api/assets/view/${doc.storage_key}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 rounded"
                          >
                            View Document ↗
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Audit Timeline */}
              {selectedInternship.audit_timeline?.length > 0 && (
                <div className="pt-3 border-t border-slate-100">
                  <h4 className="font-bold text-slate-900 text-sm mb-2">History & Audit Timeline</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedInternship.audit_timeline.map((log) => (
                      <div key={log.id} className="text-[11px] text-slate-600 flex items-center justify-between p-2 rounded bg-slate-50">
                        <span>
                          <strong className="text-slate-800">{log.action}</strong> by {log.actor_type}
                        </span>
                        <span className="text-slate-400">{new Date(log.created_at).toLocaleDateString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* APPLY MODAL */}
      {applyModalOpp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg border border-slate-200 shadow-2xl p-6">
            <h3 className="text-lg font-bold text-slate-900">Apply to {applyModalOpp.title}</h3>
            <p className="text-xs text-slate-500 mt-1">{applyModalOpp.company_name} • Deadline: {applyModalOpp.deadline}</p>

            {formError && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 text-red-800 text-xs">
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="mt-3 p-3 rounded-lg bg-emerald-50 text-emerald-800 text-xs">
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleApplySubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Statement of Interest / Why are you a good fit?</label>
                <textarea
                  rows={4}
                  placeholder="Share your technical interests, project experiences, and enthusiasm..."
                  value={applyForm.statement_of_interest}
                  onChange={(e) => setApplyForm(p => ({ ...p, statement_of_interest: e.target.value }))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0b3578]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Attach Resume / CV (Optional PDF)</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const b64 = await readFileAsBase64(file);
                      setApplyForm(p => ({ ...p, resume_file: b64 }));
                    }
                  }}
                  className="w-full text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setApplyModalOpp(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#0b3578] hover:bg-blue-800 rounded-lg disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPLETION SUBMIT MODAL */}
      {completionModalInternship && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg border border-slate-200 shadow-2xl p-6">
            <h3 className="text-lg font-bold text-slate-900">Submit Completion Certificate</h3>
            <p className="text-xs text-slate-500 mt-1">{completionModalInternship.role_title} at {completionModalInternship.company_name}</p>

            {formError && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 text-red-800 text-xs">{formError}</div>
            )}
            {formSuccess && (
              <div className="mt-3 p-3 rounded-lg bg-emerald-50 text-emerald-800 text-xs">{formSuccess}</div>
            )}

            <form onSubmit={handleCompletionSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Actual Completion Date *</label>
                <input
                  type="date"
                  required
                  value={completionForm.actual_completion_date}
                  onChange={(e) => setCompletionForm(p => ({ ...p, actual_completion_date: e.target.value }))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0b3578]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Official Completion Certificate (Mandatory PDF) *</label>
                <input
                  type="file"
                  required
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const b64 = await readFileAsBase64(file);
                      setCompletionForm(p => ({
                        ...p,
                        certificate_file: b64,
                        certificate_filename: file.name,
                      }));
                    }
                  }}
                  className="w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Internship Report / Summary (Optional PDF)</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const b64 = await readFileAsBase64(file);
                      setCompletionForm(p => ({
                        ...p,
                        report_file: b64,
                        report_filename: file.name,
                      }));
                    }
                  }}
                  className="w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Remarks / Learnings</label>
                <textarea
                  rows={2}
                  placeholder="Key technical achievements, skills acquired..."
                  value={completionForm.remarks}
                  onChange={(e) => setCompletionForm(p => ({ ...p, remarks: e.target.value }))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0b3578]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCompletionModalInternship(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Certificate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESUBMIT MODAL */}
      {resubmitModalInternship && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg border border-slate-200 shadow-2xl p-6">
            <h3 className="text-lg font-bold text-slate-900">Respond to Coordinator Request</h3>
            <p className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg mt-2 font-medium">
              Instructions: {resubmitModalInternship.additional_info_instructions || 'Please review and resubmit requested documents.'}
            </p>

            {formError && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 text-red-800 text-xs">{formError}</div>
            )}
            {formSuccess && (
              <div className="mt-3 p-3 rounded-lg bg-emerald-50 text-emerald-800 text-xs">{formSuccess}</div>
            )}

            <form onSubmit={handleResubmitSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Your Response / Clarification</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain any updates or answers to the coordinator..."
                  value={resubmitForm.remarks}
                  onChange={(e) => setResubmitForm(p => ({ ...p, remarks: e.target.value }))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0b3578]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Document Type (If uploading updated doc)</label>
                <select
                  value={resubmitForm.new_doc_type}
                  onChange={(e) => setResubmitForm(p => ({ ...p, new_doc_type: e.target.value }))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0b3578]"
                >
                  <option value="OFFER_LETTER">Offer Letter</option>
                  <option value="JOINING_LETTER">Joining Letter</option>
                  <option value="COMPLETION_CERTIFICATE">Completion Certificate</option>
                  <option value="INTERNSHIP_REPORT">Internship Report</option>
                  <option value="OTHER_SUPPORTING_DOCUMENT">Other Supporting Document</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Updated Document File</label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const b64 = await readFileAsBase64(file);
                      setResubmitForm(p => ({
                        ...p,
                        new_doc_file: b64,
                        new_doc_filename: file.name,
                      }));
                    }
                  }}
                  className="w-full text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResubmitModalInternship(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Send Response'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPLOAD ADDITIONAL DOC MODAL */}
      {uploadDocModalInternship && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg border border-slate-200 shadow-2xl p-6">
            <h3 className="text-lg font-bold text-slate-900">Upload Additional Document</h3>
            <p className="text-xs text-slate-500 mt-1">{uploadDocModalInternship.role_title} at {uploadDocModalInternship.company_name}</p>

            {formError && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 text-red-800 text-xs">{formError}</div>
            )}
            {formSuccess && (
              <div className="mt-3 p-3 rounded-lg bg-emerald-50 text-emerald-800 text-xs">{formSuccess}</div>
            )}

            <form onSubmit={handleUploadDocSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Document Type *</label>
                <select
                  value={uploadDocForm.document_type}
                  onChange={(e) => setUploadDocForm(p => ({ ...p, document_type: e.target.value }))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0b3578]"
                >
                  <option value="JOINING_LETTER">Joining Letter</option>
                  <option value="OFFER_LETTER">Offer Letter</option>
                  <option value="INTERNSHIP_REPORT">Internship Report</option>
                  <option value="RECOMMENDATION_LETTER">Recommendation Letter</option>
                  <option value="OTHER_SUPPORTING_DOCUMENT">Other Supporting Document</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">File (PDF or Image, Max 10MB) *</label>
                <input
                  type="file"
                  required
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const b64 = await readFileAsBase64(file);
                      setUploadDocForm(p => ({
                        ...p,
                        file: b64,
                        filename: file.name,
                      }));
                    }
                  }}
                  className="w-full text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUploadDocModalInternship(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#0b3578] hover:bg-blue-800 rounded-lg disabled:opacity-50"
                >
                  {submitting ? 'Uploading...' : 'Upload Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* WITHDRAWAL REQUEST MODAL */}
      {withdrawalModalInternship && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg border border-slate-200 shadow-2xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Request Internship Withdrawal</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {withdrawalModalInternship.role_title} at {withdrawalModalInternship.company_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWithdrawalModalInternship(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
              <p className="font-bold">⚠️ Withdrawal Policy Notice:</p>
              <p className="mt-1 text-[11px] leading-relaxed">
                Submitting a withdrawal request notifies the Internship Coordinator. Your internship status will shift to <strong>WITHDRAWAL_REQUESTED</strong>. If approved, the record is retired from your active commitments.
              </p>
            </div>

            {formError && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 text-red-800 text-xs">{formError}</div>
            )}

            <form onSubmit={handleWithdrawalSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason for Withdrawal *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Explain why you wish to withdraw (e.g. conflicting academic obligations, offer revoked by employer, personal circumstances)..."
                  value={withdrawalReason}
                  onChange={(e) => setWithdrawalReason(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0b3578]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWithdrawalModalInternship(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !withdrawalReason.trim()}
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Confirm Withdrawal Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
