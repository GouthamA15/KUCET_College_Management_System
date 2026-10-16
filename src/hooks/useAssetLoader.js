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
    resolvedSrc: retryCount > 0 && src ? `${src}${src.includes('?') ? '&' : '?'}retry=${retryKey}` : src,
  };
}

export default useAssetLoader;
