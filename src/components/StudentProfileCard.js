// A compact student profile card for admin view
'use client';

export default function StudentProfileCard({ student }) {
  if (!student) return null;
  return (
    <div className="w-full max-w-xs mx-auto bg-gray-50 rounded-lg shadow p-4 space-y-2 text-sm">
      <div><span className="font-medium">Roll No:</span> {student.roll_no}</div>
      <div><span className="font-medium">Name:</span> {student.name}</div>
      <div><span className="font-medium">Father Name:</span> {student.father_name}</div>
      <div><span className="font-medium">Gender:</span> {student.gender}</div>
      <div><span className="font-medium">Category:</span> {student.category}</div>
      <div><span className="font-medium">Phone:</span> {student.phone}</div>
      {/* Add more fields if needed */}
    </div>
  );
}
