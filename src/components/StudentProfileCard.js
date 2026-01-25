// A compact student profile card for admin view
'use client';

export default function StudentProfileCard({ student }) {
  if (!student) return null;
  return (
    <div className="w-full max-w-xs mx-auto bg-gray-50 rounded-lg shadow p-4 space-y-2 text-sm">
      <div><span className="font-medium">Roll No:</span> {student.roll_no}</div>
      <div><span className="font-medium">Name:</span> {student.name}</div>
      <div><span className="font-medium">Father Name:</span> {(student.personal_details && student.personal_details.father_name) || student.father_name}</div>
      <div><span className="font-medium">Gender:</span> {student.gender}</div>
      <div><span className="font-medium">Category:</span> {student.category}</div>
      <div><span className="font-medium">Phone:</span> {student.mobile}</div>
      <div><span className="font-medium">Admission No:</span> {student.admission_no}</div>
      <div><span className="font-medium">Mother Name:</span> {(student.personal_details && student.personal_details.mother_name) || student.mother_name}</div>
      <div><span className="font-medium">DOB:</span> {student.date_of_birth}</div>
      <div><span className="font-medium">Nationality:</span> {student.nationality}</div>
      <div><span className="font-medium">Religion:</span> {student.religion}</div>
      <div><span className="font-medium">Caste:</span> {student.caste}</div>
      <div><span className="font-medium">Sub Caste:</span> {student.sub_caste}</div>
      <div><span className="font-medium">Address:</span> {(student.personal_details && student.personal_details.address) || student.address}</div>
      <div><span className="font-medium">Email:</span> {student.email}</div>
      <div><span className="font-medium">Qualifying Exam:</span> {student.qualifying_exam}</div>
      <div><span className="font-medium">Scholarship:</span> {student.scholarship_status}</div>
      <div><span className="font-medium">Fee Details:</span> {student.fee_payment_details}</div>
      {/* Add more fields if needed */}
    </div>
  );
}
