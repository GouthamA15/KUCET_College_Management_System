"use client";
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function ScrollHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!searchParams) return;
    const scrollTarget = searchParams.get('scroll');
    if (scrollTarget === 'history') {
      const doScroll = () => {
        const el = typeof document !== 'undefined' ? document.getElementById('request-history-section') : null;
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
          el.classList.add('bg-indigo-50', 'transition-colors', 'duration-1000', 'rounded-lg');
          setTimeout(() => el.classList.remove('bg-indigo-50', 'transition-colors', 'duration-1000', 'rounded-lg'), 1000);
        }
      };
      setTimeout(doScroll, 150);
    }
  }, [searchParams]);

  return null;
}
