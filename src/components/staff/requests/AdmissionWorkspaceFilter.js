'use client';
import React from 'react';
import { COLLEGE_CONFIG } from '@/lib/college-config';
import { ADMISSION_EXAM_OPTIONS } from '@/lib/admission-workspace';

export default function AdmissionWorkspaceFilter({
    workspace,
    onChange,
    onRefresh,
    isLoading = false,
    title = 'Workspace Filter',
    subtitle = 'Select target branch and intake examination',
    actions = null,
}) {
    const [prevPropYear, setPrevPropYear] = React.useState(workspace?.entryYear);
    const [yearInput, setYearInput] = React.useState(String(workspace?.entryYear ?? ''));

    if (workspace?.entryYear !== prevPropYear) {
        setPrevPropYear(workspace?.entryYear);
        setYearInput(String(workspace?.entryYear ?? ''));
    }

    const handleExamChange = (e) => {
        onChange({ ...workspace, intakeExam: e.target.value });
    };

    const handleBranchChange = (e) => {
        onChange({ ...workspace, targetBranch: e.target.value });
    };

    const handleYearChange = (e) => {
        const val = e.target.value;
        setYearInput(val);
        if (/^\d{4}$/.test(val)) {
            const parsed = parseInt(val, 10);
            if (parsed >= 2000 && parsed <= 2100) {
                onChange({ ...workspace, entryYear: parsed });
            }
        }
    };

    return (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-6 border border-gray-300 rounded-md shadow-sm">
            <div>
                <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
                <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
            </div>

            <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3">
                <div className="flex-1 sm:w-40">
                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Intake Exam</label>
                    <select
                        value={workspace?.intakeExam || 'TG EAPCET'}
                        onChange={handleExamChange}
                        disabled={isLoading}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 text-sm font-medium text-[#0b3578] focus:outline-none focus:ring-2 focus:ring-blue-100 rounded-md transition-all disabled:opacity-60"
                    >
                        {ADMISSION_EXAM_OPTIONS.map((exam) => (
                            <option key={exam} value={exam}>
                                {exam}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex-1 sm:w-60">
                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Target Branch</label>
                    <select
                        value={workspace?.targetBranch || 'CSE'}
                        onChange={handleBranchChange}
                        disabled={isLoading}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 text-sm font-medium text-[#0b3578] focus:outline-none focus:ring-2 focus:ring-blue-100 rounded-md transition-all disabled:opacity-60"
                    >
                        {COLLEGE_CONFIG.branches.map((b) => (
                            <option key={b.code} value={b.name}>
                                {b.name.toUpperCase()}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex-1 sm:w-32">
                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Entry Year</label>
                    <input
                        type="number"
                        value={yearInput}
                        onChange={handleYearChange}
                        disabled={isLoading}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 text-sm font-medium text-[#0b3578] focus:outline-none focus:ring-2 focus:ring-blue-100 rounded-md transition-all disabled:opacity-60"
                        placeholder="e.g. 2026"
                        min="2000"
                        max="2100"
                    />
                </div>

                {actions ? (
                    <div className="flex-1 sm:w-56 sm:self-end">
                        {actions}
                    </div>
                ) : onRefresh ? (
                    <div className="flex-1 sm:w-36 sm:self-end">
                        <button
                            type="button"
                            onClick={onRefresh}
                            disabled={isLoading}
                            className="w-full px-4 py-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-md transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <span className={isLoading ? 'animate-spin' : ''}>↻</span>
                            <span>{isLoading ? 'Syncing...' : 'Sync'}</span>
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
