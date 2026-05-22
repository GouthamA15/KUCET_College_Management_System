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
        <div className="mb-10">
          <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight">System Infrastructure</h1>
          <p className="text-slate-500 mt-2 font-medium">Critical system maintenance, data sovereignty, and storage management.</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 mb-8 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('config')}
            className={`px-8 py-4 text-xs font-black uppercase tracking-[0.2em] transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'config'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            System Configuration
          </button>
          <button
            onClick={() => setActiveTab('backups')}
            className={`px-8 py-4 text-xs font-black uppercase tracking-[0.2em] transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'backups'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Database Sovereignty
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`px-8 py-4 text-xs font-black uppercase tracking-[0.2em] transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'storage'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-400 hover:text-slate-600'
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
