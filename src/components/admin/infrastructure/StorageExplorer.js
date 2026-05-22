'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import Image from 'next/image';
import { formatDate } from '@/lib/date';
import { getAssetUrl } from '@/lib/assets';

export default function StorageExplorer() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storageType, setStorageType] = useState('cloudinary');
  const [zipping, setZipping] = useState(false);
  const [searchTerm, setSearchParams] = useState('');

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/infrastructure/storage');
      const data = await res.json();
      if (res.ok) {
        setFiles(data.files);
        setStorageType(data.storageType);
      } else {
        toast.error('Failed to load storage files');
      }
    } catch (error) {
      toast.error('Connection error while exploring bucket');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (isMounted) await fetchFiles();
    };
    load();
    return () => { isMounted = false; };
  }, []);

  const handleZipDownload = () => {
    if (!confirm('This will generate a compressed archive of ALL institutional assets. This may take a moment depending on the bucket size. Proceed?')) return;
    
    setZipping(true);
    toast.loading('Generating storage archive...', { duration: 5000 });
    
    // Redirect to the zip API which will eventually redirect to the zip file
    window.location.href = '/api/admin/infrastructure/storage/zip';
    
    setTimeout(() => setZipping(false), 5000);
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 border border-slate-200 shadow-sm rounded-sm gap-4">
        <div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            Bucket Explorer
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[8px] font-black rounded-full border border-blue-100 uppercase tracking-tighter">
              {storageType} mode
            </span>
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Institutional asset registry and bulk portability.</p>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <input 
              type="text" 
              placeholder="Search assets..." 
              value={searchTerm}
              onChange={(e) => setSearchParams(e.target.value)}
              className="w-full h-11 bg-slate-50 border border-slate-200 px-4 text-[11px] font-bold outline-none focus:border-blue-500 transition-all uppercase tracking-wider"
            />
          </div>
          <button
            onClick={handleZipDownload}
            disabled={zipping || loading}
            className="px-6 h-11 bg-[#0b3578] text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-sm hover:bg-blue-900 transition-all shadow-md disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-3 whitespace-nowrap"
          >
            {zipping ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Compressing...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Download Full ZIP</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Files Grid/Table */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-sm overflow-hidden">
        <div className="bg-slate-50 px-8 py-4 border-b border-slate-200 flex justify-between items-center">
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Asset Registry ({filteredFiles.length} items)</span>
           <button onClick={fetchFiles} className="text-[10px] font-black text-blue-600 hover:underline uppercase tracking-widest">Refresh Registry</button>
        </div>
        
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-white z-10 shadow-sm">
              <tr className="border-b border-slate-100">
                <th className="px-8 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Preview</th>
                <th className="px-8 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Asset Name / Path</th>
                <th className="px-8 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Size</th>
                <th className="px-8 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Indexing institutional bucket...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredFiles.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-8 py-20 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">No assets matching your search.</td>
                </tr>
              ) : (
                filteredFiles.map((f, i) => (
                  <tr key={f.name + i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-3">
                       <div className="w-12 h-12 bg-slate-100 border border-slate-200 rounded-sm overflow-hidden flex items-center justify-center relative group">
                          {f.secure_url || storageType === 'local' ? (
                            <Image 
                              src={f.secure_url || getAssetUrl(f.name)} 
                              alt="Asset" 
                              width={48} 
                              height={48} 
                              unoptimized
                              className="object-cover w-full h-full cursor-pointer hover:scale-110 transition-transform"
                              onClick={() => window.open(f.secure_url || getAssetUrl(f.name), '_blank')}
                            />
                          ) : (
                            <span className="text-[8px] font-black text-slate-400 uppercase">RAW</span>
                          )}
                       </div>
                    </td>
                    <td className="px-8 py-3">
                      <div className="flex flex-col max-w-md">
                        <span className="text-xs font-black text-slate-700 truncate" title={f.name}>{f.name}</span>
                        <span className="text-[8px] font-mono text-slate-400 mt-1 uppercase">Format: {f.format || f.name.split('.').pop()}</span>
                      </div>
                    </td>
                    <td className="px-8 py-3">
                       <span className="text-xs font-bold text-slate-600">{formatBytes(f.size)}</span>
                    </td>
                    <td className="px-8 py-3">
                       <span className="text-xs font-bold text-slate-500">{formatDate(f.created_at)}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Storage Alert Note */}
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
         <div className="flex gap-3">
           <svg className="h-5 w-5 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
           </svg>
           <div className="space-y-1">
             <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Data Sovereignty Note</p>
             <p className="text-[11px] text-blue-700 leading-relaxed font-medium">The full ZIP download generates a point-in-time archive. For high-volume buckets, this may trigger temporary rate limiting on the storage provider.</p>
           </div>
         </div>
      </div>
    </div>
  );
}
