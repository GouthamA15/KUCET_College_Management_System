'use client';
import React from 'react';

export function StudentDashboardSkeleton() {
  return (
    <div className="-mx-4 lg:-mx-8 -mt-4 bg-slate-50 lg:h-full lg:min-h-0 lg:overflow-hidden">
      <div className="max-w-7xl mx-auto lg:h-full lg:min-h-0 px-4 lg:px-8 py-4 lg:py-3 flex flex-col gap-4 lg:gap-3">
        {/* Header */}
        <div className="shrink-0 h-28 lg:h-32 lg:rounded-sm skeleton-shimmer w-full"></div>
        
        <div className="grid grid-cols-1 lg:flex lg:flex-row lg:gap-3 lg:flex-1 lg:min-h-0">
          {/* Priority Actions */}
          <div className="order-1 lg:order-1 flex flex-col gap-4 lg:gap-3 lg:w-1/3 lg:min-h-0">
            <div className="h-64 lg:h-full skeleton-shimmer rounded-sm"></div>
          </div>
          
          {/* Academic Records and Support */}
          <div className="order-2 lg:order-2 flex flex-col gap-4 lg:gap-3 lg:w-2/3 lg:min-h-0">
            <div className="h-96 lg:h-full skeleton-shimmer rounded-sm"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ClerkDashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16 px-4 md:px-8 font-sans">
      {/* Banner */}
      <div className="h-32 skeleton-shimmer rounded-md w-full"></div>
      
      {/* Metrics */}
      <div className="space-y-4">
        <div className="flex justify-between">
          <div className="h-4 skeleton-shimmer w-32 rounded"></div>
          <div className="h-4 skeleton-shimmer w-20 rounded"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
           {[...Array(4)].map((_, i) => <div key={i} className="h-24 skeleton-shimmer rounded-md border border-slate-100"></div>)}
        </div>
      </div>

      {/* Primary Operations */}
      <div className="space-y-4">
        <div className="flex justify-between">
          <div className="h-4 skeleton-shimmer w-40 rounded"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
           {[...Array(3)].map((_, i) => <div key={i} className="h-36 skeleton-shimmer rounded-md border border-slate-100"></div>)}
        </div>
      </div>
    </div>
  );
}

export function AdminDashboardSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-6xl mx-auto bg-white border border-slate-200 shadow-sm p-4 sm:p-6 lg:p-8 flex flex-col items-center space-y-6">
        <div className="h-8 skeleton-shimmer w-64 rounded"></div>
        
        {/* Search */}
        <div className="w-full flex gap-2">
           <div className="h-10 skeleton-shimmer rounded flex-1"></div>
           <div className="h-10 skeleton-shimmer rounded w-24"></div>
        </div>
        
        {/* Tabs */}
        <div className="w-full flex border-b gap-4 pb-2">
           <div className="h-6 skeleton-shimmer w-32 rounded"></div>
           <div className="h-6 skeleton-shimmer w-32 rounded"></div>
        </div>
        
        {/* Stats Grid */}
        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4">
           {[...Array(3)].map((_, i) => <div key={i} className="h-16 skeleton-shimmer rounded border border-slate-100"></div>)}
        </div>

        {/* Big Table Area */}
        <div className="w-full h-64 skeleton-shimmer rounded mt-4"></div>
      </div>
    </div>
  );
}
