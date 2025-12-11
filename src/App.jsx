// src/App.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import { supabase } from './supabaseClient';

import MainLayout from './components/MainLayout';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import InputData from './pages/InputData';
import Database from './pages/Database';
import Kriteria from './pages/Kriteria';
import NotFound from './pages/NotFound';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const today = new Date();
  const currentSem = `Semester ${today.getMonth() < 6 ? '1' : '2'} ${today.getFullYear()}`;
  const [semester, setSemester] = useState(currentSem);

  const navigate = useNavigate();
  const location = useLocation();

  // ===============================
  // 🔥 AUTO LOGOUT FRONTEND
  // ===============================
  const IDLE_TIMEOUT = 20 * 60 * 1000; // 30 menit
  const activityEvents = ['mousemove', 'click', 'keydown', 'scroll', 'touchstart'];
  const ACTIVITY_KEY = 'app_last_activity';
  const LOGIN_AT_KEY = 'login_at';
  const SIGNED_OUT_KEY = 'signed_out_at';

  const setupAutoLogout = useCallback(() => {
    let timer = null;

    const safeClearLocalSupabaseKeys = () => {
      try {
        const keys = Object.keys(localStorage);
        keys.forEach((k) => {
          const kl = k.toLowerCase();
          if (kl.includes('supabase') || kl.startsWith('sb-')) {
            localStorage.removeItem(k);
          }
        });
      } catch (_) {}
    };

    const doSignOut = async (reason = 'idle') => {
      try {
        console.log('⏳ Auto logout:', reason);
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Auto-logout signOut error:', err);
      } finally {
        try { setSession(null); } catch (_) {}

        // hapus login_at dan catat signed_out_at untuk sinkron antar-tab
        try {
          localStorage.removeItem(LOGIN_AT_KEY);
          safeClearLocalSupabaseKeys();
          localStorage.setItem(SIGNED_OUT_KEY, Date.now().toString());
        } catch (_) {}

        // SPA navigation (replace)
        try {
          navigate('/auth', { replace: true });
        } catch (_) {
          // fallback full reload jika navigate gagal
          window.location.replace('/auth');
        }
      }
    };

    const resetTimer = () => {
      // update last activity ke localStorage (berguna ketika tab ditutup lalu dibuka lagi)
      try { localStorage.setItem(ACTIVITY_KEY, Date.now().toString()); } catch (_) {}

      if (timer) clearTimeout(timer);
      timer = setTimeout(() => doSignOut('idle timeout'), IDLE_TIMEOUT);
    };

    // pasang listener aktivitas
    activityEvents.forEach((ev) =>
      window.addEventListener(ev, resetTimer, { passive: true })
    );

    // juga tangani visibilitychange: saat kembali visible, reset timer
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') resetTimer();
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    // inisialisasi last activity jika belum ada
    try {
      if (!localStorage.getItem(ACTIVITY_KEY)) {
        localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
      }
    } catch (_) {}

    resetTimer();

    return () => {
      if (timer) clearTimeout(timer);
      activityEvents.forEach((ev) =>
        window.removeEventListener(ev, resetTimer)
      );
      document.removeEventListener('visibilitychange', visibilityHandler);
    };
  }, [navigate]);

  useEffect(() => {
    const cleanup = setupAutoLogout();
    return cleanup;
  }, [setupAutoLogout]);

  // ===============================
  // 🔥 AUTH STATE (SUPABASE)
  // ===============================
  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;
        setSession(session);
        setLoading(false);
      })
      .catch((err) => {
        console.error('getSession error:', err);

        // kalau error refresh token, bersihkan token lokal
        try {
          const keys = Object.keys(localStorage);
          keys.forEach((k) => {
            const kl = k.toLowerCase();
            if (kl.includes('supabase') || kl.startsWith('sb-')) {
              localStorage.removeItem(k);
            }
          });
        } catch (_) {}

        if (!mounted) return;
        setSession(null);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ===============================
  // 🔁 EFFECT UNTUK AUTO-REDIRECT
  // ===============================
  useEffect(() => {
    if (loading) return;

    // jika sudah login tapi masih di /auth -> pindahkan ke /dashboard
    if (session && location.pathname === '/auth') {
      navigate('/dashboard', { replace: true });
    }
  }, [session, loading, location.pathname, navigate]);

  // ===============================
  // Check last activity & login_at on mount
  // Jika sudah lewat IDLE_TIMEOUT -> langsung signOut
  // ===============================
  useEffect(() => {
    const checkOnMount = async () => {
      try {
        const lastActivity = Number(localStorage.getItem(ACTIVITY_KEY) || 0);
        const loginAt = Number(localStorage.getItem(LOGIN_AT_KEY) || 0);

        // jika tidak ada loginAt tapi ada session server, tetap berhati-hati: jika lastActivity terlalu lama, sign out
        if (lastActivity && Date.now() - lastActivity > IDLE_TIMEOUT) {
          console.info('Mount check: last activity expired -> sign out');
          await supabase.auth.signOut().catch(() => {});
          // bersihkan keys
          try {
            localStorage.removeItem(LOGIN_AT_KEY);
            const keys = Object.keys(localStorage);
            keys.forEach((k) => {
              const kl = k.toLowerCase();
              if (kl.includes('supabase') || kl.startsWith('sb-')) {
                localStorage.removeItem(k);
              }
            });
            localStorage.setItem(SIGNED_OUT_KEY, Date.now().toString());
          } catch (_) {}
          navigate('/auth', { replace: true });
          return;
        }

        // jika Anda memakai login_at sebagai batas absolut (mis. login max age), cek di sini
        // (tidak memaksa di sini karena maxSessionAge dipakai di hook lain; jika perlu aktifkan)
        // contoh cek sederhana: jika loginAt ada dan umur > 24 jam -> keluarkan
        const MAX_ABSOLUTE = 24 * 60 * 60 * 1000; // 24 jam (ubah sesuai kebijakan)
        if (loginAt && Date.now() - loginAt > MAX_ABSOLUTE) {
          console.info('Mount check: login_at expired -> sign out');
          await supabase.auth.signOut().catch(() => {});
          try {
            localStorage.removeItem(LOGIN_AT_KEY);
            const keys = Object.keys(localStorage);
            keys.forEach((k) => {
              const kl = k.toLowerCase();
              if (kl.includes('supabase') || kl.startsWith('sb-')) {
                localStorage.removeItem(k);
              }
            });
            localStorage.setItem(SIGNED_OUT_KEY, Date.now().toString());
          } catch (_) {}
          navigate('/auth', { replace: true });
          return;
        }
      } catch (e) {
        console.warn('checkOnMount error:', e);
      }
    };

    checkOnMount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // ===============================
  // Sinkronisasi antar-tab: dengarkan signed_out_at
  // ===============================
  useEffect(() => {
    const handler = (e) => {
      if (e.key === SIGNED_OUT_KEY) {
        // jika ada tanda sign out di tab lain -> reload ke auth
        try {
          navigate('/auth', { replace: true });
        } catch (_) {
          window.location.replace('/auth');
        }
      }
    };

    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [navigate]);

  const toggleSidebar = () => setIsSidebarOpen((s) => !s);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Halaman Auth selalu bisa diakses, redirect di-handle di effect di atas */}
      <Route
        path="/auth"
        element={<Auth setSession={setSession} />}
      />

      {/* Layout dengan sidebar, dibungkus ProtectedRoute */}
      <Route
        element={
          <ProtectedRoute session={session}>
            <MainLayout
              isSidebarOpen={isSidebarOpen}
              toggleSidebar={toggleSidebar}
              semester={semester}
              setSemester={setSemester}
              session={session}
              setSession={setSession}
            />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard semester={semester} />} />
        <Route path="/input" element={<InputData semester={semester} />} />
        <Route path="/database" element={<Database semester={semester} />} />
        <Route path="/kriteria" element={<Kriteria semester={semester} />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
