// src/components/Navbar.jsx
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

// Terima setSession agar kita bisa hapus session di parent (App.jsx)
const Navbar = ({ toggleSidebar, semester, setSemester, session, setSession }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const user = session?.user;
  const fullName = user?.user_metadata?.full_name;
  const email = user?.email || 'User';
  const displayName = fullName || email.split('@')[0];
  const getInitials = (name) => name ? name.substring(0,2).toUpperCase() : 'AU';

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': case '/dashboard': return { title: 'Main Dashboard', subtitle: 'Overview Risiko & Statistik' };
      case '/input': return { title: 'Input Data', subtitle: 'Formulir Register Risiko' };
      case '/database': return { title: 'Database', subtitle: 'Tabel Data Lengkap' };
      case '/kriteria': return { title: 'Kriteria', subtitle: 'Data Kriteria Lengkap' };
      default: return { title: 'Risk Management', subtitle: 'Sistem Informasi Risiko' };
    }
  };
  const { title, subtitle } = getPageTitle();

  // robust logout (cek session dulu, hindari revoke global yang memerlukan refresh token)
  const handleLogout = async () => {
    try {
      // 1) pastikan ada session di client
      const { data } = await supabase.auth.getSession();
      const currentSession = data?.session ?? null;

      if (!currentSession) {
        // tidak ada session: lakukan cleanup client-side dan redirect
        cleanupAndRedirect();
        return;
      }

      // 2) coba signOut tanpa global revoke dulu (lebih aman untuk browser/tablet)
      const { error } = await supabase.auth.signOut({ global: false });
      if (error) {
        console.warn('signOut returned error (non-fatal):', error.message);
        // lanjutkan cleanup client-side walau ada error
      }

      // 3) pastikan state di parent di-clear
      if (typeof setSession === 'function') setSession(null);

      // 4) cleanup localStorage keys supabase (fallback)
      cleanupAndRedirect();
    } catch (err) {
      console.error('Unexpected logout error:', err);
      cleanupAndRedirect();
    }
  };

  const cleanupAndRedirect = () => {
    try {
      Object.keys(localStorage).forEach((k) => {
        const kl = k.toLowerCase();
        if (kl.includes('supabase') || kl.startsWith('sb-') || kl.includes('auth')) {
          localStorage.removeItem(k);
        }
      });
    } catch (e) {
      console.warn('cleanup localStorage failed', e);
    }

    // replace supaya tidak meninggalkan history
    window.location.replace('/auth');
  };

  const generateSemesterOptions = () => {
    const currentYear = new Date().getFullYear();
    const startYear = 2024;
    const endYear = currentYear + 2;
    const options = [];
    for (let year = startYear; year <= endYear; year++) {
      options.push(`Semester 1 ${year}`);
      options.push(`Semester 2 ${year}`);
    }
    return options;
  };

  return (
    <div className="navbar-custom d-flex justify-content-between align-items-center w-100">
      <div className="d-flex align-items-center gap-3">
        <i className="bi bi-list fs-4 cursor-pointer d-lg-none" onClick={toggleSidebar}></i>
        <div>
          <h5 className="mb-0 fw-bold" style={{color: '#2b3674'}}>{title}</h5>
          <span className="text-muted-custom" style={{fontSize: '0.9rem'}}>{subtitle}</span>
        </div>
      </div>

      <div className="d-flex align-items-center gap-3 bg-white p-2 rounded-pill shadow-sm">
        <select 
          id="semesterSelect"
          name="semester"
          className="form-select border-0 bg-transparent fw-bold text-primary" 
          style={{width: '160px', fontSize:'0.85rem', cursor:'pointer', boxShadow: 'none'}}
          value={semester}
          onChange={(e) => setSemester(e.target.value)}
        >
          {generateSemesterOptions().map(sem => <option key={sem} value={sem}>{sem}</option>)}
        </select>

        <div style={{width: '1px', height: '20px', background: '#e0e0e0'}} />

        <div className="dropdown">
          <div 
            className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold dropdown-toggle" 
            role="button"
            id="userDropdown"
            data-bs-toggle="dropdown" 
            aria-expanded="false"
            style={{width: 40, height: 40, fontSize:'0.9rem', cursor: 'pointer'}}
          >
            {getInitials(displayName)}
          </div>

          <ul className="dropdown-menu dropdown-menu-end" aria-labelledby="userDropdown">
            <li>
              <h6 className="dropdown-header text-truncate" style={{maxWidth: '220px'}}>{email}</h6>
            </li>
            <li><hr className="dropdown-divider" /></li>
            <li>
              <button className="dropdown-item text-danger" onClick={handleLogout} style={{ cursor: 'pointer' }}>
                <i className="bi bi-box-arrow-right fs-5"></i> <span>Logout</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
