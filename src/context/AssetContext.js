'use client';

import React, { createContext, useContext, useEffect, useCallback, useState } from 'react';
import { getAssetUrl, invalidateAssetCache, getAssetCacheSnapshot } from '@/lib/assets';

const AssetContext = createContext();

// Manifest of static branding assets to pre-cache for instant loading
const ASSET_MANIFEST = [
  // Logos and Icons
  '/assets/ku-logo.png',
  '/assets/ku-college-logo.png',
  '/assets/Naac_A+.png',
  '/assets/kakatiya-kala-thoranam.png',
  '/assets/rudramadevi_statue.jpg',
  '/assets/college-campus.jpg',
  '/assets/default-avatar.svg',
  
  // Developer Photos
  '/assets/DevPics/Dev1.png',
  '/assets/DevPics/Dev2.jpg',
  '/assets/DevPics/Dev3.jpg',
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
  const [cacheVersion, setCacheVersion] = useState(0);

  const preCacheAssets = useCallback(async () => {
    const fetchPromises = ASSET_MANIFEST.map(async (path) => {
      try {
        const url = getAssetUrl(path);
        await fetch(url, { mode: 'no-cors' }); 
      } catch (_err) {
        // Silent error for optional pre-cache
      }
    });

    await Promise.allSettled(fetchPromises);
  }, []);

  useEffect(() => {
    preCacheAssets();
  }, [preCacheAssets]);

  /**
   * Resolves and returns a cached asset URL.
   */
  const getAsset = useCallback((path, transformations = 'f_auto,q_auto', options = {}) => {
    return getAssetUrl(path, transformations, options);
  }, []);

  /**
   * Selectively invalidates a specific asset key in the client cache.
   * Forces re-resolution on subsequent reads.
   */
  const invalidateAsset = useCallback((pathOrKey) => {
    invalidateAssetCache(pathOrKey);
    setCacheVersion((v) => v + 1);
  }, []);

  /**
   * Clears the complete client asset memory cache.
   */
  const clearCache = useCallback(() => {
    invalidateAssetCache();
    setCacheVersion((v) => v + 1);
  }, []);

  return (
    <AssetContext.Provider
      value={{
        getAsset,
        invalidateAsset,
        clearCache,
        cacheSnapshot: getAssetCacheSnapshot(),
        cacheVersion,
      }}
    >
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
