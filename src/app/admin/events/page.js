'use client';

import React from 'react';
import Link from 'next/link';
import { Trophy, FileQuestion, ArrowRight, ShieldCheck, Layers } from 'lucide-react';

export default function AdminEventsPortalPage() {
  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
      {/* Page Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">
            Campus Events & Tournament Management
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Super Admin control console for collegiate competitions, technical assessments, and tournament arbitrations.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium bg-blue-50 text-[#0b3578] border border-blue-200">
            <ShieldCheck className="w-3.5 h-3.5" /> Super Admin Access
          </span>
        </div>
      </header>

      {/* Grid of Admin Event Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Technical Quiz Console Card */}
        <div className="bg-white rounded-sm border border-gray-300 p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-blue-50 text-[#0b3578] border border-blue-200">
                Technical Assessment
              </span>
              <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                Configurable
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-md bg-blue-50 text-[#0b3578] flex items-center justify-center">
                <FileQuestion className="w-5 h-5" />
              </div>
              <h2 className="text-base font-semibold text-gray-800">
                Technical Quiz Console
              </h2>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Question bank authoring, time limit and negative marking controls, candidate attempt resets, and real-time standings monitoring.
            </p>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <Link
              href="/admin/events/quiz"
              className="inline-flex items-center justify-between w-full px-4 py-2.5 rounded-md bg-[#0b3578] hover:bg-[#0a2d66] text-white text-xs font-medium transition-colors shadow-sm"
            >
              <span>Manage Technical Quiz</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Chess Tournament Console Card */}
        <div className="bg-white rounded-sm border border-gray-300 p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                Mind Sports League
              </span>
              <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                Configurable
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-md bg-amber-50 text-amber-800 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-amber-600" />
              </div>
              <h2 className="text-base font-semibold text-gray-800">
                Chess Championship
              </h2>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Contender roster approval, single-elimination bracket pairing, live interactive move auditor, and official score verification.
            </p>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <Link
              href="/admin/events/chess"
              className="inline-flex items-center justify-between w-full px-4 py-2.5 rounded-md bg-[#0b3578] hover:bg-[#0a2d66] text-white text-xs font-medium transition-colors shadow-sm"
            >
              <span>Manage Chess Event</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Modular Expansion Placeholder */}
        <div className="bg-white rounded-sm border border-dashed border-gray-300 p-6 shadow-sm flex flex-col justify-between space-y-4 opacity-75">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                Expansion Slot
              </span>
              <span className="text-xs font-medium text-gray-400">
                Future Module
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-md bg-gray-100 text-gray-500 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <h2 className="text-base font-semibold text-gray-700">
                Multiplayer Game Slot
              </h2>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              Modular tournament slot reserved for upcoming college symposium games (Carrom, Coding Hackathons, Debate).
            </p>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <div className="py-2 px-3 rounded-md bg-gray-100 text-center text-xs font-medium text-gray-500">
              Module Inactive
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
