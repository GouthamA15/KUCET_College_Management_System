'use client';

import { useEffect, useState } from 'react';
import NextImage from 'next/image';
import { useAssets } from '@/context/AssetContext';
import { showLocalNotification } from '@/lib/notification-utils';
import { Capacitor } from '@capacitor/core';

export default function Hero() {
  const [imageLoaded, setImageLoaded] = useState(false);
  const { getAsset } = useAssets();
  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();

  useEffect(() => {
    const timer = setTimeout(() => setImageLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleTestNotification = async () => {
    alert('Attempting instant notification...');
    await showLocalNotification(
      'Notification Test 🔔',
      'This is a test notification from KUCET CMS app. If you see this, notifications are working!'
    );
  };

  return (
    <section className="relative w-full">
      {/* Test Notification Buttons - Visible to everyone for debugging */}
      <div className="absolute top-20 left-4 z-[100] flex flex-col gap-2">
        <button 
          onClick={handleTestNotification}
          className="bg-blue-600 hover:bg-blue-700 text-white border border-white/50 rounded-lg px-4 py-2 text-xs font-black shadow-2xl transition-all active:scale-95 flex items-center gap-2 uppercase tracking-tighter"
        >
          <span className="bg-green-400 w-2 h-2 rounded-full animate-ping"></span>
          Instant Test
        </button>
        
        <button 
          onClick={async () => {
            alert('Scheduling test notification for 5 seconds from now...');
            // Schedule for 5 seconds later
            await showLocalNotification(
              'Delayed Test ⏳',
              'This notification was scheduled 5 seconds ago. If you see this, background scheduling works!',
              { triggerAt: new Date(Date.now() + 5000) }
            );
          }}
          className="bg-slate-800 hover:bg-slate-900 text-white border border-white/30 rounded-lg px-4 py-2 text-xs font-black shadow-2xl transition-all active:scale-95 flex items-center gap-2 uppercase tracking-tighter"
        >
          <span className="bg-orange-400 w-2 h-2 rounded-full"></span>
          10s Delay Test
        </button>
      </div>

      {/* Hero Image */}
      <div className="relative w-full h-75 md:h-100 lg:h-125 overflow-hidden">
        <NextImage
          src={getAsset('/assets/college-campus.jpg')}
          alt="KU College of Engineering and Technology Campus"
          fill
          className={`object-cover transition-opacity duration-1000 ease-in-out ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setImageLoaded(true)}          priority
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent"></div>
        
        {/* Overlay Text with gray transparent background - only show on md+ screens */}
        <div className={`hidden md:block absolute bottom-0 left-0 right-0 p-10 transition-all duration-700 ease-out ${imageLoaded ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
          <div className="inline-block bg-gray-900/60 backdrop-blur-sm rounded-lg px-8 py-5">
            <h1 className="text-4xl lg:text-5xl font-bold text-white drop-shadow-lg">
              Welcome to KUCET
            </h1>
            <p className="text-xl text-white/90 mt-2 drop-shadow-md">
              Excellence in Engineering Education
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
