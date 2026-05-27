'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function ConfigManager() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/infrastructure/config');
      const data = await res.json();
      if (res.ok) {
        setConfig(data.config);
      } else {
        toast.error('Failed to load institutional configuration');
      }
    } catch (error) {
      toast.error('Connection error while fetching settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (isMounted) await fetchConfig();
    })();
    return () => { isMounted = false; };
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    const toastId = toast.loading('Synchronizing institutional settings...');
    try {
      const res = await fetch('/api/admin/infrastructure/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        toast.success('Institutional configuration updated successfully.', { id: toastId });
        fetchConfig();
      } else {
        toast.error('Failed to update configuration.', { id: toastId });
      }
    } catch (error) {
      toast.error('Critical error during synchronization.', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-sm">
        <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">Retrieving system registry...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleUpdate} className="space-y-8 animate-fadeIn">
      
      {/* 1. Core Identity */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-sm overflow-hidden">
        <div className="bg-slate-50 px-8 py-4 border-b border-slate-200">
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Institutional Identity</span>
        </div>
        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full College Name</label>
            <input 
              type="text" 
              value={config.name || ''} 
              onChange={(e) => setConfig({...config, name: e.target.value})}
              className="w-full h-12 bg-slate-50 border border-slate-200 rounded-sm px-4 text-xs font-bold focus:border-blue-500 outline-none transition-all uppercase"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Short Name / Abbreviation</label>
            <input 
              type="text" 
              value={config.short_name || ''} 
              onChange={(e) => setConfig({...config, short_name: e.target.value})}
              className="w-full h-12 bg-slate-50 border border-slate-200 rounded-sm px-4 text-xs font-bold focus:border-blue-500 outline-none transition-all uppercase"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Official Address</label>
            <textarea 
              rows="3"
              value={config.address || ''} 
              onChange={(e) => setConfig({...config, address: e.target.value})}
              className="w-full bg-slate-50 border border-slate-200 rounded-sm p-4 text-xs font-bold focus:border-blue-500 outline-none transition-all uppercase"
            />
          </div>
        </div>
      </div>

      {/* 2. Localization & Contact */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-sm overflow-hidden">
        <div className="bg-slate-50 px-8 py-4 border-b border-slate-200">
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Localization & Reach</span>
        </div>
        <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">City / Location</label>
            <input 
              type="text" 
              value={config.location || ''} 
              onChange={(e) => setConfig({...config, location: e.target.value})}
              className="w-full h-12 bg-slate-50 border border-slate-200 rounded-sm px-4 text-xs font-bold focus:border-blue-500 outline-none transition-all uppercase"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pincode</label>
            <input 
              type="text" 
              value={config.pincode || ''} 
              onChange={(e) => setConfig({...config, pincode: e.target.value})}
              className="w-full h-12 bg-slate-50 border border-slate-200 rounded-sm px-4 text-xs font-bold focus:border-blue-500 outline-none transition-all uppercase"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Official Contact</label>
            <input 
              type="text" 
              value={config.contact || ''} 
              onChange={(e) => setConfig({...config, contact: e.target.value})}
              className="w-full h-12 bg-slate-50 border border-slate-200 rounded-sm px-4 text-xs font-bold focus:border-blue-500 outline-none transition-all uppercase"
            />
          </div>
        </div>
      </div>

      {/* 3. Entrance Codes (JSON) */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-sm overflow-hidden">
        <div className="bg-slate-50 px-8 py-4 border-b border-slate-200">
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Institutional Entrance Codes</span>
        </div>
        <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
           {['pgecet', 'eapcet', 'ecet'].map(exam => (
             <div key={exam} className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{exam} Code</label>
                <input 
                  type="text" 
                  value={config.entrance_codes?.[exam] || ''} 
                  onChange={(e) => setConfig({
                    ...config, 
                    entrance_codes: { ...config.entrance_codes, [exam]: e.target.value }
                  })}
                  className="w-full h-12 bg-slate-50 border border-slate-200 rounded-sm px-4 text-xs font-bold focus:border-blue-500 outline-none transition-all uppercase"
                />
             </div>
           ))}
        </div>
      </div>

      {/* 4. Safety & Maintenance */}
      <div className="bg-rose-50 border border-rose-100 shadow-sm rounded-sm overflow-hidden">
        <div className="bg-rose-100 px-8 py-4 border-b border-rose-200 flex justify-between items-center">
           <span className="text-[10px] font-black text-rose-700 uppercase tracking-widest">System Governance</span>
           <span className="px-2 py-0.5 bg-rose-600 text-white text-[8px] font-black rounded-full uppercase tracking-tighter">High Privilege</span>
        </div>
        <div className="p-8 flex items-center justify-between">
           <div className="space-y-1">
             <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Institutional Maintenance Mode</p>
             <p className="text-xs text-slate-500 font-medium">When active, the portal becomes read-only for students and staff. Only Super Admins can make modifications.</p>
           </div>
           <button
             type="button"
             onClick={() => setConfig({...config, maintenance_mode: !config.maintenance_mode})}
             className={`w-16 h-8 rounded-full p-1 transition-all duration-300 ${config.maintenance_mode ? 'bg-rose-600' : 'bg-slate-300'}`}
           >
             <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-all duration-300 ${config.maintenance_mode ? 'translate-x-8' : 'translate-x-0'}`}></div>
           </button>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4">
         <button
           type="submit"
           disabled={saving}
           className="px-10 h-14 bg-slate-800 text-white text-xs font-black uppercase tracking-[0.2em] rounded-sm hover:bg-slate-900 transition-all shadow-xl disabled:bg-slate-300 flex items-center gap-4"
         >
           {saving ? (
             <>
               <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
               <span>Updating System...</span>
             </>
           ) : (
             <span>Synchronize Configuration</span>
           )}
         </button>
      </div>
    </form>
  );
}
