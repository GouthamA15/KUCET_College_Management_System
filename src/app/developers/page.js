'use client';

import Footer from '@/components/Footer';
import Image from 'next/image';
import { useAssets } from '@/context/AssetContext';
import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import Header from '@/components/Header';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function DevelopersPage() {
  const { getAsset } = useAssets();
  const audiosRef = useRef({});
  const [bugDescription, setBugDescription] = useState('');
  const [bugSeverity, setBugSeverity] = useState('MEDIUM');
  const [affectedPage, setAffectedPage] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bugReports, setBugReports] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reportType, setReportType] = useState('BUG');
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoginPromptOpen, setIsLoginPromptOpen] = useState(false);
  const fetchRef = useRef();

  // On mount, check for pending submission from before login
  useEffect(() => {
    try {
      const pending = sessionStorage.getItem('pendingBugReport');
      if (pending) {
        sessionStorage.removeItem('pendingBugReport');
        const data = JSON.parse(pending);
        if (data.description) {
          const doSubmit = async () => {
            const toastId = toast.loading('Completing your submission...');
            try {
              let screenshotPayload = null;
              if (data.screenshotPreview) {
                screenshotPayload = data.screenshotPreview;
              }
              const res = await fetch('/api/bugs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  description: data.description,
                  screenshot: screenshotPayload,
                  severity: data.severity,
                  type: data.type,
                  affected_page: data.affected_page || null,
                }),
              });
              if (res.ok) {
                toast.success(`${data.type === 'FEATURE_REQUEST' ? 'Suggestion' : 'Bug report'} submitted successfully!`, { id: toastId });
                if (fetchRef.current) fetchRef.current();
              } else if (res.status === 401) {
                toast.error('Please log in to submit', { id: toastId });
                sessionStorage.setItem('pendingBugReport', pending);
              } else {
                const err = await res.json();
                toast.error(err.message || 'Submission failed', { id: toastId });
              }
            } catch {
              toast.error('Submission failed. Please try again.', { id: toastId });
            }
          };
          doSubmit();
        }
      }
    } catch {
      // sessionStorage might not be available
    }
  }, []);

  const fetchBugReports = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (activeTab === 'bugs') params.append('type', 'BUG');
      else if (activeTab === 'features') params.append('type', 'FEATURE_REQUEST');
      else if (activeTab === 'fixed') params.append('status', 'RESOLVED');
      if (searchQuery.trim()) params.append('q', searchQuery.trim());

      const res = await fetch(`/api/bugs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setBugReports(data);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    }
  }, [activeTab, searchQuery]);

  useEffect(() => {
    fetchRef.current = fetchBugReports;
    // Inline fetch to avoid set-state-in-effect lint
    const params = new URLSearchParams();
    if (activeTab === 'bugs') params.append('type', 'BUG');
    else if (activeTab === 'features') params.append('type', 'FEATURE_REQUEST');
    else if (activeTab === 'fixed') params.append('status', 'RESOLVED');
    if (searchQuery.trim()) params.append('q', searchQuery.trim());
    fetch(`/api/bugs?${params.toString()}`)
      .then(r => r.json())
      .then(data => setBugReports(data))
      .catch(() => {});
    fetch('/api/bugs/developer-check')
      .then(r => r.json())
      .then(data => setIsDeveloper(data.isDeveloper))
      .catch(() => {});
  }, [fetchBugReports, activeTab, searchQuery]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1 * 1024 * 1024) {
        toast.error('File size should be less than 1MB');
        return;
      }
      setScreenshot(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!bugDescription.trim()) {
      toast.error('Please provide a description');
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading('Submitting...');

    try {
      let base64Screenshot = null;
      if (screenshotPreview) {
        base64Screenshot = screenshotPreview;
      }

      const label = reportType === 'BUG' ? 'bug report' : 'feature suggestion';

      const res = await fetch('/api/bugs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: bugDescription,
          screenshot: base64Screenshot,
          severity: bugSeverity,
          type: reportType,
          affected_page: affectedPage || null,
        }),
      });

      if (res.ok) {
        toast.success(`${label} submitted successfully!`, { id: loadingToast });
        setBugDescription('');
        setBugSeverity('MEDIUM');
        setAffectedPage('');
        setScreenshot(null);
        setScreenshotPreview(null);
        setIsModalOpen(false);
        fetchBugReports();
      } else if (res.status === 401) {
        toast.error('Please log in to submit', { id: loadingToast });
        sessionStorage.setItem('pendingBugReport', JSON.stringify({
          description: bugDescription,
          type: reportType,
          severity: bugSeverity,
          affected_page: affectedPage,
          screenshotPreview: base64Screenshot,
        }));
        setIsModalOpen(false);
        setIsLoginPromptOpen(true);
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || `Failed to submit ${label}`, { id: loadingToast });
      }
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('An error occurred. Please try again.', { id: loadingToast });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkFixed = async (id) => {
    const loadingToast = toast.loading('Marking as fixed...');
    try {
      const res = await fetch(`/api/bugs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve' }),
      });
      if (res.ok) {
        toast.success('Marked as fixed!', { id: loadingToast });
        fetchBugReports();
      } else {
        const err = await res.json();
        toast.error(err.message || 'Failed to mark as fixed', { id: loadingToast });
      }
    } catch {
      toast.error('An error occurred', { id: loadingToast });
    }
  };

  const handleReopen = async (id) => {
    const loadingToast = toast.loading('Reopening...');
    try {
      const res = await fetch(`/api/bugs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reopen' }),
      });
      if (res.ok) {
        toast.success('Reopened!', { id: loadingToast });
        fetchBugReports();
      } else {
        const err = await res.json();
        toast.error(err.message || 'Failed to reopen', { id: loadingToast });
      }
    } catch {
      toast.error('An error occurred', { id: loadingToast });
    }
  };

  const developers = useMemo(() => [
    {
      name: 'Masna Goutham',
      role: 'Frontend & UI/UX Developer',
      image: getAsset('/assets/DevPics/Dev1.png'),
      delay: '0s',
      audio: getAsset('/assets/DevPics/Dev1.mp4'),
      portfolio: ''
    },
    {
      name: 'P.Sannith',
      role: 'Backend & Database Administrator',
      image: getAsset('/assets/DevPics/Dev2.jpg'),
      delay: '0.2s',
      audio: getAsset('/assets/DevPics/Dev2.mp3'),
      portfolio: 'https://sannith-hack.github.io/Portfolio/'
    },
    {
      name: 'Uzair',
      role: 'System Interface and API designer',
      image: getAsset('/assets/DevPics/Dev3.jpeg'),
      audio: getAsset('/assets/DevPics/Dev3.mp3'),
      delay: '0.4s',
    },
  ], [getAsset]);

  useEffect(() => {
    developers.forEach(dev => {
      if (dev.audio && !audiosRef.current[dev.audio]) {
        const audio = new Audio(dev.audio);
        audio.volume = 0.5;
        audio.preload = 'auto';
        audiosRef.current[dev.audio] = audio;
      }
    });

    const audios = audiosRef.current;
    return () => {
      Object.values(audios).forEach(audio => {
        audio.pause();
        audio.src = '';
      });
    };
  }, [developers]);

  const handleMouseEnter = (dev) => {
    if (dev.audio && audiosRef.current[dev.audio]) {
      const audio = audiosRef.current[dev.audio];
      Object.values(audiosRef.current).forEach(a => {
        if (a !== audio) { a.pause(); a.currentTime = 0; }
      });
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    }
  };

  const handleMouseLeave = (dev) => {
    if (dev.audio && audiosRef.current[dev.audio]) {
      const audio = audiosRef.current[dev.audio];
      audio.pause();
      audio.currentTime = 0;
    }
  };

  const tabs = [
    { key: 'all', label: 'All', icon: '📋' },
    { key: 'bugs', label: 'Bugs', icon: '🐛' },
    { key: 'features', label: 'Feature Requests', icon: '💡' },
    { key: 'fixed', label: 'Fixed \u2705', icon: '' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 font-sans relative">
      <Header />

      <div id="main-content" className="flex flex-col min-h-screen relative overflow-x-hidden transition-all duration-300">
        <main className="flex-grow container mx-auto px-4 py-12">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-extrabold text-[#0b3578] mb-4 animate-fade-in-down">
              Meet Team &quot;Homeless Soon&quot;
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto animate-fade-in-up">
              The talented individuals behind the KUCET College Management System, dedicated to building a robust and user-friendly platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 max-w-6xl mx-auto mb-20">
            {developers.map((dev, index) => (
              <div
                key={index}
                className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 overflow-hidden border border-gray-100 flex flex-col items-center p-8 text-center animate-fade-in-up"
                style={{ animationDelay: dev.delay, animationFillMode: 'both' }}
                onMouseEnter={() => handleMouseEnter(dev)}
                onMouseLeave={() => handleMouseLeave(dev)}
              >
                <div className="relative w-40 h-40 mb-6">
                  <div className="absolute inset-0 bg-blue-100 rounded-full scale-0 group-hover:scale-110 transition-transform duration-500 ease-out"></div>
                  <div className="relative w-full h-full rounded-full overflow-hidden border-4 border-white shadow-md group-hover:border-blue-50 transition-colors duration-300">
                    <Image src={dev.image} alt={dev.name} fill className="object-cover" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2 group-hover:text-[#0b3578] transition-colors duration-300">
                  {dev.name}
                </h3>
                <div className="h-1 w-12 bg-blue-500 rounded-full mb-4 group-hover:w-24 transition-all duration-300"></div>
                <p className="text-gray-600 font-medium bg-blue-50 px-4 py-1.5 rounded-full text-sm">
                  {dev.role}
                </p>
                {dev.portfolio && (
                  <a
                    href={dev.portfolio}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-semibold flex items-center gap-1 hover:underline decoration-2 underline-offset-4"
                  >
                    View more details
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </a>
                )}
              </div>
            ))}
          </div>

          <div className="max-w-5xl mx-auto text-center animate-fade-in-up" style={{ animationDelay: '0.6s', animationFillMode: 'both' }}>
            <h2 className="text-3xl font-bold text-[#0b3578] mb-8">Team &quot;Homeless Soon&quot;</h2>
            <div className="relative w-full rounded-2xl overflow-hidden shadow-xl border-4 border-white group">
               <Image
                  src={getAsset('/assets/DevPics/Group.jpg')}
                  alt="Team Group Photo"
                  width={3096}
                  height={2477}
                  className="w-full h-auto object-contain transition-transform duration-500 group-hover:scale-105"
               />
            </div>
            <p className="mt-6 text-gray-600 italic">
              &quot;Coming together is a beginning, keeping together is progress, working together is success.&quot;
            </p>
          </div>

          <div className="max-w-5xl mx-auto mt-24 mb-16 animate-fade-in-up" style={{ animationDelay: '0.8s', animationFillMode: 'both' }}>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-6">
              <div>
                <h2 className="text-3xl font-bold text-[#0b3578]">Community Board</h2>
                <p className="text-gray-600 mt-2">Report bugs, suggest features, and track progress — all in the open.</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setReportType('BUG'); setIsModalOpen(true); }}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 transform hover:scale-105 active:scale-95"
                >
                  <span>🐛</span> Report Bug
                </button>
                <button
                  onClick={() => { setReportType('FEATURE_REQUEST'); setIsModalOpen(true); }}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 transform hover:scale-105 active:scale-95"
                >
                  <span>💡</span> Suggest Feature
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="mb-6">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reports, features, or reporters..."
                className="w-full px-5 py-3 rounded-xl border-2 border-gray-100 focus:border-[#0b3578] focus:outline-none transition-colors"
              />
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-8 border-b border-gray-200 pb-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                    activeTab === tab.key
                      ? 'bg-[#0b3578] text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tab.icon && <span className="mr-1.5">{tab.icon}</span>}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Reports Grid */}
            {bugReports.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-gray-200">
                <div className="text-gray-400 mb-4 flex justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-700">Nothing here yet!</h3>
                <p className="text-gray-500 mt-1">Be the first to report a bug or suggest a feature.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {bugReports.map((report) => {
                  const isFeature = report.type === 'FEATURE_REQUEST';
                  return (
                    <div key={report.id} className={`bg-white rounded-2xl shadow-md border overflow-hidden hover:shadow-lg transition-shadow ${
                      report.status === 'RESOLVED' ? 'border-green-200' : isFeature ? 'border-purple-100' : 'border-gray-100'
                    }`}>
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-4 gap-2">
                          <div className="flex gap-2 flex-wrap">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                              isFeature
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-red-100 text-red-600'
                            }`}>
                              {isFeature ? 'FEATURE' : 'BUG'}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                              report.status === 'OPEN' ? 'bg-yellow-100 text-yellow-700' :
                              report.status === 'RESOLVED' ? 'bg-green-100 text-green-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {report.status === 'RESOLVED' ? 'FIXED' : report.status}
                            </span>
                            {!isFeature && (
                              <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                                report.severity === 'CRITICAL' ? 'bg-red-200 text-red-700' :
                                report.severity === 'HIGH' ? 'bg-orange-100 text-orange-600' :
                                report.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-600' :
                                'bg-blue-100 text-blue-600'
                              }`}>
                                {report.severity}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 whitespace-nowrap">
                            {new Date(report.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="mb-3">
                          <p className="text-xs text-gray-500">
                            <strong>By:</strong> {report.submitted_by} ({report.user_type})
                          </p>
                          {report.affected_page && (
                            <p className="text-xs text-gray-500">
                              <strong>Page:</strong> {report.affected_page}
                            </p>
                          )}
                          {report.fixed_by && (
                            <p className="text-xs text-green-600 font-semibold">
                              <strong>Fixed by:</strong> {report.fixed_by}
                              {report.fixed_at && (
                                <span className="font-normal text-gray-500">
                                  {' '}on {new Date(report.fixed_at).toLocaleDateString()}
                                </span>
                              )}
                            </p>
                          )}
                        </div>

                        <p className={`text-gray-800 font-medium mb-4 ${report.status === 'RESOLVED' ? 'line-through opacity-60' : ''}`}>
                          {report.description}
                        </p>

                        {report.screenshot_url && (
                          <div className="relative h-40 w-full rounded-lg overflow-hidden bg-gray-100 cursor-pointer group mb-3" onClick={() => window.open(getAsset(report.screenshot_url), '_blank')}>
                            <Image src={getAsset(report.screenshot_url)} alt="Screenshot" fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="text-white text-sm font-bold bg-black/40 px-3 py-1 rounded-lg">View Full Image</span>
                            </div>
                          </div>
                        )}

                        {report.browser_info && !report.fixed_by && (
                          <p className="text-xs text-gray-400 truncate">
                            <strong>Browser:</strong> {report.browser_info}
                          </p>
                        )}

                        {/* Admin Actions */}
                        {report.status === 'OPEN' && isDeveloper && (
                          <button
                            onClick={() => handleMarkFixed(report.id)}
                            className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                          >
                            <span>✓</span> Mark as Fixed
                          </button>
                        )}
                        {report.status === 'RESOLVED' && isDeveloper && (
                          <button
                            onClick={() => handleReopen(report.id)}
                            className="mt-4 w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                          >
                            Reopen
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-scale-in">
              <div className={`p-6 text-white flex justify-between items-center ${reportType === 'FEATURE_REQUEST' ? 'bg-purple-700' : 'bg-[#0b3578]'}`}>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  {reportType === 'FEATURE_REQUEST' ? (
                    <><span>💡</span> Suggest a Feature</>
                  ) : (
                    <><span>🐛</span> Report a Bug</>
                  )}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-full transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-4 bg-gray-50 border-b border-gray-100 flex gap-2">
                <button
                  onClick={() => setReportType('BUG')}
                  className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${reportType === 'BUG' ? 'bg-red-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                >
                  🐛 Report Bug
                </button>
                <button
                  onClick={() => setReportType('FEATURE_REQUEST')}
                  className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${reportType === 'FEATURE_REQUEST' ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                >
                  💡 Suggest Feature
                </button>
              </div>

              <form onSubmit={handleSubmitReport} className="p-8">
                <div className="mb-6">
                  <label className="block text-gray-700 font-bold mb-2">
                    {reportType === 'FEATURE_REQUEST' ? 'Feature Description' : 'Problem Description'}
                  </label>
                  <textarea
                    value={bugDescription}
                    onChange={(e) => setBugDescription(e.target.value)}
                    placeholder={reportType === 'FEATURE_REQUEST'
                      ? 'Describe the feature you\'d like to see. What problem would it solve?'
                      : 'Please describe the issue in detail. What were you doing? What went wrong?'}
                    className="w-full h-32 px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-[#0b3578] focus:outline-none transition-colors resize-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  {reportType === 'BUG' && (
                    <div>
                      <label className="block text-gray-700 font-bold mb-2">Severity</label>
                      <select
                        value={bugSeverity}
                        onChange={(e) => setBugSeverity(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-[#0b3578] focus:outline-none transition-colors"
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="CRITICAL">Critical</option>
                      </select>
                    </div>
                  )}
                  <div className={reportType === 'BUG' ? '' : 'col-span-2'}>
                    <label className="block text-gray-700 font-bold mb-2">Affected Page (Optional)</label>
                    <input
                      type="text"
                      value={affectedPage}
                      onChange={(e) => setAffectedPage(e.target.value)}
                      placeholder={reportType === 'FEATURE_REQUEST' ? 'e.g., Student Dashboard' : 'e.g., /student/profile'}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-[#0b3578] focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="mb-8">
                  <label className="block text-gray-700 font-bold mb-2">Screenshot (Optional)</label>
                  {!screenshotPreview ? (
                    <div className="relative h-40 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer group">
                      <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400 group-hover:text-blue-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-gray-500 group-hover:text-blue-600 font-medium">Click to upload screenshot</span>
                      <span className="text-xs text-gray-400 mt-1">PNG, JPG up to 1MB</span>
                    </div>
                  ) : (
                    <div className="relative h-48 rounded-xl overflow-hidden shadow-md">
                      <Image src={screenshotPreview} alt="Preview" fill className="object-cover" />
                      <button type="button" onClick={() => { setScreenshot(null); setScreenshotPreview(null); }}
                        className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full shadow-lg hover:bg-red-700 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  <button type="button" onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-3 border-2 border-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting}
                    className={`flex-[2] text-white font-bold py-3 rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${reportType === 'FEATURE_REQUEST' ? 'bg-purple-700 hover:bg-purple-800' : 'bg-[#0b3578] hover:bg-[#082a61]'}`}>
                    {isSubmitting ? 'Submitting...' : reportType === 'FEATURE_REQUEST' ? 'Submit Suggestion' : 'Submit Bug Report'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Login Prompt Modal */}
        {isLoginPromptOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-in">
              <div className="bg-[#0b3578] p-6 text-white text-center">
                <div className="text-5xl mb-4">🔐</div>
                <h2 className="text-xl font-bold">Login Required</h2>
                <p className="text-white/80 mt-2">Please log in to submit your report or suggestion.</p>
              </div>
              <div className="p-8 text-center">
                <p className="text-gray-600 mb-2">Your draft has been saved.</p>
                <p className="text-sm text-gray-500 mb-4">After logging in, visit this page again and your submission will be completed automatically.</p>
                <p className="text-xs text-gray-400 mb-6">Developers: Sign in with <strong>Google</strong> using your registered email.</p>
                <div className="flex gap-4">
                  <button
                    onClick={() => setIsLoginPromptOpen(false)}
                    className="flex-1 px-6 py-3 border-2 border-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <Link
                    href="/?login=true"
                    className="flex-[2] bg-[#0b3578] hover:bg-[#082a61] text-white font-bold py-3 rounded-xl shadow-lg text-center transition-all inline-block"
                  >
                    Go to Login
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        <Footer />
      </div>
    </div>
  );
}
