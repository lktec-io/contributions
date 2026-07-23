import { useState, useEffect, useRef, useCallback } from 'react';
import { notificationService } from '../services/notificationService';

// Independent of useNotifications (the bell's hook) — that hook only exists
// while Header/NotificationBell happen to be mounted (not on every route),
// and only polls the unread count, not the list. This hook is mounted once
// at the App root so a new payment-request alert surfaces regardless of
// which authenticated page the user is currently on.

const ALERT_TYPE = 'payment_verification_requested';
const POLL_MS = 15000;
const SEEN_KEY = 'ct_pr_alert_seen_ids';

function loadSeenIds() {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveSeenIds(set) {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...set]));
  } catch {
    // sessionStorage unavailable — alerts just won't survive a reload, non-fatal
  }
}

export function usePaymentRequestAlerts(isAuthenticated) {
  const [queue, setQueue] = useState([]);
  const seenRef = useRef(null);
  const intervalRef = useRef(null);

  if (seenRef.current === null) seenRef.current = loadSeenIds();

  const poll = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await notificationService.getAll();
      const rows = res.data.data || [];
      const fresh = rows.filter(n =>
        n.type === ALERT_TYPE && !n.is_read && !seenRef.current.has(n.id)
      );
      if (fresh.length) {
        fresh.forEach(n => seenRef.current.add(n.id));
        saveSeenIds(seenRef.current);
        setQueue(prev => [...prev, ...fresh]);
      }
    } catch {
      // Best-effort convenience layer — silent fail, never surfaces an error.
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      clearInterval(intervalRef.current);
      return;
    }
    poll();
    intervalRef.current = setInterval(poll, POLL_MS);
    return () => clearInterval(intervalRef.current);
  }, [isAuthenticated, poll]);

  const dismiss = useCallback(() => {
    setQueue(prev => prev.slice(1));
  }, []);

  // Once logged out there's nothing to show, regardless of any queued items
  // left over from the previous session — derived here rather than reset via
  // a setState-in-effect.
  return { current: isAuthenticated ? (queue[0] || null) : null, dismiss };
}
