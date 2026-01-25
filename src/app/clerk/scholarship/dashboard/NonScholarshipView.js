// src/app/clerk/scholarship/dashboard/NonScholarshipView.js
"use client";

export default function NonScholarshipView({ student }) {
  return (
    <div className="p-4 border rounded-md bg-gray-50">
      <h3 className="text-lg font-semibold mb-2">Non-Scholarship Student</h3>
      <p>
        Student <span className="font-bold">{student.name}</span> (Roll No:{" "}
        <span className="font-bold">{student.roll_no}</span>) is not a scholarship
        recipient.
      </p>
    </div>
  );
}