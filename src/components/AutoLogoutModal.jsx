// src/components/AutoLogoutModal.jsx
import React from 'react';

/**
 * Simple modal (Bootstrap-like) to warn user
 * Props:
 *  - show (bool)
 *  - onStay (func)
 *  - onLogout (func)
 *  - remaining (optional number, ms) -> if you want to show countdown
 */
const AutoLogoutModal = ({ show, onStay, onLogout, remainingMs = null }) => {
  if (!show) return null;

  const remainingSec = remainingMs ? Math.max(0, Math.ceil(remainingMs / 1000)) : null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <div className="modal-dialog modal-sm modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h6 className="modal-title">Sesi Akan Berakhir</h6>
          </div>
          <div className="modal-body">
            <p>Anda tidak aktif beberapa saat. Untuk keamanan, sesi akan berakhir.</p>
            {remainingSec !== null && <p className="mb-0"><strong>{remainingSec}</strong> detik tersisa.</p>}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onStay}>Tetap Masuk</button>
            <button className="btn btn-danger" onClick={onLogout}>Keluar Sekarang</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoLogoutModal;
