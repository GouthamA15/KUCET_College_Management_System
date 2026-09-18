'use client';
import React from 'react';

export function StudentDashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16 px-4 md:px-8 font-sans mt-4">
      <div className="flex flex-col gap-4 lg:gap-5">
        {/* Header */}
        <div className="h-28 lg:h-32 rounded-md skeleton-shimmer w-full"></div>
        
        <div className="grid grid-cols-1 lg:flex lg:flex-row gap-5 lg:gap-6">
          {/* Priority Actions */}
          <div className="order-1 flex flex-col gap-5 w-full lg:w-1/3">
            <div className="h-64 skeleton-shimmer rounded-md border border-slate-100"></div>
          </div>
          
          {/* Academic Records and Support */}
          <div className="order-2 flex flex-col gap-5 w-full lg:w-2/3">
            <div className="h-96 skeleton-shimmer rounded-md border border-slate-100"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StaffDashboardSkeleton() {
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

export function TableSkeleton() {
  return (
    <div className="w-full space-y-4">
      <div className="flex justify-between items-center mb-4">
        <div className="h-8 skeleton-shimmer w-48 rounded"></div>
        <div className="h-8 skeleton-shimmer w-32 rounded"></div>
      </div>
      <div className="border border-slate-200 rounded-md bg-white">
        <div className="h-10 skeleton-shimmer border-b border-slate-200"></div>
        <div className="divide-y divide-slate-100">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 skeleton-shimmer"></div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GenericPageSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 text-sm">
      <header className="mb-4">
        <div className="h-8 skeleton-shimmer w-64 rounded mb-2"></div>
        <div className="h-4 skeleton-shimmer w-96 rounded"></div>
      </header>
      
      <div className="flex gap-2 mb-3">
        <div className="h-9 w-24 skeleton-shimmer rounded"></div>
        <div className="h-9 w-24 skeleton-shimmer rounded"></div>
        <div className="h-9 w-32 skeleton-shimmer rounded ml-auto"></div>
      </div>
      
      <div className="h-96 skeleton-shimmer rounded border border-gray-200"></div>
    </div>
  );
}
