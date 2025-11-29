// src/components/Sidebar.jsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import logoSimriskom from '../assets/Simriskom.png';

const Sidebar = ({ isOpen, toggle }) => {
  const menus = [
    { path: '/dashboard', name: 'Dashboard', icon: 'bi-grid-fill' },
    { path: '/input', name: 'Input Data', icon: 'bi-pencil-square' },
    { path: '/database', name: 'Lihat Data', icon: 'bi-database-fill' },
    { path: '/kriteria', name: 'Tabel Kriteria', icon: 'bi-book-half' },
  ];

  return (
    <div className="d-flex flex-column h-100">
      
      {/* HEADER SIDEBAR */}
      <div 
        className={`sidebar-header mt-3 mb-2 d-flex align-items-center ${isOpen ? 'justify-content-between px-3' : 'justify-content-center'}`}
        style={{ minHeight: '50px' }}
      >
        
        {/* LOGO + TEKS (Hanya muncul jika Sidebar Terbuka) */}
        {isOpen && (
          <div className="d-flex align-items-center gap-2 animate__fadeIn ps-1">
            {/* 1. Gambar Logo (Kecilkan sedikit agar muat dengan teks) */}
            <img 
              src={logoSimriskom} 
              alt="Logo" 
              style={{ height: '70px', width: 'auto', objectFit: 'contain' }} 
            />
            
            {/* 2. Teks Manual */}
            <h5 className="m-0 fw-bold text-dark" style={{ fontSize: '1.1rem', letterSpacing: '-0.5px' }}>
              SIMRISKOM
            </h5>
          </div>
        )}

        {/* TOMBOL TOGGLE */}
        <button 
          onClick={toggle} 
          className="btn btn-link text-decoration-none p-0 d-flex align-items-center justify-content-center sidebar-toggle-btn"
          title={isOpen ? "Tutup Sidebar" : "Buka Menu"}
        >
           <i className={`bi ${isOpen ? 'bi-chevron-left text-muted' : 'bi-list text-primary fs-3'}`}></i>
        </button>

      </div>

      {/* MENU LIST */}
      <ul className="menu-list list-unstyled flex-grow-1 mt-2">
        {menus.map((menu) => (
          <li key={menu.path}>
            <NavLink 
              to={menu.path} 
              className={({ isActive }) => 
                `text-decoration-none d-flex align-items-center ${isActive ? 'active' : ''}`
              }
              title={!isOpen ? menu.name : ''}
            >
              <div className="menu-icon">
                <i className={`bi ${menu.icon}`}></i>
              </div>
              {isOpen && <span className="menu-text text-nowrap">{menu.name}</span>}
            </NavLink>
          </li>
        ))}
      </ul>

      {/* FOOTER */}
      <div className="p-3 mt-auto text-center border-top">
         <small className="text-muted d-block" style={{fontSize: '0.65rem'}}>
           {isOpen ? '© 2025 SIMRISKOM' : '©'}
         </small>
      </div>

    </div>
  );
};

export default Sidebar;