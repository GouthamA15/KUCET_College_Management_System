import { useState, useCallback, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';

export function useSecurityNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [notifsLoading, setNotifsLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setNotifsLoading(true);
    try {
      const res = await fetch('/api/auth/security-notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setNotifsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchNotifications();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchNotifications]);

  const handleMarkAsRead = async (notificationId) => {
    try {
      const res = await fetch('/api/auth/security-notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId })
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    if (unread.length === 0) return;
    try {
      const res = await fetch('/api/auth/security-notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true })
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        toast.success('All alerts marked as read');
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications]);

  return { notifications, notifsLoading, unreadCount, handleMarkAsRead, handleMarkAllAsRead, fetchNotifications };
}
