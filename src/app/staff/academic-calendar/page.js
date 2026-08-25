'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Info, X } from 'lucide-react';
import CalendarGrid from '@/components/staff/academic-calendar/CalendarGrid';
import AcademicYearSelect, { getCurrentFrontendAcademicYear } from '@/components/ui/AcademicYearSelect';

export default function AcademicCalendarPage() {
    // Determine dynamic range for the dropdown
    const currentYearStr = getCurrentFrontendAcademicYear();
    const startYearNumber = parseInt(currentYearStr.substring(0, 4));

    // UI State
    const [activeTab, setActiveTab] = useState('setup');
    const [isMobileDevice, setIsMobileDevice] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

    // Shared state for selected calendar context
    const [academicYear, setAcademicYear] = useState(currentYearStr);
    const [semester, setSemester] = useState('1');
    
    // Data state
    const [allSemesters, setAllSemesters] = useState([]);

    // State for Section 1: Semester Setup
    const [genStartDate, setGenStartDate] = useState('');
    const [genEndDate, setGenEndDate] = useState('');
    const [weekendDays, setWeekendDays] = useState({ SUNDAY: true, MONDAY: false, TUESDAY: false, WEDNESDAY: false, THURSDAY: false, FRIDAY: false, SATURDAY: false });
    const [isGenerating, setIsGenerating] = useState(false);

    // State for Section 2: Bulk Update
    const [bulkStartDate, setBulkStartDate] = useState('');
    const [bulkEndDate, setBulkEndDate] = useState('');
    const [bulkDayType, setBulkDayType] = useState('HOLIDAY');
    const [bulkHolidayName, setBulkHolidayName] = useState('');
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleResize = () => setIsMobileDevice(window.innerWidth < 768);
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (isBottomSheetOpen && isMobileDevice) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isBottomSheetOpen, isMobileDevice]);

    // Fetch all semester configs on mount
    useEffect(() => {
        const fetchSemesters = async () => {
            try {
                const res = await fetch('/api/staff/semesters');
                const data = await res.json();
                if (!res.ok) throw new Error('Failed to fetch semester configurations');
                setAllSemesters(data.data || []);
            } catch (error) {
                toast.error(error.message);
            }
        };
        fetchSemesters();
    }, []);

    // Pre-fill form when semester selection changes
    useEffect(() => {
        const selected = allSemesters.find(
            s => s.academic_year === academicYear && String(s.semester) === String(semester)
        );
        if (selected) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setGenStartDate(selected.start_date.substring(0, 10));
            setGenEndDate(selected.end_date.substring(0, 10));
        } else {
            setGenStartDate('');
            setGenEndDate('');
        }
    }, [academicYear, semester, allSemesters]);

    const handleWeekendDayChange = (day) => {
        setWeekendDays(prev => ({ ...prev, [day]: !prev[day] }));
    };

    const handleGenerateCalendar = async () => {
        if (!academicYear || !semester || !genStartDate || !genEndDate) {
            toast.error('Please fill all fields for semester setup.');
            return;
        }
        setIsGenerating(true);
        try {
            const selectedWeekendDays = Object.keys(weekendDays).filter(day => weekendDays[day]);
            const res = await fetch('/api/staff/academic-calendar/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    academic_year: academicYear,
                    semester: parseInt(semester),
                    start_date: genStartDate,
                    end_date: genEndDate,
                    weekend_days: selectedWeekendDays
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to generate calendar');
            
            toast.success('Calendar generated successfully!');
            
            // Refresh semesters list
            const refreshRes = await fetch('/api/staff/semesters');
            const refreshData = await refreshRes.json();
            if (refreshRes.ok) setAllSemesters(refreshData.data || []);
            
            setActiveTab('view');
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleBulkUpdate = async () => {
        if (!academicYear || !semester || !bulkStartDate || !bulkEndDate || !bulkDayType) {
            toast.error('Please fill all fields for bulk update.');
            return;
        }
        if (bulkDayType === 'HOLIDAY' && !bulkHolidayName) {
            toast.error('Please provide a name for the holiday.');
            return;
        }

        setIsBulkUpdating(true);
        try {
            const res = await fetch('/api/staff/academic-calendar/bulk-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    academic_year: academicYear,
                    semester: parseInt(semester),
                    start_date: bulkStartDate,
                    end_date: bulkEndDate,
                    day_type: bulkDayType,
                    holiday_name: bulkDayType === 'HOLIDAY' ? bulkHolidayName : null
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to apply bulk update');
            
            toast.success(`Successfully updated ${data.data.updatedCount} days!`);
            setActiveTab('view');
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsBulkUpdating(false);
        }
    };

    const tabs = [
        { id: 'setup', label: 'Semester Setup' },
        { id: 'bulk', label: 'Bulk Update' },
        { id: 'view', label: 'Calendar Grid' },
    ];

    const helpContent = (
        <div 
          className={`
            absolute top-1/2 -translate-y-1/2 mt-1 sm:mt-0 sm:top-auto sm:translate-y-0
            right-0 sm:left-full sm:ml-3 w-[280px] sm:w-[320px] 
            bg-white shadow-xl rounded-md border border-slate-200 
            transition-all duration-200 origin-top-right sm:origin-left z-50
            ${isHovered && !isMobileDevice ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}
          `}
        >
          <div className="p-4 relative">
            <div className="absolute left-[-6px] top-4 w-3 h-3 bg-white border-l border-b border-slate-200 transform rotate-45 hidden sm:block"></div>
            <h3 className="text-sm font-bold text-[#0b2447] mb-2">Calendar Module</h3>
            <p className="text-xs text-slate-600 mb-2 leading-relaxed">
              This module manages institutional academic dates.
            </p>
            <ul className="list-disc pl-4 space-y-1 text-xs text-slate-600">
              <li><strong>Setup:</strong> Define the start/end dates for a semester.</li>
              <li><strong>Bulk Update:</strong> Mark ranges as holidays, exams, or internal tests.</li>
              <li><strong>Grid:</strong> View and interact with the active institutional calendar.</li>
            </ul>
          </div>
        </div>
    );

    const helpBottomSheet = (
        <div className={`fixed inset-0 z-50 lg:hidden ${isBottomSheetOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
          <div 
            className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${isBottomSheetOpen ? 'opacity-100' : 'opacity-0'}`}
            onClick={() => setIsBottomSheetOpen(false)}
          />
          <div 
            className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out transform ${isBottomSheetOpen ? 'translate-y-0' : 'translate-y-full'}`}
          >
            <div className="p-6 relative">
              <button 
                onClick={() => setIsBottomSheetOpen(false)}
                className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
              <h3 className="text-lg font-bold text-[#0b2447] mb-3">Calendar Module</h3>
              <div className="text-sm text-slate-700 space-y-4 mb-6 leading-relaxed">
                <p className="text-slate-600">
                  This module manages institutional academic dates.
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>Setup:</strong> Define the start/end dates for a semester.</li>
                  <li><strong>Bulk Update:</strong> Mark ranges as holidays, exams, or internal tests.</li>
                  <li><strong>Grid:</strong> View and interact with the active institutional calendar.</li>
                </ul>
              </div>
              <button 
                onClick={() => setIsBottomSheetOpen(false)} 
                className="w-full bg-[#0b3578] text-white py-3 rounded-md font-semibold text-sm hover:bg-[#0a2d66] transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
    );

    return (
        <div className="w-full max-w-6xl mx-auto space-y-6 text-sm pb-10">
            {/* Header Section */}
            <header className="mb-4">
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-semibold text-gray-800">Academic Calendar</h1>
                    
                    <div 
                        className="relative inline-flex items-center"
                        onMouseEnter={() => !isMobileDevice && setIsHovered(true)}
                        onMouseLeave={() => !isMobileDevice && setIsHovered(false)}
                    >
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                if (isMobileDevice) setIsBottomSheetOpen(true);
                            }}
                            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100 focus:outline-none"
                        >
                            <Info size={18} />
                        </button>
                        {!isMobileDevice && helpContent}
                    </div>
                </div>
                <p className="text-gray-500 mt-1">Setup current and future semester dates, apply bulk updates, and view schedules.</p>
            </header>

            {isMobileDevice && helpBottomSheet}

            {/* Tabs */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-3 py-2 rounded-md text-sm whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-[#0b3578] text-white' : 'bg-white border hover:bg-gray-50'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Context Selector Card */}
            <section className="border border-gray-300 rounded-md bg-white p-4 mb-6">
                <div className="mb-3">
                    <h2 className="text-sm font-semibold text-gray-800">Target Academic Scope</h2>
                    <p className="text-sm text-gray-600">Select the year and semester you are currently managing.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="academicYear" className="block text-xs font-semibold text-gray-600 mb-1">Academic Year</label>
                        <AcademicYearSelect 
                            id="academicYear" 
                            value={academicYear} 
                            onChange={(e) => setAcademicYear(e.target.value)} 
                            startYear={startYearNumber}
                            numYears={3}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-[#0b3578] outline-none transition-colors"
                        />
                    </div>
                    <div>
                        <label htmlFor="semester" className="block text-xs font-semibold text-gray-600 mb-1">Semester</label>
                        <select 
                            id="semester" 
                            value={semester} 
                            onChange={(e) => setSemester(e.target.value)} 
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-[#0b3578] outline-none transition-colors"
                        >
                            <option value="1">1st Semester (Odd)</option>
                            <option value="2">2nd Semester (Even)</option>
                        </select>
                    </div>
                </div>
            </section>

            {/* Tab Contents */}
            <div className="space-y-6">
                {activeTab === 'setup' && (
                    <section className="border border-gray-300 rounded-md bg-white p-4 animate-fadeIn">
                        <div className="mb-4">
                            <h2 className="text-sm font-semibold text-gray-800">Semester Setup</h2>
                            <p className="text-sm text-gray-600">Define the exact start and end dates for the selected semester.</p>
                        </div>
                        <div className="space-y-5 max-w-2xl">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="genStartDate" className="block text-xs font-semibold text-gray-600 mb-1">Start Date</label>
                                    <input type="date" id="genStartDate" value={genStartDate} onChange={(e) => setGenStartDate(e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#0b3578]"/>
                                </div>
                                <div>
                                    <label htmlFor="genEndDate" className="block text-xs font-semibold text-gray-600 mb-1">End Date</label>
                                    <input type="date" id="genEndDate" value={genEndDate} onChange={(e) => setGenEndDate(e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#0b3578]"/>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-2">Weekend Pattern</label>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                    {Object.keys(weekendDays).map(day => (
                                        <label key={day} className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer hover:text-[#0b3578] transition-colors">
                                            <input type="checkbox" checked={weekendDays[day]} onChange={() => handleWeekendDayChange(day)} className="rounded border-gray-300 text-[#0b3578] focus:ring-[#0b3578]/20"/>
                                            <span>{day.charAt(0) + day.slice(1).toLowerCase()}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="pt-2">
                                <button onClick={handleGenerateCalendar} disabled={isGenerating} className="px-5 py-2 bg-[#0b3578] text-white font-medium text-sm rounded-md hover:bg-blue-900 transition-colors disabled:opacity-50">
                                    {isGenerating ? 'Generating...' : 'Generate New Calendar'}
                                </button>
                            </div>
                        </div>
                    </section>
                )}

                {activeTab === 'bulk' && (
                    <section className="border border-gray-300 rounded-md bg-white p-4 animate-fadeIn">
                        <div className="mb-4">
                            <h2 className="text-sm font-semibold text-gray-800">Bulk Range Update</h2>
                            <p className="text-sm text-gray-600">Mark a date range as holidays, exams, or events.</p>
                        </div>
                        <div className="space-y-5 max-w-2xl">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="bulkStartDate" className="block text-xs font-semibold text-gray-600 mb-1">Start Date</label>
                                    <input type="date" id="bulkStartDate" value={bulkStartDate} onChange={(e) => setBulkStartDate(e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#0b3578]"/>
                                </div>
                                <div>
                                    <label htmlFor="bulkEndDate" className="block text-xs font-semibold text-gray-600 mb-1">End Date</label>
                                    <input type="date" id="bulkEndDate" value={bulkEndDate} onChange={(e) => setBulkEndDate(e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#0b3578]"/>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="bulkDayType" className="block text-xs font-semibold text-gray-600 mb-1">Day Type</label>
                                <select id="bulkDayType" value={bulkDayType} onChange={(e) => setBulkDayType(e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-[#0b3578] outline-none transition-all">
                                    <option value="HOLIDAY">Holiday</option>
                                    <option value="EXAM">Exam Day</option>
                                    <option value="INTERNAL">Internal Test Day</option>
                                    <option value="EVENT">College Event</option>
                                    <option value="WORKING">Working Day</option>
                                </select>
                            </div>
                            {bulkDayType === 'HOLIDAY' && (
                                <div className="animate-fadeIn">
                                    <label htmlFor="bulkHolidayName" className="block text-xs font-semibold text-gray-600 mb-1">Holiday Label</label>
                                    <input type="text" id="bulkHolidayName" value={bulkHolidayName} onChange={(e) => setBulkHolidayName(e.target.value)} placeholder="e.g., Summer Vacation" className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#0b3578]"/>
                                </div>
                            )}
                            <div className="pt-2">
                                <button onClick={handleBulkUpdate} disabled={isBulkUpdating} className="px-5 py-2 bg-[#0b3578] text-white font-medium text-sm rounded-md hover:bg-blue-900 transition-colors disabled:opacity-50">
                                    {isBulkUpdating ? 'Applying...' : 'Apply Range Update'}
                                </button>
                            </div>
                        </div>
                    </section>
                )}

                {activeTab === 'view' && (
                    <section className="border border-gray-300 rounded-md bg-white p-4 animate-fadeIn">
                        <CalendarGrid
                            academicYear={academicYear}
                            semester={semester}
                            key={`${academicYear}-${semester}`} 
                        />
                    </section>
                )}
            </div>
        </div>
    );
}
