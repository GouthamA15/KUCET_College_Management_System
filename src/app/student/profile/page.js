"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";


export default function StudentProfilePage() {
  const router = useRouter();
  const [student, setStudent] = useState(null);
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);


  useEffect(() => {
    const stored = localStorage.getItem("logged_in_student");
    if (!stored) {
      router.replace("/");
      return;
    }
    const stu = JSON.parse(stored);
    setStudent(stu);
    setPhone(stu.phone_no || "");

    // Prevent browser back navigation after login
    const handlePopState = () => {
      const studentData = localStorage.getItem("logged_in_student");
      if (!studentData) {
        router.replace("/");
        return;
      }
      // If authenticated, prevent going back to login/home
      const currentPath = window.location.pathname;
      if (currentPath.startsWith('/student')) {
        window.history.pushState(null, '', currentPath);
      }
    };
    // Overwrite the previous history entry so back does not go to home/login
    window.history.replaceState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("logged_in_student");
    sessionStorage.clear();
    router.replace("/");
  };

  const handleEdit = () => {
    setEditing(true);
    setSuccess(false);
    setError("");
  };

  const handleCancel = () => {
    setEditing(false);
    setPhone(student.phone_no || "");
    setError("");
    setSuccess(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const res = await fetch("/api/student/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollno: student.rollno, phone }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        setEditing(false);
        // Update localStorage and state
        const updated = { ...student, phone_no: phone };
        setStudent(updated);
        localStorage.setItem("logged_in_student", JSON.stringify(updated));
      } else {
        setError(data.error || "Update failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  if (!student) return null;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <Navbar studentProfileMode={true} onLogout={handleLogout} />

      {/* Centered Profile Card */}
      <main className="flex-1 flex flex-col items-center justify-center py-10 animate-slideDown">
        <section className="bg-white rounded-xl shadow-xl border border-blue-100 flex flex-row items-center px-12 py-8 min-w-[440px] max-w-xl mx-auto relative" style={{minHeight: 220}}>
          {/* Edit Icon */}
          {!editing && (
            <button
              onClick={handleEdit}
              className="absolute top-4 right-4 text-gray-400 hover:text-blue-700 transition-colors"
              title="Edit Phone Number"
              aria-label="Edit Phone Number"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487a2.1 2.1 0 1 1 2.97 2.97L7.5 19.789l-4 1 1-4 14.362-14.302ZM19 7l-2-2" />
              </svg>
            </button>
          )}
          {/* Avatar */}
          <div className="flex-shrink-0 flex items-center justify-center mr-8">
            <div className="w-28 h-28 rounded-full border-2 border-blue-200 bg-gray-100 flex items-center justify-center overflow-hidden">
              <img
                src="/assets/default-avatar.svg"
                alt="Profile Pic"
                className="w-24 h-24 object-cover rounded-full"
                draggable="false"
              />
            </div>
          </div>
          {/* Info */}
          <div className="flex flex-col justify-center text-left text-[#222] gap-1 w-full">
            <div className="font-mono text-base font-semibold tracking-wide">{student.rollno}</div>
            <div className="font-bold text-lg leading-tight">{student.student_name}</div>
            <div className="text-base text-gray-700">{student.father_name}</div>
            <div className="text-base text-gray-700 mb-2">Academic Year: <span className="font-semibold">2023–27</span></div>
            <div className="font-medium text-base mt-2 flex items-center">
              Phone: {editing ? (
                <>
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="ml-2 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-[#0b3578] focus:border-transparent text-gray-800 w-36"
                  />
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="ml-2 px-3 py-1 bg-[#0b3578] text-white rounded hover:bg-[#0a2d66] text-sm"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={handleCancel}
                    className="ml-2 px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                  >Cancel</button>
                </>
              ) : (
                <span className="ml-2 font-mono">{student.phone_no || <span className='text-gray-400'>Not set</span>}</span>
              )}
            </div>
            {success && <div className="text-green-600 text-sm mt-2">Phone updated successfully!</div>}
            {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

  // ...all logic and UI moved above...
