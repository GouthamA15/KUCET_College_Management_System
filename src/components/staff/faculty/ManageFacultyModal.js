import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { X, Save, AlertTriangle, BookOpen, Clock, AlertCircle } from 'lucide-react';

export default function ManageFacultyModal({ faculty, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({ account_status: faculty.account_status, assignments: [], requests: [] });
  
  const [pendingAccountStatus, setPendingAccountStatus] = useState(faculty.account_status);
  const [subjectChanges, setSubjectChanges] = useState({}); // { assignmentId: boolean }
  const [requestChanges, setRequestChanges] = useState({}); // { interestId: boolean }
  
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/staff/hod/active-faculty/${faculty.id}/manage`);
        const json = await res.json();
        if (res.ok) {
          setData(json.data);
          setPendingAccountStatus(json.data.account_status);
        } else {
          toast.error(json.error || 'Failed to fetch faculty details');
          onClose();
        }
      } catch (_e) {
        toast.error('An error occurred while fetching details');
        onClose();
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [faculty.id, onClose]);

  const hasChanges = () => {
    if (pendingAccountStatus !== data.account_status) return true;
    if (Object.keys(subjectChanges).length > 0) return true;
    if (Object.keys(requestChanges).length > 0) return true;
    return false;
  };

  const handleClose = () => {
    if (hasChanges()) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  };

  const handleSave = async () => {
    if (!hasChanges()) return;
    
    setSaving(true);
    try {
      const payload = {
        accountStatus: pendingAccountStatus !== data.account_status ? pendingAccountStatus : undefined,
        subjectChanges: Object.entries(subjectChanges).map(([id, enabled]) => ({
          assignmentId: parseInt(id, 10),
          enabled
        })),
        requestedSubjects: Object.entries(requestChanges).map(([id, enabled]) => ({
          interestId: parseInt(id, 10),
          enabled
        }))
      };

      const res = await fetch(`/api/staff/hod/active-faculty/${faculty.id}/manage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      
      if (res.ok) {
        toast.success(json.message || 'Faculty managed successfully');
        onSaved(); // trigger parent refresh
      } else {
        toast.error(json.error || 'Failed to save changes');
      }
    } catch (_e) {
      toast.error('An error occurred while saving changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-white rounded-xl p-6 flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0b3578] mb-4"></div>
          <p className="text-sm text-gray-600 font-medium">Loading faculty details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={handleClose}></div>
        
        {/* Main Modal */}
        <div className="relative z-10 bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-2xl w-full border border-slate-200 flex flex-col max-h-[90vh]">
          
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
            <div>
              <h3 className="text-lg font-bold text-[#0b3578]">Manage Faculty</h3>
              <p className="text-sm text-gray-500 font-medium mt-0.5">{faculty.name} • {faculty.employee_id}</p>
            </div>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 overflow-y-auto space-y-8 grow">
            
            {/* Account Access */}
            <section>
              <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2 uppercase tracking-wide">
                <AlertCircle size={16} className="text-[#0b3578]" />
                Account Access
              </h4>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Portal Access</p>
                    <p className="text-xs text-gray-500 mt-0.5">Controls whether this faculty can log into the system.</p>
                  </div>
                  
                  {data.account_status === 'SUSPENDED' || data.account_status === 'PENDING_ACTIVATION' ? (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                      {data.account_status}
                    </span>
                  ) : (
                    <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200">
                      <button 
                        onClick={() => setPendingAccountStatus('ACTIVE')}
                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${pendingAccountStatus === 'ACTIVE' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                      >
                        ACTIVE
                      </button>
                      <button 
                        onClick={() => setPendingAccountStatus('DISABLED')}
                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${pendingAccountStatus === 'DISABLED' ? 'bg-amber-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                      >
                        DISABLED
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Subject Access */}
            <section>
              <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2 uppercase tracking-wide">
                <BookOpen size={16} className="text-[#0b3578]" />
                Assigned Subjects
              </h4>
              
              {data.assignments.length > 0 ? (
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
                  {data.assignments.map(assignment => {
                    // Determine the current pending state for this assignment
                    const currentIsActive = assignment.is_active;
                    const pendingIsActive = subjectChanges[assignment.id] !== undefined ? subjectChanges[assignment.id] : currentIsActive;
                    
                    return (
                      <div key={assignment.id} className="p-4 bg-white flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div>
                          <p className="text-sm font-bold text-[#0b3578]">{assignment.subject_name}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 font-medium">
                            <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 border border-gray-200">{assignment.subject_code}</span>
                            <span>•</span>
                            <span>{assignment.branch}</span>
                            <span>•</span>
                            <span>Sem {assignment.course_semester}</span>
                            <span>•</span>
                            <span>{assignment.academic_year}</span>
                          </div>
                        </div>
                        
                        <button 
                          onClick={() => setSubjectChanges(prev => ({ ...prev, [assignment.id]: !pendingIsActive }))}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0b3578] focus:ring-offset-2 ${pendingIsActive ? 'bg-green-500' : 'bg-gray-200'}`}
                        >
                          <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${pendingIsActive ? 'translate-x-5' : 'translate-x-0'}`}></span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <p className="text-sm text-gray-500 font-medium">No subjects currently assigned.</p>
                </div>
              )}
            </section>

            {/* Requested Subjects */}
            {data.requests.length > 0 && (
              <section>
                <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2 uppercase tracking-wide">
                  <Clock size={16} className="text-amber-600" />
                  Requested Subjects
                </h4>
                
                <div className="border border-amber-200 rounded-lg divide-y divide-amber-100 overflow-hidden bg-amber-50/30">
                  {data.requests.map(request => {
                    const isApproved = requestChanges[request.id] || false;
                    
                    return (
                      <div key={request.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-gray-900">{request.subject_name}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 font-medium">
                            <span className="bg-white px-1.5 py-0.5 rounded text-gray-700 border border-gray-200">{request.subject_code}</span>
                            <span>•</span>
                            <span>{request.branch}</span>
                            <span>•</span>
                            <span>Sem {request.semester}</span>
                            <span>•</span>
                            <span>{request.academic_year}</span>
                          </div>
                        </div>
                        
                        <button 
                          onClick={() => setRequestChanges(prev => ({ ...prev, [request.id]: !isApproved }))}
                          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all border ${isApproved ? 'bg-green-600 text-white border-green-700 shadow-sm' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                        >
                          {isApproved ? 'APPROVED (Pending Save)' : 'Approve Request'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 shrink-0">
            <button
              onClick={handleClose}
              disabled={saving}
              className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges() || saving}
              className="px-5 py-2 bg-[#0b3578] text-white rounded-md text-sm font-medium hover:bg-[#0a2d66] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Confirm Close Sub-Modal */}
        {showConfirmClose && (
          <div className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 transform scale-100 transition-all">
              <div className="p-5 border-b border-gray-100 flex items-center gap-3 bg-amber-50/50">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="text-amber-600 w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Unsaved Changes</h3>
                  <p className="text-sm text-gray-500 mt-0.5">You have pending modifications.</p>
                </div>
              </div>
              <div className="p-5">
                <p className="text-sm text-gray-700">Are you sure you want to discard your changes? This action cannot be undone.</p>
                <div className="mt-6 flex gap-3 w-full">
                  <button onClick={() => setShowConfirmClose(false)} className="flex-1 bg-white border border-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                    Keep Editing
                  </button>
                  <button onClick={() => onClose()} className="flex-1 bg-amber-600 text-white font-medium py-2 px-4 rounded-lg text-sm hover:bg-amber-700 shadow-sm transition-colors">
                    Discard
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
