'use client';

import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/date';

export default function BackupManager() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [restoreModal, setRestoreModal] = useState(null); // stores the backup object to restore
  const [restoring, setRestoring] = useState(false);
  const [confirmString, setConfirmString] = useState('');

  const fetchBackups = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await fetch('/api/admin/infrastructure/backups');
      const data = await res.json();
      if (res.ok) {
        setBackups(data.backups || []);
      } else {
        toast.error(data.message || 'Failed to load backups');
      }
    } catch (_error) {
      toast.error('Connection error while fetching backups');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const initialLoad = async () => {
      try {
        const res = await fetch('/api/admin/infrastructure/backups');
        const data = await res.json();
        if (isMounted) {
          if (res.ok) {
            setBackups(data.backups || []);
          } else {
            toast.error(data.message || 'Failed to load backups');
          }
        }
      } catch (_error) {
        if (isMounted) toast.error('Connection error while fetching backups');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    initialLoad();
    return () => { isMounted = false; };
  }, []);

  const handleManualBackup = async () => {
    if (!confirm('This will generate a full database snapshot, verify its integrity, compress it, and enforce the 14-day retention policy. Proceed?')) return;
    
    setTriggering(true);
    const toastId = toast.loading('Generating consistent database snapshot...');
    try {
      const res = await fetch('/api/admin/infrastructure/backups', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Manual backup successfully created.', { id: toastId });
        await fetchBackups(true);
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
    const filename = restoreModal.filename || restoreModal.name;
    
    setRestoring(true);
    const toastId = toast.loading(`Initiating safety snapshot and restoring from ${filename}...`);
    try {
      const res = await fetch('/api/admin/infrastructure/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          confirmPhrase: confirmString
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Database restored successfully! Verified ${data.verifiedTables || 'all'} tables. Emergency backup: ${data.emergencyBackupFilename || 'Created'}.`, { id: toastId, duration: 6000 });
        setRestoreModal(null);
        setConfirmString('');
        await fetchBackups(true);
      } else {
        toast.error(`Restoration failed: ${data.message || 'Unknown error'}`, { id: toastId });
      }
    } catch (_error) {
      toast.error('Critical error during restoration pipeline.', { id: toastId });
    } finally {
      setRestoring(false);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getTypeBadge = (backup) => {
    if (backup.isEmergency || backup.backup_type === 'EMERGENCY_PRE_RESTORE') {
      return (
        <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-800 rounded-xs border border-amber-200">
          Emergency Snapshot
        </span>
      );
    }
    if (backup.backup_type === 'MANUAL') {
      return (
        <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-blue-100 text-blue-800 rounded-xs border border-blue-200">
          Manual Dump
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-800 rounded-xs border border-emerald-200">
        Scheduled Daily
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 sm:p-6 border border-slate-200 shadow-sm rounded-sm gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Database Backup & Recovery Engine</h3>
            <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 rounded-xs border border-slate-200">
              14-Day Retention
            </span>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            Automated Daily at 02:30 AM • SHA-256 Verified • Guarded Pre-Restore Snapshots
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => fetchBackups()}
            disabled={loading}
            className="px-4 h-11 border border-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-widest rounded-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
            title="Refresh Backups List"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
          <button
            onClick={handleManualBackup}
            disabled={triggering || loading}
            className="flex-1 sm:flex-none px-6 h-11 bg-slate-800 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-sm hover:bg-slate-900 transition-all shadow-md disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {triggering ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Exporting...</span>
              </>
            ) : (
              <span>Create Backup Now</span>
            )}
          </button>
        </div>
      </div>

      {/* Backups List */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-sm overflow-hidden">
        <div className="bg-slate-50 px-4 sm:px-6 md:px-8 py-4 border-b border-slate-200 flex justify-between items-center">
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
             Persistent VPS Storage Backups ({backups.length} Available)
           </span>
           <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">
             Auto-Pruned &gt; 14 Days
           </span>
        </div>
        
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-white">
                  <th className="px-4 sm:px-8 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Filename / Checksum</th>
                  <th className="px-4 sm:px-8 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                  <th className="px-4 sm:px-8 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Timestamp</th>
                  <th className="px-4 sm:px-8 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Size</th>
                  <th className="px-4 sm:px-8 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-4 sm:px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scanning backup registry...</span>
                      </div>
                    </td>
                  </tr>
                ) : backups.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-4 sm:px-8 py-20 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">No previous backups detected on disk.</td>
                  </tr>
                ) : (
                  backups.map((b) => {
                    const filename = b.filename || b.name;
                    return (
                      <tr key={filename} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 sm:px-8 py-5">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-700 font-mono">{filename}</span>
                            {b.checksum_sha256 && (
                              <span className="text-[9px] font-mono text-slate-400 mt-1 uppercase truncate max-w-md">
                                SHA256: {b.checksum_sha256}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 sm:px-8 py-5">
                          {getTypeBadge(b)}
                        </td>
                        <td className="px-4 sm:px-8 py-5">
                           <span className="text-xs font-bold text-slate-600">{formatDate(b.created_at)}</span>
                        </td>
                        <td className="px-4 sm:px-8 py-5">
                           <span className="text-xs font-bold text-slate-600 font-mono">{formatBytes(b.size)}</span>
                        </td>
                        <td className="px-4 sm:px-8 py-5 text-right">
                           <div className="flex items-center justify-end gap-2.5">
                              <a
                                href={`/api/admin/infrastructure/backups/download/${encodeURIComponent(filename)}`}
                                download={filename}
                                className="px-3.5 py-1.5 border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-100 transition-all rounded-xs shadow-2xs"
                              >
                                Download
                              </a>
                              <button
                                onClick={() => { setRestoreModal(b); setConfirmString(''); }}
                                className="px-3.5 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all rounded-xs"
                              >
                                Restore
                              </button>
                           </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          {/* Mobile Card List */}
          <div className="md:hidden flex flex-col gap-4 p-4 bg-slate-50">
            {loading ? (
              <div className="py-10 text-center flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scanning backup storage...</span>
              </div>
            ) : backups.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">No previous backups detected on disk.</div>
            ) : (
              backups.map((b) => {
                const filename = b.filename || b.name;
                return (
                  <div key={filename} className="bg-white border border-slate-200 rounded-sm p-4 shadow-xs flex flex-col gap-3">
                    <div className="flex flex-col border-b border-slate-100 pb-2">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-xs font-black text-slate-700 break-all font-mono">{filename}</span>
                        {getTypeBadge(b)}
                      </div>
                      {b.checksum_sha256 && (
                        <span className="text-[8px] font-mono text-slate-400 mt-1 uppercase break-all">
                          SHA256: {b.checksum_sha256}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex justify-between items-center text-xs text-slate-600">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Timestamp</span>
                        <span>{formatDate(b.created_at)}</span>
                      </div>
                      <div className="flex flex-col gap-0.5 items-end">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Size</span>
                        <span className="font-bold text-slate-700 font-mono">{formatBytes(b.size)}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 mt-1">
                      <a
                        href={`/api/admin/infrastructure/backups/download/${encodeURIComponent(filename)}`}
                        download={filename}
                        className="flex-1 text-center py-2 border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-all rounded-xs"
                      >
                        Download
                      </a>
                      <button
                        onClick={() => { setRestoreModal(b); setConfirmString(''); }}
                        className="flex-1 py-2 bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all rounded-xs"
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      </div>

      {/* Restore Confirmation Modal */}
      {restoreModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
          <div className="bg-white max-w-lg w-full shadow-2xl rounded-sm overflow-hidden border border-rose-300 animate-slideUp my-auto">
            <div className="p-4 sm:p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-4 text-rose-600">
                <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight text-slate-900">Guarded Database Restoration</h3>
                  <p className="text-[10px] font-black text-rose-600 uppercase tracking-wider">High Risk Critical Operation</p>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-bold text-slate-700 leading-relaxed">
                  You are about to restore the system database from snapshot:
                </p>
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-xs font-mono">
                  <div className="text-xs font-black text-slate-800 break-all">{restoreModal.filename || restoreModal.name}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Snapshot Date: {formatDate(restoreModal.created_at)}</div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xs p-3.5 space-y-1.5 text-amber-900">
                  <div className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
                    <span>🛡️ Automated Safety Guarantee:</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    The system will automatically create an <strong>Emergency Pre-Restore Backup</strong> of the current live database before applying any changes. If the emergency backup fails, restoration aborts immediately.
                  </p>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
                     Type <span className="text-rose-600 underline">RESTORE</span> to confirm:
                   </label>
                   <input 
                     type="text" 
                     value={confirmString}
                     onChange={(e) => setConfirmString(e.target.value.trim().toUpperCase())}
                     className="w-full h-11 border-2 border-rose-200 rounded-xs px-4 text-sm font-bold outline-none focus:border-rose-500 transition-all uppercase font-mono"
                     placeholder="TYPE RESTORE"
                     autoFocus
                   />
                </div>

                <p className="text-[11px] font-medium text-slate-500 italic">
                  * Restoring will replace existing table data with this snapshot. Active domain caches will be automatically invalidated.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
                <button
                  disabled={restoring}
                  onClick={() => { setRestoreModal(null); setConfirmString(''); }}
                  className="w-full sm:flex-1 h-11 border border-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-widest rounded-xs hover:bg-slate-50 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  disabled={restoring || confirmString !== 'RESTORE'}
                  onClick={handleRestore}
                  className="w-full sm:flex-2 h-11 bg-rose-600 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-xs hover:bg-rose-700 transition-all shadow-md flex items-center justify-center gap-3 disabled:bg-rose-300 disabled:shadow-none cursor-pointer disabled:cursor-not-allowed"
                >
                  {restoring ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Restoring Database...</span>
                    </>
                  ) : (
                    <span>Confirm & Execute Restore</span>
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
