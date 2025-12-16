// src/components/ModalEdit.jsx
import React from 'react';
import { calculateRiskScore, getRiskLevel, getBadgeStyle } from '../utils/riskHelpers';

const ModalEdit = ({ data, onChange, onSubmit, onClose }) => {
  if (!data) return null;

  // Logika disable jika keputusan = Tidak
  const isDisabled = data.keputusan_penanganan === 'Tidak';
  
  // Helper visual status
  const getStatusLabel = (progress) => {
    const p = Number(progress) || 0;
    if (p === 0) return 'Open';
    if (p > 0 && p < 100) return 'On Going';
    return 'Closed';
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content border-0 shadow">
          
          {/* HEADER: Simpel & Profesional */}
          <div className="modal-header bg-white border-bottom">
            <div>
              <h5 className="modal-title fw-bold text-dark">
                Edit Risiko <span className="text-primary">{data.risk_no}</span>
              </h5>
              <small className="text-muted">Pastikan data diperbarui sesuai kondisi terkini.</small>
            </div>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>

          <div className="modal-body p-4">
            <form id="formEdit" onSubmit={onSubmit}>
              
              {/* --- BAGIAN 1: INFORMASI ASET & ANALISIS --- */}
              <h6 className="text-uppercase text-muted fw-bold small border-bottom pb-2 mb-3">
                1. Informasi Aset & Analisis Risiko
              </h6>
              
              <div className="row g-3 mb-4">
                {/* Baris 1: Aset Utama */}
                <div className="col-12">
                  <label className="form-label small fw-bold">Nama Aset / Sistem</label>
                  <input 
                    type="text" 
                    className="form-control fw-bold" 
                    name="aset" 
                    value={data.aset || ''} 
                    onChange={onChange} 
                  />
                </div>

                {/* Baris 2: Detail Klasifikasi */}
                <div className="col-md-3">
                  <label className="form-label small text-muted">Klasifikasi</label>
                  <select className="form-select form-select-sm" name="klasifikasi_aset" value={data.klasifikasi_aset || ''} onChange={onChange}>
                    <option>Data dan Informasi</option>
                    <option>Perangkat Lunak</option>
                    <option>Perangkat Keras</option>
                    <option>Sarana Pendukung</option>
                    <option>SDM & Pihak Ketiga</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label small text-muted">Kategori SPBE</label>
                  <select className="form-select form-select-sm" name="kategori" value={data.kategori || ''} onChange={onChange}>
                    <option>Penyalahgunaan Kontrol Akses</option>
                    <option>Pencurian Data Pribadi</option>
                    <option>Insiden Web Defacement</option>
                    <option>Keamanan Cloud Service</option>
                    <option>Keamanan Infrastruktur</option>
                    <option>Ketidaksesuaian Pengelolaan Aplikasi</option>
                    <option>Kesalahan Pengelolaan Data & Info</option>
                    <option>Kesalahan Pengelolaan SDM</option>
                    <option>Kesalahan Pengelolaan Aset</option>
                    <option>Kesalahan Pengelolaan Pihak Ketiga</option>
                    <option>Terganggunya Layanan</option>
                    <option>Insiden Malware</option>
                    <option>Lainnya</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label small text-muted">Jenis Risiko</label>
                  <select className="form-select form-select-sm" name="jenis_risiko" value={data.jenis_risiko || ''} onChange={onChange}>
                    <option>Negatif</option>
                    <option>Positif</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label small text-muted">Tanggal Identifikasi</label>
                  <input type="date" className="form-control form-select-sm" name="tanggal_identifikasi" value={data.tanggal_identifikasi || ''} onChange={onChange} />
                </div>

                {/* Baris 3: Text Area Analisis (Sejajar) */}
                <div className="col-md-4">
                  <label className="form-label small fw-bold text-danger">Ancaman</label>
                  <textarea className="form-control bg-light" rows="3" name="ancaman" value={data.ancaman || ''} onChange={onChange}></textarea>
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-bold text-danger">Kerawanan</label>
                  <textarea className="form-control bg-light" rows="3" name="kerawanan" value={data.kerawanan || ''} onChange={onChange}></textarea>
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-bold text-danger">Dampak Identifikasi</label>
                  <textarea className="form-control bg-light" rows="3" name="dampak_identifikasi" value={data.dampak_identifikasi || ''} onChange={onChange}></textarea>
                </div>

                {/* Baris 4: Konteks Tambahan */}
                <div className="col-md-6">
                  <label className="form-label small text-muted">Area Dampak Utama</label>
                  <select className="form-select form-select-sm" name="area_dampak" value={data.area_dampak || ''} onChange={onChange}>
                    <option>Layanan Organisasi</option>
                    <option>Finansial</option>
                    <option>Reputasi</option>
                    <option>Kinerja</option>
                    <option>Operasional dan Aset TIK</option>
                    <option>Hukum dan Regulasi</option>
                    <option>SDM</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label small text-muted">Kontrol Saat Ini</label>
                  <input type="text" className="form-control form-control-sm" name="kontrol_saat_ini" value={data.kontrol_saat_ini || ''} onChange={onChange} />
                </div>
              </div>

              {/* --- BAGIAN 2: PERHITUNGAN SKOR (Side by Side) --- */}
              <h6 className="text-uppercase text-muted fw-bold small border-bottom pb-2 mb-3">
                2. Evaluasi Skor Risiko
              </h6>
              
              <div className="row g-0 border rounded overflow-hidden mb-4">
                {/* KIRI: Inherent Risk */}
                <div className="col-lg-6 p-3 border-end" style={{backgroundColor: '#fffbf0'}}>
                  <h6 className="fw-bold text-warning mb-3">INHERENT RISK (Awal)</h6>
                  <div className="row g-2 align-items-center">
                    <div className="col-4">
                      <label className="small text-muted d-block">Kemungkinan</label>
                      <input type="number" min="1" max="5" className="form-control form-control-sm border-warning" name="inherent_kemungkinan" value={data.inherent_kemungkinan ?? 1} onChange={onChange} />
                    </div>
                    <div className="col-4">
                      <label className="small text-muted d-block">Dampak</label>
                      <input type="number" min="1" max="5" className="form-control form-control-sm border-warning" name="inherent_dampak" value={data.inherent_dampak ?? 1} onChange={onChange} />
                    </div>
                    <div className="col-4 text-center">
                      <label className="small text-muted d-block">Skor</label>
                      <span className="badge bg-warning text-dark fs-6 w-100">{data.inherent_ir}</span>
                    </div>
                    <div className="col-12 mt-2">
                       <div className="small fw-bold text-muted">Level: <span style={{color: '#b45309'}}>{data.level_risiko}</span></div>
                    </div>
                  </div>
                </div>

                {/* KANAN: Residual Risk */}
                <div className="col-lg-6 p-3" style={{backgroundColor: '#f0fdf4'}}>
                   <div className="d-flex justify-content-between align-items-center mb-3">
                      <h6 className="fw-bold text-success m-0">RESIDUAL RISK (Sisa)</h6>
                      <select 
                        className="form-select form-select-sm py-0 w-auto border-success text-success fw-bold" 
                        style={{fontSize: '0.8rem'}}
                        name="terdapat_residual" 
                        value={data.terdapat_residual} 
                        onChange={onChange}
                      >
                        <option value="true">Ada Sisa</option>
                        <option value="false">Hilang</option>
                      </select>
                   </div>
                   
                   <div className="row g-2 align-items-center">
                    <div className="col-4">
                      <label className="small text-muted d-block">Kemungkinan</label>
                      <input 
                        type="number" min="1" max="5" 
                        className="form-control form-control-sm border-success" 
                        name="residual_kemungkinan" 
                        value={data.residual_kemungkinan ?? 1} 
                        onChange={onChange} 
                        disabled={String(data.terdapat_residual) === 'false'} 
                      />
                    </div>
                    <div className="col-4">
                      <label className="small text-muted d-block">Dampak</label>
                      <input 
                        type="number" min="1" max="5" 
                        className="form-control form-control-sm border-success" 
                        name="residual_dampak" 
                        value={data.residual_dampak ?? 1} 
                        onChange={onChange} 
                        disabled={String(data.terdapat_residual) === 'false'} 
                      />
                    </div>
                    <div className="col-4 text-center">
                      <label className="small text-muted d-block">Skor Sisa</label>
                      <span className={`badge fs-6 w-100 ${String(data.terdapat_residual) === 'false' ? 'bg-secondary' : 'bg-success'}`}>
                        {String(data.terdapat_residual) === 'false' ? 0 : data.rr}
                      </span>
                    </div>
                    <div className="col-12 mt-2">
                       <div className="small fw-bold text-muted">Level: <span className="text-success">{String(data.terdapat_residual) === 'false' ? 'Nihil' : getRiskLevel(data.rr)}</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* --- BAGIAN 3: RENCANA PENANGANAN & PROGRESS --- */}
              <h6 className="text-uppercase text-muted fw-bold small border-bottom pb-2 mb-3">
                3. Rencana Penanganan & Progress
              </h6>

              {/* Logika Keputusan */}
              <div className="row g-3 mb-3 bg-light p-3 rounded mx-1 border">
                <div className="col-md-4">
                   <label className="form-label small fw-bold">Keputusan Penanganan?</label>
                   <select className="form-select form-select-sm fw-bold text-dark" name="keputusan_penanganan" value={data.keputusan_penanganan || 'Ya'} onChange={onChange}>
                      <option value="Ya">Ya, Perlu Penanganan</option>
                      <option value="Tidak">Tidak, Risiko Diterima</option>
                   </select>
                </div>
                <div className="col-md-4">
                   <label className="form-label small fw-bold">Opsi Penanganan</label>
                   <select className="form-select form-select-sm" name="opsi_penanganan" value={data.opsi_penanganan || ''} onChange={onChange} disabled={isDisabled}>
                      <option>Mitigasi</option>
                      <option>Transfer</option>
                      <option>Hindari</option>
                      <option>Terima</option>
                   </select>
                </div>
                <div className="col-md-4">
                   <label className="form-label small fw-bold">Prioritas</label>
                   <select className="form-select form-select-sm" name="prioritas_risiko" value={data.prioritas_risiko || '1'} onChange={onChange}>
                      <option value="1">1 (Sangat Tinggi)</option>
                      <option value="2">2 (Tinggi)</option>
                      <option value="3">3 (Sedang)</option>
                      <option value="4">4 (Rendah)</option>
                      <option value="5">5 (Sangat Rendah)</option>
                   </select>
                </div>
              </div>

              {/* Detail Rencana */}
              <div className="row g-3 mb-4">
                 <div className="col-md-8">
                    <label className="form-label small text-muted">Rencana Aksi Konkret</label>
                    <input type="text" className="form-control" name="rencana_aksi" value={data.rencana_aksi || ''} onChange={onChange} disabled={isDisabled} placeholder="Apa yang akan dilakukan?" />
                 </div>
                 <div className="col-md-4">
                    <label className="form-label small text-muted">Output / Hasil</label>
                    <input type="text" className="form-control" name="keluaran" value={data.keluaran || ''} onChange={onChange} disabled={isDisabled} />
                 </div>
                 <div className="col-md-4">
                    <label className="form-label small text-muted">Target Jadwal</label>
                    <input type="date" className="form-control" name="target_jadwal" value={data.target_jadwal || ''} onChange={onChange} disabled={isDisabled} />
                 </div>
                 <div className="col-md-4">
                    <label className="form-label small text-muted">PIC (Person in Charge)</label>
                    <input type="text" className="form-control" name="penanggung_jawab" value={data.penanggung_jawab || ''} onChange={onChange} disabled={isDisabled} />
                 </div>
                 <div className="col-md-4">
                    <label className="form-label small text-muted">Risk Owner</label>
                    <input type="text" className="form-control" name="risk_owner" value={data.risk_owner || ''} onChange={onChange} disabled={isDisabled} />
                 </div>
                 <div className="col-12">
                    <label className="form-label small text-muted">Kontrol Tambahan (Opsional)</label>
                    <input type="text" className="form-control form-control-sm text-muted" name="rencana_kontrol_tambahan" value={data.rencana_kontrol_tambahan || ''} onChange={onChange} disabled={isDisabled} placeholder="Jika ada kontrol pendukung lainnya..." />
                 </div>
              </div>

              {/* Progress Slider */}
              <div className="bg-white border rounded p-3">
                 <label className="form-label small fw-bold d-flex justify-content-between mb-2">
                    <span>Realisasi Progress</span>
                    <span className={`badge ${data.status === 'Closed' ? 'bg-success' : 'bg-primary'}`}>
                      {data.progress || 0}% ({getStatusLabel(data.progress)})
                    </span>
                 </label>
                 <input type="range" className="form-range" min="0" max="100" step="5" name="progress" value={data.progress || 0} onChange={onChange} />
                 <div className="d-flex justify-content-between small text-muted" style={{fontSize: '0.75rem'}}>
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                 </div>
              </div>

            </form>
          </div>

          <div className="modal-footer bg-light border-top">
            <button type="button" className="btn btn-white border" onClick={onClose}>Batal</button>
            <button type="submit" form="formEdit" className="btn btn-primary fw-bold px-4 shadow-sm">
              <i className="bi bi-save me-2"></i>Simpan Perubahan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalEdit;