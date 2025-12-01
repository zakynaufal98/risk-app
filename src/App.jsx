// src/App.jsx
import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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

  // ===============================
  // 🔥 AUTO LOGOUT FRONTEND (Tanpa Modal)
  // ===============================
  // 30 * 60 * 1000  => 30 menit (30 detik * 60 * 1000 milidetik)
  const IDLE_TIMEOUT = 30 * 60 * 1000; // ubah sesuai kebutuhan
  const activityEvents = ['mousemove', 'click', 'keydown', 'scroll', 'touchstart'];

  const setupAutoLogout = useCallback(() => {
    let timer = null;

    const doSignOut = async () => {
      try {
        console.log('⏳ Auto logout: user idle terlalu lama.');
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Auto-logout signOut error:', err);
      } finally {
        // pastikan state aplikasi juga dibersihkan
        try { setSession(null); } catch (e) {}
        // pakai replace agar user tidak kembali ke halaman sebelumnya
        window.location.replace('/auth');
      }
    };

    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(doSignOut, IDLE_TIMEOUT);
    };

    // Pasang listener
    activityEvents.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));

    // Mulai timer pertama
    resetTimer();

    // Return cleanup function agar bisa dipanggil di useEffect cleanup
    return () => {
      if (timer) clearTimeout(timer);
      activityEvents.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [IDLE_TIMEOUT, activityEvents, setSession]);

  useEffect(() => {
    // aktifkan sistem auto logout dan simpan cleanup
    const cleanup = setupAutoLogout();
    return cleanup;
  }, [setupAutoLogout]);
  // ===============================


  // ===============================
  // 🔥 AUTH STATE LISTENER
  // ===============================
  useEffect(() => {
    let mounted = true;

    // Ambil session saat awal load
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setLoading(false);
    }).catch((err) => {
      console.error('getSession error:', err);
      if (!mounted) return;
      setSession(null);
      setLoading(false);
    });

    // Listener perubahan auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ===============================

  const toggleSidebar = () => setIsSidebarOpen(s => !s);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary"></div>
      </div>
    );
  }

  return (
    <Routes>

      {/* Tanpa Sidebar */}
      <Route
        path="/auth"
        element={!session ? <Auth /> : <Navigate to="/dashboard" replace />}
      />

      {/* Dengan Sidebar */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout
              isSidebarOpen={isSidebarOpen}
              toggleSidebar={toggleSidebar}
              semester={semester}
              setSemester={setSemester}
              session={session}
              setSession={setSession}         // <-- penting: teruskan setter agar Navbar/komponen lain bisa clear session
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

      {/* Fullscreen */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
