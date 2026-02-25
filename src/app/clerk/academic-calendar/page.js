'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/app/components/Footer/Footer';
import CalendarGrid from '@/components/clerk/academic-calendar/CalendarGrid';

export default function AcademicCalendarPage() {
    // Shared state for selected calendar
    const [academicYear, setAcademicYear] = useState('2025-26');
    const [semester, setSemester] = useState('1');
    const [showCalendar, setShowCalendar] = useState(false);
    
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

    const academicYears = ['2024-25', '2025-26', '2026-27'];

    // Fetch all semester configs on mount
    useEffect(() => {
        const fetchSemesters = async () => {
            try {
                const res = await fetch('/api/clerk/semesters');
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
            s => s.academic_year === academicYear && s.semester == semester
        );

        if (selected) {
            // Format YYYY-MM-DD from DB if they contain time
            setGenStartDate(selected.start_date.split('T')[0]);
            setGenEndDate(selected.end_date.split('T')[0]);

            let weekendPattern = [];
            if (typeof selected.weekend_pattern === 'string') {
                weekendPattern = JSON.parse(selected.weekend_pattern || '[]');
            } else if (Array.isArray(selected.weekend_pattern)) {
                weekendPattern = selected.weekend_pattern;
            }
            
            const newWeekendDays = { SUNDAY: false, MONDAY: false, TUESDAY: false, WEDNESDAY: false, THURSDAY: false, FRIDAY: false, SATURDAY: false };
            for(const day of weekendPattern) {
                if(day in newWeekendDays) {
                    newWeekendDays[day] = true;
                }
            }
            setWeekendDays(newWeekendDays);
        } else {
            // Reset if no data found for the selection
            setGenStartDate('');
            setGenEndDate('');
            setWeekendDays({ SUNDAY: true, MONDAY: false, TUESDAY: false, WEDNESDAY: false, THURSDAY: false, FRIDAY: false, SATURDAY: false });
        }
    }, [academicYear, semester, allSemesters]);

    const handleLoadCalendar = () => {
        if (academicYear && semester) {
            setShowCalendar(true);
        } else {
            toast.error('Please select an Academic Year and Semester first.');
        }
    };

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
            const res = await fetch('/api/clerk/academic-calendar/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    academic_year: academicYear,
                    semester,
                    start_date: genStartDate,
                    end_date: genEndDate,
                    weekend_days: selectedWeekendDays,
                }),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);
            toast.success('Calendar generated successfully! Loading view...');
            setShowCalendar(true); // Automatically show calendar on successful generation
        } catch (error) {
            toast.error(`Generation failed: ${error.message}`);
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
            toast.error('Holiday name is required for bulk holiday updates.');
            return;
        }
        setIsBulkUpdating(true);
        try {
            const res = await fetch('/api/clerk/academic-calendar/bulk-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    academic_year: academicYear,
                    semester,
                    start_date: bulkStartDate,
                    end_date: bulkEndDate,
                    day_type: bulkDayType,
                    holiday_name: bulkHolidayName,
                }),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);
            toast.success('Bulk update applied successfully! Calendar will refresh.');
            setShowCalendar(false); // Force re-fetch
            setTimeout(() => setShowCalendar(true), 100);
        } catch (error) {
            toast.error(`Bulk update failed: ${error.message}`);
        } finally {
            setIsBulkUpdating(false);
        }
    };
    
    return (
        <div className="min-h-screen bg-gray-100 flex flex-col">
            <Header />
            <Navbar role="clerk" />
            <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
                <div className="mb-8">
                    <h1 className="text-2xl md:text-3xl font-bold">Academic Calendar Management</h1>
                    <p className="text-gray-600">A structured way of managing the academic calendar.</p>
                </div>

                {/* Section 0: Calendar Selector */}
                <div className="bg-white p-4 rounded-lg shadow-md border mb-6">
                    <h2 className="text-lg font-bold text-gray-800 border-b pb-2 mb-4">Select Calendar</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label htmlFor="academicYear" className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
                            <select id="academicYear" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className="w-full p-2 border-gray-300 border rounded-md shadow-sm">
                                {academicYears.map(year => <option key={year} value={year}>{year}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="semester" className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                            <select id="semester" value={semester} onChange={(e) => setSemester(e.target.value)} className="w-full p-2 border-gray-300 border rounded-md shadow-sm">
                                <option value="1">1st Semester (Odd)</option>
                                <option value="2">2nd Semester (Even)</option>
                            </select>
                        </div>
                        <div className="self-end">
                            <button onClick={handleLoadCalendar} disabled={!academicYear || !semester} className="w-full px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-300">
                                View Calendar
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Section 1: Semester Setup */}
                    <div className="bg-white p-4 rounded-lg shadow-md border">
                        <h2 className="text-lg font-bold text-gray-800 border-b pb-2 mb-4">Section 1: Semester Setup</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="genStartDate" className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                                    <input type="date" id="genStartDate" value={genStartDate} onChange={(e) => setGenStartDate(e.target.value)} className="w-full p-2 border-gray-300 border rounded-md"/>
                                </div>
                                <div>
                                    <label htmlFor="genEndDate" className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                                    <input type="date" id="genEndDate" value={genEndDate} onChange={(e) => setGenEndDate(e.target.value)} className="w-full p-2 border-gray-300 border rounded-md"/>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Weekend Pattern</label>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                    {Object.keys(weekendDays).map(day => (
                                        <label key={day} className="flex items-center space-x-2 text-sm">
                                            <input type="checkbox" checked={weekendDays[day]} onChange={() => handleWeekendDayChange(day)} className="rounded"/>
                                            <span>{day.charAt(0) + day.slice(1).toLowerCase()}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <button onClick={handleGenerateCalendar} disabled={isGenerating} className="w-full px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300">
                                {isGenerating ? 'Generating...' : '[ Generate Calendar ]'}
                            </button>
                        </div>
                    </div>

                    {/* Section 2: Bulk Day Type Update */}
                    <div className="bg-white p-4 rounded-lg shadow-md border">
                        <h2 className="text-lg font-bold text-gray-800 border-b pb-2 mb-4">Section 2: Bulk Day Type Update</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="bulkStartDate" className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                                    <input type="date" id="bulkStartDate" value={bulkStartDate} onChange={(e) => setBulkStartDate(e.target.value)} className="w-full p-2 border-gray-300 border rounded-md"/>
                                </div>
                                <div>
                                    <label htmlFor="bulkEndDate" className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                                    <input type="date" id="bulkEndDate" value={bulkEndDate} onChange={(e) => setBulkEndDate(e.target.value)} className="w-full p-2 border-gray-300 border rounded-md"/>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="bulkDayType" className="block text-sm font-medium text-gray-700 mb-1">Day Type</label>
                                <select id="bulkDayType" value={bulkDayType} onChange={(e) => setBulkDayType(e.target.value)} className="w-full p-2 border-gray-300 border rounded-md">
                                    <option value="HOLIDAY">Holiday</option>
                                    <option value="EXAM">Exam Day</option>
                                    <option value="INTERNAL">Internal Test Day</option>
                                    <option value="EVENT">College Event</option>
                                    <option value="WORKING">Working Day</option>
                                </select>
                            </div>
                            {bulkDayType === 'HOLIDAY' && (
                                <div>
                                    <label htmlFor="bulkHolidayName" className="block text-sm font-medium text-gray-700 mb-1">Holiday Name</label>
                                    <input type="text" id="bulkHolidayName" value={bulkHolidayName} onChange={(e) => setBulkHolidayName(e.target.value)} placeholder="e.g., Summer Vacation" className="w-full p-2 border-gray-300 border rounded-md"/>
                                </div>
                            )}
                            <button onClick={handleBulkUpdate} disabled={isBulkUpdating} className="w-full px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-300">
                                {isBulkUpdating ? 'Applying...' : '[ Apply Range Update ]'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Section 3: Calendar Grid View */}
                {showCalendar && (
                    <div className="mt-6">
                        <CalendarGrid
                            academicYear={academicYear}
                            semester={semester}
                            key={`${academicYear}-${semester}`} 
                        />
                    </div>
                )}
            </main>
            <Footer />
        </div>
    );
}
