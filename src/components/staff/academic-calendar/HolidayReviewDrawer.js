'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { X, Check, AlertTriangle, Calendar, Info, Plus, Sparkles } from 'lucide-react';
import { formatDate } from '@/lib/date';

export default function HolidayReviewDrawer({
  isOpen,
  onClose,
  academicYear,
  semester,
  candidates: initialCandidates = [],
  onApproved
}) {
  const [candidates, setCandidates] = useState(() =>
    initialCandidates.map(c => ({
      ...c,
      selected: c.selected !== undefined ? c.selected : !c.is_already_approved && !c.is_exam_collision
    }))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [customName, setCustomName] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCandidates(
      initialCandidates.map(c => ({
        ...c,
        selected: c.selected !== undefined ? c.selected : !c.is_already_approved && !c.is_exam_collision
      }))
    );
  }, [initialCandidates]);

  if (!isOpen) return null;

  const handleToggleSelect = (index) => {
    setCandidates(prev => {
      const next = [...prev];
      next[index] = { ...next[index], selected: !next[index].selected };
      return next;
    });
  };

  const handleNameChange = (index, newName) => {
    setCandidates(prev => {
      const next = [...prev];
      next[index] = { ...next[index], occasion_name: newName };
      return next;
    });
  };

  const handleSelectAll = (selectState) => {
    setCandidates(prev =>
      prev.map(c => ({
        ...c,
        selected: c.is_exam_collision ? false : selectState
      }))
    );
  };

  const handleAddCustom = (e) => {
    e.preventDefault();
    if (!customDate || !customName.trim()) {
      toast.error('Please enter both date and occasion name.');
      return;
    }

    const [y, m, d] = customDate.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[dateObj.getUTCDay()];

    const newCandidate = {
      date: customDate,
      day_of_week: dayName,
      occasion_name: customName.trim(),
      category: 'INSTITUTION_SPECIFIC',
      category_label: 'Kakatiya University Custom',
      source: 'Manual Institution Entry',
      is_weekend: dateObj.getUTCDay() === 0,
      conflict_type: 'NONE',
      conflict_warning: null,
      is_already_approved: false,
      is_exam_collision: false,
      selected: true
    };

    setCandidates(prev => {
      const updated = [...prev, newCandidate];
      return updated.sort((a, b) => a.date.localeCompare(b.date));
    });

    setCustomDate('');
    setCustomName('');
    setShowAddCustom(false);
    toast.success('Custom holiday added to review list.');
  };

  const handleApprove = async () => {
    const selectedHolidays = candidates
      .filter(c => c.selected && c.occasion_name.trim())
      .map(c => ({
        date: c.date,
        name: c.occasion_name.trim(),
        replace_conflicts: c.is_exam_collision
      }));

    if (selectedHolidays.length === 0) {
      toast.error('No holidays selected for approval.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/staff/academic-calendar/holiday-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academic_year: academicYear,
          semester: parseInt(semester, 10),
          holidays: selectedHolidays
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save approved holidays');

      toast.success(json.message || `Approved ${selectedHolidays.length} holidays.`);
      if (onApproved) onApproved();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCount = candidates.filter(c => c.selected).length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex justify-end">
      <div className="relative w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <header className="px-6 py-4 bg-[#0b2447] text-white flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-300" />
            <div>
              <h2 className="text-lg font-bold">Public Holiday Suggestions</h2>
              <p className="text-xs text-slate-300">
                {academicYear} • Semester {semester} • Review, edit, and approve official college holidays
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            aria-label="Close Drawer"
          >
            <X size={20} />
          </button>
        </header>

        {/* Notice Banner */}
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs flex items-start gap-2">
          <Info className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
          <div>
            <strong>Human Approval Required:</strong> Suggested holidays from Telangana GAD and National Gazettes are proposed for review. None of these dates become official college holidays until you approve and save them below.
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="px-6 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSelectAll(true)}
              className="px-2.5 py-1 bg-white border border-slate-300 rounded font-medium text-slate-700 hover:bg-slate-100"
            >
              Select All Eligible
            </button>
            <button
              type="button"
              onClick={() => handleSelectAll(false)}
              className="px-2.5 py-1 bg-white border border-slate-300 rounded font-medium text-slate-700 hover:bg-slate-100"
            >
              Deselect All
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowAddCustom(!showAddCustom)}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#0b3578] text-white rounded font-medium hover:bg-blue-900"
          >
            <Plus size={14} />
            <span>Add Custom University Holiday</span>
          </button>
        </div>

        {/* Inline Add Custom Form */}
        {showAddCustom && (
          <form onSubmit={handleAddCustom} className="px-6 py-3 bg-blue-50/60 border-b border-blue-200 text-xs space-y-2 animate-fadeIn">
            <div className="font-semibold text-blue-900">Add Custom Institution Event / Holiday:</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="date"
                value={customDate}
                onChange={e => setCustomDate(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded bg-white"
                required
              />
              <input
                type="text"
                placeholder="Occasion Name (e.g. Annual College Day)"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                className="sm:col-span-2 px-3 py-1.5 border border-slate-300 rounded bg-white"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddCustom(false)}
                className="px-3 py-1 border border-slate-300 rounded bg-white text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-[#0b3578] text-white rounded font-medium hover:bg-blue-900"
              >
                Insert Candidate
              </button>
            </div>
          </form>
        )}

        {/* Candidates List / Table */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {candidates.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Calendar className="w-10 h-10 mx-auto text-slate-400 mb-2" />
              <p className="font-medium text-sm">No holiday candidates found for this semester window.</p>
              <p className="text-xs text-slate-400 mt-1">You can add custom university holidays using the button above.</p>
            </div>
          ) : (
            candidates.map((cand, idx) => {
              const hasConflict = cand.conflict_type !== 'NONE' && cand.conflict_type !== 'WORKING_DAY';
              const isApproved = cand.is_already_approved;

              return (
                <div
                  key={`${cand.date}-${idx}`}
                  className={`border rounded-lg p-3 transition-colors ${
                    cand.selected ? 'bg-white border-blue-300 shadow-sm' : 'bg-slate-50/70 border-slate-200 opacity-75'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id={`cand-check-${idx}`}
                      checked={cand.selected}
                      onChange={() => handleToggleSelect(idx)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-[#0b3578] focus:ring-[#0b3578]"
                    />

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <label htmlFor={`cand-check-${idx}`} className="font-bold text-sm text-slate-900 cursor-pointer">
                            {formatDate(cand.date)}
                          </label>
                          <span className="text-xs font-semibold text-slate-600">({cand.day_of_week})</span>
                          <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-200 text-slate-700">
                            {cand.category_label}
                          </span>
                        </div>

                        {cand.is_weekend && (
                          <span className="text-[11px] font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                            Coincides with Weekend
                          </span>
                        )}
                      </div>

                      {/* Editable Occasion Name */}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={cand.occasion_name}
                          onChange={e => handleNameChange(idx, e.target.value)}
                          className="flex-1 px-2.5 py-1 text-xs border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0b3578]"
                          title="Edit Occasion Name"
                        />
                      </div>

                      {/* Conflict / Status Notice */}
                      {hasConflict && (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                          <AlertTriangle size={13} className="shrink-0 text-amber-600" />
                          <span>{cand.conflict_warning}</span>
                        </div>
                      )}

                      {isApproved && (
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                          <Check size={13} className="shrink-0 text-emerald-600" />
                          <span>Active on calendar: Already declared as holiday</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <footer className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-600">
            <span className="font-bold text-slate-900">{selectedCount}</span> of {candidates.length} candidates selected
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={isSubmitting || selectedCount === 0}
              className="px-5 py-2 text-xs font-semibold bg-[#0b3578] text-white rounded hover:bg-blue-900 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Check size={14} />
              <span>{isSubmitting ? 'Saving...' : `Approve & Apply (${selectedCount})`}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
