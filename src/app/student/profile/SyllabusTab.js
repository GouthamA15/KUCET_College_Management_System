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
          const isPE = subject.title.toLowerCase().includes('professional elective');
          const isOE = subject.title.toLowerCase().includes('open elective');
          
          const branchToDeptCode = {
            'CSE': 'CS',
            'IT': 'IT',
            'ECE': 'EC',
            'EEE': 'EE',
            'MECH': 'ME',
            'CIVIL': 'CE',
            'CSD': 'DS'
          };

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
                    <div className="flex items-center space-x-2 mb-0.5">
                      <div className={`text-xs font-bold uppercase tracking-wider ${isExpanded ? 'text-indigo-600' : 'text-gray-500'}`}>
                        {subject.code}
                      </div>
                      {isPE && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded uppercase">Faculty Selection</span>}
                      {isOE && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded uppercase">Student Group Choice</span>}
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

              <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
                <div className="p-5 bg-white border-t border-indigo-100">
                  {isPE && (
                    <div className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-xl text-amber-900 text-sm">
                      <div className="flex items-center mb-2">
                        <svg className="w-5 h-5 mr-2 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <span className="font-bold">Professional Elective Information</span>
                      </div>
                      <p>This subject will be selected by the professors or faculty. Only one of the subjects from the group below will be taught based on departmental expertise and student interest.</p>
                    </div>
                  )}

                  {isOE && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-100 rounded-xl text-green-900 text-sm">
                      <div className="flex items-center mb-2">
                        <svg className="w-5 h-5 mr-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <span className="font-bold">Open Elective Information</span>
                      </div>
                      <p className="mb-2">All students together will decide which of these subjects to learn. You can select any one of the following subjects as an Open Elective.</p>
                      <div className="flex items-start bg-white/50 p-2 rounded-lg border border-green-200">
                        <svg className="w-4 h-4 mr-2 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs font-semibold text-red-700">Important: Students should NOT choose a same department subject as an Open Elective.</span>
                      </div>
                    </div>
                  )}

                  {subject.isGroup ? (
                    <div className="space-y-8">
                      {subject.variants?.map((variant, vIdx) => {
                        const deptMatch = variant.code.match(/([A-Z]{2})/);
                        const variantDept = deptMatch ? deptMatch[1] : null;
                        const isOwnDept = isOE && variantDept && variantDept === branchToDeptCode[branch];

                        return (
                          <div key={vIdx} className={`rounded-xl border p-1 ${isOwnDept ? 'border-red-100 bg-red-50/20' : 'border-indigo-100 bg-indigo-50/10'}`}>
                            <div className="p-3 flex items-center justify-between">
                              <h5 className={`font-bold text-sm ${isOwnDept ? 'text-red-700' : 'text-indigo-700'}`}>
                                {variant.code}: {variant.title}
                              </h5>
                              {isOwnDept && (
                                <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full uppercase font-bold">
                                  Restricted for {branch}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 pt-0">
                              {variant.units?.map((unit, uIdx) => (
                                <div key={uIdx} className="p-4 rounded-xl border border-gray-100 bg-white hover:border-indigo-200 hover:shadow-sm transition-all duration-200">
                                  <h4 className="text-xs font-bold text-gray-800 mb-3 flex items-center">
                                    <span className="w-5 h-5 bg-gray-100 text-gray-600 rounded flex items-center justify-center text-[9px] mr-2">
                                      {uIdx + 1}
                                    </span>
                                    {unit.name}
                                  </h4>
                                  <ul className="space-y-2.5 ml-2">
                                    {unit.topics?.map((topic, tIdx) => {
                                      const hasColon = topic.includes(':');
                                      const title = hasColon ? topic.split(':')[0] : topic;
                                      const content = hasColon ? topic.split(':').slice(1).join(':') : null;
                                      
                                      const subtopics = content 
                                        ? content.split(',').map(s => s.trim()).filter(Boolean)
                                        : [];

                                      return (
                                        <li key={tIdx} className="text-[11px] text-gray-700 leading-relaxed">
                                          <div className="flex items-start">
                                            <span className="mr-2 mt-1.5 w-1 h-1 bg-indigo-400 rounded-full flex-shrink-0"></span>
                                            <div>
                                              <span className={`font-semibold text-gray-900 ${hasColon ? 'block mb-0.5' : ''}`}>
                                                {title}{hasColon ? ':' : ''}
                                              </span>
                                              {subtopics.length > 0 ? (
                                                <div className="mt-1 space-y-1 pl-2 border-l border-indigo-50">
                                                  {subtopics.map((sub, sIdx) => (
                                                    <div key={sIdx} className="flex items-start text-gray-600">
                                                      <span className="mr-1.5 text-indigo-300">•</span>
                                                      <span>{sub}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              ) : content ? (
                                                <span className="text-gray-600 ml-1">{content}</span>
                                              ) : null}
                                            </div>
                                          </div>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {subject.units?.map((unit, uIdx) => (
                        <div key={uIdx} className="group p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:border-indigo-200 hover:shadow-sm transition-all duration-200">
                          <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center group-hover:text-indigo-700">
                            <span className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center text-[10px] mr-2">
                              {uIdx + 1}
                            </span>
                            {unit.name}
                          </h4>
                          <ul className="space-y-3 ml-4">
                            {unit.topics?.map((topic, tIdx) => {
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
                  )}
                  
                  {(!subject.units || subject.units.length === 0) && !subject.isGroup && (
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
