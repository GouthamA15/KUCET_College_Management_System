"use client";
import { useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { smoothScrollToElement } from '@/lib/scroll-utils';

export default function ScrollHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const hasScrolled = useRef(false);

  useEffect(() => {
    if (!searchParams) return;
    const scrollTarget = searchParams.get('scroll');
    if (scrollTarget !== 'history') return;
    if (hasScrolled.current) return;

    let intervalId = null;

    const tryScroll = () => {
      if (typeof document === 'undefined') return false;
      const el = document.getElementById('request-history-section');
      if (el) {
        smoothScrollToElement(el, { behavior: 'smooth', block: 'start' });
        el.classList.add('bg-indigo-50', 'transition-colors', 'duration-1000', 'rounded-lg');
        setTimeout(() => el.classList.remove('bg-indigo-50', 'transition-colors', 'duration-1000', 'rounded-lg'), 1000);
        hasScrolled.current = true;
        return true;
      }
      return false;
    };

    // Try immediately, then poll every 100ms until the element exists
    const didScroll = tryScroll();
    if (!didScroll) {
      intervalId = setInterval(() => {
        const ok = tryScroll();
        if (ok && intervalId) {
          clearInterval(intervalId);
          intervalId = null;
          // clean URL param without triggering navigation
          try {
            router.replace('/student/requests/certificates', { scroll: false });
          } catch (e) {
            // ignore
          }
        }
      }, 100);
    } else {
      try {
        router.replace('/student/requests/certificates', { scroll: false });
      } catch (e) {}
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [searchParams, router]);

  return null;
}
