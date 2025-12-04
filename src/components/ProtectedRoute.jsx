// src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ session, children }) => {
  const location = useLocation();

  // Kalau belum login → lempar ke /auth
  if (!session) {
    return (
      <Navigate
        to="/auth"
        replace
        state={{ from: location }}
      />
    );
  }

  // Kalau sudah login → render isi (MainLayout + halaman2 di dalamnya)
  return children;
};

export default ProtectedRoute;
