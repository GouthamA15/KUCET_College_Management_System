'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

export default function CoordinatorInternshipDashboardClient() {
  const [activeTab, setActiveTab] = useState('queues'); // 'queues' | 'opportunities' | 'companies' | 'analytics'
  const [_loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    total_internships: 0,
    pending_approvals: 0,
    under_review: 0,
    approved_internships: 0,
    ongoing_internships: 0,
    pending_completions: 0,
    completed_internships: 0,
    withdrawal_requests: 0,
    correction_requests: 0,
    unverified_company_exceptions: 0,
    verified_companies: 0,
    active_opportunities: 0,
  });
  const [coordinatorInfo, setCoordinatorInfo] = useState(null);

  // Queue State
  const [queueFilter, setQueueFilter] = useState('ALL'); // 'ALL' | 'PENDING_APPROVALS' | 'INTERNAL_APPLICATIONS' | 'EXTERNAL_REGISTRATIONS' | 'WITHDRAWAL_REQUESTS' | 'PENDING_COMPLETIONS' | 'ACTION_REQUIRED' | 'UNVERIFIED_COMPANY_EXCEPTIONS'
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [yearFilter, setYearFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [applicationsData, setApplicationsData] = useState({ items: [], pagination: { total: 0, totalPages: 1 } });
  const [loadingApps, setLoadingApps] = useState(false);

  // Opportunities State
  const [opportunities, setOpportunities] = useState([]);
  const [loadingOpps, setLoadingOpps] = useState(false);
  const [showCreateOppModal, setShowCreateOppModal] = useState(false);
  const [_selectedOppForEdit, _setSelectedOppForEdit] = useState(null);

  // Companies State
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const [companyStatusFilter, setCompanyStatusFilter] = useState('ALL');
  const [showCreateCompanyModal, setShowCreateCompanyModal] = useState(false);

  // Analytics & 8 Reports State
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState('branch');
  const [reportData, setReportData] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // Action Modals
  const [selectedInternship, setSelectedInternship] = useState(null);
  const [reviewModalData, setReviewModalData] = useState(null); // { internship, action, remarks, instructions, is_unverified_company_exception, exception_reason }
  const [verifyModalData, setVerifyModalData] = useState(null); // { internship, action, remarks }
  const [withdrawalReviewModalData, setWithdrawalReviewModalData] = useState(null); // { internship, action, remarks }
  const [showBulkZipModal, setShowBulkZipModal] = useState(false);
  const [bulkZipParams, setBulkZipParams] = useState({ branch: 'ALL', academicYear: 'ALL', status: 'ALL' });
  const [isExporting, setIsExporting] = useState(false);

  const [submittingAction, setSubmittingAction] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Opportunity Form
  const [oppForm, setOppForm] = useState({
    company_id: '',
    title: '',
    description: '',
    category: 'Software Engineering',
    required_skills: '',
    required_qualifications: '',
    eligible_branches: ['ALL'],
    eligible_academic_years: ['ALL'],
    min_cgpa: '',
    start_date: '',
    end_date: '',
    duration: '3 Months',
    mode: 'HYBRID',
    location: '',
    stipend: '₹15,000 / month',
    openings_count: 2,
    deadline: '',
    additional_requirements: '',
    status: 'PUBLISHED',
  });

  // Company Form
  const [companyForm, setCompanyForm] = useState({
    company_name: '',
    website: '',
    industry: 'Information Technology',
    location: 'Hyderabad',
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    auto_verify: true,
  });

  // Fetch Dashboard High-level Metrics
  const fetchDashboardMetrics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/staff/internship/dashboard', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const json = await res.json();
        setMetrics(json.data.metrics || {});
        setCoordinatorInfo(json.data.coordinator || null);
      }
    } catch (err) {
      console.error('Failed to load coordinator dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Review Queues
  const fetchApplicationsQueue = useCallback(async () => {
    try {
      setLoadingApps(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (queueFilter !== 'ALL') params.set('queue', queueFilter);
      if (branchFilter !== 'ALL') params.set('branch', branchFilter);
      if (yearFilter !== 'ALL') params.set('academicYear', yearFilter);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/staff/internship/applications?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setApplicationsData(json.data || { items: [], pagination: { total: 0, totalPages: 1 } });
      }
    } catch (err) {
      console.error('Failed to load applications queue:', err);
    } finally {
      setLoadingApps(false);
    }
  }, [page, queueFilter, branchFilter, yearFilter, searchQuery]);

  // Fetch Opportunities
  const fetchOpportunities = useCallback(async () => {
    try {
      setLoadingOpps(true);
      const res = await fetch('/api/staff/internship/opportunities?limit=50');
      if (res.ok) {
        const json = await res.json();
        setOpportunities(json.data.items || []);
      }
    } catch (err) {
      console.error('Failed to load opportunities:', err);
    } finally {
      setLoadingOpps(false);
    }
  }, []);

  // Fetch Companies
  const fetchCompanies = useCallback(async () => {
    try {
      setLoadingCompanies(true);
      const params = new URLSearchParams();
      if (companySearch) params.set('search', companySearch);
      if (companyStatusFilter !== 'ALL') params.set('status', companyStatusFilter);

      const res = await fetch(`/api/staff/internship/companies?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setCompanies(json.data.items || []);
      }
    } catch (err) {
      console.error('Failed to load companies:', err);
    } finally {
      setLoadingCompanies(false);
    }
  }, [companySearch, companyStatusFilter]);

  // Fetch Analytics
  const fetchAnalytics = useCallback(async () => {
    try {
      setLoadingAnalytics(true);
      const res = await fetch('/api/staff/internship/reports');
      if (res.ok) {
        const json = await res.json();
        setAnalytics(json.data);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  // Fetch Report Table Data
  const fetchSelectedReport = useCallback(async (type) => {
    try {
      setLoadingReport(true);
      const params = new URLSearchParams();
      params.set('reportType', type);
      if (branchFilter !== 'ALL') params.set('branch', branchFilter);
      if (yearFilter !== 'ALL') params.set('academicYear', yearFilter);

      const res = await fetch(`/api/staff/internship/reports?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setReportData(json.data);
      }
    } catch (err) {
      console.error('Failed to load report data:', err);
    } finally {
      setLoadingReport(false);
    }
  }, [branchFilter, yearFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDashboardMetrics();
  }, [fetchDashboardMetrics]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (activeTab === 'queues') fetchApplicationsQueue();
    if (activeTab === 'opportunities') fetchOpportunities();
    if (activeTab === 'companies') fetchCompanies();
    if (activeTab === 'analytics') {
      fetchAnalytics();
      fetchSelectedReport(selectedReportType);
    }
  }, [activeTab, fetchApplicationsQueue, fetchOpportunities, fetchCompanies, fetchAnalytics, fetchSelectedReport, selectedReportType]);

  // View Internship Detail
  const handleViewDetail = async (id) => {
    try {
      const res = await fetch(`/api/staff/internship/applications/${id}`);
      if (res.ok) {
        const json = await res.json();
        setSelectedInternship(json.data);
      }
    } catch (err) {
      console.error('Failed to load detail:', err);
    }
  };

  // Submit Review Application
  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewModalData) return;
    setErrorMessage(null);

    try {
      setSubmittingAction(true);
      const res = await fetch(`/api/staff/internship/applications/${reviewModalData.internship.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: reviewModalData.action,
          remarks: reviewModalData.remarks || null,
          instructions: reviewModalData.instructions || null,
          is_unverified_company_exception: Boolean(reviewModalData.is_unverified_company_exception),
          exception_reason: reviewModalData.exception_reason || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to submit review');
      }

      setStatusMessage(`Application status updated: ${reviewModalData.action}`);
      setReviewModalData(null);
      fetchApplicationsQueue();
      fetchDashboardMetrics();
      if (selectedInternship?.id === reviewModalData.internship.id) {
        handleViewDetail(selectedInternship.id);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error updating application review');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Submit Withdrawal Review
  const handleWithdrawalReviewSubmit = async (e) => {
    e.preventDefault();
    if (!withdrawalReviewModalData) return;
    setErrorMessage(null);

    try {
      setSubmittingAction(true);
      const res = await fetch(`/api/staff/internship/applications/${withdrawalReviewModalData.internship.id}/withdrawal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: withdrawalReviewModalData.action,
          remarks: withdrawalReviewModalData.remarks || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to review withdrawal request');
      }

      setStatusMessage(`Withdrawal request ${withdrawalReviewModalData.action.toLowerCase()}d successfully`);
      setWithdrawalReviewModalData(null);
      fetchApplicationsQueue();
      fetchDashboardMetrics();
      if (selectedInternship?.id === withdrawalReviewModalData.internship.id) {
        handleViewDetail(selectedInternship.id);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error updating withdrawal review');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Submit Completion Verification
  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    if (!verifyModalData) return;
    setErrorMessage(null);

    try {
      setSubmittingAction(true);
      const res = await fetch(`/api/staff/internship/verifications/${verifyModalData.internship.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: verifyModalData.action,
          remarks: verifyModalData.remarks || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to update verification');
      }

      setStatusMessage(`Completion status updated: ${verifyModalData.action}`);
      setVerifyModalData(null);
      fetchApplicationsQueue();
      fetchDashboardMetrics();
      if (selectedInternship?.id === verifyModalData.internship.id) {
        handleViewDetail(selectedInternship.id);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error updating completion verification');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Create Opportunity Submit
  const handleCreateOppSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    try {
      setSubmittingAction(true);
      const res = await fetch('/api/staff/internship/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(oppForm),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to create opportunity');
      }

      setStatusMessage('Internship opportunity successfully created and published!');
      setShowCreateOppModal(false);
      fetchOpportunities();
      fetchDashboardMetrics();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to create opportunity');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Set Opportunity Status (Publish/Unpublish/Close)
  const handleSetOppStatus = async (oppId, newStatus) => {
    try {
      const res = await fetch(`/api/staff/internship/opportunities/${oppId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setStatusMessage(`Opportunity status updated to ${newStatus}`);
        fetchOpportunities();
        fetchDashboardMetrics();
      }
    } catch (err) {
      console.error('Failed to change opp status:', err);
    }
  };

  // Create Company Submit
  const handleCreateCompanySubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    try {
      setSubmittingAction(true);
      const res = await fetch('/api/staff/internship/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(companyForm),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to create company');
      }

      setStatusMessage('Company registered and verified!');
      setShowCreateCompanyModal(false);
      fetchCompanies();
      fetchDashboardMetrics();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to create company');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Verify Company
  const handleVerifyCompanyAction = async (companyId, newStatus) => {
    try {
      const res = await fetch(`/api/staff/internship/companies/${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setStatusMessage(`Company verification status updated to ${newStatus}`);
        fetchCompanies();
        fetchDashboardMetrics();
      }
    } catch (err) {
      console.error('Failed to update company:', err);
    }
  };

  // Bulk ZIP Download
  const handleBulkZipDownload = async () => {
    try {
      setIsExporting(true);
      const res = await fetch('/api/staff/internship/bulk-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bulkZipParams),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to generate bulk ZIP archive');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `KUCET_Internship_Documents_${bulkZipParams.branch}_${bulkZipParams.academicYear}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setShowBulkZipModal(false);
      setStatusMessage('Bulk ZIP archive downloaded successfully!');
    } catch (err) {
      setErrorMessage(err.message || 'Error exporting bulk ZIP');
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Approved</span>;
      case 'SUBMITTED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">Submitted</span>;
      case 'UNDER_REVIEW':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">Under Review</span>;
      case 'ADDITIONAL_INFO_REQUIRED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Info Required</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">Rejected</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 px-4 sm:px-6">
      {/* Header Banner */}
      <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 lg:p-8 shadow-xl border border-indigo-900/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 mb-3">
              Institutional Authority
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
              Internship Coordination Console
            </h1>
            <p className="text-sm text-indigo-200/80 mt-2 max-w-2xl">
              College-wide authority across all 7 institutional branches. Review student applications, verify external company registrations, validate completion certificates, and manage opportunities.
            </p>
            {coordinatorInfo && (
              <p className="text-xs text-amber-300 font-semibold mt-2">
                Active Designated Coordinator: {coordinatorInfo.staff_name} ({coordinatorInfo.department_code}) • Academic Year: {coordinatorInfo.academic_year}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/api/staff/internship/reports/export"
              target="_blank"
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-colors flex items-center gap-1.5"
            >
              <span>📊</span> Export Excel (.xlsx)
            </a>
            <button
              onClick={() => setShowBulkZipModal(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors flex items-center gap-1.5"
            >
              <span>📁</span> Bulk ZIP Export
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {statusMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="text-emerald-700 font-bold ml-2">×</button>
        </div>
      )}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-red-700 font-bold ml-2">×</button>
        </div>
      )}

      {/* Metric Cards - 10 Institutional Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Records</p>
          <p className="text-xl font-black text-slate-900 mt-0.5">{metrics.total_internships}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Pending Approvals</p>
          <p className="text-xl font-black text-blue-700 mt-0.5">{metrics.pending_approvals}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Under Review</p>
          <p className="text-xl font-black text-indigo-700 mt-0.5">{metrics.under_review}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Approved Active</p>
          <p className="text-xl font-black text-emerald-700 mt-0.5">{metrics.approved_internships}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Completions Queue</p>
          <p className="text-xl font-black text-purple-700 mt-0.5">{metrics.pending_completions}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">Verified Completed</p>
          <p className="text-xl font-black text-teal-700 mt-0.5">{metrics.completed_internships}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Withdrawals</p>
          <p className="text-xl font-black text-rose-700 mt-0.5">{metrics.withdrawal_requests}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Corrections Required</p>
          <p className="text-xl font-black text-amber-700 mt-0.5">{metrics.correction_requests}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wider">Unverified Co. Exceptions</p>
          <p className="text-xl font-black text-violet-700 mt-0.5">{metrics.unverified_company_exceptions}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-bold text-cyan-600 uppercase tracking-wider">Verified Companies</p>
          <p className="text-xl font-black text-cyan-700 mt-0.5">{metrics.verified_companies}</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab('queues')}
          className={`py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'queues'
              ? 'border-[#0b3578] text-[#0b3578]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Review Queues ({metrics.pending_approvals + metrics.pending_completions + metrics.withdrawal_requests + metrics.correction_requests})
        </button>
        <button
          onClick={() => setActiveTab('opportunities')}
          className={`py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'opportunities'
              ? 'border-[#0b3578] text-[#0b3578]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Opportunities Hub ({opportunities.length})
        </button>
        <button
          onClick={() => setActiveTab('companies')}
          className={`py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'companies'
              ? 'border-[#0b3578] text-[#0b3578]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Companies & Directory
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'analytics'
              ? 'border-[#0b3578] text-[#0b3578]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Analytics & Reports
        </button>
      </div>

      {/* TAB 1: REVIEW QUEUES */}
      {activeTab === 'queues' && (
        <div className="space-y-4">
          {/* Queue Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-2 items-center flex-1">
              <select
                value={queueFilter}
                onChange={(e) => { setQueueFilter(e.target.value); setPage(1); }}
                className="text-xs px-3 py-2 border border-slate-300 rounded-lg font-bold bg-slate-50"
              >
                <option value="ALL">All Applications & Queues</option>
                <option value="PENDING_APPROVALS">Pending Approvals ({metrics.pending_approvals})</option>
                <option value="INTERNAL_APPLICATIONS">Internal Applications</option>
                <option value="EXTERNAL_REGISTRATIONS">External Registrations</option>
                <option value="WITHDRAWAL_REQUESTS">⚠️ Withdrawal Requests ({metrics.withdrawal_requests})</option>
                <option value="PENDING_COMPLETIONS">Pending Completions ({metrics.pending_completions})</option>
                <option value="ACTION_REQUIRED">Action Required / Corrections ({metrics.correction_requests})</option>
                <option value="UNVERIFIED_COMPANY_EXCEPTIONS">Unverified Co. Exceptions ({metrics.unverified_company_exceptions})</option>
              </select>

              <select
                value={branchFilter}
                onChange={(e) => { setBranchFilter(e.target.value); setPage(1); }}
                className="text-xs px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="ALL">All Branches</option>
                <option value="CSE">CSE</option>
                <option value="IT">IT</option>
                <option value="CSD">CSD</option>
                <option value="ECE">ECE</option>
                <option value="EEE">EEE</option>
                <option value="CIVIL">CIVIL</option>
                <option value="MECH">MECH</option>
              </select>

              <select
                value={yearFilter}
                onChange={(e) => { setYearFilter(e.target.value); setPage(1); }}
                className="text-xs px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="ALL">All Academic Years</option>
                <option value="2024-2025">2024-2025</option>
                <option value="2023-2024">2023-2024</option>
                <option value="2022-2023">2022-2023</option>
              </select>
            </div>

            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder="Search roll no, student, company..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0b3578]"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Company & Role</th>
                    <th className="px-4 py-3">Dates & Mode</th>
                    <th className="px-4 py-3">App Status</th>
                    <th className="px-4 py-3">Completion</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingApps ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-400">Loading records...</td>
                    </tr>
                  ) : applicationsData.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-400">No applications found in this queue.</td>
                    </tr>
                  ) : (
                    applicationsData.items.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">{row.student_name}</p>
                          <p className="text-[11px] text-slate-500">{row.student_roll_no || row.roll_no} • {row.student_branch || row.branch}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {row.registration_type === 'INTERNAL_APPLICATION' ? 'Internal' : 'External'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{row.company_name}</p>
                          <p className="text-[11px] text-slate-500">{row.role_title}</p>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {row.company_verification_status && row.company_verification_status !== 'VERIFIED' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                                Unverified Org
                              </span>
                            )}
                            {row.is_unverified_company_exception && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800">
                                Exception Approved
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-slate-500">
                          <p>{row.start_date} to {row.end_date}</p>
                          <p className="text-slate-400">{row.mode}</p>
                          {row.has_overlap_warning && (
                            <span className="inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-900 border border-amber-200">
                              ⚠️ Date Overlap
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            {getStatusBadge(row.application_status)}
                            {row.application_status === 'WITHDRAWAL_REQUESTED' && (
                              <p className="text-[10px] text-rose-600 font-bold mt-1">Withdrawal Pending</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[11px]">
                          {row.completion_status === 'VERIFIED_COMPLETED' ? (
                            <span className="text-emerald-700 font-bold">✓ Verified</span>
                          ) : row.completion_status === 'SUBMITTED_FOR_VERIFICATION' ? (
                            <span className="text-purple-700 font-bold animate-pulse">Needs Verification</span>
                          ) : (
                            <span className="text-slate-400">{row.completion_status}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right space-x-1">
                          <button
                            onClick={() => handleViewDetail(row.id)}
                            className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded"
                          >
                            Inspect
                          </button>
                          {row.application_status === 'WITHDRAWAL_REQUESTED' && (
                            <button
                              onClick={() => setWithdrawalReviewModalData({ internship: row, action: 'APPROVE', remarks: '' })}
                              className="px-2.5 py-1 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-500 rounded"
                            >
                              Withdrawal
                            </button>
                          )}
                          {['SUBMITTED', 'UNDER_REVIEW', 'ADDITIONAL_INFO_REQUIRED'].includes(row.application_status) && (
                            <button
                              onClick={() => setReviewModalData({
                                internship: row,
                                action: 'APPROVE',
                                remarks: '',
                                instructions: '',
                                is_unverified_company_exception: false,
                                exception_reason: '',
                              })}
                              className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#0b3578] hover:bg-blue-800 rounded"
                            >
                              Review
                            </button>
                          )}
                          {row.completion_status === 'SUBMITTED_FOR_VERIFICATION' && (
                            <button
                              onClick={() => setVerifyModalData({ internship: row, action: 'VERIFY', remarks: '' })}
                              className="px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded"
                            >
                              Verify
                            </button>
                          )}
                          {row.completion_status === 'VERIFIED_COMPLETED' && (
                            <button
                              onClick={() => setVerifyModalData({ internship: row, action: 'REQUEST_CORRECTION', remarks: '' })}
                              className="px-2 py-1 text-[10px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded"
                            >
                              Corrections
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            {applicationsData.pagination.totalPages > 1 && (
              <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Page {page} of {applicationsData.pagination.totalPages} ({applicationsData.pagination.total} total)</span>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    className="px-3 py-1 bg-slate-100 rounded disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= applicationsData.pagination.totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="px-3 py-1 bg-slate-100 rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: OPPORTUNITIES HUB */}
      {activeTab === 'opportunities' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h3 className="font-bold text-base text-slate-900">Internship Opportunities Hub</h3>
              <p className="text-xs text-slate-500">Publish college-facilitated opportunities and manage student applications.</p>
            </div>
            <button
              onClick={() => {
                setShowCreateOppModal(true);
                fetchCompanies();
              }}
              className="px-4 py-2 bg-[#0b3578] text-white font-bold rounded-xl text-xs hover:bg-blue-800 shadow-sm"
            >
              + Create New Opportunity
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loadingOpps ? (
              <div className="col-span-2 p-12 text-center text-slate-400">Loading opportunities...</div>
            ) : opportunities.length === 0 ? (
              <div className="col-span-2 bg-white p-12 text-center rounded-2xl border border-slate-200">
                <p className="text-sm font-bold text-slate-700">No opportunities created yet.</p>
                <p className="text-xs text-slate-400 mt-1">Click &apos;Create New Opportunity&apos; to publish your first post.</p>
              </div>
            ) : (
              opportunities.map((opp) => (
                <div key={opp.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-[#0b3578] px-2 py-0.5 rounded bg-blue-50 border border-blue-100">
                        {opp.category}
                      </span>
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                        opp.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {opp.status}
                      </span>
                    </div>

                    <h4 className="font-bold text-base text-slate-900">{opp.title}</h4>
                    <p className="text-xs font-semibold text-slate-600">{opp.company_name}</p>

                    <div className="mt-3 text-xs text-slate-500 space-y-1">
                      <p>Branches: <span className="font-medium text-slate-700">{Array.isArray(opp.eligible_branches) ? opp.eligible_branches.join(', ') : 'ALL'}</span></p>
                      <p>Deadline: <span className="font-medium text-slate-700">{opp.deadline}</span> • Mode: <span className="font-medium text-slate-700">{opp.mode}</span></p>
                      <p>Openings: <span className="font-medium text-slate-700">{opp.openings_count}</span> • Applicants: <span className="font-bold text-[#0b3578]">{opp.applications_count || 0}</span></p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="space-x-1">
                      {opp.status === 'DRAFT' && (
                        <button
                          onClick={() => handleSetOppStatus(opp.id, 'PUBLISHED')}
                          className="px-2.5 py-1 text-xs font-bold bg-emerald-600 text-white rounded hover:bg-emerald-500"
                        >
                          Publish
                        </button>
                      )}
                      {opp.status === 'PUBLISHED' && (
                        <button
                          onClick={() => handleSetOppStatus(opp.id, 'UNPUBLISHED')}
                          className="px-2.5 py-1 text-xs font-bold bg-slate-600 text-white rounded hover:bg-slate-500"
                        >
                          Unpublish
                        </button>
                      )}
                      {['PUBLISHED', 'DRAFT'].includes(opp.status) && (
                        <button
                          onClick={() => handleSetOppStatus(opp.id, 'CLOSED')}
                          className="px-2.5 py-1 text-xs font-bold bg-amber-600 text-white rounded hover:bg-amber-500"
                        >
                          Close
                        </button>
                      )}
                    </div>

                    <Link
                      href={`/staff/internship/dashboard?queue=INTERNAL_APPLICATIONS&search=${encodeURIComponent(opp.title)}`}
                      className="text-xs font-bold text-[#0b3578] hover:underline"
                    >
                      View Applicants ({opp.applications_count || 0}) →
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: COMPANIES & DIRECTORY */}
      {activeTab === 'companies' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-2 items-center flex-1">
              <select
                value={companyStatusFilter}
                onChange={(e) => setCompanyStatusFilter(e.target.value)}
                className="text-xs px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="ALL">All Verification Statuses</option>
                <option value="VERIFIED">Verified Only</option>
                <option value="PENDING_VERIFICATION">Pending Verification</option>
                <option value="REJECTED">Rejected</option>
              </select>

              <input
                type="text"
                placeholder="Search company name, industry, location..."
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                className="text-xs px-3 py-2 border border-slate-300 rounded-lg flex-1 min-w-[200px]"
              />
            </div>

            <button
              onClick={() => setShowCreateCompanyModal(true)}
              className="px-4 py-2 bg-[#0b3578] text-white font-bold rounded-xl text-xs hover:bg-blue-800"
            >
              + Add Organization
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Industry</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Website</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingCompanies ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-400">Loading companies...</td>
                    </tr>
                  ) : companies.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-400">No organizations found.</td>
                    </tr>
                  ) : (
                    companies.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-900">{c.company_name}</td>
                        <td className="px-4 py-3 text-slate-600">{c.industry || 'General'}</td>
                        <td className="px-4 py-3 text-slate-600">{c.location || 'N/A'}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {c.website ? (
                            <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              {c.website.replace(/^https?:\/\//, '')}
                            </a>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                            c.verification_status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800' :
                            c.verification_status === 'PENDING_VERIFICATION' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {c.verification_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right space-x-1">
                          {c.verification_status === 'PENDING_VERIFICATION' && (
                            <>
                              <button
                                onClick={() => handleVerifyCompanyAction(c.id, 'VERIFIED')}
                                className="px-2 py-1 text-xs font-bold text-white bg-emerald-600 rounded hover:bg-emerald-500"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleVerifyCompanyAction(c.id, 'REJECTED')}
                                className="px-2 py-1 text-xs font-bold text-white bg-rose-600 rounded hover:bg-rose-500"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ANALYTICS & 8 INSTITUTIONAL REPORTS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-lg text-slate-900">Institutional Analytics & Reporting</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Generate 8 authoritative institutional reports across branches, academic cohorts, and recruiting organizations.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={selectedReportType}
                onChange={(e) => {
                  setSelectedReportType(e.target.value);
                  fetchSelectedReport(e.target.value);
                }}
                className="text-xs px-3 py-2 border border-slate-300 rounded-xl font-bold bg-slate-50 text-slate-800"
              >
                <option value="branch">1. Branch-Wise Summary</option>
                <option value="academic_year">2. Academic Year Summary</option>
                <option value="company">3. Organization Recruitment Summary</option>
                <option value="student">4. Student Participation Directory</option>
                <option value="status">5. Lifecycle Status Breakdown</option>
                <option value="completed">6. Completed Internships Ledger</option>
                <option value="pending_verification">7. Pending Verifications Queue</option>
                <option value="external">8. External vs Internal Distribution</option>
              </select>

              <a
                href={`/api/staff/internship/reports/export?format=csv&reportType=${selectedReportType}&branch=${branchFilter}&academicYear=${yearFilter}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs"
              >
                <span>📄</span> Export CSV
              </a>

              <a
                href={`/api/staff/internship/reports/export?format=xlsx&branch=${branchFilter}&academicYear=${yearFilter}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs"
              >
                <span>📊</span> Export Excel (.xlsx)
              </a>

              <button
                onClick={() => setShowBulkZipModal(true)}
                className="px-3.5 py-2 bg-[#0b3578] hover:bg-blue-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs"
              >
                <span>📁</span> Bulk ZIP (.zip)
              </button>
            </div>
          </div>

          {/* Dynamic 8-Report Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  {reportData?.title || 'Institutional Report Table'}
                </h4>
                <p className="text-[11px] text-slate-500">
                  {reportData?.total !== undefined ? `${reportData.total} matching records found` : 'Loading report...'}
                </p>
              </div>
              <button
                onClick={() => fetchSelectedReport(selectedReportType)}
                disabled={loadingReport}
                className="text-xs font-bold text-[#0b3578] hover:underline"
              >
                {loadingReport ? 'Loading...' : '↻ Refresh Report'}
              </button>
            </div>

            <div className="overflow-x-auto max-h-[500px]">
              {loadingReport ? (
                <div className="p-12 text-center text-slate-400">Loading report data...</div>
              ) : !reportData || !reportData.data || reportData.data.length === 0 ? (
                <div className="p-12 text-center text-slate-400">No records found for the selected report filters.</div>
              ) : (
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200 sticky top-0">
                    <tr>
                      {reportData.columns?.map((col, idx) => (
                        <th key={idx} className="px-4 py-3 whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData.data.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50/80 transition-colors">
                        {Object.values(row).map((val, cIdx) => (
                          <td key={cIdx} className="px-4 py-3 whitespace-nowrap">
                            {val !== null && val !== undefined ? String(val) : '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* High-level Analytics Overview */}
          {loadingAnalytics ? (
            <div className="p-8 text-center text-slate-400">Loading metrics overview...</div>
          ) : analytics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Branch Breakdown */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <h4 className="font-bold text-sm text-slate-900 mb-3">Branch Distribution</h4>
                <div className="space-y-2 text-xs">
                  {analytics.branch_breakdown?.map((b) => (
                    <div key={b.branch} className="flex items-center justify-between p-2 rounded bg-slate-50">
                      <span className="font-bold text-slate-800">{b.branch}</span>
                      <span>{b.total} total • <strong className="text-emerald-700">{b.verified} verified</strong></span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mode Breakdown */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <h4 className="font-bold text-sm text-slate-900 mb-3">Internship Modes</h4>
                <div className="space-y-2 text-xs">
                  {analytics.mode_breakdown?.map((m) => (
                    <div key={m.mode} className="flex items-center justify-between p-2 rounded bg-slate-50">
                      <span className="font-bold text-slate-800">{m.mode}</span>
                      <span className="font-bold text-indigo-700">{m.total}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Companies */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <h4 className="font-bold text-sm text-slate-900 mb-3">Top Partner Organizations</h4>
                <div className="space-y-2 text-xs">
                  {analytics.top_companies?.map((c, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-50">
                      <span className="font-semibold text-slate-800 line-clamp-1">{c.company_name}</span>
                      <span className="font-bold text-[#0b3578]">{c.total} interns</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedInternship && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl p-6">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-800">
                  {selectedInternship.registration_type}
                </span>
                <h3 className="text-xl font-bold text-slate-900 mt-1">{selectedInternship.role_title}</h3>
                <p className="text-xs font-semibold text-[#0b3578]">{selectedInternship.company_name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Student: {selectedInternship.student_name} ({selectedInternship.student_roll_no || selectedInternship.roll_no} • {selectedInternship.student_branch || selectedInternship.branch})
                </p>
              </div>
              <button
                onClick={() => setSelectedInternship(null)}
                className="text-slate-400 hover:text-slate-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold">App Status</span>
                  <div className="mt-0.5">{getStatusBadge(selectedInternship.application_status)}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold">Lifecycle</span>
                  <div className="mt-0.5 font-bold text-slate-800">{selectedInternship.internship_status}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold">Completion</span>
                  <div className="mt-0.5 font-bold text-emerald-700">{selectedInternship.completion_status}</div>
                </div>
              </div>

              {/* Overlap Warning Banner */}
              {selectedInternship.has_overlap_warning && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                  <p className="font-bold flex items-center gap-1.5">
                    <span>⚠️</span> Overlap Warning Detected
                  </p>
                  <p className="text-[11px] mt-0.5">{selectedInternship.overlap_details || 'The registered date range overlaps with another active or approved internship for this student.'}</p>
                </div>
              )}

              {/* Unverified Company Exception Banner */}
              {selectedInternship.is_unverified_company_exception && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-900">
                  <p className="font-bold flex items-center gap-1.5">
                    <span>⚡</span> Approved Under Unverified Company Exception
                  </p>
                  <p className="text-[11px] mt-0.5"><strong>Justification:</strong> {selectedInternship.unverified_company_exception_reason}</p>
                </div>
              )}

              {/* Withdrawal Request Banner */}
              {selectedInternship.withdrawal_reason && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900">
                  <p className="font-bold flex items-center gap-1.5">
                    <span>⚠️</span> Withdrawal Request Details
                  </p>
                  <p className="text-[11px] mt-0.5"><strong>Reason:</strong> {selectedInternship.withdrawal_reason}</p>
                  {selectedInternship.withdrawal_remarks && (
                    <p className="text-[11px] mt-0.5"><strong>Coordinator Remarks:</strong> {selectedInternship.withdrawal_remarks}</p>
                  )}
                </div>
              )}

              {/* Offer Letter and Documents */}
              <div>
                <h4 className="font-bold text-slate-900 mb-2">Verified Documents ({selectedInternship.documents?.length || 0})</h4>
                <div className="space-y-2">
                  {selectedInternship.documents?.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
                      <div>
                        <p className="font-bold text-slate-800">{doc.original_filename}</p>
                        <p className="text-[10px] text-slate-500">{doc.document_type} • Status: {doc.verification_status}</p>
                      </div>
                      <a
                        href={`/api/assets/view/${doc.storage_key}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 font-bold text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded"
                      >
                        Inspect Document ↗
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              {/* Coordinator Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex flex-wrap justify-end gap-2">
                {selectedInternship.application_status === 'WITHDRAWAL_REQUESTED' && (
                  <button
                    onClick={() => {
                      setWithdrawalReviewModalData({ internship: selectedInternship, action: 'APPROVE', remarks: '' });
                      setSelectedInternship(null);
                    }}
                    className="px-4 py-2 font-bold text-white bg-rose-600 rounded-lg text-xs hover:bg-rose-500"
                  >
                    Review Withdrawal Request
                  </button>
                )}
                {['SUBMITTED', 'UNDER_REVIEW', 'ADDITIONAL_INFO_REQUIRED'].includes(selectedInternship.application_status) && (
                  <>
                    <button
                      onClick={() => {
                        setReviewModalData({
                          internship: selectedInternship,
                          action: 'APPROVE',
                          remarks: '',
                          instructions: '',
                          is_unverified_company_exception: false,
                          exception_reason: '',
                        });
                        setSelectedInternship(null);
                      }}
                      className="px-4 py-2 font-bold text-white bg-emerald-600 rounded-lg text-xs hover:bg-emerald-500"
                    >
                      Approve Application
                    </button>
                    <button
                      onClick={() => {
                        setReviewModalData({
                          internship: selectedInternship,
                          action: 'REQUEST_INFO',
                          remarks: '',
                          instructions: '',
                          is_unverified_company_exception: false,
                          exception_reason: '',
                        });
                        setSelectedInternship(null);
                      }}
                      className="px-4 py-2 font-bold text-slate-950 bg-amber-500 rounded-lg text-xs hover:bg-amber-400"
                    >
                      Request Info
                    </button>
                    <button
                      onClick={() => {
                        setReviewModalData({
                          internship: selectedInternship,
                          action: 'REJECT',
                          remarks: '',
                          instructions: '',
                          is_unverified_company_exception: false,
                          exception_reason: '',
                        });
                        setSelectedInternship(null);
                      }}
                      className="px-4 py-2 font-bold text-white bg-rose-600 rounded-lg text-xs hover:bg-rose-500"
                    >
                      Reject
                    </button>
                  </>
                )}
                {selectedInternship.completion_status === 'SUBMITTED_FOR_VERIFICATION' && (
                  <button
                    onClick={() => {
                      setVerifyModalData({ internship: selectedInternship, action: 'VERIFY', remarks: '' });
                      setSelectedInternship(null);
                    }}
                    className="px-4 py-2 font-bold text-white bg-emerald-600 rounded-lg text-xs hover:bg-emerald-500"
                  >
                    Verify Completion
                  </button>
                )}
                {selectedInternship.completion_status === 'VERIFIED_COMPLETED' && (
                  <button
                    onClick={() => {
                      setVerifyModalData({ internship: selectedInternship, action: 'REQUEST_CORRECTION', remarks: '' });
                      setSelectedInternship(null);
                    }}
                    className="px-4 py-2 font-bold text-slate-800 bg-slate-100 rounded-lg text-xs hover:bg-slate-200"
                  >
                    Request Corrections
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REVIEW APPLICATION MODAL */}
      {reviewModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg border border-slate-200 shadow-2xl p-6">
            <h3 className="text-lg font-bold text-slate-900">
              Review Application: {reviewModalData.internship.student_name}
            </h3>
            <p className="text-xs text-slate-500 mt-1">{reviewModalData.internship.role_title} at {reviewModalData.internship.company_name}</p>

            <form onSubmit={handleReviewSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Decision Action *</label>
                <select
                  value={reviewModalData.action}
                  onChange={(e) => setReviewModalData(p => ({ ...p, action: e.target.value }))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-bold"
                >
                  <option value="APPROVE">Approve Registration</option>
                  <option value="REQUEST_INFO">Request Additional Info / Clarification</option>
                  <option value="REJECT">Reject Registration</option>
                </select>
              </div>

              {reviewModalData.action === 'APPROVE' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Coordinator Approval Remarks</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Approved for credits eligibility under academic curriculum."
                    value={reviewModalData.remarks}
                    onChange={(e) => setReviewModalData(p => ({ ...p, remarks: e.target.value }))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              )}

              {/* Unverified Company Exception Block */}
              {reviewModalData.action === 'APPROVE' && reviewModalData.internship.company_verification_status !== 'VERIFIED' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <span>⚠️</span>
                    <span>Unverified Company Exception Required</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    The company <strong>{reviewModalData.internship.company_name}</strong> is not officially verified in the college directory. To approve this internship without verifying the organization for all future students, you must confirm an audited unverified company exception.
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      required
                      checked={Boolean(reviewModalData.is_unverified_company_exception)}
                      onChange={(e) => setReviewModalData(p => ({ ...p, is_unverified_company_exception: e.target.checked }))}
                      className="rounded border-slate-300 text-[#0b3578] focus:ring-[#0b3578]"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      I confirm and authorize this unverified company exception
                    </span>
                  </label>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Exception Academic Justification *
                    </label>
                    <textarea
                      rows={2}
                      required
                      placeholder="State academic reason or verification findings justifying this exception..."
                      value={reviewModalData.exception_reason || ''}
                      onChange={(e) => setReviewModalData(p => ({ ...p, exception_reason: e.target.value }))}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>
              )}

              {reviewModalData.action === 'REQUEST_INFO' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Specific Instructions for Student *</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Describe exactly what document or detail the student must resubmit..."
                    value={reviewModalData.instructions}
                    onChange={(e) => setReviewModalData(p => ({ ...p, instructions: e.target.value }))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              )}

              {reviewModalData.action === 'REJECT' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Rejection Reason *</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Provide mandatory reason for rejection..."
                    value={reviewModalData.remarks}
                    onChange={(e) => setReviewModalData(p => ({ ...p, remarks: e.target.value }))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewModalData(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#0b3578] hover:bg-blue-800 rounded-lg disabled:opacity-50"
                >
                  {submittingAction ? 'Processing...' : 'Confirm Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WITHDRAWAL REVIEW MODAL */}
      {withdrawalReviewModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg border border-slate-200 shadow-2xl p-6">
            <h3 className="text-lg font-bold text-slate-900">Review Withdrawal Request</h3>
            <p className="text-xs text-slate-500 mt-1">
              {withdrawalReviewModalData.internship.student_name} ({withdrawalReviewModalData.internship.student_roll_no || withdrawalReviewModalData.internship.roll_no}) • {withdrawalReviewModalData.internship.company_name}
            </p>

            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900">
              <p className="font-bold">Student Withdrawal Justification:</p>
              <p className="mt-1 text-[11px] leading-relaxed">
                {withdrawalReviewModalData.internship.withdrawal_reason || 'No specific explanation provided by student.'}
              </p>
              {withdrawalReviewModalData.internship.withdrawal_requested_at && (
                <p className="mt-1 text-[10px] text-rose-700">
                  Requested on: {new Date(withdrawalReviewModalData.internship.withdrawal_requested_at).toLocaleString('en-IN')}
                </p>
              )}
            </div>

            <form onSubmit={handleWithdrawalReviewSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Decision Action *</label>
                <select
                  value={withdrawalReviewModalData.action}
                  onChange={(e) => setWithdrawalReviewModalData(p => ({ ...p, action: e.target.value }))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-bold"
                >
                  <option value="APPROVE">Approve Withdrawal (Retire Internship Record)</option>
                  <option value="REJECT">Reject Withdrawal Request (Keep Active)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Coordinator Remarks / Feedback</label>
                <textarea
                  rows={2}
                  placeholder="State decision remarks to be communicated to the student..."
                  value={withdrawalReviewModalData.remarks || ''}
                  onChange={(e) => setWithdrawalReviewModalData(p => ({ ...p, remarks: e.target.value }))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWithdrawalReviewModalData(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className={`px-5 py-2 text-xs font-bold text-white rounded-lg disabled:opacity-50 ${
                    withdrawalReviewModalData.action === 'APPROVE'
                      ? 'bg-rose-600 hover:bg-rose-500'
                      : 'bg-slate-800 hover:bg-slate-700'
                  }`}
                >
                  {submittingAction ? 'Processing...' : `Confirm ${withdrawalReviewModalData.action === 'APPROVE' ? 'Approval' : 'Rejection'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VERIFY COMPLETION MODAL */}
      {verifyModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg border border-slate-200 shadow-2xl p-6">
            <h3 className="text-lg font-bold text-slate-900">Verify Completion Certificate</h3>
            <p className="text-xs text-slate-500 mt-1">{verifyModalData.internship.student_name} • {verifyModalData.internship.company_name}</p>

            <form onSubmit={handleVerifySubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Verification Action *</label>
                <select
                  value={verifyModalData.action}
                  onChange={(e) => setVerifyModalData(p => ({ ...p, action: e.target.value }))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-bold"
                >
                  <option value="VERIFY">Verify & Mark Completed (Official)</option>
                  <option value="REQUEST_CORRECTION">Request Post-Completion Corrections / Resubmission</option>
                  <option value="REQUEST_DOCS">Request Additional Documents</option>
                  <option value="REJECT">Reject Verification</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Verification Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Official verification remarks or resubmission instructions..."
                  value={verifyModalData.remarks}
                  onChange={(e) => setVerifyModalData(p => ({ ...p, remarks: e.target.value }))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVerifyModalData(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg disabled:opacity-50"
                >
                  {submittingAction ? 'Processing...' : 'Confirm Verification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE OPPORTUNITY MODAL */}
      {showCreateOppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl p-6">
            <h3 className="text-xl font-bold text-slate-900">Post New Internship Opportunity</h3>
            <p className="text-xs text-slate-500 mt-0.5">Publish an opportunity to eligible student cohorts.</p>

            <form onSubmit={handleCreateOppSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Organization *</label>
                <select
                  required
                  value={oppForm.company_id}
                  onChange={(e) => setOppForm(p => ({ ...p, company_id: e.target.value }))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="">Select Company...</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.company_name} ({c.location || 'Location N/A'})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Opportunity Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Full Stack Developer Intern"
                    value={oppForm.title}
                    onChange={(e) => setOppForm(p => ({ ...p, title: e.target.value }))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Software, Core Engineering"
                    value={oppForm.category}
                    onChange={(e) => setOppForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detailed role description, responsibilities, projects..."
                  value={oppForm.description}
                  onChange={(e) => setOppForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mode *</label>
                  <select
                    value={oppForm.mode}
                    onChange={(e) => setOppForm(p => ({ ...p, mode: e.target.value }))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="HYBRID">Hybrid</option>
                    <option value="ONLINE">Remote / Online</option>
                    <option value="OFFLINE">Onsite / In-Office</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Min CGPA</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 7.5"
                    value={oppForm.min_cgpa}
                    onChange={(e) => setOppForm(p => ({ ...p, min_cgpa: e.target.value }))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Deadline *</label>
                  <input
                    type="date"
                    required
                    value={oppForm.deadline}
                    onChange={(e) => setOppForm(p => ({ ...p, deadline: e.target.value }))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Stipend</label>
                  <input
                    type="text"
                    value={oppForm.stipend}
                    onChange={(e) => setOppForm(p => ({ ...p, stipend: e.target.value }))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Openings Count</label>
                  <input
                    type="number"
                    min="1"
                    value={oppForm.openings_count}
                    onChange={(e) => setOppForm(p => ({ ...p, openings_count: e.target.value }))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateOppModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#0b3578] hover:bg-blue-800 rounded-lg disabled:opacity-50"
                >
                  {submittingAction ? 'Publishing...' : 'Create & Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE COMPANY MODAL */}
      {showCreateCompanyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg border border-slate-200 shadow-2xl p-6">
            <h3 className="text-xl font-bold text-slate-900">Add & Verify Organization</h3>
            <p className="text-xs text-slate-500 mt-0.5">Register an authorized company in the college internship directory.</p>

            <form onSubmit={handleCreateCompanySubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Organization Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Microsoft India, TCS"
                  value={companyForm.company_name}
                  onChange={(e) => setCompanyForm(p => ({ ...p, company_name: e.target.value }))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Website</label>
                  <input
                    type="url"
                    placeholder="https://company.com"
                    value={companyForm.website}
                    onChange={(e) => setCompanyForm(p => ({ ...p, website: e.target.value }))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Industry</label>
                  <input
                    type="text"
                    placeholder="e.g. Information Technology"
                    value={companyForm.industry}
                    onChange={(e) => setCompanyForm(p => ({ ...p, industry: e.target.value }))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Location / City</label>
                <input
                  type="text"
                  placeholder="e.g. Hyderabad, Telangana"
                  value={companyForm.location}
                  onChange={(e) => setCompanyForm(p => ({ ...p, location: e.target.value }))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateCompanyModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#0b3578] hover:bg-blue-800 rounded-lg disabled:opacity-50"
                >
                  {submittingAction ? 'Saving...' : 'Save & Verify'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK ZIP MODAL */}
      {showBulkZipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md border border-slate-200 shadow-2xl p-6">
            <h3 className="text-lg font-bold text-slate-900">Bulk Document Archive Export</h3>
            <p className="text-xs text-slate-500 mt-1">
              Export all verified student internship offer letters and completion certificates in a structured folder hierarchy:
              <br />
              <code className="text-[10px] text-blue-700 bg-blue-50 px-1 py-0.5 rounded mt-1 inline-block">
                Internship_Documents/[BRANCH]/[YEAR]/[ROLL_NO]/...
              </code>
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Branch Scope</label>
                <select
                  value={bulkZipParams.branch}
                  onChange={(e) => setBulkZipParams(p => ({ ...p, branch: e.target.value }))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-bold"
                >
                  <option value="ALL">All Branches (Global College Scope)</option>
                  <option value="CSE">CSE</option>
                  <option value="IT">IT</option>
                  <option value="CSD">CSD</option>
                  <option value="ECE">ECE</option>
                  <option value="EEE">EEE</option>
                  <option value="CIVIL">CIVIL</option>
                  <option value="MECH">MECH</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Academic Year</label>
                <select
                  value={bulkZipParams.academicYear}
                  onChange={(e) => setBulkZipParams(p => ({ ...p, academicYear: e.target.value }))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-bold"
                >
                  <option value="ALL">All Academic Batches</option>
                  <option value="2024-2025">2024-2025</option>
                  <option value="2023-2024">2023-2024</option>
                  <option value="2022-2023">2022-2023</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status Filter</label>
                <select
                  value={bulkZipParams.status}
                  onChange={(e) => setBulkZipParams(p => ({ ...p, status: e.target.value }))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-bold"
                >
                  <option value="ALL">All Approved & Completed Records</option>
                  <option value="COMPLETED">Verified Completed Only</option>
                  <option value="APPROVED">Approved Active Internships Only</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-5">
              <button
                type="button"
                onClick={() => setShowBulkZipModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isExporting}
                onClick={handleBulkZipDownload}
                className="px-5 py-2 text-xs font-bold text-white bg-[#0b3578] hover:bg-blue-800 rounded-lg disabled:opacity-50"
              >
                {isExporting ? 'Generating ZIP...' : 'Generate & Download ZIP'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
