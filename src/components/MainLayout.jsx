// src/components/MainLayout.jsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

const MainLayout = ({ isSidebarOpen, toggleSidebar, semester, setSemester, session }) => {
  
  // LOGIKA CLASS SIDEBAR:
  // 1. Jika terbuka (isSidebarOpen true): tambahkan 'mobile-open' (untuk HP)
  // 2. Jika tertutup (isSidebarOpen false): tambahkan 'collapsed' (untuk Desktop)
  const sidebarClass = isSidebarOpen ? 'mobile-open' : 'collapsed';

  return (
    <div className="app-container">
      
      {/* OVERLAY (Hanya muncul di HP saat menu terbuka) */}
      {isSidebarOpen && (
        <div 
          className="sidebar-overlay d-lg-none" 
          onClick={toggleSidebar} // Klik gelap untuk tutup
        ></div>
      )}

      {/* SIDEBAR */}
      <div className={`sidebar ${sidebarClass}`}>
         <Sidebar isOpen={isSidebarOpen} toggle={toggleSidebar} />
      </div>

      {/* MAIN CONTENT */}
      <div className={`main-content ${isSidebarOpen ? '' : 'expanded'}`}>
         <div className="px-4 pt-3">
            <Navbar 
              toggleSidebar={toggleSidebar} 
              semester={semester} 
              setSemester={setSemester} 
              session={session} 
            />
         </div>

         <div className="px-4 pb-4">
            <Outlet /> 
         </div>
      </div>
    </div>
  );
};

export default MainLayout;