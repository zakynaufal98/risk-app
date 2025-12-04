// src/App.jsx
import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

import MainLayout from './components/MainLayout';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import InputData from './pages/InputData';
import Database from './pages/Database';
import Kriteria from './pages/Kriteria';
import NotFound from './pages/NotFound';
import ProtectedRoute from './components/ProtectedRoute';

import useAutoLogout from './hooks/useAutoLogout';

function App() {
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const today = new Date();
  const currentSem = `Semester ${today.getMonth() < 6 ? '1' : '2'} ${today.getFullYear()}`;
  const [semester, setSemester] = useState(currentSem);

  // ===============================
  // AUTO LOGOUT (idle + max session age)
  // ===============================
  useAutoLogout({
    timeout: 20 * 60 * 1000,        // 20 menit idle
    warningTime: 2 * 60 * 1000,     // warning 2 menit
    maxSessionAge: 60 * 60 * 1000,  // maksimum 1 jam login
    onLogout: () => {
      setSession(null);
      navigate('/auth', { replace: true });
    },
    checkSessionInterval: 60 * 1000 // cek ke Supabase tiap 1 menit
  });

  // ===============================
  // INIT SESSION & AUTH LISTENER
  // ===============================
  useEffect(() => {
    let mounted = true;

    // Ambil session saat pertama load
    supabase.auth.getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data?.session ?? null);
        setLoading(false);
      })
      .catch((err) => {
        console.error('getSession error:', err);
        if (!mounted) return;
        setSession(null);
        setLoading(false);
      });

    // Listener perubahan auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

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

      {/* AUTH (tanpa sidebar) */}
      <Route
        path="/auth"
        element={!session ? <Auth /> : <Navigate to="/dashboard" replace />}
      />

      {/* MAIN APP (dengan sidebar, wajib login) */}
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
