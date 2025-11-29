// src/components/Navbar.jsx
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

// 1. Terima props 'session'
const Navbar = ({ toggleSidebar, semester, setSemester, session }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // --- LOGIKA NAMA USER ---
  const user = session?.user;
  
  // Coba ambil nama dari metadata, kalau tidak ada pakai email
  // user_metadata biasanya kosong kecuali diset saat register
  const fullName = user?.user_metadata?.full_name;
  const email = user?.email || 'User';

  // Jika fullName ada pakai itu, jika tidak, ambil text sebelum @ dari email
  const displayName = fullName || email.split('@')[0];

  // Buat Inisial (Contoh: "admin@gmail.com" -> "AD")
  const getInitials = (name) => {
    return name ? name.substring(0, 2).toUpperCase() : 'AU';
  };
  // ------------------------

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return { title: 'Main Dashboard', subtitle: 'Overview Risiko & Statistik' };
      case '/dashboard': return { title: 'Main Dashboard', subtitle: 'Overview Risiko & Statistik' };
      case '/input': return { title: 'Input Data', subtitle: 'Formulir Register Risiko' };
      case '/database': return { title: 'Database', subtitle: 'Tabel Data Lengkap' };
      case '/kriteria': return { title: 'Kriteria', subtitle: 'Data Kriteria Lengkap' };
      default: return { title: 'Risk Management', subtitle: 'Sistem Informasi Risiko' };
    }
  };

  const { title, subtitle } = getPageTitle();

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

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Error logging out:', error.message);
    navigate('/auth'); 
  };

  return (
    <div className="navbar-custom d-flex justify-content-between align-items-center w-100">
      {/* KIRI */}
      <div className="d-flex align-items-center gap-3">
        <i className="bi bi-list fs-4 cursor-pointer d-lg-none" onClick={toggleSidebar}></i>
        <div>
          <h5 className="mb-0 fw-bold" style={{color: '#2b3674'}}>{title}</h5>
          <span className="text-muted-custom" style={{fontSize: '0.9rem'}}>{subtitle}</span>
        </div>
      </div>

      {/* KANAN */}
      <div className="d-flex align-items-center gap-3 bg-white p-2 rounded-pill shadow-sm">
        
        <select 
          className="form-select border-0 bg-transparent fw-bold text-primary" 
          style={{width: '160px', fontSize:'0.85rem', cursor:'pointer', boxShadow: 'none'}}
          value={semester}
          onChange={(e) => setSemester(e.target.value)}
        >
          {generateSemesterOptions().map(sem => (
             <option key={sem} value={sem}>{sem}</option>
          ))}
        </select>

        <div style={{width: '1px', height: '20px', background: '#e0e0e0'}}></div>

        {/* USER DROPDOWN */}
        {/* USER DROPDOWN (AVATAR) */}
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
          
          {/* Menu Dropdown */}
          <ul className="dropdown-menu dropdown-menu-end" aria-labelledby="userDropdown">
            {/* Header Email */}
            <li>
                <h6 className="dropdown-header text-truncate" style={{maxWidth: '220px'}}>
                    {email}
                </h6>
            </li>
            
            <li><hr className="dropdown-divider" /></li>
            
            {/* Tombol Logout */}
            <li>
              <button 
                className="dropdown-item text-danger" 
                onClick={handleLogout}
                style={{ cursor: 'pointer' }} // Pastikan cursor pointer
              >
                <i className="bi bi-box-arrow-right fs-5"></i> 
                <span>Logout</span>
              </button>
            </li>
          </ul>
        </div>

      </div>
    </div>
  );
};

export default Navbar;