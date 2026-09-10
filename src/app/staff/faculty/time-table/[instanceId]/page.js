'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useStaff } from '@/context/StaffContext';
import UniversalTimetable from '@/components/timetable/UniversalTimetable';
import SlotEditorModal from '@/components/timetable/SlotEditorModal';

export default function TimetableInstancePage({ params }) {
  const router = useRouter();
  const { staffData } = useStaff();
  
  // Unwrap params using React.use for Next.js app router compatibility
  const unwrappedParams = use(params);
  const instanceId = parseInt(unwrappedParams.instanceId);
  
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isEditingPublished, setIsEditingPublished] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  const fetchData = useCallback(async () => {
    if (!staffData?.is_hod || !instanceId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/staff/hod/timetable-instances/${instanceId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      } else {
        toast.error('Failed to load instance');
        router.push('/staff/faculty/time-table');
      }
    } catch (_e) {
      toast.error('Network error');
    } finally {
      setIsLoading(false);
    }
  }, [staffData?.is_hod, instanceId, router]);

  useEffect(() => {
    if (staffData?.is_hod && instanceId) {
      const timer = setTimeout(() => fetchData(), 0);
      return () => clearTimeout(timer);
    }
  }, [staffData?.is_hod, instanceId, fetchData]);

  const handleArchive = async () => {
    setIsPublishing(true);
    try {
      const res = await fetch(`/api/staff/hod/timetable-instances/${instanceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ARCHIVED' })
      });
      if (res.ok) {
        toast.success('Timetable archived successfully');
        setShowArchiveConfirm(false);
        fetchData();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed to archive');
      }
    } catch (_e) {
      toast.error('Network error');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleReactivate = async () => {
    setIsPublishing(true);
    try {
      const res = await fetch(`/api/staff/hod/timetable-instances/${instanceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DRAFT' })
      });
      if (res.ok) {
        toast.success('Timetable reactivated to Draft');
        fetchData();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed to reactivate');
      }
    } catch (_e) {
      toast.error('Network error');
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const res = await fetch(`/api/staff/hod/timetable-instances/${instanceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PUBLISHED' })
      });
      if (res.ok) {
        toast.success('Timetable published successfully');
        fetchData();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed to publish');
      }
    } catch (_e) {
      toast.error('Network error');
    } finally {
      setIsPublishing(false);
    }
  };

  if (!staffData?.is_hod) return null;

  if (isLoading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-[#0b3578] border-t-transparent animate-spin rounded-full"></div></div>;
  }

  if (!data) return null;
  const { instance, entries } = data;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-sm pb-10">
      <div className="mb-2">
        <button onClick={() => router.push('/staff/faculty/time-table')} className="text-[#0b3578] hover:underline font-medium text-xs cursor-pointer">
          &larr; Back to Timetable
        </button>
      </div>

      <header className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white border border-slate-200 p-6 rounded-md shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-semibold text-gray-800">{instance.branch} &mdash; Semester {instance.semester}</h1>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
              instance.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' :
              instance.status === 'DRAFT' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
            }`}>
              {instance.status}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            Year {Math.ceil(instance.semester / 2)} &bull; {instance.academic_year}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {instance.status === 'PUBLISHED' && !isEditingPublished && (
            <button 
              onClick={() => setIsEditingPublished(true)}
              className="bg-[#0b3578] text-white px-5 py-2 rounded-md font-medium text-sm hover:bg-blue-900 transition-colors shrink-0 cursor-pointer"
            >
              Edit Timetable
            </button>
          )}
          {instance.status === 'PUBLISHED' && isEditingPublished && (
            <button 
              onClick={() => setIsEditingPublished(false)}
              className="bg-slate-100 text-slate-700 border border-slate-300 px-5 py-2 rounded-md font-medium text-sm hover:bg-slate-200 transition-colors shrink-0 cursor-pointer"
            >
              Done Editing
            </button>
          )}
          {instance.status === 'PUBLISHED' && (
            <button 
              onClick={() => setShowArchiveConfirm(true)}
              disabled={isPublishing}
              className="bg-slate-100 text-rose-600 border border-slate-300 px-5 py-2 rounded-md font-medium text-sm hover:bg-rose-50 hover:border-rose-300 transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
            >
              Archive Timetable
            </button>
          )}
          {instance.status === 'DRAFT' && (
            <button 
              onClick={handlePublish}
              disabled={isPublishing}
              className="bg-[#0b3578] text-white px-5 py-2 rounded-md font-medium text-sm hover:bg-blue-900 transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
            >
              {isPublishing ? 'Publishing...' : 'Publish Timetable'}
            </button>
          )}
          {instance.status === 'ARCHIVED' && (
            <button 
              onClick={handleReactivate}
              disabled={isPublishing}
              className="bg-emerald-600 text-white border border-emerald-700 px-5 py-2 rounded-md font-medium text-sm hover:bg-emerald-700 transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
            >
              {isPublishing ? 'Reactivating...' : 'Reactivate Timetable'}
            </button>
          )}
        </div>
      </header>

      <div className="bg-white border border-slate-200 shadow-sm rounded-md overflow-hidden">
        <UniversalTimetable 
          data={entries} 
          isEditable={instance.status === 'DRAFT' || (instance.status === 'PUBLISHED' && isEditingPublished)} 
          onEditSlot={(day, period, current) => setEditingSlot({ day, period, current })} 
          title="Class Schedule Matrix" 
        />
      </div>

      {editingSlot && (
        <SlotEditorModal 
          instanceId={instanceId}
          instance={instance}
          editingSlot={editingSlot}
          onClose={() => setEditingSlot(null)}
          onSaved={() => {
            setEditingSlot(null);
            fetchData();
          }}
          entries={entries}
          isEditable={instance.status !== 'ARCHIVED'}
        />
      )}

      {showArchiveConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="font-bold text-xl text-slate-800 mb-2">Archive Timetable?</h3>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Are you sure you want to archive this timetable? It will become strictly read-only and will no longer be visible to students as the active schedule.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowArchiveConfirm(false)}
                className="px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleArchive}
                disabled={isPublishing}
                className="px-4 py-2.5 text-sm font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {isPublishing ? 'Archiving...' : 'Yes, Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
