import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { BookOpen } from 'lucide-react';

export default function HodSelfProgramManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allPrograms, setAllPrograms] = useState([]);
  const [allocatedIds, setAllocatedIds] = useState([]);
  const [programChanges, setProgramChanges] = useState({});

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/staff/hod/my-programs');
        const json = await res.json();
        if (res.ok) {
          setAllPrograms(json.data.allPrograms || []);
          setAllocatedIds(json.data.allocatedProgramIds || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleSave = async () => {
    if (Object.keys(programChanges).length === 0) return;
    setSaving(true);
    try {
      const payload = {
        programChanges: Object.entries(programChanges).map(([id, enabled]) => ({
          programId: parseInt(id, 10),
          enabled
        }))
      };
      const res = await fetch('/api/staff/hod/my-programs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        toast.success('Teaching Programs updated successfully');
        setProgramChanges({});
        const res2 = await fetch('/api/staff/hod/my-programs');
        const json = await res2.json();
        if (res2.ok) setAllocatedIds(json.data.allocatedProgramIds || []);
      } else {
        toast.error('Failed to update programs');
      }
    } catch (e) {
      toast.error('Error saving programs');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = Object.keys(programChanges).length > 0;

  if (loading) return <div className="animate-pulse h-16 bg-gray-100 rounded-md"></div>;

  return (
    <div className="mt-6 bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
        <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2 uppercase tracking-wide">
          <BookOpen size={16} className="text-[#0b3578]" />
          Teaching Programs
        </h4>
        {hasChanges && (
          <div className="flex gap-2">
            <button
              onClick={() => setProgramChanges({})}
              disabled={saving}
              className="text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs font-bold bg-[#0b3578] text-white px-4 py-1.5 rounded hover:bg-blue-900 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        {allPrograms.map(prog => {
          const currentIsAllocated = allocatedIds.includes(prog.id);
          const pendingIsAllocated = programChanges[prog.id] !== undefined ? programChanges[prog.id] : currentIsAllocated;
          
          return (
            <button
              key={prog.id}
              onClick={() => setProgramChanges(prev => ({ ...prev, [prog.id]: !pendingIsAllocated }))}
              className={`flex items-center px-4 py-2 rounded-md border text-sm font-bold transition-all duration-200 ${
                pendingIsAllocated 
                  ? 'bg-[#0b3578] border-[#0b3578] text-white shadow-sm' 
                  : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50 hover:border-slate-400'
              }`}
            >
              {prog.program_code}
              <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-sm ${pendingIsAllocated ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {pendingIsAllocated ? 'ON' : 'OFF'}
              </span>
            </button>
          );
        })}
        {allPrograms.length === 0 && <p className="text-sm text-gray-500">No programs available.</p>}
      </div>
    </div>
  );
}
