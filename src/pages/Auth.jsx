// src/pages/Auth.jsx
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import 'bootstrap-icons/font/bootstrap-icons.css';
// IMPORT LOGO
import logoSimriskom from '../assets/Simriskom.png';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [view, setView] = useState('login'); 
  const [message, setMessage] = useState(null);

  const navigate = useNavigate();

  const switchView = (newView) => {
    setView(newView);
    setMessage(null);
    setEmail('');
    setPassword('');
  };

  // --- FUNGSI LOGIN ---
  const handleSignIn = async (e) => {
  e.preventDefault();
  setLoading(true);
  setMessage(null);
  
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  
  setLoading(false);
  
  if (error) {
    let msg = error.message;

    if (msg === 'Invalid login credentials') {
      msg = 'Email atau password salah.';
    } else if (msg.includes('Email not confirmed')) {
      msg = 'Email belum diverifikasi.';
    }

    setMessage({ type: 'danger', text: msg });
    return;
  }

  // ⬇⬇ TAMBAHAN: simpan timestamp login untuk auto-logout maxSessionAge
  localStorage.setItem('login_at', Date.now().toString());

  // lalu arahkan ke dashboard
  navigate('/dashboard', { replace: true });
};

  // --- FUNGSI RESET PASSWORD ---
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/update-password',
    });

    setLoading(false);
    if (error) {
      setMessage({ type: 'danger', text: 'Gagal mengirim email: ' + error.message });
      return;
    }
    
    setMessage({ 
      type: 'success', 
      text: 'Link reset password telah dikirim ke email Anda! Silakan cek inbox/spam.' 
    });
  };

  return (
    <div className="modern-login-container">
      
      {/* === BAGIAN KIRI: FORMULIR === */}
      <div className="login-form-side">
        <div className="login-content-wrapper">
          
          {/* === BRAND HEADER: GAMBAR + TEKS SAMPAING === */}
          {/* UBAH DI SINI: Gunakan d-flex, align-items-center, dan gap-3 untuk posisi menyamping */}
          <div className="brand-header mb-5 d-flex align-items-center gap-3">
            {/* 1. Gambar Logo */}
            <img 
              src={logoSimriskom} 
              alt="SIMRISKOM Logo" 
              // Sedikit disesuaikan tingginya agar seimbang dengan teks di sampingnya
              style={{ height: '120px', width: 'auto' }} 
            />
            
            {/* 2. Teks yang diketik manual */}
            {/* Hapus margin top (mt-3) sebelumnya */}
            <div>
                <h3 className="fw-bold m-0" style={{color: '#1a237e', letterSpacing: '-0.5px', fontSize: '1.4rem'}}>SIMRISKOM</h3>
                <p className="text-muted mb-0 fw-medium" style={{fontSize: '0.8rem', lineHeight: '1.2'}}>
                  Sistem Manajemen Risiko<br/>Komunikasi dan Informatika
                </p>
            </div>
          </div>
          {/* =========================================== */}

          <h2 className="login-heading fs-4 mb-2">
            {view === 'login' ? 'Silakan Masuk' : 'Reset Password'}
          </h2>
          <p className="login-subheading mb-4">
            {view === 'login' 
              ? 'Masukkan email dan password Anda untuk melanjutkan.' 
              : 'Masukkan email untuk menerima link reset password.'}
          </p>

          {message && (
            <div className={`alert alert-${message.type} d-flex align-items-center border-0 shadow-sm mb-4`} role="alert" style={{borderRadius: '12px', fontSize: '0.9rem'}}>
              <i className={`bi ${message.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} me-2 fs-5`}></i>
              <div>{message.text}</div>
            </div>
          )}

          <form onSubmit={view === 'login' ? handleSignIn : handleResetPassword}>
            
            <div className="modern-input-group">
              <i className="bi bi-envelope input-icon"></i>
              <input 
                type="email" 
                className="form-control modern-input" 
                placeholder="Masukkan email Anda"
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
              />
            </div>

            {view === 'login' && (
              <div className="modern-input-group">
                <i className="bi bi-lock input-icon"></i>
                <input 
                  type="password" 
                  className="form-control modern-input" 
                  placeholder="Masukkan password"
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required 
                />
              </div>
            )}

            <div className="d-flex justify-content-between align-items-center mb-4">
              {view === 'login' ? (
                <>
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" id="rememberMe" style={{cursor:'pointer'}} />
                    <label className="form-check-label small text-muted" htmlFor="rememberMe" style={{cursor:'pointer'}}>
                      Ingat saya
                    </label>
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-link text-link p-0 border-0"
                    onClick={() => switchView('forgot')}
                  >
                    Lupa Password?
                  </button>
                </>
              ) : (
                <button 
                  type="button" 
                  className="btn btn-link text-muted text-decoration-none p-0 border-0 small"
                  onClick={() => switchView('login')}
                >
                  <i className="bi bi-arrow-left me-1"></i> Kembali ke Login
                </button>
              )}
            </div>

            <button type="submit" className="btn-modern" disabled={loading}>
              {loading 
                ? (<span><span className="spinner-border spinner-border-sm me-2"></span>Memproses...</span>)
                : (view === 'login' ? 'Masuk Sekarang' : 'Kirim Link Reset')
              }
            </button>

          </form>
        </div>
      </div>

      {/* === BAGIAN KANAN: VISUAL BANNER === */}
      <div className="login-visual-side">
        <div className="visual-circle c1"></div>
        <div className="visual-circle c2"></div>
        
        <div className="text-center position-relative" style={{zIndex: 2, maxWidth: '400px'}}>
          <h2 className="fw-bold mb-2 text-white">SIMRISKOM</h2>
          <p className="text-white-50 fs-5">
            Sistem Manajemen Risiko<br/>Komunikasi dan Informatika
          </p>
        </div>
      </div>

    </div>
  );
}