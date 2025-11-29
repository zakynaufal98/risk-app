// src/pages/UpdatePassword.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import 'bootstrap-icons/font/bootstrap-icons.css';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  // Opsional: Cek apakah user benar-benar punya sesi (dari link email)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        alert("Link tidak valid atau kadaluarsa. Silakan request reset password ulang.");
        navigate('/auth');
      }
    });
  }, [navigate]);

  const handleUpdate = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      return alert("Password konfirmasi tidak cocok!");
    }

    if (password.length < 6) {
      return alert("Password minimal 6 karakter.");
    }

    setLoading(true);

    // Fungsi Supabase untuk update data user saat ini
    const { error } = await supabase.auth.updateUser({ 
      password: password 
    });

    setLoading(false);

    if (error) {
      return alert('Gagal update password: ' + error.message);
    }

    alert('Password berhasil diperbarui! Mengalihkan ke dashboard...');
    navigate('/dashboard');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        
        <div className="brand-logo-container">
          <i className="bi bi-shield-lock brand-icon"></i>
          <h2 className="brand-text">RiskApp</h2>
        </div>

        <h4 className="login-title">Set New Password</h4>
        <small className="login-subtitle">
          Please enter your new password below.
        </small>

        <form onSubmit={handleUpdate}>
          
          {/* New Password */}
          <div className="input-group">
            <span className="input-group-text bg-transparent">
              <i className="bi bi-key"></i>
            </span>
            <input 
              type="password" 
              className="form-control bg-transparent" 
              placeholder="New Password"
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
            />
          </div>

          {/* Confirm Password */}
          <div className="input-group">
            <span className="input-group-text bg-transparent">
              <i className="bi bi-check-circle"></i>
            </span>
            <input 
              type="password" 
              className="form-control bg-transparent" 
              placeholder="Confirm New Password"
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)} 
              required 
            />
          </div>

          <button type="submit" className="btn btn-primary-custom text-white" disabled={loading}>
            {loading ? 'Updating...' : 'Update Password'}
          </button>
          
          <div className="mt-3">
             <button 
                type="button" 
                className="btn btn-link text-decoration-none text-muted p-0 border-0 small"
                onClick={() => navigate('/auth')}
              >
                Cancel
              </button>
          </div>

        </form>

      </div>
    </div>
  );
}

