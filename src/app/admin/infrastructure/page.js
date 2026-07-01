'use client';

import React, { useState } from 'react';
import BackupManager from '@/components/admin/infrastructure/BackupManager';
import StorageExplorer from '@/components/admin/infrastructure/StorageExplorer';
import ConfigManager from '@/components/admin/infrastructure/ConfigManager';

export default function InfrastructurePage() {
  const [activeTab, setActiveTab] = useState('config');

  return (
    <div className="min-h-screen bg-[#f8fbff] pb-20">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 sm:mt-10">
        
        {/* Header Section */}
        <div className="mb-6 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 uppercase tracking-tight break-words leading-tight">System Infrastructure</h1>
          <p className="text-sm text-slate-500 mt-1 sm:mt-2 font-medium leading-snug">Critical system maintenance, data sovereignty, and storage management.</p>
        </div>

        {/* Tab Navigation (Chips for Mobile) */}
        <div className="flex gap-2 sm:gap-4 mb-6 sm:mb-8 overflow-x-auto no-scrollbar pb-2">
          <button
            onClick={() => setActiveTab('config')}
            className={`px-4 sm:px-6 py-2.5 sm:py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest sm:tracking-[0.2em] transition-all rounded-full whitespace-nowrap border flex-shrink-0 ${
              activeTab === 'config'
                ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            System Configuration
          </button>
          <button
            onClick={() => setActiveTab('backups')}
            className={`px-4 sm:px-6 py-2.5 sm:py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest sm:tracking-[0.2em] transition-all rounded-full whitespace-nowrap border flex-shrink-0 ${
              activeTab === 'backups'
                ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            Database Sovereignty
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`px-4 sm:px-6 py-2.5 sm:py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest sm:tracking-[0.2em] transition-all rounded-full whitespace-nowrap border flex-shrink-0 ${
              activeTab === 'storage'
                ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            Storage Explorer
          </button>
        </div>

        {/* Tab Content */}
        <div className="animate-fadeIn">
          {activeTab === 'config' && <ConfigManager />}
          {activeTab === 'backups' && <BackupManager />}
          {activeTab === 'storage' && <StorageExplorer />}
        </div>
      </div>
    </div>
  );
}
