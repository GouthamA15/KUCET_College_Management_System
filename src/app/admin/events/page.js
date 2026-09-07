'use client';

import React from 'react';
import Link from 'next/link';
import { Trophy, Swords, ArrowRight, Sparkles } from 'lucide-react';

export default function AdminEventsPortalPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Campus Events & Tournaments
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage collegiate esports, mind sports, and inter-departmental tournaments.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Chess Event Card */}
        <div className="bg-gradient-to-br from-[#002A5C] to-[#0b3578] rounded-3xl p-6 text-white shadow-xl flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-amber-300">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded-full border border-amber-400/30">
                Active Module
              </span>
              <h2 className="text-xl font-black mt-2">
                Chess Championship
              </h2>
              <p className="text-xs text-blue-100/80 mt-1 leading-relaxed">
                FIDE rapid rules, dynamic match fixtures, live interactive chessboard, and arbitrated result verification.
              </p>
            </div>
          </div>

          <Link
            href="/admin/events/chess"
            className="inline-flex items-center justify-between w-full px-4 py-3 rounded-2xl bg-white text-slate-950 text-xs font-extrabold uppercase tracking-wider hover:bg-amber-300 transition-colors shadow-md cursor-pointer"
          >
            <span>Manage Chess Event</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Future Game Scaffolding Placeholders */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-6 opacity-70">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                Coming Soon
              </span>
              <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300 mt-2">
                Future Tournament 2
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Modular slot reserved for upcoming competitive games and mind sports.
              </p>
            </div>
          </div>

          <div className="py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-center text-xs font-bold text-slate-400">
            Modular Slot Inactive
          </div>
        </div>
      </div>
    </div>
  );
}
