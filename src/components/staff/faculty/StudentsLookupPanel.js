'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useStaff } from '@/context/StaffContext';
import { ChevronDown, Search, Users, UserSearch, Download, Info, X, Award, Image as ImageIcon, ExternalLink, Loader2 } from 'lucide-react';
import { getAssetUrl } from '@/lib/assets';
import { ACHIEVEMENT_CONFIG } from '@/lib/achievement-config';
import * as XLSX from 'xlsx-js-style';
import { formatDate } from '@/lib/date';

export default function StudentsLookupPanel() {
  const { staffData } = useStaff();
  
  const [activeTab, setActiveTab] = useState('cohort'); // 'cohort' or 'search'

  // Cohort State
  const [program, setProgram] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState('');
  
  // Search State
  const [searchRoll, setSearchRoll] = useState('');
  const [searchName, setSearchName] = useState('');
  const [certificatesOnly, setCertificatesOnly] = useState(false);
  const [activeAcademicYear, setActiveAcademicYear] = useState('');

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  
  // Modal State
  const [modalTab, setModalTab] = useState('profile');
  const [achievements, setAchievements] = useState([]);
  const [loadingAchievements, setLoadingAchievements] = useState(false);
  const [achievementsError, setAchievementsError] = useState(null);

  const handleDownloadCertificate = async (ach) => {
    if (!ach.certificate_file_path) return;
    const sanitizedTitle = ach.title.replace(/[\s\W]+/g, '_');
    const ext = ach.certificate_file_path.split('.').pop();
    const fileName = selectedStudent.roll_no + '_' + sanitizedTitle + '_Certificate.' + ext;
    
    toast.loading('Downloading...', { id: 'download-toast' });
    try {
      const url = getAssetUrl(ach.certificate_file_path);
      const response = await fetch(url);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      
      toast.success('Download complete', { id: 'download-toast' });
    } catch (e) {
      toast.error('Failed to download file', { id: 'download-toast' });
      console.error(e);
    }
  };

  const handleViewProfile = (student) => {
    setSelectedStudent(student);
    setModalTab(certificatesOnly ? 'achievements' : 'profile');
    setAchievements([]);
    setAchievementsError(null);
  };

  useEffect(() => {
    if (!selectedStudent) return;
    
    const fetchAchievements = async () => {
      setLoadingAchievements(true);
      setAchievementsError(null);
      try {
        const res = await fetch(`/api/staff/faculty/students/${selectedStudent.id}/achievements${certificatesOnly ? '?cohort=true' : ''}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch achievements');
        setAchievements(json.data || []);
      } catch (err) {
        setAchievementsError('Unable to load achievements.');
      } finally {
        setLoadingAchievements(false);
      }
    };
    fetchAchievements();
  }, [selectedStudent]);
  
  // Set default program if only one is available
  useEffect(() => {
    if (staffData?.branches?.length === 1 && !program) {
      const id = setTimeout(() => {
        setProgram(staffData.branches[0]);
      }, 0);
      return () => clearTimeout(id);
    }
  }, [staffData, program]);
  
  


  const handleExport = async () => {
    if (!students || students.length === 0) return;
    
    const loadingToast = toast.loading('Generating Export...');

    try {
      // 1. Fetch achievements for all students in bulk
      const studentIds = students.map(s => s.id);
      let allAchievements = [];
      try {
        const res = await fetch('/api/staff/faculty/students/bulk-achievements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentIds })
        });
        const achData = await res.json();
        if (res.ok) allAchievements = achData.data || [];
      } catch (err) {
        console.error('Failed to fetch bulk achievements', err);
      }

      // Create worksheet data
      const wsData = [];
      
      // Define Headers
      const headers = [
        'Roll Number', 
        'Student Name', 
        'Branch', 
        'Email ID', 
        'Phone Number',
        'Father Name',
        'Mother Name',
        'Date of Birth',
        'Address',
        'Current Year',
        'Batch'
      ];
      wsData.push(headers);
      
      // Add student rows
      students.forEach(s => {
        wsData.push([
          s.roll_no, 
          s.name, 
          s.branch, 
          s.email,
          s.phone,
          s.father_name,
          s.mother_name,
          formatDate(s.dob) || s.dob || '-',
          s.address,
          s.current_year,
          s.batch_year
        ]);
      });
      
      // Create worksheet and workbook
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Style headers
      const headerStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "0B3578" } },
        alignment: { horizontal: "center", vertical: "center" }
      };
      
      // Apply styles to first row (headers)
      for (let C = 0; C < headers.length; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
        if (!ws[cellAddress]) continue;
        ws[cellAddress].s = headerStyle;
      }
      
      // Set column widths
      ws['!cols'] = [
        { wch: 15 }, // Roll Number
        { wch: 35 }, // Student Name
        { wch: 10 }, // Branch
        { wch: 40 }, // Email ID
        { wch: 15 }, // Phone Number
        { wch: 25 }, // Father Name
        { wch: 25 }, // Mother Name
        { wch: 15 }, // Date of Birth
        { wch: 50 }, // Address
        { wch: 15 }, // Current Year
        { wch: 10 }  // Batch
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Students");

      // --- Achievements Worksheet ---
      const achWsData = [];
      const achHeaders = [
        'Roll Number',
        'Student Name',
        'Branch',
        'Achievement Type',
        'Title',
        'Academic Year',
        'Level',
        'Certificate Status',
        'Description'
      ];
      achWsData.push(achHeaders);
      
      const studentMap = {};
      students.forEach(s => { studentMap[s.id] = s; });
      
      allAchievements.forEach(ach => {
         const student = studentMap[ach.student_id];
         if (!student) return;
         
         const config = ACHIEVEMENT_CONFIG[ach.achievement_type] || {};
         
         achWsData.push([
           student.roll_no,
           student.name,
           student.branch,
           ach.achievement_type,
           ach.title,
           ach.academic_year,
           ach.achievement_level || '-',
           ach.certificate_file_path ? 'Yes' : 'Not uploaded',
           ach.description || ''
         ]);
      });

      if (allAchievements.length > 0) {
        const achWs = XLSX.utils.aoa_to_sheet(achWsData);
        for (let C = 0; C < achHeaders.length; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
          if (achWs[cellAddress]) achWs[cellAddress].s = headerStyle;
        }
        achWs['!cols'] = [
          { wch: 15 }, { wch: 35 }, { wch: 10 }, { wch: 25 }, { wch: 40 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 50 }
        ];
        XLSX.utils.book_append_sheet(wb, achWs, "Achievements");
      }
      
      // Export file
      let fileName = `students_export_${new Date().toISOString().split('T')[0]}`;
      if (activeTab === 'cohort' && program && yearOfStudy) {
        fileName = `${program}_Year_${yearOfStudy}`;
      } else if (activeTab === 'search') {
        fileName = 'Search_Results';
        if (searchRoll) fileName += `_${searchRoll}`;
      }
      XLSX.writeFile(wb, `${fileName}.xlsx`);
      
      toast.success('Export completed successfully!', { id: loadingToast });
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate export', { id: loadingToast });
    }
  };



  const handleCohortSearch = async () => {
    if (!program || !yearOfStudy) return;
    
    setLoading(true);
    setHasSearched(true);
    setStudents([]);
    
    try {
      const res = await fetch(`/api/staff/faculty/class-lookup?program=${program}&yearOfStudy=${yearOfStudy}${certificatesOnly ? '&certificatesOnly=true' : ''}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch students');
      setStudents(data.data || []);
      if (data.activeAcademicYear) setActiveAcademicYear(data.activeAcademicYear);
      if (data.activeAcademicYear) setActiveAcademicYear(data.activeAcademicYear);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGlobalSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchRoll.trim() && !searchName.trim()) {
      toast.error('Please enter a roll number or name to search');
      return;
    }
    
    setLoading(true);
    setHasSearched(true);
    setStudents([]);
    
    try {
      const params = new URLSearchParams();
      if (searchRoll.trim()) params.append('roll_no', searchRoll.trim());
      if (searchName.trim()) params.append('name', searchName.trim());

      const res = await fetch(`/api/staff/faculty/class-lookup?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to search students');
      setStudents(data.data || []);
      if (data.activeAcademicYear) setActiveAcademicYear(data.activeAcademicYear);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-search for cohort
  useEffect(() => {
    let id;
    if (activeTab === 'cohort') {
      if (program && yearOfStudy) {
        id = setTimeout(() => {
          handleCohortSearch();
        }, 300);
      } else {
        id = setTimeout(() => {
          setStudents([]);
          setHasSearched(false);
        }, 0);
      }
    }
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program, yearOfStudy, activeTab, certificatesOnly]);

  const branches = staffData?.branches || [];

  return (
    <div className="border border-blue-100 rounded-md bg-gradient-to-br from-blue-50/50 via-white to-blue-50/50 shadow-sm flex flex-col w-full">
      {/* Internal Tabs */}
      <div className="flex items-center border-b border-gray-200 bg-transparent">
        <button
          onClick={() => { setActiveTab('cohort'); setStudents([]); setHasSearched(false); }}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'cohort'
              ? 'border-[#0b3578] text-[#0b3578] bg-white shadow-sm rounded-t-md'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-white/50'
          }`}
        >
          <Users size={16} />
          Cohort Lookup
        </button>
        <button
          onClick={() => { setActiveTab('search'); setStudents([]); setHasSearched(false); }}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'search'
              ? 'border-[#0b3578] text-[#0b3578] bg-white shadow-sm rounded-t-md'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-white/50'
          }`}
        >
          <UserSearch size={16} />
          Global Search
        </button>
      </div>

      <div className="p-4 sm:p-6 w-full">
        {activeTab === 'cohort' ? (
          <div className="mb-6 bg-white/80 backdrop-blur-sm p-4 rounded-md border border-slate-200 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-800 mb-4">Select Class Cohort</h2>
            <div className="flex flex-col sm:flex-row flex-wrap gap-4">
              <div className="relative flex-1 sm:flex-none sm:w-64">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1 block">Program / Branch</label>
                <select
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  className="w-full appearance-none pl-3 pr-7 py-2.5 text-sm font-medium border border-gray-200 rounded-sm bg-white text-gray-700 focus:outline-none focus:border-[#0b3578]/40 focus:ring-1 focus:ring-[#0b3578]/10 transition cursor-pointer"
                >
                  <option value="">Select Program</option>
                  {branches.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-[34px] text-gray-400 pointer-events-none" />
              </div>

              <div className="relative flex-1 sm:flex-none sm:w-48">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1 block">Year of Study</label>
                <select
                  value={yearOfStudy}
                  onChange={(e) => setYearOfStudy(e.target.value)}
                  className="w-full appearance-none pl-3 pr-7 py-2.5 text-sm font-medium border border-gray-200 rounded-sm bg-white text-gray-700 focus:outline-none focus:border-[#0b3578]/40 focus:ring-1 focus:ring-[#0b3578]/10 transition cursor-pointer"
                >
                  <option value="">Select Year</option>
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-[34px] text-gray-400 pointer-events-none" />
              </div>
            
              <div className="relative flex-1 sm:flex-none sm:w-48">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1 block">Certificates Filter</label>
                <select
                  value={certificatesOnly ? 'true' : 'false'}
                  onChange={(e) => setCertificatesOnly(e.target.value === 'true')}
                  className="w-full appearance-none pl-3 pr-7 py-2.5 text-sm font-medium border border-gray-200 rounded-sm bg-white text-gray-700 focus:outline-none focus:border-[#0b3578]/40 focus:ring-1 focus:ring-[#0b3578]/10 transition cursor-pointer"
                >
                  <option value="false">All Students</option>
                  <option value="true">Has Certificates</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-[34px] text-gray-400 pointer-events-none" />
                {activeAcademicYear && certificatesOnly && <span className="absolute -top-1 right-0 text-[9px] bg-blue-50 text-[#0b3578] px-1.5 rounded font-bold uppercase">{activeAcademicYear}</span>}
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleGlobalSearch} className="mb-6 bg-white/80 backdrop-blur-sm p-4 rounded-md border border-slate-200 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-800 mb-4">Search Students in Your Department</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1 block">Roll Number</label>
                <input
                  placeholder="e.g. 21B81A0501"
                  value={searchRoll}
                  onChange={(e) => setSearchRoll(e.target.value.toUpperCase())}
                  className="w-full bg-white border border-gray-200 rounded-sm px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#0b3578] uppercase"
                />
              </div>
              
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1 block">Student Name</label>
                <input 
                  placeholder="Enter full or partial name" 
                  value={searchName} 
                  onChange={(e) => setSearchName(e.target.value)} 
                  className="w-full bg-white border border-gray-200 rounded-sm px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#0b3578]" 
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-5">
              <button 
                type="button"
                onClick={() => { setSearchRoll(''); setSearchName(''); setStudents([]); setHasSearched(false); }}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-sm hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Clear
              </button>
              <button
                type="submit"
                disabled={loading || (!searchRoll.trim() && !searchName.trim())}
                className={`px-4 py-2 text-sm font-medium rounded-sm transition-colors flex items-center gap-2 ${
                  (loading || (!searchRoll.trim() && !searchName.trim()))
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200' 
                    : 'bg-[#0b3578] text-white hover:bg-[#082654] border border-[#0b3578] shadow-sm cursor-pointer'
                }`}
              >
                {loading ? 'Searching...' : 'Search Records'}
              </button>
            </div>
          </form>
        )}

        {/* Results Area */}
        <div className="w-full">
          {!hasSearched ? (
            <div className="border border-dashed border-slate-300 rounded-md py-16 text-center bg-white/50 backdrop-blur-sm shadow-sm">
              <Search size={28} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-600">
                {activeTab === 'cohort' ? 'Select a program and year' : 'Search by roll number or name'}
              </p>
              <p className="text-xs text-gray-400 mt-1">Students matching your criteria will appear here.</p>
            </div>
          ) : loading ? (
            <div className="border border-slate-200 rounded-md py-16 text-center bg-white/50 backdrop-blur-sm shadow-sm">
              <p className="text-sm font-medium text-gray-500 animate-pulse">Searching student records...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="border border-dashed border-slate-300 rounded-md py-16 text-center bg-white/50 backdrop-blur-sm shadow-sm">
              <p className="text-sm font-medium text-gray-600">No students found</p>
              <p className="text-xs text-gray-400 mt-1">
                {activeTab === 'search' 
                  ? 'No active students match this criteria in your assigned programs.'
                  : 'No active students match this program and year of study.'}
              </p>
            </div>
          ) : (
            <div className="w-full flex flex-col">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest bg-gray-100 px-2 py-1 rounded">
                  {students.length} Result{students.length !== 1 && 's'}
                </span>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0b3578] rounded hover:bg-[#0a2d66] transition-colors cursor-pointer"
                >
                  <Download size={14} />
                  Export to Excel
                </button>
              </div>
              <div className="overflow-x-auto w-full border border-slate-200 shadow-sm rounded-md bg-white">
                <table className="w-full text-sm divide-y divide-slate-200 table-auto min-w-[600px]">
                  <thead className="bg-slate-50/80">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Roll No</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Student Name</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Branch</th>
                      {certificatesOnly && <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Certificates</th>}
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">More</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {students.map((student) => (
                      <tr key={student.id} className="hover:bg-blue-50/50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-[#0b3578]">
                          {student.roll_no}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-semibold text-gray-800">{student.name}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-xs font-medium text-gray-500">
                          {student.branch}
                        </td>
                          {certificatesOnly && (
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                               <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-[#0b3578] bg-blue-100 rounded-full">
                                {student.certificates_count || 0}
                              </span>
                            </td>
                          )}
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleViewProfile(student)}
                            className="p-1 text-slate-400 hover:text-[#0b3578] hover:bg-blue-50 rounded-full transition-colors cursor-pointer inline-flex"
                            title="View Full Profile"
                          >
                            <Info size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
            {/* Student Details Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity">
          <div className="relative z-10 bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
              <h3 className="text-base font-semibold text-slate-800">Student Profile</h3>
              <button 
                onClick={() => setSelectedStudent(null)} 
                className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="px-6 py-3 border-b border-gray-200 flex items-center gap-4 bg-white shrink-0">
              <button 
                onClick={() => setModalTab('profile')}
                className={`pb-2 text-sm font-medium transition-colors border-b-2 ${modalTab === 'profile' ? 'border-[#0b3578] text-[#0b3578]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Information
              </button>
              <button 
                onClick={() => setModalTab('achievements')}
                className={`pb-2 text-sm font-medium transition-colors border-b-2 ${modalTab === 'achievements' ? 'border-[#0b3578] text-[#0b3578]' : 'border-transparent text-gray-500 hover:text-gray-700'} flex items-center gap-1`}
              >
                Achievements {achievements.length > 0 && <span className="bg-blue-100 text-[#0b3578] text-xs py-0.5 px-2 rounded-full ml-1">{achievements.length}</span>}
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="flex flex-col mb-6">
                <span className="text-xl font-bold text-[#0b3578]">{selectedStudent.name}</span>
                <span className="text-sm font-mono font-bold text-slate-500">{selectedStudent.roll_no}</span>
              </div>
              
              {modalTab === 'profile' ? (
                <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Father Name</span>
                    <span className="font-semibold text-slate-700">{selectedStudent.father_name || '-'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Mother Name</span>
                    <span className="font-semibold text-slate-700">{selectedStudent.mother_name || '-'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Date of Birth</span>
                    <span className="font-semibold text-slate-700">{formatDate(selectedStudent.dob) || selectedStudent.dob || '-'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Phone Number</span>
                    <span className="font-semibold text-slate-700">{selectedStudent.phone || '-'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Email ID</span>
                    <span className="font-semibold text-slate-700">{selectedStudent.email || '-'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Address</span>
                    <span className="font-semibold text-slate-700">{selectedStudent.address || '-'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Current Year</span>
                    <span className="font-semibold text-slate-700">{selectedStudent.current_year || '-'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Batch</span>
                    <span className="font-semibold text-slate-700">{selectedStudent.batch_year || '-'}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {loadingAchievements ? (
                    <div className="flex flex-col justify-center items-center py-10 text-gray-500">
                      <Loader2 className="w-8 h-8 animate-spin text-[#0b3578] mb-2" />
                      <p className="text-sm">Loading achievements...</p>
                    </div>
                  ) : achievementsError ? (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md text-sm text-center">
                      {achievementsError}
                    </div>
                  ) : achievements.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 border border-gray-100 rounded-lg">
                      <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No achievements submitted</p>
                      <p className="text-gray-400 text-sm mt-1">Achievements submitted by the student will appear here.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {achievements.map(ach => {
                        const config = ACHIEVEMENT_CONFIG[ach.achievement_type];
                        if (!config) return null;
                        
                        let additionalParsed = {};
                        if (ach.additional_data) {
                          try {
                            additionalParsed = typeof ach.additional_data === 'string' ? JSON.parse(ach.additional_data) : ach.additional_data;
                          } catch (e) {}
                        }
                        
                        const allConfigFields = Object.values(config.groups).flat();
                        
                        return (
                          <div key={ach.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <span className="inline-block px-2.5 py-1 bg-indigo-50 text-indigo-700 font-semibold text-[10px] uppercase tracking-wider rounded-full mb-2">
                                  {ach.achievement_type}
                                </span>
                                <h4 className="font-bold text-gray-900 text-base">{ach.title}</h4>
                                <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                  <span className="font-medium bg-gray-100 px-2 py-0.5 rounded text-gray-600">AY {ach.academic_year}</span>
                                </p>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-sm bg-gray-50 p-3 rounded-md border border-gray-100">
                              {allConfigFields.map(field => {
                                if (field.name === 'title') return null;
                                
                                const val = field.isAdditional ? additionalParsed[field.name] : ach[field.name];
                                if (!val) return null;
                                
                                let displayVal = val;
                                if (field.type === 'date') displayVal = formatDate(val) || val;
                                
                                return (
                                  <div key={field.name} className={field.span === 2 ? "sm:col-span-2" : ""}>
                                    <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">{field.label}</span>
                                    <span className="text-gray-700 font-medium break-words">{displayVal}</span>
                                  </div>
                                );
                              })}
                            </div>
                            
                            {ach.description && (
                              <div className="mt-3 text-sm">
                                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{config.descLabel || 'Description'}</span>
                                <p className="text-gray-700 whitespace-pre-wrap">{ach.description}</p>
                              </div>
                            )}
                            
                            {ach.certificate_file_path && (
                              <div className="mt-4 pt-3 border-t border-gray-100">
                                <a 
                                  href={getAssetUrl(ach.certificate_file_path)} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0b3578] hover:text-[#082a5e] bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors"
                                >
                                  <ImageIcon className="w-4 h-4" /> View Certificate <ExternalLink className="w-3 h-3 ml-1" />
                                </a>
                                  <button onClick={() => handleDownloadCertificate(ach)} className="ml-2 inline-flex items-center gap-1.5 text-sm font-medium text-white hover:text-white bg-[#0b3578] hover:bg-[#082a5e] px-3 py-1.5 rounded-md transition-colors">
                                    <Download className="w-4 h-4" /> Download
                                  </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}