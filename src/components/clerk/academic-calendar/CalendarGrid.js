'use client';
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import EditDayModal from './EditDayModal';

const CalendarGrid = ({ academicYear, semester }) => {
    const today = new Date();
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1); // 1-12
    const [calendarData, setCalendarData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDay, setSelectedDay] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchCalendarData = useCallback(async () => {
        setLoading(true);
        const month = currentMonth;
        const year = currentYear;
        try {
            const res = await fetch(`/api/clerk/academic-calendar?academic_year=${academicYear}&semester=${semester}&month=${month}&year=${year}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch calendar data');
            const dataMap = data.data.reduce((acc, item) => {
                const dayNumber = parseInt(String(item.date).split('-')[2], 10);
                if (!Number.isNaN(dayNumber)) acc[dayNumber] = item;
                return acc;
            }, {});
            setCalendarData(dataMap);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    }, [academicYear, semester, currentMonth, currentYear]);

    useEffect(() => {
        fetchCalendarData();
    }, [fetchCalendarData]);

    const handleDayClick = (dayObj) => {
        console.log('Clicked:', dayObj);
        setSelectedDay({ ...dayObj });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedDay(null);
    };

    const handleSave = () => {
        fetchCalendarData();
        handleCloseModal();
    }

    const changeMonth = (offset) => {
        setCurrentMonth(prev => {
            let newMonth = prev + offset;
            if (newMonth > 12) {
                setCurrentYear(y => y + 1);
                newMonth = 1;
            } else if (newMonth < 1) {
                setCurrentYear(y => y - 1);
                newMonth = 12;
            }
            return newMonth;
        });
    };

    const generateGrid = () => {
        const year = currentYear;
        const monthIndex = currentMonth - 1;
        const firstDay = new Date(year, monthIndex, 1).getDay();
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

        const grid = [];
        let dayCounter = 1;

        for (let i = 0; i < 6; i++) {
            const week = [];
            for (let j = 0; j < 7; j++) {
                if ((i === 0 && j < firstDay) || dayCounter > daysInMonth) {
                    week.push(<div key={`${i}-${j}`} className="border p-2 h-24 bg-gray-50"></div>);
                } else {
                    const dayNum = dayCounter; // capture to avoid closure on mutated counter
                    const dayData = calendarData[dayNum];
                    let bgColor = 'bg-white';
                    if (dayData?.is_holiday) bgColor = 'bg-red-100';
                    else if (j === 0) bgColor = 'bg-gray-100'; // Sunday

                    const now = new Date();
                    const isToday = now.getFullYear() === year && now.getMonth() === monthIndex && now.getDate() === dayCounter;

                    week.push(
                        <div
                            key={`${i}-${j}`}
                            className={`border p-2 h-24 cursor-pointer hover:bg-indigo-50 ${bgColor}`}
                            onClick={() => handleDayClick({ day: dayNum, month: currentMonth, year: currentYear })}
                        >
                            <span className={`font-bold ${isToday ? 'text-indigo-600' : 'text-gray-800'}`}>{dayNum}</span>
                            {dayData && (
                                <div className="text-xs mt-1">
                                    {dayData.is_holiday ? <span className="font-semibold text-red-700">{dayData.holiday_name}</span> : <span className="font-semibold text-green-700">Working</span>}
                                </div>
                            )}
                        </div>
                    );
                    dayCounter++;
                }
            }
            if (week.some(d => d.props.children)) grid.push(week);
        }
        return grid;
    };

    const handleMarkAllSundays = async () => {
        const year = currentYear;
        const monthIndex = currentMonth - 1;
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        const sundays = [];

        for (let day = 1; day <= daysInMonth; day++) {
            const jsDate = new Date(year, monthIndex, day);
            if (jsDate.getDay() === 0) { // It's a Sunday
                const isoDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                sundays.push(isoDate);
            }
        }

        if (sundays.length === 0) {
            toast.success("No Sundays to mark in this month.");
            return;
        }

        if (!confirm(`Are you sure you want to mark all ${sundays.length} Sundays in this month as holidays?`)) {
            return;
        }

        setLoading(true);
        try {
            const promises = sundays.map(date =>
                fetch('/api/clerk/academic-calendar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        date,
                        academic_year: academicYear,
                        semester,
                        is_working_day: false,
                        is_holiday: true,
                        holiday_name: 'Sunday',
                    }),
                }).then(res => {
                    if (!res.ok) return res.json().then(err => Promise.reject(err));
                    return res.json();
                })
            );

            await Promise.all(promises);
            toast.success(`${sundays.length} Sundays marked as holidays.`);
            fetchCalendarData();
        } catch (error) {
            toast.error(error.error || 'Failed to mark some Sundays.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                <div className="flex items-center gap-2">
                    <button onClick={() => changeMonth(-1)} className="px-4 py-2 bg-gray-200 rounded-md">← Prev</button>
                    <h2 className="text-xl font-bold text-center">{new Date(currentYear, currentMonth - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                    <button onClick={() => changeMonth(1)} className="px-4 py-2 bg-gray-200 rounded-md">Next →</button>
                </div>
                <button
                    onClick={handleMarkAllSundays}
                    className="w-full md:w-auto px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                >
                    Mark All Sundays as Holiday
                </button>
            </div>
            {loading ? (
                <div className="text-center py-10">Loading calendar...</div>
            ) : (
                <div className="grid grid-cols-7">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="text-center font-bold border-b p-2 bg-gray-50">{day}</div>
                    ))}
                    {generateGrid().map((week, i) => week.map(day => day))}
                </div>
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
