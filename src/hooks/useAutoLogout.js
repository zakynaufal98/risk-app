// src/hooks/useAutoLogout.js
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';

/**
 * useAutoLogout
 * - timeout: idle time sebelum logout (ms)
 * - warningTime: waktu sebelum logout untuk tampilkan warning (ms)
 * - maxSessionAge: batas maksimum umur login absolut (ms)
 * - onLogout: callback setelah logout
 * - checkSessionInterval: cek session Supabase berkala (ms)
 */
export default function useAutoLogout({
  timeout = 30 * 60 * 1000,     // 30 menit idle
  warningTime = 60 * 1000,      // 1 menit warning
  maxSessionAge = null,         // contoh: 60 * 60 * 1000 (1 jam)
  onLogout = null,
  checkSessionInterval = null
} = {}) {

  const [showWarning, setShowWarning] = useState(false);

  const lastActivityRef = useRef(Date.now());
  const logoutTimerRef = useRef(null);
  const warningTimerRef = useRef(null);
  const intervalRef = useRef(null);

  // ===== Helper logout =====
  const forceLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('signOut failed (ignored):', e);
    } finally {
      try {
        localStorage.removeItem('login_at');
      } catch {}

     	setShowWarning(false);
      if (typeof onLogout === 'function') onLogout();
      else window.location.href = '/login';
    }
  }, [onLogout]);

  // ===== Reset idle timers =====
  const resetTimers = useCallback(() => {
    lastActivityRef.current = Date.now();

    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);

    setShowWarning(false);

    const msUntilWarning = Math.max(0, timeout - warningTime);
    const msUntilLogout = Math.max(0, timeout);

    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
    }, msUntilWarning);

    logoutTimerRef.current = setTimeout(() => {
      forceLogout();
    }, msUntilLogout);

  }, [timeout, warningTime, forceLogout]);

  // ===== Activity handler =====
  const activityHandler = useCallback(() => {
    resetTimers();
  }, [resetTimers]);

  // ===== Effect =====
  useEffect(() => {

    // ---- 1) Pasang event listener aktivitas
    const events = [
      'mousemove', 'mousedown', 'keydown',
      'touchstart', 'pointermove', 'wheel', 'scroll'
    ];
    events.forEach(ev => window.addEventListener(ev, activityHandler, { passive: true }));

    // ---- 2) Return ke tab → reset idle
    const onVisibility = () => {
      if (!document.hidden) activityHandler();
    };
    document.addEventListener('visibilitychange', onVisibility);

    // ---- 3) Init idle timer
    resetTimers();

    // ---- 4) OPSI C: cek umur session absolut
    if (maxSessionAge && typeof maxSessionAge === 'number') {
      const loginAt = Number(localStorage.getItem('login_at') || 0);

      // jika tidak ada timestamp → logout
      if (!loginAt) {
        forceLogout();
      }

      // jika umur session lewat batas → logout
      if (loginAt && Date.now() - loginAt > maxSessionAge) {
        forceLogout();
      }
    }

    // ---- 5) Optional: cek session Supabase berkala (server side)
    if (checkSessionInterval && typeof checkSessionInterval === 'number') {
      intervalRef.current = setInterval(async () => {
        try {
          const { data } = await supabase.auth.getSession();
          if (!data?.session) {
            forceLogout();
          }
        } catch (e) {
          console.error('Session check failed:', e);
        }
      }, checkSessionInterval);
    }

    return () => {
      events.forEach(ev => window.removeEventListener(ev, activityHandler));
      document.removeEventListener('visibilitychange', onVisibility);

      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };

  }, [activityHandler, resetTimers, maxSessionAge, checkSessionInterval, forceLogout]);

  // ===== Tombol "Tetap login" =====
  const stayLoggedIn = useCallback(() => {
    resetTimers();
    setShowWarning(false);
  }, [resetTimers]);

  return {
    showWarning,
    stayLoggedIn
  };
}
