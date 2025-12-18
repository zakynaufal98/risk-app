// src/components/RiskMatrixModal.jsx
import React from 'react';
import { calculateRiskScore, getRiskLevel, getBadgeStyle } from '../utils/riskHelpers';

const RiskMatrixModal = ({ show, onClose, currentL, currentI }) => {
  if (!show) return null;

  // Definisi Sumbu
  const rows = [5, 4, 3, 2, 1]; // Kemungkinan
  const cols = [1, 2, 3, 4, 5]; // Dampak

  const getCellColor = (l, i) => {
    const score = calculateRiskScore(l, i);
    const level = getRiskLevel(score);
    const style = getBadgeStyle(level);
    return style.backgroundColor;
  };

  return (
    <div 
      className="modal show d-block" 
      tabIndex="-1" 
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}
      onClick={onClose}
    >
      <div 
        className="modal-dialog modal-dialog-centered" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '550px' }}
      >
        <div className="modal-content shadow-lg border-0" style={{ borderRadius: '16px' }}>
          <div className="modal-header border-0 pb-0">
            <h5 className="modal-title fw-bold">Matriks Analisis Risiko</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          
          <div className="modal-body text-center p-4">
            <p className="text-muted small mb-4">
              Posisi risiko Anda saat ini (Kemungkinan: <strong>{currentL}</strong>, Dampak: <strong>{currentI}</strong>) ditandai dengan garis tebal.
            </p>

            {/* === LAYOUT FLEXBOX AGAR RAPI === */}
            <div className="d-flex align-items-center justify-content-center">
              
              {/* 1. LABEL SUMBU Y (KEMUNGKINAN) */}
              <div 
                className="fw-bold text-secondary me-3"
                style={{ 
                  writingMode: 'vertical-rl', // Teks vertikal
                  transform: 'rotate(180deg)', // Putar agar terbaca dari bawah ke atas
                  letterSpacing: '1px',
                  fontSize: '0.85rem'
                }}
              >
                KEMUNGKINAN
              </div>

              {/* 2. AREA TABEL & LABEL SUMBU X */}
              <div>
                <table className="table table-bordered text-center mb-0" style={{ borderCollapse: 'separate', borderSpacing: '3px', borderColor: 'transparent' }}>
                  <tbody>
                    {rows.map((rowVal) => (
                      <tr key={rowVal}>
                        {/* Angka Sumbu Y */}
                        <td className="align-middle fw-bold text-muted bg-light border-0 rounded" style={{ width: '30px', fontSize:'0.9rem' }}>
                          {rowVal}
                        </td>
                        
                        {cols.map((colVal) => {
                          const score = calculateRiskScore(rowVal, colVal);
                          // Cek Highlight
                          const isActive = parseInt(currentL) === rowVal && parseInt(currentI) === colVal;
                          
                          return (
                            <td 
                              key={colVal}
                              className="align-middle text-white fw-bold shadow-sm"
                              style={{ 
                                width: '55px', 
                                height: '55px',
                                backgroundColor: getCellColor(rowVal, colVal),
                                borderRadius: '8px',
                                cursor: 'default',
                                // HIGHLIGHT STYLE
                                border: isActive ? '4px solid #212529' : '1px solid rgba(0,0,0,0.05)',
                                transform: isActive ? 'scale(1.15)' : 'scale(1)',
                                zIndex: isActive ? 10 : 1,
                                transition: 'all 0.2s',
                                boxShadow: isActive ? '0 6px 12px rgba(0,0,0,0.3)' : 'none',
                                fontSize: '1.1rem'
                              }}
                              title={`K:${rowVal} x D:${colVal} = ${score}`}
                            >
                              {score}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    
                    {/* Baris Angka Sumbu X */}
                    <tr>
                      <td className="border-0"></td>
                      {cols.map((colVal) => (
                        <td key={colVal} className="fw-bold text-muted bg-light border-0 py-2 rounded" style={{fontSize:'0.9rem'}}>
                          {colVal}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>

                {/* LABEL SUMBU X (DAMPAK) */}
                <div className="mt-2 fw-bold small text-secondary" style={{ letterSpacing: '1px' }}>
                  DAMPAK
                </div>
              </div>
            </div>

            {/* Legend / Keterangan Warna */}
            <div className="d-flex justify-content-center gap-2 mt-4 flex-wrap pt-3 border-top">
               <span className="badge rounded-pill px-3 py-2" style={getBadgeStyle('Sangat Rendah')}>1-5</span>
               <span className="badge rounded-pill px-3 py-2" style={getBadgeStyle('Rendah')}>6-10</span>
               <span className="badge rounded-pill px-3 py-2" style={getBadgeStyle('Sedang')}>11-15</span>
               <span className="badge rounded-pill px-3 py-2" style={getBadgeStyle('Tinggi')}>16-20</span>
               <span className="badge rounded-pill px-3 py-2" style={getBadgeStyle('Sangat Tinggi')}>21-25</span>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default RiskMatrixModal;