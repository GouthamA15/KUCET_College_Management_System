import { useState, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';

export function useSecuritySessions(activeTab) {
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch('/api/auth/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'sessions') {
      const timer = setTimeout(() => {
        fetchSessions();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [activeTab, fetchSessions]);

  const handleRevokeSession = async (sessionId) => {
    if (!confirm('Are you sure you want to logout this device?')) return;
    try {
      const res = await fetch('/api/auth/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      if (res.ok) {
        toast.success('Device logged out.');
        fetchSessions();
        return true;
      } else {
        toast.error('Failed to logout device.');
      }
    } catch {
      toast.error('Network error');
    }
    return false;
  };

  const handleRevokeOtherSessions = async (onSuccess) => {
    if (!confirm('This will logout your account from all other devices. Continue?')) return;
    try {
      const res = await fetch('/api/auth/sessions/revoke-others', { method: 'POST' });
      if (res.ok) {
        toast.success('Other devices logged out.');
        fetchSessions();
        if (onSuccess) onSuccess();
        return true;
      } else {
        toast.error('Failed to logout other devices.');
      }
    } catch {
      toast.error('Network error');
    }
    return false;
  };

  return { sessions, sessionsLoading, fetchSessions, handleRevokeSession, handleRevokeOtherSessions };
}
