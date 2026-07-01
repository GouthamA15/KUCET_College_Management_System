'use client';

import React, { useState } from 'react';
import BackupManager from '@/components/admin/infrastructure/BackupManager';
import StorageExplorer from '@/components/admin/infrastructure/StorageExplorer';
import ConfigManager from '@/components/admin/infrastructure/ConfigManager';

export default function InfrastructurePage() {
  const [activeTab, setActiveTab] = useState('config');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f8fbff] pb-20">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 sm:mt-10">
        
        {/* Header Section */}
        <div className="mb-6 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 uppercase tracking-tight break-words leading-tight">System Infrastructure</h1>
          <p className="text-sm text-slate-500 mt-1 sm:mt-2 font-medium leading-snug">Critical system maintenance, data sovereignty, and storage management.</p>
        </div>

        
        {/* Mobile Section Drawer Button */}
        <div className="md:hidden mb-6">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg shadow-sm"
          >
            <div className="flex flex-col items-start">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Infrastructure Section</span>
              <span className="text-sm font-black text-[#0b3578]">
                {activeTab === 'config' ? 'System Configuration' : activeTab === 'backups' ? 'Database Sovereignty' : 'Storage Explorer'}
              </span>
            </div>
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          {/* Mobile Drawer */}
          {isMobileMenuOpen && (
            <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-slate-900/50 backdrop-blur-sm animate-in fade-in" onClick={() => setIsMobileMenuOpen(false)}>
              <div className="bg-white w-full rounded-t-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-full" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-lg text-slate-800 uppercase tracking-tight">Infrastructure Sections</h3>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {[
                    { id: 'config', name: 'System Configuration' },
                    { id: 'backups', name: 'Database Sovereignty' },
                    { id: 'storage', name: 'Storage Explorer' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveTab(tab.id); setIsMobileMenuOpen(false); }}
                      className={`w-full text-left px-5 py-4 rounded-xl text-sm font-bold uppercase tracking-widest transition-all ${
                        activeTab === tab.id
                          ? 'bg-blue-50 text-blue-700 border-2 border-blue-200'
                          : 'bg-white text-slate-600 border-2 border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      {tab.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Desktop Tab Navigation */}
        <div className="hidden md:flex gap-4 mb-8 border-b border-slate-200 pb-px">
          <button
            onClick={() => setActiveTab('config')}
            className={`px-6 py-3 text-xs font-black uppercase tracking-[0.2em] transition-all ${
              activeTab === 'config'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            System Configuration
          </button>
          <button
            onClick={() => setActiveTab('backups')}
            className={`px-6 py-3 text-xs font-black uppercase tracking-[0.2em] transition-all ${
              activeTab === 'backups'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Database Sovereignty
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`px-6 py-3 text-xs font-black uppercase tracking-[0.2em] transition-all ${
              activeTab === 'storage'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-500 hover:text-slate-800'
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
