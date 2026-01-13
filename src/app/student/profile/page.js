"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";

export default function StudentProfilePage() {
  const router = useRouter();
  const [student, setStudent] = useState(null);
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Load student from localStorage
    const stored = localStorage.getItem("logged_in_student");
    if (!stored) {
      router.replace("/");
      return;
    }
    const stu = JSON.parse(stored);
    setStudent(stu);
    setPhone(stu.phone_no || "");
  }, [router]);

  const handleEdit = () => {
    setEditing(true);
    setSuccess(false);
    setError("");
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

  const handleLogout = () => {
    localStorage.removeItem("logged_in_student");
    router.replace("/");
  };

  if (!student) return null;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <main className="max-w-lg mx-auto bg-white rounded-xl shadow-2xl p-8 mt-10 animate-slideDown">
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-[#0b3578]">Student Profile</h2>
          <button onClick={handleLogout} className="text-sm text-blue-700 hover:underline">Logout</button>
        </div>
        <div className="space-y-4">
          <div><span className="font-medium">Roll No:</span> {student.rollno}</div>
          <div><span className="font-medium">Name:</span> {student.student_name}</div>
          <div><span className="font-medium">Father Name:</span> {student.father_name}</div>
          <div><span className="font-medium">Gender:</span> {student.gender}</div>
          <div><span className="font-medium">Category:</span> {student.category}</div>
          <div>
            <span className="font-medium">Phone:</span>{" "}
            {editing ? (
              <>
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="ml-2 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-[#0b3578] focus:border-transparent text-gray-800"
                />
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="ml-2 px-3 py-1 bg-[#0b3578] text-white rounded hover:bg-[#0a2d66] text-sm"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => { setEditing(false); setPhone(student.phone_no || ""); }}
                  className="ml-2 px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                >Cancel</button>
              </>
            ) : (
              <>
                <span className="ml-2">{student.phone_no || <span className="text-gray-400">Not set</span>}</span>
                <button
                  onClick={handleEdit}
                  className="ml-2 px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
                >Edit</button>
              </>
            )}
            {success && <div className="text-green-600 text-sm mt-2">Phone updated successfully!</div>}
            {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
