"use client";
import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";

const DAY_TYPE_STYLES = {
  WORKING: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-800",
  },
  HOLIDAY: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
  },
  EXAM: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
  },
  EVENT: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-800",
  },
};

function formatMonthYear(year, month) {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleString("default", { month: "long", year: "numeric" });
}

function compareYearMonth(aYear, aMonth, bYear, bMonth) {
  if (aYear === bYear && aMonth === bMonth) return 0;
  if (aYear < bYear || (aYear === bYear && aMonth < bMonth)) return -1;
  return 1;
}

export default function FacultyAcademicCalendar({ assignment, selectedDate, onSelectDate, attendanceSectionId }) {
  const [todayString] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });

  const [semesterStartDate, setSemesterStartDate] = useState(null);
  const [semesterEndDate, setSemesterEndDate] = useState(null);
  const [calendarData, setCalendarData] = useState({}); // key: YYYY-MM-DD
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth() + 1); // 1-12
  const [loading, setLoading] = useState(true);

  const academicYear = assignment?.academic_year;
  const courseSemester = assignment?.course_semester;
  const academicTerm = assignment?.academic_term ?? null;

  const fetchSemesterWindow = useCallback(async () => {
    if (!academicYear || !academicTerm) return;
    try {
      const res = await fetch(`/api/clerk/semesters?academic_year=${encodeURIComponent(academicYear)}&semester=${encodeURIComponent(academicTerm)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch semester window");

        if (data.data && data.data.length > 0) {
        const sem = data.data[0];
        const start = typeof sem.start_date === "string" ? sem.start_date.split("T")[0] : null;
        const end = typeof sem.end_date === "string" ? sem.end_date.split("T")[0] : null;
        setSemesterStartDate(start);
        setSemesterEndDate(end);

        if (start && end) {
          const [sYear, sMonth] = start.split("-").map((p) => parseInt(p, 10));
          const [eYear, eMonth] = end.split("-").map((p) => parseInt(p, 10));
            const now = new Date();
            const nowYear = now.getFullYear();
            const nowMonth = now.getMonth() + 1;
            let initYear = nowYear;
            let initMonth = nowMonth;

            if (compareYearMonth(nowYear, nowMonth, sYear, sMonth) < 0) {
              initYear = sYear;
              initMonth = sMonth;
            } else if (compareYearMonth(nowYear, nowMonth, eYear, eMonth) > 0) {
              initYear = eYear;
              initMonth = eMonth;
            }

            setCurrentYear(initYear);
            setCurrentMonth(initMonth);
        }
      }
    } catch (error) {
      toast.error(error.message);
    }
  }, [academicYear, academicTerm]);

  const fetchCalendar = useCallback(async () => {
    if (!academicYear || !academicTerm || !currentMonth || !currentYear) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/clerk/academic-calendar?academic_year=${encodeURIComponent(academicYear)}&semester=${encodeURIComponent(
          academicTerm
        )}&month=${currentMonth}&year=${currentYear}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load academic calendar");

      const map = {};
      (data.data || []).forEach((row) => {
        const key = typeof row.date === "string" ? row.date.split("T")[0] : row.date;
        if (!key) return;
        map[key] = {
          day_type: row.day_type || "WORKING",
          holiday_name: row.holiday_name || null,
        };
      });
      setCalendarData(map);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [academicYear, academicTerm, currentMonth, currentYear]);

  useEffect(() => {
    // If academicTerm is not provided by the assignment, avoid leaving the
    // component stuck in loading state. Show nothing and skip fetches.
    if (!academicYear || !academicTerm) {
      setLoading(false);
      return;
    }

    fetchSemesterWindow();
  }, [fetchSemesterWindow, academicYear, academicTerm]);

  useEffect(() => {
    if (!academicYear || !academicTerm) {
      setLoading(false);
      return;
    }

    fetchCalendar();
  }, [fetchCalendar, academicYear, academicTerm]);

  const isWithinSemester = (dateStr) => {
    if (!semesterStartDate || !semesterEndDate || !dateStr) return true;
    return dateStr >= semesterStartDate && dateStr <= semesterEndDate;
  };

  const isFutureDate = (dateStr) => {
    if (!dateStr) return false;
    return dateStr > todayString;
  };

  const changeMonth = (offset) => {
    setCurrentMonth((prevMonth) => {
      let newMonth = prevMonth + offset;
      let newYear = currentYear;
      if (newMonth > 12) {
        newMonth = 1;
        newYear += 1;
      } else if (newMonth < 1) {
        newMonth = 12;
        newYear -= 1;
      }

      if (semesterStartDate && semesterEndDate) {
        const [sYear, sMonth] = semesterStartDate.split("-").map((p) => parseInt(p, 10));
        const [eYear, eMonth] = semesterEndDate.split("-").map((p) => parseInt(p, 10));
        if (compareYearMonth(newYear, newMonth, sYear, sMonth) < 0) {
          return prevMonth;
        }
        if (compareYearMonth(newYear, newMonth, eYear, eMonth) > 0) {
          return prevMonth;
        }
      }

      setCurrentYear(newYear);
      return newMonth;
    });
  };

  const handleDayClick = async (dateStr) => {
    if (!isWithinSemester(dateStr)) return;

    if (isFutureDate(dateStr)) {
      toast.error("Attendance for future dates is not allowed.");
      return;
    }

    try {
      const res = await fetch(
        `/api/public/academic-calendar/day-info?date=${dateStr}&academic_year=${encodeURIComponent(
          academicYear
        )}&semester=${encodeURIComponent(academicTerm)}`
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Could not verify day type");
      const serverDayInfo = result.data;

      if (serverDayInfo.day_type !== "WORKING") {
        let reason = serverDayInfo.day_type;
        if (serverDayInfo.day_type === "HOLIDAY" && serverDayInfo.holiday_name) {
          reason = `${serverDayInfo.day_type}: ${serverDayInfo.holiday_name}`;
        }
        toast.error(`Attendance not allowed: ${reason}`);
        return;
      }

      if (onSelectDate) {
        onSelectDate(dateStr, serverDayInfo);
      }

      if (attendanceSectionId) {
        // Scroll after state update so the view focuses slightly below the top
        // (keeping the ATTENDANCE ENTRY label near the top and rows visible).
        setTimeout(() => {
          const el = document.getElementById(attendanceSectionId);
          if (!el || typeof window === "undefined") return;

          const rect = el.getBoundingClientRect();
          // Scroll so the attendance entry section starts at the very top
          // of the viewport, ensuring the calendar UI is completely above
          // (out of view) on mobile.
          const headerOffset = 0; // px
          const targetY = window.scrollY + rect.top - headerOffset;

          window.scrollTo({ top: targetY < 0 ? 0 : targetY, behavior: "smooth" });
        }, 0);
      }
    } catch (error) {
      toast.error(error.message || "Could not validate day");
    }
  };

  const renderGridCells = () => {
    const monthIndex = currentMonth - 1;
    const firstDayOfWeek = new Date(currentYear, monthIndex, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

    const cells = [];
    const totalCells = 42; // 6 weeks

    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - firstDayOfWeek + 1;

      if (dayNum <= 0 || dayNum > daysInMonth) {
        cells.push(<div key={`empty-${i}`} className="border-b border-r bg-gray-50" />);
        continue;
      }

      const dayStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      const isToday = dayStr === todayString;
      const withinSemester = isWithinSemester(dayStr);
      const isFuture = isFutureDate(dayStr);
      const dayData = calendarData[dayStr] || { day_type: "WORKING", holiday_name: null };

      const style = DAY_TYPE_STYLES[dayData.day_type] || {
        bg: "bg-white",
        border: "border-gray-200",
        text: "text-gray-700",
      };

      const baseClasses = withinSemester
        ? isFuture
          ? `${style.bg} ${style.border} ${style.text} cursor-not-allowed opacity-60`
          : `${style.bg} ${style.border} ${style.text} cursor-pointer hover:bg-gray-100`
        : "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60";

      cells.push(
        <button
          key={dayStr}
          type="button"
          onClick={() => withinSemester && !isFuture && handleDayClick(dayStr)}
          className={`relative border-b border-r px-2 py-1 text-left text-xs flex flex-col gap-1 ${baseClasses}`}
        >
          <span className="font-semibold text-sm">{dayNum}</span>
          {dayData.day_type !== "WORKING" && withinSemester && !isFuture && (
            <span className="text-[10px] font-semibold uppercase tracking-wide">
              {dayData.day_type === "HOLIDAY" && dayData.holiday_name
                ? dayData.holiday_name
                : dayData.day_type}
            </span>
          )}
          {isToday && withinSemester && !isFuture && (
            <span className="absolute inset-0 border-2 border-gray-700 pointer-events-none" />
          )}
          {selectedDate === dayStr && (
            <span className="absolute inset-x-1 bottom-1 h-0.5 bg-gray-800" />
          )}
        </button>
      );
    }

    return cells;
  };

  const renderLegend = () => (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-700 border-t border-b bg-gray-50 px-3 py-2">
      <span className="font-semibold mr-2">DAY TYPES</span>
      <div className="flex items-center gap-1">
        <span className="w-3 h-3 rounded-sm bg-green-50 border border-green-200" />
        <span>Working</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="w-3 h-3 rounded-sm bg-red-50 border border-red-200" />
        <span>Holiday</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="w-3 h-3 rounded-sm bg-blue-50 border border-blue-200" />
        <span>Exam</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="w-3 h-3 rounded-sm bg-yellow-50 border border-yellow-200" />
        <span>Event</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="w-3 h-3 rounded-sm bg-gray-200 border border-gray-300" />
        <span>Outside Semester</span>
      </div>
    </div>
  );

  return (
    <section className="bg-white border-2 border-gray-200 rounded-lg mb-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between px-4 py-3 border-b border-gray-200 gap-3">
        <div>
          <p className="text-[11px] font-bold text-gray-500 tracking-[0.15em] uppercase">
            FACULTY ACADEMIC CALENDAR
          </p>
            <p className="text-sm font-semibold text-gray-800 mt-1">
              {academicYear} • Semester {courseSemester}{academicTerm ? ` (Term ${academicTerm})` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            className="px-2 py-1 border border-gray-300 bg-gray-100 hover:bg-gray-200 uppercase"
          >
            PREV
          </button>
          <div className="min-w-[140px] text-center text-sm font-bold">
            {formatMonthYear(currentYear, currentMonth)}
          </div>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            className="px-2 py-1 border border-gray-300 bg-gray-100 hover:bg-gray-200 uppercase"
          >
            NEXT
          </button>
        </div>
      </header>

      {!academicTerm && (
        <div className="px-4 py-3 text-sm text-yellow-700 bg-yellow-50 border-t border-b border-yellow-100">
          Academic term not available for this assignment. Calendar is disabled until the assignment includes an `academic_term` value.
        </div>
      )}

      {renderLegend()}

      {loading ? (
        <div className="px-4 py-8 text-center text-sm text-gray-600">Loading calendar…</div>
      ) : (
        <div className="hidden md:grid md:grid-cols-7 border-t border-gray-200 text-xs">
          {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
            <div
              key={d}
              className="border-b border-r bg-gray-50 px-2 py-1 text-center text-[11px] font-semibold text-gray-600 tracking-wide"
            >
              {d}
            </div>
          ))}
          {renderGridCells()}
        </div>
      )}

      {!loading && (
        <div className="md:hidden border-t border-gray-200 text-sm">
          {[...Array(new Date(currentYear, currentMonth, 0).getDate()).keys()].map((i) => {
            const dayNum = i + 1;
            const dayStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
            const withinSemester = isWithinSemester(dayStr);
            const isFuture = isFutureDate(dayStr);
            const isToday = dayStr === todayString;
            const dayData = calendarData[dayStr] || { day_type: "WORKING", holiday_name: null };
            const style = DAY_TYPE_STYLES[dayData.day_type] || {
              bg: "bg-white",
              border: "border-gray-200",
              text: "text-gray-700",
            };

            const rowClasses = !withinSemester
              ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60"
              : isFuture
              ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60"
              : `${style.bg} ${style.border} ${style.text} cursor-pointer`;

            const weekday = new Date(currentYear, currentMonth - 1, dayNum).toLocaleDateString("en-US", {
              weekday: "long",
            });

            return (
              <button
                key={dayStr}
                type="button"
                onClick={() => withinSemester && !isFuture && handleDayClick(dayStr)}
                className={`w-full flex items-center justify-between px-3 py-2 border-b ${rowClasses}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center justify-center w-10">
                    <span className="text-base font-bold">{dayNum}</span>
                    {isToday && <span className="mt-0.5 h-1 w-1 rounded-full bg-gray-700" />}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold text-gray-700">{weekday}</p>
                    {dayData.day_type !== "WORKING" && withinSemester && (
                      <p className="text-[11px] font-semibold">
                        {dayData.day_type === "HOLIDAY" && dayData.holiday_name
                          ? dayData.holiday_name
                          : dayData.day_type}
                      </p>
                    )}
                  </div>
                </div>
                {selectedDate === dayStr && <span className="text-[10px] font-semibold text-gray-700">SELECTED</span>}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
