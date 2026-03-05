'use client';

import React, { createContext, useContext, useEffect, useCallback } from 'react';
import { getAssetUrl } from '@/lib/assets';

const AssetContext = createContext();

// Manifest of assets to pre-cache for instant loading
const ASSET_MANIFEST = [
  // Logos and Icons
  '/assets/ku-logo.png',
  '/assets/ku-college-logo.png',
  '/assets/Naac_A+.png',
  '/assets/kakatiya-kala-thoranam.png',
  '/assets/rudramadevi_statue.jpg',
  '/assets/college-campus.jpg',
  
  // Developer Photos
  '/assets/DevPics/Dev1.png',
  '/assets/DevPics/Dev2.jpg',
  '/assets/DevPics/Dev3.jpeg',
  '/assets/DevPics/Group.jpg',
  
  // Developer Audio Files (Crucial for instant playback on hover)
  '/assets/DevPics/Dev1.mp4',
  '/assets/DevPics/Dev2.mp3',
  '/assets/DevPics/Dev3.mp3',
  
  // Payment QRs
  '/assets/Payment QR/kucet-logo.png',
  '/assets/Payment QR/ku_payment_100.png',
  '/assets/Payment QR/ku_payment_150.png',
  '/assets/Payment QR/ku_payment_200.png'
];

export function AssetProvider({ children }) {
  const preCacheAssets = useCallback(async () => {
    // We just fetch the assets once so the browser stores them in its native HTTP cache.
    // This avoids issues with Next.js <Image /> components and blob URLs,
    // while still achieving the goal of fetching once and storing locally.
    
    const fetchPromises = ASSET_MANIFEST.map(async (path) => {
      try {
        const url = getAssetUrl(path);
        // Using 'no-cache' ensures we make a request, but the browser will
        // still cache the response according to Cloudinary's cache headers.
        // Actually, just a standard fetch will populate the browser's memory/disk cache.
        await fetch(url, { mode: 'no-cors' }); 
      } catch (err) {
        console.warn(`Asset pre-cache error for ${path}:`, err.message);
      }
    });

    await Promise.allSettled(fetchPromises);
  }, []);

  useEffect(() => {
    preCacheAssets();
  }, [preCacheAssets]);

  // Always return the actual URL, relying on the browser cache for instant loads
  const getAsset = useCallback((path) => {
    return getAssetUrl(path);
  }, []);

  return (
    <AssetContext.Provider value={{ getAsset }}>
      {children}
    </AssetContext.Provider>
  );
}

export const useAssets = () => {
  const context = useContext(AssetContext);
  if (!context) {
    throw new Error('useAssets must be used within an AssetProvider');
  }
  return context;
};
