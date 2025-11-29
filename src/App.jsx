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
  const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 menit (bisa ubah)
  const activityEvents = ['mousemove', 'click', 'keydown', 'scroll', 'touchstart'];

  const setupAutoLogout = useCallback(() => {
    let timer;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        console.log("⏳ Auto logout: user idle terlalu lama.");

        await supabase.auth.signOut();
        window.location.href = '/auth'; // redirect
      }, IDLE_TIMEOUT);
    };

    // Pasang listener
    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer(); // timer pertama

    // Cleanup
    return () => {
      clearTimeout(timer);
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, []);

  useEffect(() => {
    setupAutoLogout(); // aktifkan sistem auto logout
  }, [setupAutoLogout]);
  // ===============================


  // ===============================
  // 🔥 AUTH STATE LISTENER
  // ===============================
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
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
