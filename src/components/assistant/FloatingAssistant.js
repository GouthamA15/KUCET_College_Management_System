'use client';

import React, { useState, useEffect, useContext } from 'react';
import { usePathname } from 'next/navigation';
import AssistantContainer from './AssistantContainer';
import { StudentContext } from '@/context/StudentContext';
import { ClerkContext } from '@/context/ClerkContext';
import { AdminContext } from '@/context/AdminContext';

export default function FloatingAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const studentContext = useContext(StudentContext);
  const clerkContext = useContext(ClerkContext);
  const adminContext = useContext(AdminContext);

  // Hidden on public & login pages
  const isPublicPage =
    !pathname ||
    pathname === '/' ||
    pathname.startsWith('/admission') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/dev/') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/terms');

  // Detect user role
  let role = 'student';
  if (pathname.startsWith('/admin')) {
    role = 'admin';
  } else if (pathname.startsWith('/clerk/hod') || pathname.startsWith('/hod')) {
    role = 'hod';
  } else if (pathname.startsWith('/clerk/faculty')) {
    role = 'faculty';
  } else if (clerkContext?.clerkData) {
    role = clerkContext.clerkData.is_hod
      ? 'hod'
      : clerkContext.clerkData.role === 'faculty'
      ? 'faculty'
      : 'clerk';
  } else if (adminContext?.admin) {
    role = 'admin';
  }

  // Keyboard shortcut Ctrl+Shift+A or Cmd+Shift+A to toggle assistant
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isPublicPage) return null;

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="group relative flex items-center justify-center w-14 h-14 bg-gradient-to-tr from-[#0b3578] via-blue-600 to-indigo-600 text-white rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border-2 border-white/40"
          aria-label="Open AI Assistant"
        >
          {/* Subtle pulse ring */}
          <span className="absolute -inset-1 rounded-full bg-blue-500/30 animate-ping pointer-events-none" />

          {/* Icon */}
          <span className="text-2xl transition-transform group-hover:rotate-12">
            {isOpen ? '✕' : '⚡'}
          </span>

          {/* Hover Tooltip */}
          <span className="absolute right-16 bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-xl whitespace-nowrap shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
            AI Assistant <span className="text-slate-400 text-[10px] font-normal">(Ctrl+Shift+A)</span>
          </span>
        </button>
      </div>

      {/* Slide-over Drawer Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-end p-0 sm:p-4 bg-slate-950/40 backdrop-blur-xs animate-fadeIn">
          <div
            className="fixed inset-0"
            onClick={() => setIsOpen(false)}
          />

          <div className="relative w-full sm:w-[850px] max-w-full z-10 animate-slideUp">
            <AssistantContainer
              role={role}
              isDrawerMode={true}
              onClose={() => setIsOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
