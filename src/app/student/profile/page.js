'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/components/Footer';
import Image from 'next/image';
import { getBranchFromRoll, getCurrentStudyingYear, getCurrentAcademicYear } from '@/lib/rollNumber';
import { formatDate } from '@/lib/date';
import { computeAcademicYear, isYearAllowed } from '@/app/lib/academicYear';

export default function StudentProfileNew() {
  const router = useRouter();
  const [studentData, setStudentData] = useState(null);
  const [activeTab, setActiveTab] = useState('personal');

  const fetchProfile = useCallback(async (rollno) => {
    try {
      const res = await fetch(`/api/student/${rollno}`);
      const data = await res.json();
      if (res.ok) {
        setStudentData(data);
      } else {
        router.replace('/');
      }
    } catch (e) {
      router.replace('/');
    }
  }, [router]);

  useEffect(() => {
    const load = async () => {
      try {
        const me = await fetch('/api/student/me');
        if (!me.ok) {
          router.replace('/');
          return;
        }
        const user = await me.json();
        await fetchProfile(user.roll_no);
      } catch {
        router.replace('/');
      }
    };
    load();
  }, [router, fetchProfile]);

  if (!studentData) return null;
  const { student } = studentData;

  const branch = getBranchFromRoll(student.roll_no);
  const courseLabel = branch ? `B. Tech (${branch})` : 'B. Tech';
  const yearOfStudy = getCurrentStudyingYear(student.roll_no) || 1;
  const currentAcademicYearLabel = getCurrentAcademicYear(student.roll_no);

  // Determine allowed span (3 for lateral, 4 for regular)
  const maxYears = (() => {
    let n = 4;
    for (let y = 4; y >= 3; y--) { if (isYearAllowed(student.roll_no, y)) { n = y; break; } }
    return n;
  })();

  const scholarshipByYear = {};
  (studentData.scholarship || []).forEach((s) => {
    const y = Number(s.year);
    if (Number.isInteger(y)) scholarshipByYear[y] = s;
  });

  const rows = Array.from({ length: maxYears }, (_, i) => {
    const y = i + 1;
    const acad = computeAcademicYear(student.roll_no, y);
    const rec = scholarshipByYear[y];
    const formatDateSlash = (val) => {
      if (!val) return '';
      try {
        const dFmt = formatDate(val);
        if (dFmt && typeof dFmt === 'string') return dFmt.replaceAll('-', '/');
        const d = new Date(val);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      } catch {
        return String(val);
      }
    };
    return {
      labelYear: acad ?? `Year ${y}`,
      proceedings_no: rec?.proceedings_no ?? '',
      amount_sanctioned: rec?.amount_sanctioned ?? '',
      amount_disbursed: rec?.amount_disbursed ?? '',
      date: rec?.date ? formatDateSlash(rec.date) : '',
    };
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col overflow-hidden">
      <Header />
      {/* Student navbar with profile context */}
      <Navbar studentProfileMode={true} activeTab={'profile'} onLogout={async () => { await fetch('/api/student/logout', { method: 'POST' }); router.replace('/'); }} />
      {/* Warning bar section: full-width, between Navbar and Profile Card */}
      {(!student.email || !student.is_email_verified || !student.password_hash) && (
        <div className="w-full flex justify-center px-6 pt-4">
          <div className="w-full max-w-6xl">
            <div className="border border-yellow-300 bg-yellow-50 text-yellow-800 rounded-md p-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="text-sm">
                  {(!student.email) && (
                    <span>⚠️ Email not added. Please set your email and password to use portal features.</span>
                  )}
                  {(student.email && !student.is_email_verified) && (
                    <span>⚠️ Email verification required. Please verify your email to use portal features.</span>
                  )}
                  {(!student.password_hash && student.email && student.is_email_verified) && (
                    <span>⚠️ Password not set. Please set a password to continue.</span>
                  )}
                </div>
                <a href="/student/settings/security" className="inline-flex items-center text-sm font-semibold text-blue-700 hover:underline">Go to Security & Privacy</a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main card container: fixed height, centered, no scroll */}
      <main className="flex-1 flex items-start justify-center px-6 py-6">
        <div className="w-full max-w-6xl bg-white shadow-xl rounded-lg p-6 overflow-hidden">
          {/* Two-column header zone */}
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8">
            {/* Left section: photo + identity */}
            <div className="flex flex-col items-center md:items-start">
              <div className="w-40 h-40 rounded-full border-4 border-gray-300 overflow-hidden flex items-center justify-center bg-gray-100">
                {student.pfp ? (
                  // Using next/image with data URL; fallback to <img> if required
                  <Image src={student.pfp} alt="Profile Photo" width={160} height={160} className="object-cover w-full h-full" />
                ) : (
                  <div className="text-gray-500">Profile Pic</div>
                )}
              </div>
              <div className="mt-6 text-center md:text-left">
                <div className="text-3xl font-bold leading-tight">{student.name}</div>
                <div className="mt-1 text-lg font-semibold tracking-wide text-gray-800">{student.roll_no}</div>
              </div>
            </div>

            {/* Right section: academic basics */}
            <div className="flex flex-col justify-start">
              <div className="space-y-1">
                <div className="text-xl font-semibold">{courseLabel}</div>
                <div className="text-blue-700 font-semibold">Year: {yearOfStudy}</div>
                {currentAcademicYearLabel && (
                  <div className="text-blue-700 font-semibold">Academic Year: {currentAcademicYearLabel} (Current Academic)</div>
                )}
              </div>

              {/* Tabs card below */}
              <div className="mt-6 border rounded-lg">
                {/* Tabs header */}
                <div className="flex border-b bg-gray-50 rounded-t-lg">
                  <button
                    onClick={() => setActiveTab('personal')}
                    className={`px-4 py-3 text-sm font-medium border-b-2 ${activeTab === 'personal' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-600 hover:text-gray-800'}`}
                  >
                    Personal Tab
                  </button>
                  <button
                    onClick={() => setActiveTab('scholarship')}
                    className={`px-4 py-3 text-sm font-medium border-b-2 ${activeTab === 'scholarship' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-600 hover:text-gray-800'}`}
                  >
                    Scholarship Details
                  </button>
                </div>

                {/* Tab body */}
                <div className="p-4 min-h-70">
                  {activeTab === 'personal' && (
                    <div className="space-y-3 text-[16px]">
                      <div><span className="font-semibold">Father Name:</span> <span className="ml-2">{student.personal_details?.father_name ?? '-'}</span></div>
                      <div><span className="font-semibold">Mother Name:</span> <span className="ml-2">{student.personal_details?.mother_name ?? '-'}</span></div>
                      <div><span className="font-semibold">Date of Birth:</span> <span className="ml-2">{student.date_of_birth ? formatDate(student.date_of_birth).replaceAll('-', '/') : '-'}</span></div>
                      <div><span className="font-semibold">Phone:</span> <span className="ml-2">{student.mobile ?? '-'}</span></div>
                      <div><span className="font-semibold">Address:</span> <span className="ml-2">{student.personal_details?.address ?? student.address ?? '-'}</span></div>
                      <div><span className="font-semibold">Email:</span> <span className="ml-2">{student.email || '-'}</span></div>
                    </div>
                  )}

                  {activeTab === 'scholarship' && (
                    <>
                      {/* Desktop/Tablet: Keep fixed table layout */}
                      <div className="hidden md:block overflow-x-hidden">
                        <div className="rounded-md overflow-hidden">
                          <table className="table-fixed w-full border-collapse text-sm">
                            <colgroup>
                              <col style={{ width: '7.5rem' }} />
                              <col style={{ width: '45%' }} />
                              <col style={{ width: '16%' }} />
                              <col style={{ width: '16%' }} />
                              <col style={{ width: '12%' }} />
                            </colgroup>
                            <thead className="bg-gray-100">
                              <tr className="border border-gray-300">
                                <th className="text-left py-2 px-3 border-r border-gray-300">Year</th>
                                <th className="text-left py-2 px-3 border-r border-gray-300">Proceedings No</th>
                                <th className="text-right py-2 px-3 border-r border-gray-300">Amount Sanctioned</th>
                                <th className="text-right py-2 px-3 border-r border-gray-300">Amount Distributed</th>
                                <th className="text-left py-2 px-3">Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((r, idx) => (
                                <tr key={idx} className="border-x border-b border-gray-300">
                                  <td className="py-2 px-3 border-r border-gray-300 align-top">{r.labelYear}</td>
                                  <td className="py-2 px-3 border-r border-gray-300 whitespace-normal wrap-break-word align-top">{r.proceedings_no || '\u00A0'}</td>
                                  <td className="py-2 px-3 border-r border-gray-300 text-right align-top">{r.amount_sanctioned ? `₹ ${r.amount_sanctioned}` : '\u00A0'}</td>
                                  <td className="py-2 px-3 border-r border-gray-300 text-right align-top">{r.amount_disbursed ? `₹ ${r.amount_disbursed}` : '\u00A0'}</td>
                                  <td className="py-2 px-3 align-top">{r.date || '\u00A0'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {/* Outer table border */}
                          <div className="pointer-events-none border border-gray-300 rounded-md mt-[calc(100%-100%)]" />
                        </div>
                      </div>

                      {/* Mobile: Card-based layout, no horizontal table */}
                      <div className="block md:hidden">
                        <div className="space-y-3">
                          {rows.map((r, idx) => (
                            <div key={idx} className="border border-gray-300 rounded-md bg-white p-3 shadow-sm">
                              {/* Year - prominent */}
                              <div className="flex items-center justify-between">
                                <div className="text-sm font-semibold text-gray-700">Year</div>
                                <div className="text-sm font-semibold text-blue-700">{r.labelYear}</div>
                              </div>

                              {/* Proceedings No - stack to avoid ugly wrapping */}
                              <div className="mt-2">
                                <div className="text-xs font-medium text-gray-600">Proceedings No</div>
                                <div className="text-sm text-gray-800 whitespace-normal wrap-break-word leading-relaxed">{r.proceedings_no || '-'}</div>
                              </div>

                              {/* Amounts & Date - label left, value right */}
                              <div className="mt-2 flex items-center justify-between">
                                <div className="text-sm font-medium text-gray-700">Amount Sanctioned</div>
                                <div className="text-sm font-semibold">{r.amount_sanctioned ? `₹ ${r.amount_sanctioned}` : '-'}</div>
                              </div>
                              <div className="mt-2 flex items-center justify-between">
                                <div className="text-sm font-medium text-gray-700">Amount Distributed</div>
                                <div className="text-sm font-semibold">{r.amount_disbursed ? `₹ ${r.amount_disbursed}` : '-'}</div>
                              </div>
                              <div className="mt-2 flex items-center justify-between">
                                <div className="text-sm font-medium text-gray-700">Date</div>
                                <div className="text-sm">{r.date || '-'}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
