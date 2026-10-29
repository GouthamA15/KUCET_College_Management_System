'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';

export default function InstitutionalRolesClient() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('ALL'); // ALL, PRINCIPALS, FACULTY
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirmation Modal State
  const [activeModal, setActiveModal] = useState(null); 
  // activeModal: { type: 'DESIGNATE_SUPERVISOR' | 'REVOKE_SUPERVISOR' | 'ASSIGN_PRINCIPAL' | 'REVOKE_PRINCIPAL', staff: object }

  const fetchData = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/institutional-roles', {
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }
      const json = await res.json();
      setData(json.data);
    } catch (err) {
      setError(err.message || 'Failed to load institutional roles data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const handleDesignateSupervisor = async (staffId) => {
    try {
      setIsSubmitting(true);
      setError(null);
      setSuccessMessage(null);

      const res = await fetch('/api/admin/institutional-roles/academic-supervisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DESIGNATE', staff_id: staffId })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to designate Academic Supervisor');
      }

      setSuccessMessage(json.message);
      setActiveModal(null);
      await fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeSupervisor = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      setSuccessMessage(null);

      const res = await fetch('/api/admin/institutional-roles/academic-supervisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REVOKE' })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to revoke Academic Supervisor');
      }

      setSuccessMessage(json.message);
      setActiveModal(null);
      await fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrincipalRoleToggle = async (staffId, action) => {
    try {
      setIsSubmitting(true);
      setError(null);
      setSuccessMessage(null);

      const res = await fetch('/api/admin/institutional-roles/principal-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: staffId, action })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Failed to ${action.toLowerCase()} Principal role`);
      }

      setSuccessMessage(json.message);
      setActiveModal(null);
      await fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    if (!data?.eligible_staff) return [];
    let list = data.eligible_staff;

    if (filterRole === 'PRINCIPALS') {
      list = list.filter(s => s.has_principal_role);
    } else if (filterRole === 'FACULTY') {
      list = list.filter(s => s.roles.includes('FACULTY'));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(s => 
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.employee_id && s.employee_id.toLowerCase().includes(q)) ||
        (s.designation && s.designation.toLowerCase().includes(q)) ||
        String(s.id).includes(q)
      );
    }

    return list;
  }, [data, filterRole, searchQuery]);

  const supervisor = data?.designated_supervisor;

  // Authorization badge helper
  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE_AUTHORIZED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            Active & Authorized
          </span>
        );
      case 'UNCONFIGURED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            Unconfigured (Fail-Closed)
          </span>
        );
      case 'REVOKED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <span className="w-2 h-2 rounded-full bg-rose-600" />
            Revoked (Fail-Closed)
          </span>
        );
      case 'PRINCIPAL_ROLE_MISSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-600" />
            Principal Role Missing (Blocked)
          </span>
        );
      case 'INACTIVE_ACCOUNT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
            <span className="w-2 h-2 rounded-full bg-red-600" />
            Account Inactive (Blocked)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">
            {status || 'Unknown'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-purple-950 text-white rounded-2xl p-6 lg:p-8 shadow-xl border border-indigo-900/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-200 border border-purple-400/30 mb-3">
              Institutional Governance
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
              Institutional Roles & Academic Supervisor
            </h1>
            <p className="text-sm text-indigo-200/80 mt-2 max-w-2xl">
              Authoritatively manage the college Principal role and the designated Academic Supervisor with global multi-department monitoring authority across all seven branches: CSE, IT, CSD, ECE, EEE, CIVIL, and MECH.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/manage-staff"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-colors shadow-xs"
            >
              ← Manage Staff Directory
            </Link>
            <button
              onClick={() => fetchData(true)}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : '↻ Refresh Status'}
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl text-red-800 text-sm flex items-start justify-between shadow-xs">
          <div>
            <p className="font-bold">Operation Notice</p>
            <p className="mt-0.5">{error}</p>
          </div>
          <button 
            onClick={() => setError(null)} 
            className="text-red-500 hover:text-red-700 font-bold ml-4 text-lg"
          >
            ×
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-xl text-emerald-800 text-sm flex items-start justify-between shadow-xs">
          <div>
            <p className="font-bold">Success</p>
            <p className="mt-0.5">{successMessage}</p>
          </div>
          <button 
            onClick={() => setSuccessMessage(null)} 
            className="text-emerald-500 hover:text-emerald-700 font-bold ml-4 text-lg"
          >
            ×
          </button>
        </div>
      )}

      {/* SECTION 1: Current Designated Academic Supervisor */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🏛️</span>
              <h2 className="text-lg font-bold text-slate-900">
                Designated Academic Supervisor
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Holds single-identity global read-only monitoring authority across all departments (attendance, timetable, student records).
            </p>
          </div>
          <div>
            {getStatusBadge(supervisor?.authorization_status)}
          </div>
        </div>

        <div className="p-6">
          {supervisor && supervisor.id ? (
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-6 rounded-xl bg-purple-50/40 border border-purple-100">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-purple-600 text-white font-extrabold text-xl flex items-center justify-center shrink-0 shadow-sm">
                  {supervisor.name ? supervisor.name.charAt(0).toUpperCase() : 'P'}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-extrabold text-slate-900">
                      {supervisor.name}
                    </h3>
                    <span className="bg-purple-100 text-purple-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-purple-200">
                      STAFF ID #{supervisor.id}
                    </span>
                    <span className="bg-indigo-100 text-indigo-800 text-[10px] font-semibold px-2 py-0.5 rounded">
                      {supervisor.employee_id || 'KU-STAFF'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 font-medium">
                    {supervisor.designation || 'Professor'} • {supervisor.email}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    {supervisor.roles && supervisor.roles.map((r, i) => (
                      <span key={i} className="bg-white text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                        {r}
                      </span>
                    ))}
                    {supervisor.has_principal_role && (
                      <span className="bg-purple-200/80 text-purple-900 text-[10px] font-bold px-2 py-0.5 rounded border border-purple-300 shadow-2xs">
                        👑 PRINCIPAL ROLE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-3 italic">
                    {supervisor.status_description}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                <button
                  onClick={() => setActiveModal({ type: 'REVOKE_SUPERVISOR', staff: supervisor })}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 transition-colors shadow-xs"
                >
                  Revoke Supervisor Designation
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 px-4 bg-slate-50/60 rounded-xl border border-dashed border-slate-300">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xl mb-3">
                🛡️
              </div>
              <h4 className="text-sm font-bold text-slate-800">No Academic Supervisor Designated</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {supervisor?.status_description || 'Global Academic Supervisor privileges are disabled. The system strictly fails closed until an active staff account with the Principal role is designated below.'}
              </p>
              <div className="mt-4">
                <span className="inline-block bg-slate-200 text-slate-700 text-[11px] font-mono px-3 py-1 rounded">
                  Status: {supervisor?.authorization_status || 'UNCONFIGURED'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: Institutional Principal Accounts */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">👑</span>
              <h2 className="text-lg font-bold text-slate-900">
                Institutional Principal Roster
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Staff members holding the official institutional Principal rank. Only accounts in this roster are eligible for Academic Supervisor designation.
            </p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
            {data?.principal_accounts ? data.principal_accounts.length : 0} Principal(s)
          </span>
        </div>

        <div className="p-6">
          {data?.principal_accounts && data.principal_accounts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.principal_accounts.map((p) => {
                const isDesignated = p.id === supervisor?.id && supervisor?.authorization_status === 'ACTIVE_AUTHORIZED';
                return (
                  <div 
                    key={p.id}
                    className={`rounded-xl p-5 border transition-all ${
                      isDesignated 
                        ? 'bg-purple-50/60 border-purple-300 shadow-sm ring-2 ring-purple-400/20' 
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm">
                          {p.name}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Staff ID #{p.id} • {p.employee_id}
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
                          {p.designation} • {p.email}
                        </p>
                      </div>
                      {isDesignated ? (
                        <span className="bg-purple-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded shadow-2xs whitespace-nowrap">
                          ★ ACTIVE SUPERVISOR
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap">
                          PRINCIPAL
                        </span>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      {!isDesignated ? (
                        <button
                          onClick={() => setActiveModal({ type: 'DESIGNATE_SUPERVISOR', staff: p })}
                          disabled={isSubmitting}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-xs"
                        >
                          Designate as Supervisor
                        </button>
                      ) : (
                        <span className="text-xs text-purple-800 font-semibold italic">
                          Global Authority Active
                        </span>
                      )}

                      <button
                        onClick={() => setActiveModal({ type: 'REVOKE_PRINCIPAL', staff: p })}
                        disabled={isSubmitting}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 transition-colors"
                      >
                        Revoke Role
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No staff account currently holds the Principal role. Use the staff selector below to assign the Principal role.
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: Searchable Staff Selector & Actions */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Staff Directory & Role Governance
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Select any verified staff account to assign or revoke institutional roles or grant supervisory authority.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search name, ID, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 pl-9 pr-4 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
            </div>

            {/* Filter Tabs */}
            <div className="flex rounded-xl bg-slate-200/70 p-1">
              {['ALL', 'PRINCIPALS', 'FACULTY'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilterRole(tab)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    filterRole === tab 
                      ? 'bg-white text-slate-900 shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab === 'ALL' ? 'All Active' : tab.charAt(0) + tab.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Staff Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-6">Staff Member</th>
                <th className="py-3.5 px-6">Designation & Department</th>
                <th className="py-3.5 px-6">Current Roles</th>
                <th className="py-3.5 px-6">Supervisor Status</th>
                <th className="py-3.5 px-6 text-right">Administrative Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredStaff.length > 0 ? (
                filteredStaff.map((staff) => {
                  const isSupervisor = staff.id === supervisor?.id && supervisor?.authorization_status === 'ACTIVE_AUTHORIZED';
                  return (
                    <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-extrabold text-slate-900 text-sm">{staff.name}</div>
                        <div className="text-slate-500 text-[11px] mt-0.5">
                          ID: #{staff.id} • {staff.employee_id}
                        </div>
                        <div className="text-slate-400 text-[11px] font-mono">{staff.email}</div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-semibold text-slate-800">{staff.designation || 'Faculty'}</div>
                        <div className="text-slate-500 text-[11px] mt-0.5">
                          {staff.branches && staff.branches.length > 0 ? staff.branches.join(', ') : 'Institutional'}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-wrap items-center gap-1">
                          {staff.has_principal_role && (
                            <span className="bg-purple-100 text-purple-800 font-extrabold text-[10px] px-2 py-0.5 rounded border border-purple-200">
                              👑 PRINCIPAL
                            </span>
                          )}
                          {staff.roles && staff.roles.map((r, i) => (
                            <span key={i} className="bg-slate-100 text-slate-700 text-[10px] px-1.5 py-0.5 rounded">
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {isSupervisor ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
                            ★ Active Academic Supervisor
                          </span>
                        ) : staff.has_principal_role ? (
                          <span className="text-slate-500 text-[11px]">
                            Eligible (Principal)
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">
                            Not Designated
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex items-center gap-2">
                          {/* Principal Role Button */}
                          {!staff.has_principal_role ? (
                            <button
                              onClick={() => setActiveModal({ type: 'ASSIGN_PRINCIPAL', staff })}
                              disabled={isSubmitting}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-800 border border-slate-200 transition-colors"
                            >
                              + Assign Principal
                            </button>
                          ) : (
                            <button
                              onClick={() => setActiveModal({ type: 'REVOKE_PRINCIPAL', staff })}
                              disabled={isSubmitting || isSupervisor}
                              title={isSupervisor ? 'Revoke supervisor designation first' : 'Revoke Principal role'}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                isSupervisor 
                                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                                  : 'bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border-slate-200'
                              }`}
                            >
                              Revoke Role
                            </button>
                          )}

                          {/* Academic Supervisor Designation Button */}
                          {!isSupervisor ? (
                            <button
                              onClick={() => setActiveModal({ type: 'DESIGNATE_SUPERVISOR', staff })}
                              disabled={isSubmitting || !staff.has_principal_role}
                              title={!staff.has_principal_role ? 'Must assign Principal role first' : 'Designate as Academic Supervisor'}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-xs ${
                                staff.has_principal_role 
                                  ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                              }`}
                            >
                              Designate Supervisor
                            </button>
                          ) : (
                            <button
                              onClick={() => setActiveModal({ type: 'REVOKE_SUPERVISOR', staff })}
                              disabled={isSubmitting}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 transition-colors"
                            >
                              Revoke Supervisor
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500 text-xs">
                    No matching staff members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 4: Visible Audit & History Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📜</span>
              <h2 className="text-lg font-bold text-slate-900">
                Institutional Role Audit Trail
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Cryptographically timestamped log of privileged role assignments, designations, replacements, and revocations.
            </p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            Recent 30 Events
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-6">Timestamp</th>
                <th className="py-3 px-6">Action</th>
                <th className="py-3 px-6">Target Staff</th>
                <th className="py-3 px-6">Actor</th>
                <th className="py-3 px-6">Details / Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {data?.audit_history && data.audit_history.length > 0 ? (
                data.audit_history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60">
                    <td className="py-3.5 px-6 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'}
                    </td>
                    <td className="py-3.5 px-6">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide border ${
                        item.action.includes('DESIGNATED') ? 'bg-purple-100 text-purple-900 border-purple-300' :
                        item.action.includes('REPLACED') ? 'bg-indigo-100 text-indigo-900 border-indigo-300' :
                        item.action.includes('REVOKED') ? 'bg-rose-100 text-rose-900 border-rose-300' :
                        'bg-slate-100 text-slate-800 border-slate-200'
                      }`}>
                        {item.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="font-bold text-slate-900">{item.target_name || `ID #${item.target_id}`}</div>
                      {item.target_email && (
                        <div className="text-[11px] text-slate-500">{item.target_email}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-slate-600 font-medium">
                      Super Admin (ID #{item.user_id || '1'})
                    </td>
                    <td className="py-3.5 px-6 font-mono text-[10px] text-slate-500 max-w-xs truncate">
                      {JSON.stringify(item.payload_after || item.payload_before || {})}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500 text-xs">
                    No institutional role modification audit records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONFIRMATION DIALOG MODAL */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 ${
                  activeModal.type.includes('REVOKE') ? 'bg-rose-100 text-rose-700' : 'bg-purple-100 text-purple-700'
                }`}>
                  {activeModal.type.includes('REVOKE') ? '⚠️' : '🛡️'}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {activeModal.type === 'DESIGNATE_SUPERVISOR' && 'Designate Academic Supervisor'}
                    {activeModal.type === 'REVOKE_SUPERVISOR' && 'Revoke Academic Supervisor Authority'}
                    {activeModal.type === 'ASSIGN_PRINCIPAL' && 'Assign Institutional Principal Role'}
                    {activeModal.type === 'REVOKE_PRINCIPAL' && 'Revoke Principal Role'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Target: {activeModal.staff?.name} (Staff ID #{activeModal.staff?.id})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            {/* Modal Body / Impact Description */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
              {activeModal.type === 'DESIGNATE_SUPERVISOR' && (
                <>
                  <p className="font-semibold text-slate-900">
                    You are designating {activeModal.staff?.name} as the sole Academic Supervisor.
                  </p>
                  <p>
                    • This grants global read-only monitoring authority across all seven academic branches (CSE, IT, CSD, ECE, EEE, CIVIL, MECH).
                  </p>
                  <p>
                    • If another staff member was previously designated, their global monitoring privileges will be immediately revoked.
                  </p>
                  <p>
                    • Target must possess an ACTIVE account status and the Principal role.
                  </p>
                </>
              )}

              {activeModal.type === 'REVOKE_SUPERVISOR' && (
                <>
                  <p className="font-semibold text-rose-900">
                    Are you sure you want to revoke the Academic Supervisor designation?
                  </p>
                  <p>
                    • Global multi-branch monitoring privileges will immediately terminate.
                  </p>
                  <p>
                    • The system will enter the fail-closed unconfigured state until a replacement is designated.
                  </p>
                  <p>
                    • The staff account will retain its institutional Principal role.
                  </p>
                </>
              )}

              {activeModal.type === 'ASSIGN_PRINCIPAL' && (
                <>
                  <p className="font-semibold text-slate-900">
                    Assigning the Principal institutional role to {activeModal.staff?.name}.
                  </p>
                  <p>
                    • This confers official institutional Principal status in the Staff Directory.
                  </p>
                  <p>
                    • This qualifies the staff member to be designated as Academic Supervisor if desired.
                  </p>
                </>
              )}

              {activeModal.type === 'REVOKE_PRINCIPAL' && (
                <>
                  <p className="font-semibold text-rose-900">
                    Revoking the Principal role from {activeModal.staff?.name}.
                  </p>
                  <p>
                    • If this account is currently the active Academic Supervisor, this operation will be blocked until the supervisor designation is revoked or replaced.
                  </p>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setActiveModal(null)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>

              {activeModal.type === 'DESIGNATE_SUPERVISOR' && (
                <button
                  onClick={() => handleDesignateSupervisor(activeModal.staff.id)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition-colors shadow-xs"
                >
                  {isSubmitting ? 'Designating...' : 'Confirm Designation'}
                </button>
              )}

              {activeModal.type === 'REVOKE_SUPERVISOR' && (
                <button
                  onClick={handleRevokeSupervisor}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-xs"
                >
                  {isSubmitting ? 'Revoking...' : 'Confirm Revocation'}
                </button>
              )}

              {activeModal.type === 'ASSIGN_PRINCIPAL' && (
                <button
                  onClick={() => handlePrincipalRoleToggle(activeModal.staff.id, 'ASSIGN')}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition-colors shadow-xs"
                >
                  {isSubmitting ? 'Assigning...' : 'Assign Principal Role'}
                </button>
              )}

              {activeModal.type === 'REVOKE_PRINCIPAL' && (
                <button
                  onClick={() => handlePrincipalRoleToggle(activeModal.staff.id, 'REVOKE')}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-xs"
                >
                  {isSubmitting ? 'Revoking...' : 'Revoke Principal Role'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
