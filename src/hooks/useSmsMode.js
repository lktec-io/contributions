import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { smsService } from '../services/smsService';

/*  Resolves the signed-in account's SMS mode from the existing
    GET /sms/bulk-status endpoint — no new route.

    Cached per user id for the session so several components can ask without
    each firing a request; the key resets when a different user signs in.
    Returns null while unresolved, so callers can hold rendering rather than
    briefly showing a workspace the user is not allowed to see.              */

let cache    = null; // { uid, mode }
let inFlight = null;

export function useSmsMode(enabled = true) {
  const { user } = useContext(AuthContext);
  const uid = user?.id ?? null;

  // Only records the async result. A cache hit is read during render below,
  // so no state is set synchronously inside the effect.
  const [resolved, setResolved] = useState({ uid: null, mode: null });

  useEffect(() => {
    if (!enabled || !uid) return;
    if (cache && cache.uid === uid) return;

    cache = null; // a different user signed in — drop the previous answer
    let alive = true;

    if (!inFlight) {
      inFlight = smsService.getBulkStatus()
        .then(res => res.data.data?.smsMode || 'dispatch_all')
        .catch(() => 'dispatch_all')
        .then(m => { cache = { uid, mode: m }; inFlight = null; return m; });
    }
    inFlight.then(m => { if (alive) setResolved({ uid, mode: m }); });

    return () => { alive = false; };
  }, [enabled, uid]);

  if (cache && cache.uid === uid) return cache.mode;
  if (resolved.uid === uid) return resolved.mode;
  return null;
}
