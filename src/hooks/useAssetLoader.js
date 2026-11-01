'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useAssetLoader - Comprehensive hook for tracking remote/storage asset lifecycle
 * Supports loading states, caching checks, stale-request protection, and safe retries.
 *
 * @param {Object} options
 * @param {string} options.src - URL or asset key
 * @param {number} [options.retryLimit=3] - Maximum allowable retries
 * @param {Function} [options.onLoaded] - Optional success callback
 * @param {Function} [options.onError] - Optional failure callback
 */
export function useAssetLoader({ src, retryLimit = 3, onLoaded, onError } = {}) {
  const [status, setStatus] = useState(() => (src ? 'loading' : 'idle'));
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [retryKey, setRetryKey] = useState(0);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const currentKey = `${src || ''}-${retryKey}`;
  const [prevKey, setPrevKey] = useState(currentKey);

  if (prevKey !== currentKey) {
    setPrevKey(currentKey);
    setStatus(src && String(src).trim() !== '' ? 'loading' : 'idle');
    setError(null);
    setRetryCount(0);
  }

  // Safety timeout: transition to error if loading hangs longer than 15s
  useEffect(() => {
    if (status !== 'loading' || !src) return;

    const timer = setTimeout(() => {
      if (mountedRef.current && status === 'loading') {
        setStatus('error');
        setError(new Error('Asset request timed out'));
      }
    }, 15000);

    return () => clearTimeout(timer);
  }, [status, src, retryKey]);

  const onLoadSuccess = useCallback(() => {
    if (!mountedRef.current) return;
    setStatus('loaded');
    setError(null);
    onLoaded?.();
  }, [onLoaded]);

  const onLoadError = useCallback((err) => {
    if (!mountedRef.current) return;
    setStatus('error');
    const errObj = err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'Asset failed to load');
    setError(errObj);
    onError?.(errObj);
  }, [onError]);

  const retry = useCallback(() => {
    if (retryCount >= retryLimit) return false;
    setRetryCount((prev) => prev + 1);
    setRetryKey((prev) => prev + 1);
    setStatus('loading');
    setError(null);
    return true;
  }, [retryCount, retryLimit]);

  // Avoid appending query string cache-buster to data URIs
  const isDataUri = typeof src === 'string' && src.startsWith('data:');
  const resolvedSrc = retryCount > 0 && src && !isDataUri
    ? `${src}${src.includes('?') ? '&' : '?'}retry=${retryKey}`
    : src;

  return {
    status,
    isLoading: status === 'loading',
    isLoaded: status === 'loaded',
    isError: status === 'error',
    isIdle: status === 'idle',
    error,
    retryCount,
    canRetry: retryCount < retryLimit,
    retry,
    onLoadSuccess,
    onLoadError,
    // URL with retry cache-buster if retried
    resolvedSrc,
  };
}

export default useAssetLoader;
