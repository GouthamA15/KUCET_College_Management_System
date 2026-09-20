'use client';

import React, { useState, useEffect } from 'react';
import { PlusCircle, Award, Calendar, Building2, MapPin, Loader2, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/date';
import { getAssetUrl } from '@/lib/assets';
import StudentAchievementModal from '@/components/ui/edit-modals/StudentAchievementModal';

export default function StudentAchievementsTab() {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    async function fetchAchievements() {
      try {
        const res = await fetch('/api/student/achievements');
        const json = await res.json();
        if (res.ok) {
          setAchievements(Array.isArray(json) ? json : (json.data || []));
        } else {
          toast.error(json.error || 'Failed to fetch achievements');
        }
      } catch (_err) {
        toast.error('Error connecting to server');
      } finally {
        setLoading(false);
      }
    }
    fetchAchievements();
  }, []);

  const handleSaveSuccess = (newAchievement) => {
    setAchievements((prev) => [newAchievement, ...prev]);
  };

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="h-6 w-48 skeleton-shimmer rounded mb-2"></div>
            <div className="h-4 w-72 skeleton-shimmer rounded"></div>
          </div>
          <div className="h-9 w-36 skeleton-shimmer rounded-md"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border border-gray-100 rounded-lg bg-white p-4 shadow-sm flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="h-5 w-20 skeleton-shimmer rounded"></div>
                <div className="h-4 w-16 skeleton-shimmer rounded"></div>
              </div>
              <div className="h-5 w-3/4 skeleton-shimmer rounded mb-2"></div>
              <div className="h-4 w-1/2 skeleton-shimmer rounded mb-4"></div>
              <div className="mt-auto space-y-2">
                <div className="h-3 w-2/3 skeleton-shimmer rounded"></div>
                <div className="h-3 w-1/2 skeleton-shimmer rounded"></div>
                <div className="border-t border-gray-50 mt-3 pt-3">
                  <div className="h-3 w-1/3 skeleton-shimmer rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Achievements & Activities</h2>
          <p className="text-sm text-gray-500">Academic, technical, extracurricular and other recognized achievements.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="shrink-0 inline-flex items-center gap-2 bg-[#0b3578] hover:bg-[#0f449a] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
        >
          <PlusCircle className="w-4 h-4" />
          Add Achievement
        </button>
      </div>

      {achievements.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded-lg p-12 text-center bg-gray-50">
          <Award className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-gray-800 font-semibold mb-1">No achievements added yet</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Add your academic, technical, extracurricular or other recognized achievements to keep your student profile up to date.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {achievements.map((ach) => (
            <div key={ach.id} className="border border-gray-200 rounded-lg bg-white p-4 shadow-sm flex flex-col group relative overflow-hidden">
              <div className="flex justify-between items-start mb-3">
                <span className="inline-block px-2.5 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider rounded-md border border-blue-100 z-10">
                  {ach.achievement_type}
                </span>
                <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded z-10">
                  {ach.academic_year}
                </span>
              </div>
              
              <h3 className="font-bold text-gray-800 leading-snug mb-1 z-10 pr-12">{ach.title}</h3>
              {ach.program_name && (
                <p className="text-sm text-gray-600 mb-3 z-10">{ach.program_name}</p>
              )}

              <div className="mt-auto space-y-2 text-xs text-gray-500 z-10">
                {ach.issuing_organization && (
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{ach.issuing_organization}</span>
                  </div>
                )}
                {ach.achievement_date && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>{formatDate(ach.achievement_date)}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                  <span className="font-medium text-gray-700">Level:</span>
                  <span>{ach.achievement_level}</span>
                </div>
              </div>
              
              {ach.certificate_file_path && (
                <a href={getAssetUrl(ach.certificate_file_path)} target="_blank" rel="noopener noreferrer" 
                   className="absolute bottom-4 right-4 bg-gray-100 p-2 rounded-full text-gray-500 hover:text-[#0b3578] hover:bg-blue-50 transition-colors z-20"
                   title="View Certificate">
                  <ImageIcon className="w-4 h-4" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <StudentAchievementModal
          onClose={() => setIsModalOpen(false)}
          onSaveSuccess={handleSaveSuccess}
        />
      )}
    </section>
  );
}


