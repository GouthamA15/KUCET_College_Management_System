"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ClerkRedirects() {
  const router = useRouter();

  useEffect(() => {
    const roleCookie = document.cookie.split('; ').find(row => row.startsWith('clerk_role='));
    const role = roleCookie ? roleCookie.split('=')[1].toLowerCase() : '';
    if (role === 'scholarship') {
      router.replace('/clerk/scholarship/dashboard');
    } else if (role === 'admission') {
      router.replace('/clerk/admission/dashboard');
    } else if (role === 'faculty') {
      router.replace('/clerk/faculty/dashboard');
    } else {
      // No role found or unknown role — send to login/home
      router.replace('/');
    }
  }, [router]);

  return null;
}
