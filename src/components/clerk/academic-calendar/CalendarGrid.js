'use client';
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getNowSync } from '@/lib/clock';
import EditDayModal from './EditDayModal';

const dayTypeColors = {
    'WORKING': { bg: 'bg-white', text: 'text-gray-800' },
    'HOLIDAY': { bg: 'bg-[#fbeaea]', text: 'text-red-700' },
    'EXAM': { bg: 'bg-[#fff7d6]', text: 'text-amber-700' },
    'INTERNAL': { bg: 'bg-[#f3ecff]', text: 'text-purple-700' },
    'EVENT': { bg: 'bg-[#e8f4ff]', text: 'text-blue-700' },
};

const Legend = () => (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mb-4 px-4 text-xs text-gray-600">
        {Object.entries(dayTypeColors).map(([type, { bg }]) => (
            <div key={type} className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${bg} border`}></span>
                <span>{type.charAt(0) + type.slice(1).toLowerCase()}</span>
            </div>
        ))}
        <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-gray-200 border"></span>
            <span>Outside Semester</span>
        </div>
    </div>
);

const CalendarGrid = ({ academicYear, semester }) => {
    const [todayString] = useState(getNowSync().toISOString().split('T')[0]);
    const [currentYear, setCurrentYear] = useState(() => getNowSync().getFullYear());
    const [currentMonth, setCurrentMonth] = useState(() => getNowSync().getMonth() + 1); // 1-12
    const [calendarData, setCalendarData] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedDay, setSelectedDay] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [daysInMonthArray, setDaysInMonthArray] = useState([]);
    const [semesterStartDate, setSemesterStartDate] = useState(null);
    const [semesterEndDate, setSemesterEndDate] = useState(null);

    const makeUtcDate = (year, monthIndex, day) => new Date(Date.UTC(year, monthIndex, day));
    const formatMonthYear = (year, monthIndex) => {
        try {
            return new Intl.DateTimeFormat('en-IN', {
                timeZone: 'Asia/Kolkata',
                month: 'long',
                year: 'numeric',
            }).format(makeUtcDate(year, monthIndex, 1));
        } catch {
            return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
        }
    };
    const formatWeekday = (year, monthIndex, day) => {
        try {
            return new Intl.DateTimeFormat('en-US', {
                timeZone: 'Asia/Kolkata',
                weekday: 'long',
            }).format(makeUtcDate(year, monthIndex, day));
        } catch {
            return '';
        }
    };

    const fetchCalendarData = useCallback(async () => {
        if (!academicYear || !semester) return;
        setLoading(true);
        try {
            // Fetch calendar day data
            const calendarRes = await fetch(`/api/clerk/academic-calendar?academic_year=${academicYear}&semester=${semester}&month=${currentMonth}&year=${currentYear}`);
            const calendarDataJson = await calendarRes.json();
            if (!calendarRes.ok) throw new Error(calendarDataJson.error || 'Failed to fetch calendar data');
            const dataMap = calendarDataJson.data.reduce((acc, item) => {
                const dayNumber = parseInt(item.date.split('-')[2], 10);
                if (!Number.isNaN(dayNumber)) acc[dayNumber] = item;
                return acc;
            }, {});
            setCalendarData(dataMap);

            // Fetch semester start and end dates
            const semesterRes = await fetch(`/api/clerk/semesters?academic_year=${academicYear}&semester=${semester}`);
            const semesterDataJson = await semesterRes.json();
            if (!semesterRes.ok) throw new Error(semesterDataJson.error || 'Failed to fetch semester dates');

            if (semesterDataJson.data && semesterDataJson.data.length > 0) {
                setSemesterStartDate(semesterDataJson.data[0].start_date);
                setSemesterEndDate(semesterDataJson.data[0].end_date);
            } else {
                setSemesterStartDate(null);
                setSemesterEndDate(null);
            }

            const days = new Date(currentYear, currentMonth, 0).getDate();
            const monthArray = Array.from({ length: days }, (_, i) => i + 1);
            setDaysInMonthArray(monthArray);

        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    }, [academicYear, semester, currentMonth, currentYear]);

    useEffect(() => {
        const id = setTimeout(() => {
            fetchCalendarData();
        }, 0);
        return () => clearTimeout(id);
    }, [fetchCalendarData]);

    const handleDayClick = (dayNum) => {
        setSelectedDay({ day: dayNum, month: currentMonth, year: currentYear });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => setIsModalOpen(false);
    const handleSave = () => {
        fetchCalendarData();
        handleCloseModal();
    }

    const changeMonth = (offset) => {
        setCurrentMonth(prev => {
            let newMonth = prev + offset;
            let newYear = currentYear;
            if (newMonth > 12) { newYear++; newMonth = 1; } 
            else if (newMonth < 1) { newYear--; newMonth = 12; }
            setCurrentYear(newYear);
            return newMonth;
        });
    };

    const generateGrid = () => {
        const monthIndex = currentMonth - 1;
        const firstDayOfWeek = new Date(currentYear, monthIndex, 1).getDay(); // 0=Sun, 1=Mon...
        const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

        const gridCells = [];
        const totalCells = 42; // 6 weeks * 7 days

        for (let i = 0; i < totalCells; i++) {
            const dayNum = i - firstDayOfWeek + 1;

            if (dayNum > 0 && dayNum <= daysInMonth) {
                // Current month's day
                const dayData = calendarData[dayNum] || { day_type: 'WORKING' };
                let { bg, text } = dayTypeColors[dayData.day_type];
                const dayString = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const isToday = dayString === todayString;
                
                const isOutsideSemesterRange = semesterStartDate && semesterEndDate && (dayString < semesterStartDate || dayString > semesterEndDate);

                if (isOutsideSemesterRange) {
                    bg = 'bg-gray-200'; // Override background for out-of-semester days
                    text = 'text-gray-500'; // Dim text for out-of-semester days
                }

                gridCells.push(
                    <div
                        key={`current-${dayNum}`}
                        className={`border-b border-r p-2 flex flex-col h-24 md:h-32 group relative ${bg} ${isOutsideSemesterRange ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer group-hover:border-indigo-400'}`}
                        onClick={isOutsideSemesterRange ? undefined : () => handleDayClick(dayNum)}
                    >
                        <span className={`text-sm font-bold ${isToday && !isOutsideSemesterRange ? 'text-indigo-600' : text}`}>{dayNum}</span>
                        <div className="mt-1 text-xs overflow-hidden">
                            {dayData.day_type !== 'WORKING' && !isOutsideSemesterRange && (
                                <span className={`font-semibold ${text}`}>
                                    {dayData.day_type === 'HOLIDAY' ? dayData.holiday_name : dayData.day_type}
                                </span>
                            )}
                        </div>
                        {isToday && !isOutsideSemesterRange && <div className="absolute inset-0 border-2 border-indigo-500 pointer-events-none"></div>}
                        {!isOutsideSemesterRange && <div className="absolute inset-0 border-2 border-transparent group-hover:border-indigo-400 pointer-events-none"></div>}
                    </div>
                );
            } else {
                // Day outside of current month
                gridCells.push(
                    <div key={`outside-${i}`} className="border-b border-r bg-gray-100 opacity-50"></div>
                );
            }
        }
        return gridCells;
    };

    return (
        <div className="bg-white border max-w-7xl mx-auto w-full shadow-sm">
            {/* Header Bar */}
            <div className="flex flex-col md:flex-row justify-between items-center p-4 border-b">
                <h2 className="text-lg font-bold text-gray-800 mb-2 md:mb-0">
                    Academic Calendar – {academicYear} | Semester {semester}
                </h2>
                <div className="flex items-center gap-1">
                    <button onClick={() => changeMonth(-1)} className="px-3 py-1 bg-gray-200 hover:bg-gray-300 border border-gray-300">◀</button>
                    <h3 className="text-base font-bold text-center w-40">{formatMonthYear(currentYear, currentMonth - 1)}</h3>
                    <button onClick={() => changeMonth(1)} className="px-3 py-1 bg-gray-200 hover:bg-gray-300 border border-gray-300">▶</button>
                </div>
            </div>

            {/* Legend Bar */}
            <Legend />

            {loading ? <div className="text-center py-20">Loading calendar...</div>
            : (
                <>
                    {/* Desktop Grid View */}
                    <div className="hidden md:grid md:grid-cols-7 border-t">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="text-center font-bold text-xs text-gray-500 p-2 border-b border-r bg-gray-50">{day}</div>
                        ))}
                        {generateGrid()}
                    </div>

                    {/* Mobile List View */}
                    <div className="md:hidden border-t">
                        {daysInMonthArray.map(dayNum => {
                             const dayData = calendarData[dayNum] || { day_type: 'WORKING' };
                             let { bg, text } = dayTypeColors[dayData.day_type];
                                const dateStr = formatWeekday(currentYear, currentMonth - 1, dayNum);
                             const dayString = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                             const isToday = dayString === todayString;

                             const isOutsideSemesterRange = semesterStartDate && semesterEndDate && (dayString < semesterStartDate || dayString > semesterEndDate);

                            if (isOutsideSemesterRange) {
                                bg = 'bg-gray-200'; // Override background for out-of-semester days
                                text = 'text-gray-500'; // Dim text for out-of-semester days
                            }

                             return (
                                <div 
                                    key={`mobile-${dayNum}`} 
                                    className={`flex items-center justify-between p-3 border-b ${bg} ${isOutsideSemesterRange ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${isToday && !isOutsideSemesterRange ? 'border-l-4 border-indigo-500' : ''}`} 
                                    onClick={isOutsideSemesterRange ? undefined : () => handleDayClick(dayNum)}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold text-lg">{dayNum}</span>
                                        <div>
                                            <p className="font-semibold text-gray-700">{dateStr}</p>
                                            {dayData.day_type !== 'WORKING' && !isOutsideSemesterRange && (
                                                <p className={`text-xs font-bold ${text}`}>{dayData.day_type === 'HOLIDAY' ? dayData.holiday_name : dayData.day_type}</p>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-gray-400">▶</span>
                                </div>
                             )
                        })}
                    </div>
                </>
            )}

            {isModalOpen && selectedDay && (
                <EditDayModal
                    day={selectedDay}
                    data={calendarData[selectedDay.day]}
                    academicYear={academicYear}
                    semester={semester}
                    onClose={handleCloseModal}
                    onSave={handleSave}
                />
            )}
        </div>
    );
};

export default CalendarGrid;
