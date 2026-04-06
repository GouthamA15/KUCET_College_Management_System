'use client';

import Footer from '@/components/Footer';
import Image from 'next/image';
import { useAssets } from '@/context/AssetContext';
import { useRef, useEffect, useMemo, useState } from 'react';
import Header from '@/components/Header';
import ClientShell from '@/components/ClientShell.client';
import toast from 'react-hot-toast';

export default function DevelopersPage() {
  const { getAsset } = useAssets();
  const audiosRef = useRef({});
  const [bugDescription, setBugDescription] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bugReports, setBugReports] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchBugReports();
  }, []);

  const fetchBugReports = async () => {
    try {
      const res = await fetch('/api/bugs');
      if (res.ok) {
        const data = await res.json();
        setBugReports(data);
      }
    } catch (error) {
      console.error('Failed to fetch bug reports:', error);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size should be less than 5MB');
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

  const handleSubmitBug = async (e) => {
    e.preventDefault();
    if (!bugDescription.trim()) {
      toast.error('Please provide a description');
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading('Submitting report...');

    try {
      let base64Screenshot = null;
      if (screenshotPreview) {
        base64Screenshot = screenshotPreview;
      }

      const res = await fetch('/api/bugs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: bugDescription,
          screenshot: base64Screenshot,
        }),
      });

      if (res.ok) {
        toast.success('Bug reported successfully! Thank you for your feedback.', { id: loadingToast });
        setBugDescription('');
        setScreenshot(null);
        setScreenshotPreview(null);
        setIsModalOpen(false);
        fetchBugReports();
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || 'Failed to submit bug report', { id: loadingToast });
      }
    } catch (error) {
      console.error('Submit bug error:', error);
      toast.error('An error occurred. Please try again.', { id: loadingToast });
    } finally {
      setIsSubmitting(false);
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

  // Pre-load audio objects
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
      // Stop all other audios first to prevent overlap
      Object.values(audiosRef.current).forEach(a => {
        if (a !== audio) {
          a.pause();
          a.currentTime = 0;
        }
      });
      
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log("Audio play prevented:", error);
        });
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

  return (
    <div className="min-h-screen bg-gray-50 font-sans relative">
      {/* Header at the top */}
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
                    <Image
                      src={dev.image}
                      alt={dev.name}
                      fill
                      className="object-cover"
                    />
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

          {/* Group Photo Section */}
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

          {/* Bug Reporting Section */}
          <div className="max-w-5xl mx-auto mt-24 mb-16 animate-fade-in-up" style={{ animationDelay: '0.8s', animationFillMode: 'both' }}>
            <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
              <div>
                <h2 className="text-3xl font-bold text-[#0b3578]">Bug Reports & Feedback</h2>
                <p className="text-gray-600 mt-2">Help us improve the system by reporting issues you encounter.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 group transform hover:scale-105 active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 animate-pulse" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Report a Bug
              </button>
            </div>

            {bugReports.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-gray-200">
                <div className="text-gray-400 mb-4 flex justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-700">No bugs reported yet!</h3>
                <p className="text-gray-500 mt-1">The system is currently running smoothly.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {bugReports.map((report) => (
                  <div key={report.id} className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          report.status === 'OPEN' ? 'bg-red-100 text-red-600' : 
                          report.status === 'RESOLVED' ? 'bg-green-100 text-green-600' : 
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {report.status}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(report.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-gray-800 font-medium line-clamp-3 mb-4">
                        {report.description}
                      </p>
                      {report.screenshot_url && (
                        <div className="relative h-48 w-full rounded-lg overflow-hidden bg-gray-100 cursor-pointer group" onClick={() => window.open(report.screenshot_url, '_blank')}>
                          <Image
                            src={report.screenshot_url}
                            alt="Bug screenshot"
                            fill
                            className="object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white text-sm font-bold bg-black/40 px-3 py-1 rounded-lg">View Full Image</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Report Bug Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-scale-in">
              <div className="bg-[#0b3578] p-6 text-white flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Report a System Bug
                </h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-full transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l18 18" />
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handleSubmitBug} className="p-8">
                <div className="mb-6">
                  <label className="block text-gray-700 font-bold mb-2">Problem Description</label>
                  <textarea
                    value={bugDescription}
                    onChange={(e) => setBugDescription(e.target.value)}
                    placeholder="Please describe the issue in detail. What were you doing? What went wrong?"
                    className="w-full h-32 px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-[#0b3578] focus:outline-none transition-colors resize-none"
                    required
                  ></textarea>
                </div>

                <div className="mb-8">
                  <label className="block text-gray-700 font-bold mb-2">Screenshot (Optional)</label>
                  {!screenshotPreview ? (
                    <div className="relative h-40 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer group">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400 group-hover:text-blue-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-gray-500 group-hover:text-blue-600 font-medium">Click or drag to upload screenshot</span>
                      <span className="text-xs text-gray-400 mt-1">PNG, JPG up to 5MB</span>
                    </div>
                  ) : (
                    <div className="relative h-48 rounded-xl overflow-hidden shadow-md">
                      <Image
                        src={screenshotPreview}
                        alt="Preview"
                        fill
                        className="object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => { setScreenshot(null); setScreenshotPreview(null); }}
                        className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full shadow-lg hover:bg-red-700 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-3 border-2 border-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-[2] bg-[#0b3578] hover:bg-[#082a61] text-white font-bold py-3 rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Bug Report'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <Footer />
      </div>
    </div>
  );
}