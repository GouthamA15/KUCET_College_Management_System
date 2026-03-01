'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const MarkAttendanceCard = ({ session, onVerified }) => {
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleVerify = async () => {
    if (pin.length !== 4) {
      toast.error('Enter the 4-digit PIN shown on faculty screen');
      return;
    }

    setSubmitting(true);
    try {
      if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
        toast.error("GPS requires HTTPS on mobile. Please host on Render don't use a laptop on 'localhost'.", { duration: 6000 });
        return;
      }

      // 1. Get Location (Mandatory for security)
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { 
          enableHighAccuracy: true, 
          timeout: 10000 
        });
      });

      // 2. Submit Verification
      const res = await fetch('/api/student/attendance/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: session.assignment_id,
          pin: pin,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Verification failed');

      toast.success(json.message);
      onVerified(); 
    } catch (err) {
      let msg = err.message;
      if (err.code === 1) msg = "Location access denied. Please enable GPS.";
      if (err.code === 3) msg = "Location request timed out. Please retry.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-indigo-600 rounded-xl p-4 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-4 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="bg-white/20 p-3 rounded-full">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 3c4.183 0 7.66 2.567 9.106 6H22.25m-9.448 10a10.003 10.003 0 01-1.106-2.04m0 0l.054-.09A10.003 10.003 0 0122.5 12"></path></svg>
        </div>
        <div>
          <h4 className="font-bold text-lg leading-tight">Secure Attendance Active</h4>
          <p className="text-indigo-100 text-xs">{session.subject_name} ({session.subject_code})</p>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-white/10 p-2 rounded-lg border border-white/20">
        <input 
          type="text" 
          maxLength="4" 
          placeholder="PIN" 
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          className="w-20 bg-white text-gray-900 text-center font-bold text-xl py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-gray-300"
        />
        <button
          onClick={handleVerify}
          disabled={submitting || pin.length !== 4}
          className="bg-white text-indigo-600 px-4 py-2 rounded-md font-black uppercase text-sm hover:bg-indigo-50 disabled:opacity-50 transition-all whitespace-nowrap"
        >
          {submitting ? 'Verifying...' : 'Mark Present'}
        </button>
      </div>
    </div>
  );
};
const QRScannerModal = ({ onScan, onClose }) => {
  useEffect(() => {
    // Load html5-qrcode dynamically
    const script = document.createElement('script');
    script.src = "https://unpkg.com/html5-qrcode";
    script.async = true;
    document.body.appendChild(script);

    script.onload = () => {
      const html5QrCode = new window.Html5Qrcode("reader");
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };

      html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          html5QrCode.stop().then(() => {
            onScan(decodedText);
          });
        }
      ).catch(err => {
        console.error("Scanner Error:", err);
        const isInsecure = window.location.protocol !== 'https:' && window.location.hostname !== 'localhost';
        toast.error(isInsecure ? "Camera requires HTTPS on mobile. Use PIN instead." : "Camera access denied.");
      });

      return () => {
        if (html5QrCode.isScanning) {
          html5QrCode.stop();
        }
      };
    };

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800">Scan Class QR</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <div className="p-6">
          <div id="reader" className="overflow-hidden rounded-xl bg-black aspect-square"></div>
          <p className="text-center text-xs text-gray-500 mt-4">Point your camera at the QR code on the faculty's screen.</p>
        </div>
      </div>
    </div>
  );
};

export default function AcademicTab() {
  const [data, setData] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [verifiedMessages, setVerifiedMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [historySubject, setHistorySubject] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchActiveSessions = async (subjects) => {
    if (!subjects.length) return;
    try {
      const assignmentIds = subjects.map(s => s.assignment_id).join(',');
      const res = await fetch(`/api/student/attendance/active-sessions?ids=${assignmentIds}`);
      const json = await res.json();
      if (res.ok) {
        setActiveSessions(json.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch active sessions');
    }
  };

  const onVerificationSuccess = (assignmentId, subjectName) => {
    // Add confirmation message
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    setVerifiedMessages(prev => {
      // Prevent duplicate messages if already present
      if (prev.find(m => m.id === assignmentId)) return prev;
      return [...prev, { 
        id: assignmentId, 
        text: `Your attendance for ${subjectName} has been successfully taken on ${today}.` 
      }];
    });

    // Remove the verified session from the active list immediately
    setActiveSessions(prev => prev.filter(s => s.assignment_id !== assignmentId));
    // Refresh the academic data to show the new attendance count
    fetchAcademicInfo();
  };

  const fetchAcademicInfo = async () => {
    try {
      const res = await fetch('/api/student/academic-info');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch academic info');
      const subjects = json.data || [];
      setData(subjects);
      fetchActiveSessions(subjects);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (subject) => {
    setHistorySubject(subject);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/student/attendance/history?assignment_id=${subject.assignment_id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch attendance history');
      setHistoryData(json.data || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchAcademicInfo();
  }, []);

  const getPercentageColor = (pct) => {
    if (pct <= 50) return 'text-red-600 bg-red-50 border-red-200';
    if (pct <= 75) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  if (loading) return <div className="text-center py-8">Loading academic details...</div>;

  return (
    <div className="space-y-6">
      {/* Active Attendance Sessions (Self-Verification) */}
      {(activeSessions.length > 0 || verifiedMessages.length > 0) && (
        <div className="space-y-3">
          {/* Confirmation Messages */}
          {verifiedMessages.map((m, idx) => (
            <div key={`msg-${idx}`} className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-center gap-3 animate-fadeIn">
              <div className="bg-green-100 p-2 rounded-full text-green-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
              </div>
              <p className="text-sm font-bold text-green-800">{m.text}</p>
            </div>
          ))}

          {/* Active Session Cards */}
          {activeSessions.map((session) => (
            <MarkAttendanceCard 
              key={session.assignment_id} 
              session={session} 
              onVerified={() => onVerificationSuccess(session.assignment_id, session.subject_name)} 
            />
          ))}
        </div>
      )}

      {/* Attendance History Modal */}
      {historySubject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col animate-scaleUp">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Attendance History</h3>
                <p className="text-sm text-gray-500">{historySubject.subject_name}</p>
              </div>
              <button onClick={() => setHistorySubject(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingHistory ? (
                <div className="text-center py-8">Loading history...</div>
              ) : historyData.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {historyData.map((record, i) => (
                    <div key={i} className={`p-3 rounded-lg border relative overflow-hidden ${
                      record.status === 'PRESENT' 
                        ? 'bg-green-50 border-green-200 text-green-800' 
                        : (record.status === 'NCC' || record.status === 'MEDICAL')
                        ? 'bg-orange-50 border-orange-200 text-orange-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                    }`}>
                      <div className="text-sm font-bold">{new Date(record.date).toLocaleDateString()}</div>
                      <div className="text-[10px] font-black uppercase tracking-widest">{record.status}</div>
                      <div className="absolute top-1 right-1 bg-white/50 px-1.5 py-0.5 rounded text-[8px] font-bold">S{record.session}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">No records found.</div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span className="w-2 h-6 bg-indigo-600 rounded-full"></span>
          Current Semester Academic Performance
        </h3>
      </div>

      {data.length > 0 ? (
        <div className="overflow-x-auto border rounded-xl shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-gray-600">Subject</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">Attendance</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">Mid-I / Execution</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">Mid-II / Writing</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">Assign. / Record</th>
                <th className="px-4 py-3 text-center font-bold text-indigo-600 bg-indigo-50">Total Marks</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {data.map((sub) => {
                const pct = sub.total_classes > 0 ? (sub.attended_classes / sub.total_classes) * 100 : 100;
                const isLab = sub.subject_type === 'lab';
                
                // Max Mark Calculation
                const m1m = isLab ? 10 : (sub.mid_max || 20);
                const m2m = isLab ? 10 : (sub.mid_max || 20);
                const am = isLab ? 5 : (sub.mid_max === 25 ? 5 : 10);
                const totalMax = isLab ? 25 : 30;
                
                // Mark labels
                const l1 = isLab ? 'Execution' : 'Mid-I';
                const l2 = isLab ? 'Writing' : 'Mid-II';
                const l3 = isLab ? 'Record' : 'Assign.';

                // Calculate Internal Total
                const m1 = sub.mid1_marks !== null ? parseFloat(sub.mid1_marks) : null;
                const m2 = sub.mid2_marks !== null ? parseFloat(sub.mid2_marks) : null;
                const assgn = sub.assignment_marks !== null ? parseFloat(sub.assignment_marks) : 0;
                
                let internalTotal = null;
                if (isLab) {
                  // Lab: sum of everything
                  internalTotal = (m1 ?? 0) + (m2 ?? 0) + (assgn ?? 0);
                } else {
                  // Theory: Best of mid + assignment
                  if (m1 !== null || m2 !== null) {
                    const bestMid = Math.max(m1 ?? 0, m2 ?? 0);
                    internalTotal = bestMid + assgn;
                  }
                }

                return (
                  <tr key={sub.assignment_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-gray-900">{sub.subject_name}</div>
                        {isLab && <span className="text-[8px] bg-amber-50 text-amber-600 border border-amber-100 px-1 rounded font-black uppercase">Lab</span>}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">{sub.subject_code} • {sub.faculty_name}</div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button 
                        onClick={() => fetchHistory(sub)}
                        className={`inline-flex flex-col items-center px-3 py-1 rounded-lg border transition-all hover:shadow-md active:scale-95 ${getPercentageColor(pct)}`}
                      >
                        <span className="text-sm font-black">{pct.toFixed(1)}%</span>
                        <span className="text-[9px] opacity-70 font-bold uppercase">{sub.attended_classes}/{sub.total_classes}</span>
                      </button>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`font-mono font-bold ${sub.mid1_marks === null ? 'text-gray-300' : 'text-gray-700'}`}>
                          {sub.mid1_marks ?? '--'}
                        </span>
                        <span className="text-[8px] text-gray-400 font-bold uppercase">{l1} Max: {m1m}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`font-mono font-bold ${sub.mid2_marks === null ? 'text-gray-300' : 'text-gray-700'}`}>
                          {sub.mid2_marks ?? '--'}
                        </span>
                        <span className="text-[8px] text-gray-400 font-bold uppercase">{l2} Max: {m2m}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`font-mono font-bold ${sub.assignment_marks === null ? 'text-gray-300' : 'text-gray-700'}`}>
                          {sub.assignment_marks ?? '--'}
                        </span>
                        <span className="text-[8px] text-gray-400 font-bold uppercase">{l3} Max: {am}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center bg-indigo-50/30">
                      <div className="flex flex-col items-center">
                        <span className={`font-mono font-black text-lg ${internalTotal === null ? 'text-gray-300' : 'text-indigo-700'}`}>
                          {internalTotal !== null ? internalTotal.toFixed(1) : '--'}
                        </span>
                        <span className="text-[9px] text-indigo-400 font-bold uppercase">Out of {totalMax}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-center">
          <p className="text-gray-500 font-medium">No subjects found for the current semester.</p>
          <p className="text-xs text-gray-400 mt-1">Assignments will appear once faculty members are assigned to your class.</p>
        </div>
      )}
    </div>
  );
}
