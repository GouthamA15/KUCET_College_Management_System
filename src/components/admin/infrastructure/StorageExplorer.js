'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  const [currentPath, setCurrentPath] = useState(''); // Empty string is root

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

  /**
   * DERIVED DATA: Compute the current view (Folders vs Files)
   */
  const viewData = useMemo(() => {
    // If searching, show a flat list (Global Search mode)
    if (searchTerm) {
      return {
        isSearch: true,
        items: files.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase())),
        folders: []
      };
    }

    const folders = new Set();
    const currentFiles = [];

    files.forEach(f => {
      const name = f.name;
      
      // If we're at root, and the path has segments
      if (currentPath === '') {
        if (name.includes('/')) {
          folders.add(name.split('/')[0]);
        } else {
          currentFiles.push(f);
        }
      } 
      // If we're in a folder (e.g., 'students')
      else if (name.startsWith(currentPath + '/')) {
        const relativePath = name.substring(currentPath.length + 1);
        if (relativePath.includes('/')) {
          folders.add(relativePath.split('/')[0]);
        } else {
          currentFiles.push(f);
        }
      }
    });

    return {
      isSearch: false,
      items: currentFiles,
      folders: Array.from(folders).sort()
    };
  }, [files, currentPath, searchTerm]);

  const breadcrumbs = useMemo(() => {
    if (!currentPath) return [];
    const segments = currentPath.split('/');
    return segments.map((s, i) => ({
      name: s,
      path: segments.slice(0, i + 1).join('/')
    }));
  }, [currentPath]);

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 border border-slate-200 shadow-sm rounded-sm gap-4">
        <div className="w-full md:w-auto">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            Bucket Explorer
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[8px] font-black rounded-full border border-blue-100 uppercase tracking-tighter">
              {storageType} mode
            </span>
          </h3>
          
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 mt-2 overflow-x-auto no-scrollbar">
            <button 
              onClick={() => { setCurrentPath(''); setSearchParams(''); }}
              className={`text-[9px] font-black uppercase tracking-widest ${currentPath === '' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Root
            </button>
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={b.path}>
                <span className="text-slate-300 text-[10px]">/</span>
                <button 
                  onClick={() => { setCurrentPath(b.path); setSearchParams(''); }}
                  className={`text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${i === breadcrumbs.length - 1 ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {b.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <input 
              type="text" 
              placeholder="Search all assets..." 
              value={searchTerm}
              onChange={(e) => setSearchParams(e.target.value)}
              className="w-full h-11 bg-slate-50 border border-slate-200 px-4 text-[11px] font-bold outline-none focus:border-blue-500 transition-all uppercase tracking-wider shadow-inner rounded-sm"
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
                <span>Full Export</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Structured View Grid/Table */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-sm overflow-hidden">
        <div className="bg-slate-50 px-8 py-4 border-b border-slate-200 flex justify-between items-center">
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
             {viewData.isSearch ? 'Search Results' : (currentPath || 'Root Directory')}
             {!viewData.isSearch && <span className="ml-2 opacity-60">({viewData.folders.length} folders, {viewData.items.length} files)</span>}
           </span>
           <button onClick={fetchFiles} className="text-[10px] font-black text-blue-600 hover:underline uppercase tracking-widest">Refresh Sync</button>
        </div>
        
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-white sticky top-0 z-10">
                <th className="px-8 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                <th className="px-8 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Asset Name</th>
                <th className="px-8 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Size</th>
                <th className="px-8 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Synchronizing cloud files...</span>
                    </div>
                  </td>
                </tr>
              ) : (viewData.folders.length === 0 && viewData.items.length === 0) ? (
                <tr>
                  <td colSpan="4" className="px-8 py-20 text-center text-slate-400 text-xs font-bold uppercase tracking-widest italic">Directory is empty.</td>
                </tr>
              ) : (
                <>
                  {/* FOLDERS FIRST */}
                  {viewData.folders.map(folder => (
                    <tr 
                      key={folder} 
                      onClick={() => setCurrentPath(currentPath ? `${currentPath}/${folder}` : folder)}
                      className="group hover:bg-blue-50/50 cursor-pointer transition-colors"
                    >
                      <td className="px-8 py-4">
                         <div className="w-10 h-10 bg-amber-50 border border-amber-100 rounded-sm flex items-center justify-center text-amber-500 shadow-sm group-hover:bg-amber-100 transition-colors">
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                               <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                            </svg>
                         </div>
                      </td>
                      <td className="px-8 py-4">
                        <div className="flex flex-col">
                           <span className="text-xs font-black text-slate-700 uppercase tracking-widest group-hover:text-blue-700">{folder}</span>
                           <span className="text-[8px] font-bold text-slate-400 mt-0.5 uppercase tracking-tighter">Directory</span>
                        </div>
                      </td>
                      <td className="px-8 py-4 text-slate-400 text-[10px] font-black">—</td>
                      <td className="px-8 py-4 text-slate-400 text-[10px] font-black">—</td>
                    </tr>
                  ))}

                  {/* FILES SECOND */}
                  {viewData.items.map((f, i) => (
                    <tr key={f.name + i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-3">
                         <div className="w-10 h-10 bg-white border border-slate-200 rounded-sm overflow-hidden flex items-center justify-center relative shadow-sm">
                            {f.secure_url || storageType === 'local' ? (
                              <Image 
                                src={f.secure_url || getAssetUrl(f.name)} 
                                alt="Asset" 
                                width={40} 
                                height={40} 
                                unoptimized
                                className="object-cover w-full h-full cursor-zoom-in hover:scale-110 transition-transform"
                                onClick={() => window.open(f.secure_url || getAssetUrl(f.name), '_blank')}
                              />
                            ) : (
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">BIN</span>
                            )}
                         </div>
                      </td>
                      <td className="px-8 py-3">
                        <div className="flex flex-col max-w-md">
                          <span className="text-xs font-black text-slate-700 truncate" title={f.name}>
                            {viewData.isSearch ? f.name : f.name.split('/').pop()}
                          </span>
                          <span className="text-[8px] font-mono text-slate-400 mt-1 uppercase">
                            {f.format || f.name.split('.').pop()} • {viewData.isSearch ? `Path: ${f.name}` : 'File'}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-3">
                         <span className="text-xs font-bold text-slate-600">{formatBytes(f.size)}</span>
                      </td>
                      <td className="px-8 py-3">
                         <span className="text-xs font-bold text-slate-500 whitespace-nowrap">{formatDate(f.created_at)}</span>
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Storage Alert Note */}
      <div className="bg-blue-50 border-l-4 border-blue-400 p-6 shadow-sm rounded-sm">
         <div className="flex gap-4">
           <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 text-blue-600">
             <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
             </svg>
           </div>
           <div className="space-y-1">
             <p className="text-[11px] font-black text-blue-800 uppercase tracking-widest">Institutional Asset Sovereignty</p>
             <p className="text-xs text-blue-700 leading-relaxed font-medium">
               The explorer provides a visual interface to your institutional {storageType} bucket. 
               The structure is derived from your database-standardized paths. 
               Use the global search for cross-directory auditing.
             </p>
           </div>
         </div>
      </div>
    </div>
  );
}
