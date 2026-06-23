'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/date';

export default function BackupManager() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [restoreModal, setRestoreModal] = useState(null); // stores the backup to restore
  const [restoring, setRestoring] = useState(false);
  const [confirmString, setConfirmString] = useState('');

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/infrastructure/backups');
      const data = await res.json();
      if (res.ok) {
        setBackups(data.backups);
      } else {
        toast.error('Failed to load backups');
      }
    } catch (_error) {
      toast.error('Connection error while fetching backups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (isMounted) await fetchBackups();
    };
    load();
    return () => { isMounted = false; };
  }, []);

  const handleManualBackup = async () => {
    if (!confirm('This will generate a full database dump and upload it to Cloudinary. Proceed?')) return;
    
    setTriggering(true);
    const toastId = toast.loading('Generating system-wide backup...');
    try {
      const res = await fetch('/api/admin/infrastructure/backups', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success('Manual backup successfully completed.', { id: toastId });
        fetchBackups();
      } else {
        toast.error(`Backup failed: ${data.message || 'Unknown error'}`, { id: toastId });
      }
    } catch (_error) {
      toast.error('Failed to trigger backup execution.', { id: toastId });
    } finally {
      setTriggering(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreModal) return;
    
    setRestoring(true);
    const toastId = toast.loading(`Restoring system to ${restoreModal.name}...`);
    try {
      const res = await fetch('/api/admin/infrastructure/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: restoreModal.name })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Database successfully restored. System re-initialized.', { id: toastId });
        setRestoreModal(null);
      } else {
        toast.error(`Restoration failed: ${data.message || 'Unknown error'}`, { id: toastId });
      }
    } catch (_error) {
      toast.error('Critical error during restoration pipe.', { id: toastId });
    } finally {
      setRestoring(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Action Bar */}
      <div className="flex justify-between items-center bg-white p-6 border border-slate-200 shadow-sm rounded-sm">
        <div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Database Control</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Manual system snapshots and disaster recovery.</p>
        </div>
        <button
          onClick={handleManualBackup}
          disabled={triggering || loading}
          className="px-6 h-12 bg-slate-800 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-sm hover:bg-slate-900 transition-all shadow-md disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-3"
        >
          {triggering ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>Executing Dump...</span>
            </>
          ) : (
            <span>Run Backup Now</span>
          )}
        </button>
      </div>

      {/* Backups List */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-sm overflow-hidden">
        <div className="bg-slate-50 px-8 py-4 border-b border-slate-200">
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cloud Storage History (kucet/backups)</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-white">
                <th className="px-8 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Filename / ID</th>
                <th className="px-8 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Timestamp</th>
                <th className="px-8 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">File Size</th>
                <th className="px-8 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scanning cloud registry...</span>
                    </div>
                  </td>
                </tr>
              ) : backups.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-8 py-20 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">No previous backups detected.</td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.name} className="hover:bg-slate-50 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-700">{b.name}</span>
                        <span className="text-[9px] font-mono text-slate-400 mt-1 uppercase">MD5: {b.etag}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                       <span className="text-xs font-bold text-slate-600">{formatDate(b.created_at)}</span>
                    </td>
                    <td className="px-8 py-5">
                       <span className="text-xs font-bold text-slate-600">{formatBytes(b.size)}</span>
                    </td>
                    <td className="px-8 py-5 text-right">
                       <div className="flex items-center justify-end gap-3">
                          <a
                            href={`/api/admin/infrastructure/backups/download/${b.name}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-white hover:shadow-sm transition-all rounded-sm"
                          >
                            Download
                          </a>
                          <button
                            onClick={() => setRestoreModal(b)}
                            className="px-4 py-2 bg-rose-50 text-rose-700 border border-rose-100 text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all rounded-sm"
                          >
                            Restore
                          </button>
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restore Confirmation Modal */}
      {restoreModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white max-w-lg w-full shadow-2xl rounded-sm overflow-hidden border border-rose-200 animate-slideUp">
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-4 text-rose-600">
                <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight">Critical Warning</h3>
              </div>

              <div className="space-y-4">
                <p className="text-sm font-bold text-slate-700 leading-relaxed">
                  You are about to restore the system to a previous state using:
                </p>
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-sm">
                  <div className="text-xs font-black text-slate-800">{restoreModal.name}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Generated: {formatDate(restoreModal.created_at)}</div>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Type &quot;RESTORE_DATABASE&quot; to confirm</label>
                   <input 
                     type="text" 
                     value={confirmString}
                     onChange={(e) => setConfirmString(e.target.value)}
                     className="w-full h-12 border-2 border-rose-100 rounded-sm px-4 text-sm font-bold outline-none focus:border-rose-500 transition-all uppercase"
                     placeholder="CONFIRMATION STRING"
                   />
                </div>

                <p className="text-xs font-medium text-slate-500 italic">
                  * This action will OVERWRITE all current database records. This cannot be undone.
                </p>
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-100">
                <button
                  disabled={restoring}
                  onClick={() => { setRestoreModal(null); setConfirmString(''); }}
                  className="flex-1 h-12 border border-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-widest rounded-sm hover:bg-slate-50 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  disabled={restoring || confirmString !== 'RESTORE_DATABASE'}
                  onClick={handleRestore}
                  className="flex-2 h-12 bg-rose-600 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-sm hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20 flex items-center justify-center gap-3 disabled:bg-rose-300 disabled:shadow-none"
                >
                  {restoring ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Restoring...</span>
                    </>
                  ) : (
                    <span>Confirm Restore</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
