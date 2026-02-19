'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const EditDayModal = ({ day, data, academicYear, semester, onClose, onSave }) => {
    const [isWorkingDay, setIsWorkingDay] = useState(data?.is_working_day || false);
    const [isHoliday, setIsHoliday] = useState(data?.is_holiday || false);
    const [holidayName, setHolidayName] = useState(data?.holiday_name || '');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        setIsWorkingDay(data?.is_working_day || false);
        setIsHoliday(data?.is_holiday || false);
        setHolidayName(data?.holiday_name || '');
    }, [data]);

    const handleWorkingDayToggle = () => {
        setIsWorkingDay(prev => {
            if (!prev) setIsHoliday(false);
            return !prev;
        });
    };

    const handleHolidayToggle = () => {
        setIsHoliday(prev => {
            if (!prev) setIsWorkingDay(false);
            return !prev;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        const date = `${day.year}-${String(day.month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;

        try {
            const res = await fetch('/api/clerk/academic-calendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date,
                    academic_year: academicYear,
                    semester,
                    is_working_day: isWorkingDay,
                    is_holiday: isHoliday,
                    holiday_name: isHoliday ? holidayName : null,
                }),
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Failed to update calendar');
            
            toast.success('Calendar updated successfully');
            onSave();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full animate-in fade-in zoom-in duration-200">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b">
                        <h3 className="text-xl font-bold">Edit Date</h3>
                        <p className="text-gray-500">{`${String(day.day).padStart(2, '0')}-${String(day.month).padStart(2, '0')}-${day.year}`}</p>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-md border">
                            <label htmlFor="isWorkingDay" className="font-medium text-gray-700">Mark as Working Day</label>
                            <input
                                type="checkbox"
                                id="isWorkingDay"
                                checked={isWorkingDay}
                                onChange={handleWorkingDayToggle}
                                className="h-6 w-6 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                        </div>
                        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-md border">
                            <label htmlFor="isHoliday" className="font-medium text-gray-700">Mark as Holiday</label>
                            <input
                                type="checkbox"
                                id="isHoliday"
                                checked={isHoliday}
                                onChange={handleHolidayToggle}
                                className="h-6 w-6 text-red-600 border-gray-300 rounded focus:ring-red-500"
                            />
                        </div>
                        {isHoliday && (
                            <div className="mt-4">
                                <label htmlFor="holidayName" className="block text-sm font-medium text-gray-700 mb-1">Holiday Name</label>
                                <input
                                    type="text"
                                    id="holidayName"
                                    value={holidayName}
                                    onChange={(e) => setHolidayName(e.target.value)}
                                    className="w-full p-2 border-gray-300 border rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    required
                                    placeholder="e.g., Christmas Day"
                                />
                            </div>
                        )}
                    </div>
                    <div className="p-6 bg-gray-50 flex justify-end gap-3 rounded-b-lg">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-md hover:bg-gray-50">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:bg-indigo-300"
                        >
                            {submitting ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditDayModal;
