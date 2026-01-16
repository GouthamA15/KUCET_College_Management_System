
'use client';
import Image from 'next/image';

import { useEffect, useState } from 'react';

export default function Hero() {
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setImageLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="relative w-full">
      {/* Hero Image */}
      <div className="relative w-full h-75 md:h-100 lg:h-125 overflow-hidden">
        <Image
          src="/assets/college-campus.jpg"
          alt="KU College of Engineering and Technology Campus"
          fill
          className={`object-cover transition-opacity duration-1000 ease-in-out ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setImageLoaded(true)}
          priority
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent"></div>
        
        {/* Overlay Text with gray transparent background - only show on md+ screens */}
        <div className={`hidden md:block absolute bottom-0 left-0 right-0 p-10 transition-all duration-700 ease-out ${
          imageLoaded ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        }`}>
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
