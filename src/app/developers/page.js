'use client';

import Footer from '@/components/Footer';
import Image from 'next/image';
import { useAssets } from '@/context/AssetContext';
import { useRef, useEffect, useMemo, useState } from 'react';
import Header from '@/components/Header';
import ClientShell from '@/components/ClientShell.client';

export default function DevelopersPage() {
  const { getAsset } = useAssets();
  const audiosRef = useRef({});

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

      {/* Client-side shell: navbar, login panels and toasts */}
      <ClientShell />
      
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
        </main>

        <Footer />
      </div>
    </div>
  );
}