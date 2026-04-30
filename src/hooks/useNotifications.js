import { useState, useEffect, useCallback, useRef } from 'react';
import { notificationService } from '../services/notificationService';

export const useNotifications = (isAuthenticated) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const intervalRef = useRef(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await notificationService.getUnreadCount();
      setUnreadCount(res.data.data.count || 0);
    } catch {
      // silent fail — do not disrupt the UI
    }
  }, [isAuthenticated]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await notificationService.getAll();
      setNotifications(res.data.data || []);
    } catch {
      // silent fail
    }
  }, []);

  const markRead = useCallback(async (id) => {
    try {
      await notificationService.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // silent fail
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await notificationService.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // silent fail
    }
  }, []);

  const deleteOne = useCallback(async (id) => {
    const wasUnread = notifications.some(n => n.id === id && !n.is_read);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, removing: true } : n));
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 350);
    if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      await notificationService.deleteOne(id);
    } catch {
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [notifications, fetchNotifications, fetchUnreadCount]);

  const deleteAll = useCallback(async () => {
    const removedUnread = notifications.filter(n => !n.is_read).length;
    setNotifications(prev => prev.map(n => ({ ...n, removing: true })));
    setTimeout(() => {
      setNotifications([]);
    }, 350);
    setUnreadCount(prev => Math.max(0, prev - removedUnread));
    try {
      await notificationService.deleteAll();
    } catch {
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [notifications, fetchNotifications, fetchUnreadCount]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchUnreadCount();
      intervalRef.current = setInterval(fetchUnreadCount, 30000);
    } else {
      clearInterval(intervalRef.current);
      setUnreadCount(0);
    }
    return () => clearInterval(intervalRef.current);
  }, [isAuthenticated, fetchUnreadCount]);

  return { unreadCount, notifications, fetchNotifications, markRead, markAllRead, deleteOne, deleteAll, fetchUnreadCount };
};
