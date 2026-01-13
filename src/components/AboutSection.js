'use client';

import { useEffect, useRef, useState } from 'react';

export default function AboutSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [highlightsVisible, setHighlightsVisible] = useState(false);
  const sectionRef = useRef(null);
  const highlightsRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target === sectionRef.current && entry.isIntersecting) {
            setIsVisible(true);
          }
          if (entry.target === highlightsRef.current && entry.isIntersecting) {
            setHighlightsVisible(true);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    if (highlightsRef.current) observer.observe(highlightsRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-12 md:py-16 lg:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div 
          ref={sectionRef}
          className={`text-center mb-12 transition-all duration-700 ease-out ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
          }`}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-blue-900 mb-4">
            About KU College of Engineering and Technology
          </h2>
          <div className="w-24 h-1 bg-blue-600 mx-auto"></div>
        </div>

        <div className="space-y-6 text-gray-700 leading-relaxed">
          <p className={`text-base md:text-lg transition-all duration-700 ease-out delay-100 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
          }`}>
            KU College of Engineering and Technology (KUCET) is a premier engineering institution 
            affiliated with Kakatiya University, Warangal. Established with a vision to provide 
            quality technical education, KUCET has been at the forefront of producing skilled 
            engineers and technologists who contribute significantly to the nation's technological 
            advancement. The college is accredited with NAAC A+ grade, reflecting its commitment 
            to academic excellence and quality education.
          </p>

          <p className={`text-base md:text-lg transition-all duration-700 ease-out delay-200 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
          }`}>
            Located in the historic city of Warangal, Telangana, KUCET offers undergraduate and 
            postgraduate programs in various engineering disciplines including Computer Science, 
            Electronics and Communication, Mechanical, Civil, and Electrical Engineering. The 
            institution is recognized for its state-of-the-art infrastructure, well-equipped 
            laboratories, experienced faculty, and vibrant campus life. With admission codes 
            KUWL for EAPCET, KUWL1 for PGECET, and KUWL for ECET, the college attracts talented 
            students from across the state.
          </p>

          <p className={`text-base md:text-lg transition-all duration-700 ease-out delay-300 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
          }`}>
            KUCET emphasizes holistic development through a balanced curriculum that combines 
            theoretical knowledge with practical skills. The college fosters research and 
            innovation through various initiatives, industry partnerships, and collaborative 
            projects. With a strong placement record and alumni network spread across leading 
            organizations globally, KUCET continues to uphold its legacy of excellence in 
            engineering education and remains committed to shaping future leaders in technology 
            and innovation.
          </p>
        </div>

        {/* Key Highlights */}
        <div ref={highlightsRef} className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className={`bg-blue-50 p-6 rounded-lg text-center transition-all duration-700 ease-out ${
            highlightsVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
          }`}>
            <div className="text-4xl font-bold text-blue-900 mb-2">NAAC A+</div>
            <p className="text-gray-700">Accredited Institution</p>
          </div>
          <div className={`bg-blue-50 p-6 rounded-lg text-center transition-all duration-700 ease-out delay-150 ${
            highlightsVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
          }`}>
            <div className="text-4xl font-bold text-blue-900 mb-2">50+</div>
            <p className="text-gray-700">Years of Excellence</p>
          </div>
          <div className={`bg-blue-50 p-6 rounded-lg text-center transition-all duration-700 ease-out delay-300 ${
            highlightsVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
          }`}>
            <div className="text-4xl font-bold text-blue-900 mb-2">5000+</div>
            <p className="text-gray-700">Alumni Network</p>
          </div>
        </div>
      </div>
    </section>
  );
}
