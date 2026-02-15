'use client';

import React, { useState } from 'react';
import { syllabusData } from '@/lib/syllabus-data';

export default function SyllabusTab({ branch, semester }) {
  const branchSyllabus = syllabusData[branch] || {};
  const currentSemesterSyllabus = branchSyllabus[String(semester)] || [];
  const [expandedSubjects, setExpandedSubjects] = useState([]);

  const toggleSubject = (idx) => {
    setExpandedSubjects(prev => 
      prev.includes(idx) 
        ? prev.filter(i => i !== idx) 
        : [...prev, idx]
    );
  };

  if (currentSemesterSyllabus.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-gray-500">
        <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        <p className="text-lg font-medium">Syllabus not available for {branch} - Semester {semester}</p>
        <p className="text-sm text-center">We are currently updating the curriculum data. Please check back later.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Academic Curriculum</h3>
        <div className="flex items-center space-x-2">
          <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wider">
            {branch}
          </span>
          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider">
            SEMESTER {semester}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {currentSemesterSyllabus.map((subject, idx) => {
          const isExpanded = expandedSubjects.includes(idx);
          return (
            <div key={idx} className={`border rounded-xl overflow-hidden transition-all duration-300 ${isExpanded ? 'border-indigo-200 ring-1 ring-indigo-50 shadow-md' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}>
              <button 
                onClick={() => toggleSubject(idx)}
                className={`w-full flex items-center justify-between p-4 text-left transition-colors ${isExpanded ? 'bg-indigo-50/30' : 'bg-white hover:bg-gray-50'}`}
              >
                <div className="flex items-center space-x-4">
                  <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm transition-colors ${isExpanded ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {subject.code.substring(0, 3)}
                  </div>
                  <div>
                    <div className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${isExpanded ? 'text-indigo-600' : 'text-gray-500'}`}>
                      {subject.code}
                    </div>
                    <div className="text-base font-semibold text-gray-900">{subject.title}</div>
                  </div>
                </div>
                <div className={`p-2 rounded-full transition-all duration-300 ${isExpanded ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 bg-gray-50'}`}>
                  <svg 
                    className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} 
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
                <div className="p-5 bg-white border-t border-indigo-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {subject.units.map((unit, uIdx) => (
                      <div key={uIdx} className="group p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:border-indigo-200 hover:shadow-sm transition-all duration-200">
                        <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center group-hover:text-indigo-700">
                          <span className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center text-[10px] mr-2">
                            {uIdx + 1}
                          </span>
                          {unit.name}
                        </h4>
                        <ul className="space-y-3 ml-4">
                          {unit.topics.map((topic, tIdx) => {
                            const hasColon = topic.includes(':');
                            const title = hasColon ? topic.split(':')[0] : topic;
                            const content = hasColon ? topic.split(':').slice(1).join(':') : null;

                            return (
                              <li key={tIdx} className="text-xs text-gray-700 leading-relaxed flex items-start">
                                <span className="mr-2 mt-1.5 w-1.5 h-1.5 bg-indigo-400 rounded-full flex-shrink-0 group-hover:bg-indigo-600 transition-colors"></span>
                                <div>
                                  <span className={`font-semibold text-gray-900 ${hasColon ? 'block mb-1' : ''}`}>
                                    {title}{hasColon ? ':' : ''}
                                  </span>
                                  {content && <span className="text-gray-600">{content}</span>}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                  
                  {subject.units.length === 0 && (
                    <div className="text-center py-4 text-gray-400 text-sm italic">
                      Detailed unit information not available yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
