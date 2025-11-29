// src/pages/NotFound.jsx
import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center vh-100 bg-light">
      <h1 className="display-1 fw-bold text-primary" style={{ fontSize: '6rem' }}>404</h1>
      <h4 className="mb-3 text-muted">Halaman tidak ditemukan</h4>
      <p className="text-center text-muted mb-4" style={{ maxWidth: '400px' }}>
        Maaf, halaman yang Anda cari tidak tersedia atau URL yang Anda masukkan salah.
      </p>
      <Link to="/dashboard" className="btn btn-primary px-4 py-2 rounded-pill shadow-sm fw-bold">
        <i className="bi bi-arrow-left me-2"></i> Kembali ke Dashboard
      </Link>
    </div>
  );
};

export default NotFound;