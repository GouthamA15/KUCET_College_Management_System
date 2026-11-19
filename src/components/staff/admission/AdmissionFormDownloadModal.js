'use client';

import React, { useState } from 'react';
import toast from 'react-hot-toast';

export default function AdmissionFormDownloadModal({ isOpen, onClose, initialStudent = null }) {
  const [mode, setMode] = useState(initialStudent ? 'prefill' : 'blank');
  const [rollNo, setRollNo] = useState(initialStudent?.roll_no || '');
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isOpen) return null;

  const handleDownload = async (format = 'pdf') => {
    try {
      setIsDownloading(true);
      const queryParams = new URLSearchParams();
      if (mode === 'prefill' && rollNo.trim()) {
        queryParams.set('roll_no', rollNo.trim().toUpperCase());
      }

      const queryString = queryParams.toString();
      const endpoint = `/api/staff/admission/admission-form/${format}${queryString ? `?${queryString}` : ''}`;

      // Trigger browser download via anchor
      const link = document.createElement('a');
      link.href = endpoint;
      link.download = `kucet_admission_form_${mode === 'prefill' && rollNo ? rollNo.trim().toUpperCase() : 'blank'}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success(`Downloading ${format.toUpperCase()} Admission Form...`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to initiate download');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div 
        className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#0b3578] to-[#1d57b8] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-lg shadow-inner">
              📄
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Official Admission Form</h3>
              <p className="text-xs text-blue-100/90 mt-0.5">KU College of Engineering &amp; Technology</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Mode Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Select Form Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode('blank')}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  mode === 'blank'
                    ? 'border-[#0b3578] bg-blue-50/60 ring-2 ring-[#0b3578]/20'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-slate-800">Blank Official Template</span>
                  {mode === 'blank' && <span className="text-xs font-bold text-[#0b3578]">✓</span>}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Pristine official stationery copy for printing and manual intake.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('prefill')}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  mode === 'prefill'
                    ? 'border-[#0b3578] bg-blue-50/60 ring-2 ring-[#0b3578]/20'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-slate-800">Pre-filled Student Record</span>
                  {mode === 'prefill' && <span className="text-xs font-bold text-[#0b3578]">✓</span>}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Populated with verified student details, rankings, and addresses.
                </p>
              </button>
            </div>
          </div>

          {/* Roll number input if prefill mode */}
          {mode === 'prefill' && (
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
              <label className="block text-xs font-medium text-slate-700">
                Student Hall Ticket / Roll Number
              </label>
              <input
                type="text"
                placeholder="e.g., 22567T0901"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0b3578]/30 focus:border-[#0b3578] uppercase font-mono font-semibold"
              />
              <p className="text-[11px] text-slate-500">
                Leave empty to download a blank form, or provide roll number to populate academic fields.
              </p>
            </div>
          )}

          {/* Form Specifications Card */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3.5 space-y-2 text-xs text-slate-600">
            <div className="flex items-center gap-2 font-bold text-slate-700">
              <span className="text-base">📏</span>
              <span>Document Specifications &amp; Invariants</span>
            </div>
            <ul className="space-y-1 list-disc list-inside text-slate-500 pl-1">
              <li><strong>Exact A4 Single-Page:</strong> Strictly formatted to 1 page (zero overflow).</li>
              <li><strong>28 Numbered Fields:</strong> Preserves all qualifying, category, caste &amp; rank details.</li>
              <li><strong>Official Stationery:</strong> Embedded KU emblem, Exam Branch heading, photo box with signature slot.</li>
              <li><strong>Fee &amp; Postal Grid:</strong> Pre-ruled tables for Convener/Processing/Alumni fees and postal addresses.</li>
            </ul>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancel
          </button>

          <div className="w-full sm:w-auto flex items-center gap-2">
            <button
              type="button"
              disabled={isDownloading}
              onClick={() => handleDownload('docx')}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg text-xs font-bold transition-all shadow-xs hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              <span>Word (.docx)</span>
            </button>

            <button
              type="button"
              disabled={isDownloading}
              onClick={() => handleDownload('pdf')}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2 bg-[#0b3578] hover:bg-[#082654] text-white rounded-lg text-xs font-bold transition-all shadow-sm hover:shadow disabled:opacity-50 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Download PDF (Print-Ready)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
