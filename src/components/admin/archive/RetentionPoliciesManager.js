'use client';

import React, { useState } from 'react';

export default function RetentionPoliciesManager({ initialPolicies = [], onPoliciesUpdated }) {
  const [policies, setPolicies] = useState(initialPolicies);
  const [savingEntity, setSavingEntity] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const handleTogglePolicy = async (policy) => {
    const newStatus = !policy.auto_archive_enabled;
    await updatePolicy(policy.entity_type, {
      auto_archive_enabled: newStatus,
      retention_months: policy.retention_months,
      description: policy.description,
    });
  };

  const handleMonthsChange = (entityType, newMonths) => {
    setPolicies(prev => prev.map(p => 
      p.entity_type === entityType ? { ...p, retention_months: Number(newMonths) } : p
    ));
  };

  const updatePolicy = async (entityType, updates) => {
    setSavingEntity(entityType);
    setFeedback(null);

    try {
      const res = await fetch('/api/admin/archive/policies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          auto_archive_enabled: updates.auto_archive_enabled,
          retention_months: updates.retention_months,
          description: updates.description,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update policy');

      setFeedback({ type: 'success', message: `Retention policy for ${entityType} updated.` });

      setPolicies(prev => prev.map(p => 
        p.entity_type === entityType ? { ...p, ...updates } : p
      ));

      if (onPoliciesUpdated) onPoliciesUpdated();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update policy' });
    } finally {
      setSavingEntity(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-800 uppercase tracking-wide">Configurable Retention Rules & Policies</h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Set institutional retention thresholds and auto-archival schedules for academic, financial, and media assets.</p>
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-lg text-xs font-semibold mb-5 flex items-start justify-between ${
          feedback.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-900 border border-rose-200'
        }`}>
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} className="ml-2 font-bold cursor-pointer hover:opacity-75">✕</button>
        </div>
      )}

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
            <tr>
              <th className="py-3 px-4">Entity Type</th>
              <th className="py-3 px-4">Auto-Archival</th>
              <th className="py-3 px-4">Retention Period (Months)</th>
              <th className="py-3 px-4">Rule Context</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
            {policies.map((p) => (
              <tr key={p.id || p.entity_type} className="hover:bg-slate-50/70 transition-colors">
                <td className="py-3 px-4 font-bold text-slate-900">{p.entity_type}</td>
                <td className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => handleTogglePolicy(p)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      p.auto_archive_enabled ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                        p.auto_archive_enabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </td>
                <td className="py-3 px-4">
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={p.retention_months}
                    onChange={(e) => handleMonthsChange(p.entity_type, e.target.value)}
                    className="w-20 font-mono font-bold text-xs p-1.5 border border-slate-300 rounded bg-slate-50 text-slate-900 focus:bg-white"
                  />
                  <span className="text-slate-500 text-[11px] ml-1.5">Months</span>
                </td>
                <td className="py-3 px-4 text-slate-600 text-[11px] max-w-sm">{p.description}</td>
                <td className="py-3 px-4 text-right">
                  <button
                    type="button"
                    disabled={savingEntity === p.entity_type}
                    onClick={() => updatePolicy(p.entity_type, p)}
                    className="text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded border border-blue-200 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {savingEntity === p.entity_type ? 'Saving...' : 'Save Policy'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
