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

  return { unreadCount, notifications, fetchNotifications, markRead, markAllRead, fetchUnreadCount };
};
