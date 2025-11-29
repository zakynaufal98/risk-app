// src/hooks/useAutoLogout.js
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';

/**
 * useAutoLogout
 * @param {Object} options
 *  - timeout (ms): waktu idle sebelum auto logout (default 30*60*1000 = 30 menit)
 *  - warningTime (ms): tampilkan modal peringatan X ms sebelum logout (default 60*1000 = 1 menit)
 *  - onLogout: optional callback setelah logout (mis: redirect)
 *  - checkSessionInterval (ms|null): jika ingin cek session server berkala (default null = no server check)
 */
export default function useAutoLogout({
  timeout = 30 * 60 * 1000,
  warningTime = 60 * 1000,
  onLogout = null,
  checkSessionInterval = null
} = {}) {
  const [showWarning, setShowWarning] = useState(false);
  const remainingRef = useRef(timeout);
  const lastActivityRef = useRef(Date.now());
  const logoutTimerRef = useRef(null);
  const warningTimerRef = useRef(null);
  const intervalRef = useRef(null);

  const resetTimers = useCallback(() => {
    lastActivityRef.current = Date.now();
    // clear existing timers
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    setShowWarning(false);

    // compute milliseconds until warning + logout from now
    const msUntilWarning = Math.max(0, timeout - warningTime);
    const msUntilLogout = Math.max(0, timeout);

    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
    }, msUntilWarning);

    logoutTimerRef.current = setTimeout(async () => {
      // perform logout
      try {
        await supabase.auth.signOut();
      } catch (e) {
        // ignore signOut errors, still treat as logged out
        console.error('signOut error', e);
      }
      setShowWarning(false);
      if (typeof onLogout === 'function') onLogout();
      else window.location.href = '/login';
    }, msUntilLogout);
  }, [timeout, warningTime, onLogout]);

  // Activity handler (debounced-ish)
  const activityHandler = useCallback(() => {
    // don't reset while warning is visible (user might be reviewing modal)
    // but if user interacts while warning, we'll treat as keep-alive
    resetTimers();
  }, [resetTimers]);

  useEffect(() => {
    // events to listen for user activity
    const events = [
      'mousemove', 'mousedown', 'keydown',
      'touchstart', 'pointermove', 'wheel', 'scroll'
    ];

    events.forEach(ev => window.addEventListener(ev, activityHandler, { passive: true }));

    // visibility change: if user returns to tab, reset timers
    const onVisibility = () => {
      if (!document.hidden) activityHandler();
    };
    document.addEventListener('visibilitychange', onVisibility);

    // initialize timers
    resetTimers();

    // optional server session checker
    if (checkSessionInterval && typeof checkSessionInterval === 'number') {
      intervalRef.current = setInterval(async () => {
        try {
          const { data } = await supabase.auth.getSession();
          // if no session -> force logout now
          if (!data?.session) {
            if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
            if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
            try { await supabase.auth.signOut(); } catch (e) {}
            if (typeof onLogout === 'function') onLogout();
            else window.location.href = '/login';
          }
        } catch (e) {
          console.error('session check failed', e);
        }
      }, checkSessionInterval);
    }

    return () => {
      // cleanup
      events.forEach(ev => window.removeEventListener(ev, activityHandler));
      document.removeEventListener('visibilitychange', onVisibility);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activityHandler, resetTimers, checkSessionInterval]);

  // function to call if user wants to stay logged in from the modal
  const stayLoggedIn = useCallback(() => {
    resetTimers();
    setShowWarning(false);
  }, [resetTimers]);

  // expose state & actions
  return {
    showWarning,
    stayLoggedIn
  };
}
