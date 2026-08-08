'use client';
import React from 'react';

export function StudentDashboardSkeleton() {
  return (
    <div className="-mx-4 lg:-mx-8 -mt-4 bg-slate-50 lg:h-full lg:min-h-0 lg:overflow-hidden">
      <div className="max-w-7xl mx-auto lg:h-full lg:min-h-0 px-4 lg:px-8 py-4 lg:py-3 animate-pulse flex flex-col gap-4 lg:gap-3">
        {/* Header */}
        <div className="shrink-0 h-28 lg:h-32 lg:rounded-sm bg-slate-200 w-full"></div>
        
        <div className="grid grid-cols-1 lg:flex lg:flex-row lg:gap-3 lg:flex-1 lg:min-h-0">
          {/* Priority Actions */}
          <div className="order-1 lg:order-1 flex flex-col gap-4 lg:gap-3 lg:w-1/3 lg:min-h-0">
            <div className="h-64 lg:h-full bg-slate-200 rounded-sm"></div>
          </div>
          
          {/* Academic Records and Support */}
          <div className="order-2 lg:order-2 flex flex-col gap-4 lg:gap-3 lg:w-2/3 lg:min-h-0">
            <div className="h-96 lg:h-full bg-slate-200 rounded-sm"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ClerkDashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16 px-4 md:px-8 animate-pulse font-sans">
      {/* Banner */}
      <div className="h-32 bg-slate-200 rounded-md w-full"></div>
      
      {/* Metrics */}
      <div className="space-y-4">
        <div className="flex justify-between">
          <div className="h-4 bg-slate-200 w-32 rounded"></div>
          <div className="h-4 bg-slate-200 w-20 rounded"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
           {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-200 rounded-md border border-slate-100"></div>)}
        </div>
      </div>

      {/* Primary Operations */}
      <div className="space-y-4">
        <div className="flex justify-between">
          <div className="h-4 bg-slate-200 w-40 rounded"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
           {[...Array(3)].map((_, i) => <div key={i} className="h-36 bg-slate-200 rounded-md border border-slate-100"></div>)}
        </div>
      </div>
    </div>
  );
}

export function AdminDashboardSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center p-2 sm:p-4 animate-pulse">
      <div className="w-full max-w-6xl mx-auto bg-white border border-slate-200 shadow-sm p-4 sm:p-6 lg:p-8 flex flex-col items-center space-y-6">
        <div className="h-8 bg-slate-200 w-64 rounded"></div>
        
        {/* Search */}
        <div className="w-full flex gap-2">
           <div className="h-10 bg-slate-200 rounded flex-1"></div>
           <div className="h-10 bg-slate-200 rounded w-24"></div>
        </div>
        
        {/* Tabs */}
        <div className="w-full flex border-b gap-4 pb-2">
           <div className="h-6 bg-slate-200 w-32 rounded"></div>
           <div className="h-6 bg-slate-200 w-32 rounded"></div>
        </div>
        
        {/* Stats Grid */}
        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4">
           {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-slate-200 rounded border border-slate-100"></div>)}
        </div>

        {/* Big Table Area */}
        <div className="w-full h-64 bg-slate-200 rounded mt-4"></div>
      </div>
    </div>
  );
}
