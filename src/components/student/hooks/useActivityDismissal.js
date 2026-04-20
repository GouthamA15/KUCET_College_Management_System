'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'kucet_dismissed_activities';
const EVENT_DISMISS_START = 'kucet:activity-dismiss-start';
const EVENT_DISMISSED = 'kucet:activity-dismissed';

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function safeParseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function readDismissedMap() {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = safeParseJson(raw, {});
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeDismissedMap(map) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage failures (e.g., quota, blocked storage).
  }
}

function dispatchEvent(name, detail) {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function isActivityDismissed(activityId) {
  if (!activityId) return false;
  const map = readDismissedMap();
  return !!map[activityId];
}

export function dismissActivity(activityId, { animationMs = 180 } = {}) {
  if (!isBrowser() || !activityId) return;

  // Broadcast start so any surface can animate away.
  dispatchEvent(EVENT_DISMISS_START, { activityId, animationMs });

  window.setTimeout(() => {
    const map = readDismissedMap();
    if (map[activityId]) return;
    map[activityId] = true;
    writeDismissedMap(map);

    // Broadcast completion so listeners can hard-hide.
    dispatchEvent(EVENT_DISMISSED, { activityId });
  }, Math.max(0, Number(animationMs) || 0));
}

export default function useActivityDismissal(activityId, { animationMs = 180 } = {}) {
  const id = String(activityId || '');
  const [dismissed, setDismissed] = useState(() => (id ? isActivityDismissed(id) : false));
  const [closing, setClosing] = useState(false);

  const refresh = useCallback(() => {
    if (!id) return;
    setDismissed(isActivityDismissed(id));
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isBrowser() || !id) return;

    const onStorage = (e) => {
      if (e && e.key && e.key !== STORAGE_KEY) return;
      refresh();
    };

    const onDismissStart = (e) => {
      const evtId = e?.detail?.activityId;
      if (evtId === id) setClosing(true);
    };

    const onDismissed = (e) => {
      const evtId = e?.detail?.activityId;
      if (evtId === id) {
        setClosing(false);
        refresh();
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener(EVENT_DISMISS_START, onDismissStart);
    window.addEventListener(EVENT_DISMISSED, onDismissed);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(EVENT_DISMISS_START, onDismissStart);
      window.removeEventListener(EVENT_DISMISSED, onDismissed);
    };
  }, [id, refresh]);

  const dismiss = useCallback(() => {
    if (!id || dismissed || closing) return;
    dismissActivity(id, { animationMs });
    setClosing(true);
  }, [id, dismissed, closing, animationMs]);

  const state = useMemo(() => {
    if (dismissed) return 'dismissed';
    if (closing) return 'closing';
    return 'visible';
  }, [dismissed, closing]);

  return {
    activityId: id,
    dismissed,
    closing,
    state,
    dismiss,
  };
}
