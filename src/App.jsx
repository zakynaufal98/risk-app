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
  const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 menit
  const activityEvents = ['mousemove', 'click', 'keydown', 'scroll', 'touchstart'];

  const setupAutoLogout = useCallback(() => {
    let timer = null;

    const doSignOut = async () => {
      try {
        console.log('⏳ Auto logout: idle terlalu lama.');
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Auto-logout signOut error:', err);
      } finally {
        try {
          setSession(null);
        } catch (_) {}

        // bersihkan token lokal supabase
        try {
          Object.keys(localStorage).forEach((k) => {
            const kl = k.toLowerCase();
            if (kl.includes('supabase') || kl.startsWith('sb-')) {
              localStorage.removeItem(k);
            }
          });
        } catch (_) {}

        window.location.replace('/auth');
      }
    };

    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(doSignOut, IDLE_TIMEOUT);
    };

    activityEvents.forEach((ev) =>
      window.addEventListener(ev, resetTimer, { passive: true })
    );

    resetTimer();

    return () => {
      if (timer) clearTimeout(timer);
      activityEvents.forEach((ev) =>
        window.removeEventListener(ev, resetTimer)
      );
    };
  }, []);

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
          Object.keys(localStorage).forEach((k) => {
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
