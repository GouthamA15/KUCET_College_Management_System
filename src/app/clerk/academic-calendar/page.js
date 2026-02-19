'use client';
import { useState } from 'react';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/app/components/Footer/Footer';
import CalendarGrid from '@/components/clerk/academic-calendar/CalendarGrid';

export default function AcademicCalendarPage() {
    const [academicYear, setAcademicYear] = useState('');
    const [semester, setSemester] = useState('');
    const [showCalendar, setShowCalendar] = useState(false);

    const academicYears = ['2024-2025', '2025-2026', '2026-2027']; // This should ideally come from a config or API

    const handleLoadCalendar = () => {
        if (academicYear && semester) {
            setShowCalendar(true);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col">
            <Header />
            <Navbar role="clerk" />
            <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
                <div className="mb-6">
                    <h1 className="text-2xl md:text-3xl font-bold">Academic Calendar Management</h1>
                    <p className="text-gray-600">Manage working days and holidays for the institution.</p>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
                    <div className="flex flex-col md:flex-row md:items-end md:gap-4">
                        <div className="flex-1 mb-4 md:mb-0">
                            <label htmlFor="academicYear" className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
                            <select
                                id="academicYear"
                                value={academicYear}
                                onChange={(e) => setAcademicYear(e.target.value)}
                                className="w-full p-2 border-gray-300 border rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="">Select Year</option>
                                {academicYears.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1 mb-4 md:mb-0">
                            <label htmlFor="semester" className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                            <select
                                id="semester"
                                value={semester}
                                onChange={(e) => setSemester(e.target.value)}
                                className="w-full p-2 border-gray-300 border rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="">Select Semester</option>
                                <option value="1">1st Semester</option>
                                <option value="2">2nd Semester</option>
                            </select>
                        </div>
                        <button
                            onClick={handleLoadCalendar}
                            disabled={!academicYear || !semester}
                            className="w-full md:w-auto px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-300"
                        >
                            Load Calendar
                        </button>
                    </div>
                </div>

                {showCalendar && (
                    <CalendarGrid
                        academicYear={academicYear}
                        semester={semester}
                    />
                )}
            </main>
            <Footer />
        </div>
    );
}
