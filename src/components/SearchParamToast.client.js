'use client';
import { useEffect } from 'react';
import toast from 'react-hot-toast';

export default function SearchParamToast({ serverError }) {
  useEffect(() => {
    const error = serverError;
    if (!error) return;

    switch (error) {
      case 'ClerkNotFound':
        toast.error('This email is not registered as an employee.');
        break;
      case 'ClerkInactive':
        toast.error('Your employee account is inactive. Please contact support.');
        break;
      case 'GoogleAuthError':
        toast.error('Google authentication failed. Please try again.');
        break;
      default:
        toast.error('An unknown authentication error occurred.');
        break;
    }

    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      window.history.replaceState({ /* empty */ }, document.title, url.pathname + url.search);
    } catch (_e) {
      // ignore
    }
  }, [serverError]);

  return null;
}
