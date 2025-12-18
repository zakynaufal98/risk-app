// src/pages/InputData.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { calculateRiskScore, getRiskLevel, getBadgeStyle } from '../utils/riskHelpers';

// --- IMPORT MODAL MATRIKS ---
import RiskMatrixModal from '../components/RiskMatrixModal';

/* === KOMPONEN BANTU: TABEL KEMUNGKINAN & DAMPAK === */
const LikelihoodImpactTable = () => (
  <div className="table-responsive small">
    <p className="text-center text-muted mb-3">
      Gunakan tabel ini sebagai acuan untuk memilih angka{' '}
      <strong>kemungkinan (1–5)</strong> dan <strong>dampak (1–5)</strong> pada perhitungan risiko.
    </p>

    <h6 className="fw-bold text-center mb-2">Tabel Kemungkinan (Likelihood)</h6>
    <table className="table table-sm table-bordered table-striped align-middle">
      <thead>
        <tr style={{ backgroundColor: '#0d6efd', color: '#fff' }}>
          <th className="text-center align-middle" style={{ width: '8%' }}>Level</th>
          <th className="text-center align-middle" style={{ width: '25%' }}>Kategori</th>
          <th className="text-center align-middle" style={{ width: '20%' }}>Probabilitas</th>
          <th className="text-center align-middle">Frekuensi Terjadi</th>
        </tr>
      </thead>
      <tbody>
        <tr><td className="fw-bold text-center">1</td><td>Hampir Tidak Terjadi</td><td className="text-center">x ≤ 5%</td><td>&lt; 2 kali dalam 1 tahun</td></tr>
        <tr><td className="fw-bold text-center">2</td><td>Jarang Terjadi</td><td className="text-center">5% &lt; x ≤ 10%</td><td>2–5 kali dalam 1 tahun</td></tr>
        <tr><td className="fw-bold text-center">3</td><td>Kadang-kadang Terjadi</td><td className="text-center">10% &lt; x ≤ 20%</td><td>6–9 kali dalam 1 tahun</td></tr>
        <tr><td className="fw-bold text-center">4</td><td>Sering Terjadi</td><td className="text-center">20% &lt; x ≤ 50%</td><td>10–12 kali dalam 1 tahun</td></tr>
        <tr><td className="fw-bold text-center">5</td><td>Hampir Pasti Terjadi</td><td className="text-center">x &gt; 50%</td><td>&gt; 12 kali dalam 1 tahun</td></tr>
      </tbody>
    </table>

    <h6 className="fw-bold text-center mt-4 mb-2">Tabel Dampak (Impact)</h6>
    <table className="table table-sm table-bordered table-striped align-middle">
      <thead>
        <tr style={{ backgroundColor: '#f59e0b', color: '#111827' }}>
          <th className="text-center" style={{ width: '8%' }}>Level</th>
          <th className="text-center" style={{ width: '18%' }}>Kategori</th>
          <th className="text-center" style={{ width: '18%' }}>Finansial</th>
          <th className="text-center" style={{ width: '18%' }}>Layanan</th>
          <th className="text-center" style={{ width: '18%' }}>Operasional TIK</th>
          <th className="text-center">Hukum &amp; Regulasi</th>
        </tr>
      </thead>
      <tbody>
        <tr><td className="fw-bold text-center">1</td><td>Tidak Signifikan</td><td>≤ Rp 10 juta</td><td>≤ 1 hari</td><td>Gangguan kecil</td><td>Tidak ada pelanggaran</td></tr>
        <tr><td className="fw-bold text-center">2</td><td>Kurang Signifikan</td><td>Rp 10 – 50 juta</td><td>&gt; 1 s.d. 5 hari</td><td>Gangguan sporadis</td><td>Pelanggaran ringan (teguran)</td></tr>
        <tr><td className="fw-bold text-center">3</td><td>Cukup Signifikan</td><td>Rp 50 – 100 juta</td><td>&gt; 5 s.d. 15 hari</td><td>Terhenti sementara</td><td>Surat peringatan</td></tr>
        <tr><td className="fw-bold text-center">4</td><td>Signifikan</td><td>Rp 100 – 500 juta</td><td>&gt; 15 s.d. 30 hari</td><td>Terhenti lama</td><td>Sanksi administratif</td></tr>
        <tr><td className="fw-bold text-center">5</td><td>Sangat Signifikan</td><td>&gt; Rp 500 juta</td><td>&gt; 30 hari</td><td>Tidak berfungsi</td><td>Sanksi hukum berat</td></tr>
      </tbody>
    </table>
  </div>
);

/* === KOMPONEN BANTU: MODAL BANTUAN RISIKO === */
const RiskHelpModal = ({ title, visible, onClose }) => {
  if (!visible) return null;
  return (
    <div className="d-flex align-items-center justify-content-center" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1050 }}>
      <div className="card shadow-lg border-0" style={{ maxWidth: '900px', width: '95%', borderRadius: '18px' }}>
        <div className="card-header d-flex justify-content-between align-items-center" style={{ borderRadius: '18px 18px 0 0', background: 'linear-gradient(90deg,#0d6efd,#22c55e)', color: '#fff' }}>
          <h5 className="m-0 fw-bold"><i className="bi bi-question-circle-fill me-2"></i>{title}</h5>
          <button type="button" className="btn btn-sm btn-light" onClick={onClose}>Tutup</button>
        </div>
        <div className="card-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <LikelihoodImpactTable />
        </div>
      </div>
    </div>
  );
};

/* === KOMPONEN BANTU: MODAL SUKSES === */
const SuccessModal = ({ visible, message, onClose, onAddAnother, onViewDatabase }) => {
  if (!visible) return null;
  return (
    <div className="d-flex align-items-center justify-content-center" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1100 }}>
      <div className="card shadow-lg border-0" style={{ width: 420, borderRadius: 12 }}>
        <div className="card-body text-center p-4">
          <div className="mb-3"><i className="bi bi-check-circle-fill fs-1 text-success"></i></div>
          <h5 className="fw-bold">Berhasil disimpan</h5>
          <p className="text-muted small mb-4">{message || 'Data risiko berhasil disimpan.'}</p>
          <div className="d-flex gap-2 justify-content-center">
            <button className="btn btn-outline-secondary" onClick={onAddAnother}>Input Lagi</button>
            <button className="btn btn-primary" onClick={onViewDatabase}>Lihat Database</button>
          </div>
          <div className="mt-3"><button className="btn btn-link small" onClick={onClose}>Tutup</button></div>
        </div>
      </div>
    </div>
  );
};

/* ===================== KOMPONEN UTAMA ===================== */
const InputData = ({ semester }) => {
  const [loading, setLoading] = useState(false);
  
  // --- STATE MODAL MATRIKS ---
  const [showMatrix, setShowMatrix] = useState(false);
  const [matrixValues, setMatrixValues] = useState({ l: 1, i: 1 });

  const openMatrix = (kemungkinan, dampak) => {
    setMatrixValues({ l: parseInt(kemungkinan) || 1, i: parseInt(dampak) || 1 });
    setShowMatrix(true);
  };

  const normalizeText = (text) => (text ? text.trim().toLowerCase().replace(/\s+/g, ' ') : '');
  const [notification, setNotification] = useState(null);
  const [errors, setErrors] = useState({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showInherentHelp, setShowInherentHelp] = useState(false);
  const [showResidualHelp, setShowResidualHelp] = useState(false);

  const getStatusFromProgress = (p) => {
    const n = Number(p) || 0;
    if (n === 0) return 'Open';
    if (n > 0 && n < 100) return 'On Going';
    return 'Closed';
  };

  // Initial State
  const getInitialForm = (sem) => ({
    jenis_risiko: 'Negatif',
    semester: sem,
    aset: '',
    klasifikasi_aset: 'Data dan Informasi',
    ancaman: '',
    kerawanan: '',
    kategori: 'Penyalahgunaan Kontrol Akses',
    dampak_identifikasi: '',
    area_dampak: 'Layanan Organisasi',
    kontrol_saat_ini: '',
    inherent_dampak: 1,
    inherent_kemungkinan: 1,
    inherent_ir: 1,
    level_risiko: 'Sangat Rendah',
    keputusan_penanganan: 'Ya',
    prioritas_risiko: '1',
    opsi_penanganan: 'Mitigasi',
    rencana_aksi: '',
    keluaran: '',
    target_jadwal: '',
    penanggung_jawab: '',
    terdapat_residual: 'true',
    residual_dampak: 1,
    residual_kemungkinan: 1,
    rr: 1,
    status: 'Open',
    rencana_kontrol_tambahan: '',
    risk_owner: '',
    tanggal_identifikasi: new Date().toISOString().slice(0, 10),
    progress: 0
  });

  const [formData, setFormData] = useState(() => getInitialForm(semester));

  /* === EFFECTS === */
  useEffect(() => { setFormData((prev) => ({ ...prev, semester })); }, [semester]);

  useEffect(() => {
    if (formData.keputusan_penanganan === 'Tidak') {
      setFormData((prev) => ({ ...prev, opsi_penanganan: 'Terima', rencana_aksi: '-', keluaran: '-', target_jadwal: '', penanggung_jawab: '-', rencana_kontrol_tambahan: '-' }));
    } else {
      if (formData.opsi_penanganan === 'Terima') {
        setFormData((prev) => ({ ...prev, opsi_penanganan: 'Mitigasi', rencana_aksi: '' }));
      }
    }
  }, [formData.keputusan_penanganan, formData.opsi_penanganan]);

  // Kalkulasi Inherent
  useEffect(() => {
    const L = parseInt(formData.inherent_kemungkinan) || 1;
    const I = parseInt(formData.inherent_dampak) || 1;
    const score = calculateRiskScore(L, I);
    const level = getRiskLevel(score);
    setFormData((prev) => ({ ...prev, inherent_ir: score, level_risiko: level }));
  }, [formData.inherent_kemungkinan, formData.inherent_dampak]);

  // Kalkulasi Residual
  useEffect(() => {
    if (String(formData.terdapat_residual) === 'false') {
      setFormData((prev) => ({ ...prev, rr: 0, residual_dampak: 1, residual_kemungkinan: 1 }));
      return;
    }
    const L = parseInt(formData.residual_kemungkinan) || 1;
    const I = parseInt(formData.residual_dampak) || 1;
    const score = calculateRiskScore(L, I);
    setFormData((prev) => ({ ...prev, rr: score }));
  }, [formData.residual_kemungkinan, formData.residual_dampak, formData.terdapat_residual]);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, status: getStatusFromProgress(prev.progress || 0) }));
  }, [formData.progress]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      const copy = { ...prev };
      if (copy[name]) delete copy[name];
      return copy;
    });
  };

  const renderError = (field) => errors[field] ? <div className="form-text text-danger">{errors[field]}</div> : null;

  /* === VALIDATION === */
  const validate = () => {
    const requiredFields = ['aset', 'ancaman', 'kerawanan', 'dampak_identifikasi', 'area_dampak', 'kontrol_saat_ini', 'inherent_kemungkinan', 'inherent_dampak', 'keputusan_penanganan', 'prioritas_risiko'];
    const newErrors = {};
    requiredFields.forEach((f) => { if (!formData[f]) newErrors[f] = 'Wajib diisi.'; });
    if (String(formData.terdapat_residual) === 'true') {
      if (!formData.residual_kemungkinan) newErrors['residual_kemungkinan'] = 'Wajib diisi.';
      if (!formData.residual_dampak) newErrors['residual_dampak'] = 'Wajib diisi.';
    }
    if (formData.keputusan_penanganan === 'Ya') {
      ['rencana_aksi', 'keluaran', 'penanggung_jawab', 'risk_owner'].forEach((f) => { if (!formData[f]) newErrors[f] = 'Wajib diisi.'; });
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      try { document.querySelector(`[name="${Object.keys(newErrors)[0]}"]`)?.focus(); } catch (e) {}
    }
    return Object.keys(newErrors).length === 0;
  };

  /* === SUBMIT === */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setNotification(null);

    try {
      if (!validate()) { setLoading(false); setNotification({ type: 'danger', message: 'Lengkapi field wajib.' }); return; }

      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) throw new Error('User tidak terdeteksi.');

      const normAset = normalizeText(formData.aset);
      
      // 1. Cek / Insert Master
      let { data: masterData, error: masterErr } = await supabase.from('risk_master').select('risk_no').eq('aset_norm', normAset).maybeSingle();
      if (masterErr) throw masterErr;

      let riskNo = masterData?.risk_no;
      if (!riskNo) {
        const { data: inserted, error: insertErr } = await supabase.from('risk_master').insert([{
          aset: formData.aset, klasifikasi_aset: formData.klasifikasi_aset, kategori: formData.kategori, jenis_risiko: formData.jenis_risiko, user_id: user.id
        }]).select('risk_no').single();
        
        if (insertErr) throw insertErr;
        riskNo = inserted.risk_no;
      }

      // 2. Cek Duplikat Semester
      const { data: dupCheck } = await supabase.from('risk_history').select('id').eq('risk_no', riskNo).eq('semester', formData.semester).maybeSingle();
      if (dupCheck) {
        setNotification({ type: 'warning', message: `Aset "${formData.aset}" sudah ada di ${formData.semester}.` });
        setLoading(false); return;
      }

      // 3. Insert History
      const payload = {
        risk_no: riskNo,
        semester: formData.semester,
        tanggal_identifikasi: formData.tanggal_identifikasi,
        ancaman: formData.ancaman,
        kerawanan: formData.kerawanan,
        dampak_identifikasi: formData.dampak_identifikasi,
        area_dampak: formData.area_dampak,
        kontrol_saat_ini: formData.kontrol_saat_ini,
        inherent_kemungkinan: parseInt(formData.inherent_kemungkinan),
        inherent_dampak: parseInt(formData.inherent_dampak),
        inherent_ir: parseFloat(formData.inherent_ir),
        level_risiko: formData.level_risiko,
        
        // --- FIX PENTING: KIRIM BOOLEAN ---
        terdapat_residual: String(formData.terdapat_residual) === 'true',
        
        residual_kemungkinan: String(formData.terdapat_residual) === 'false' ? 0 : parseInt(formData.residual_kemungkinan),
        residual_dampak: String(formData.terdapat_residual) === 'false' ? 0 : parseInt(formData.residual_dampak),
        rr: String(formData.terdapat_residual) === 'false' ? 0 : parseFloat(formData.rr),
        
        keputusan_penanganan: formData.keputusan_penanganan,
        prioritas_risiko: formData.prioritas_risiko,
        opsi_penanganan: formData.opsi_penanganan,
        rencana_aksi: formData.rencana_aksi,
        keluaran: formData.keluaran,
        target_jadwal: formData.target_jadwal || null,
        penanggung_jawab: formData.penanggung_jawab,
        progress: parseInt(formData.progress),
        status: formData.status,
        rencana_kontrol_tambahan: formData.rencana_kontrol_tambahan,
        risk_owner: formData.risk_owner,
        user_id: user.id
      };

      const { error: histErr } = await supabase.from('risk_history').insert([payload]);
      if (histErr) throw histErr;

      setShowSuccessModal(true);
      setFormData(getInitialForm(formData.semester));
      setErrors({});
    } catch (err) {
      console.error(err);
      setNotification({ type: 'danger', message: 'Gagal menyimpan: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = formData.keputusan_penanganan === 'Tidak';
  const inputClass = 'form-control';
  const cardStyle = { borderRadius: '16px', overflow: 'visible' };

  const handleAddAnother = () => {
    setShowSuccessModal(false);
    try { const el = document.querySelector('[name="aset"]'); if (el) el.focus(); } catch (e) {}
  };

  const handleViewDatabase = () => { try { window.location.href = '/database'; } catch (e) {} };

  return (
    <div className="container-fluid p-0">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold text-dark m-0">Input Risiko Baru</h3>
          <p className="text-muted m-0">Semester: <span className="text-primary fw-bold">{semester}</span></p>
        </div>
        <a href="/database" className="btn btn-white text-danger fw-bold border shadow-sm px-4 py-2" style={{ borderRadius: '10px' }}><i className="bi bi-x-lg me-2"></i> Batal</a>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="row g-4 align-items-start">
          
          {/* KOLOM KIRI (FORM) */}
          <div className="col-lg-8">
            {/* 1. IDENTITAS & ASET */}
            <div className="card border-0 shadow-sm mb-4" style={cardStyle}>
              <div className="card-header bg-white border-bottom-0 pt-4 px-4 pb-0" style={{ borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
                <div className="d-flex align-items-center gap-2 text-primary"><i className="bi bi-info-circle-fill fs-5"></i><h5 className="fw-bold m-0">1. Identitas & Aset</h5></div>
                <hr className="my-2 opacity-10" />
              </div>
              <div className="card-body p-4">
                <div className="row g-3">
                  <div className="col-12">
                    <div className="d-flex align-items-center p-3 rounded-3 mb-2" style={{ backgroundColor: '#eef2ff', border: '1px dashed #6366f1' }}>
                      <i className="bi bi-calendar-check text-primary fs-3 me-3"></i>
                      <div><small className="text-muted fw-bold text-uppercase d-block" style={{ fontSize: '0.7rem' }}>Target Semester</small><span className="fw-bold text-dark fs-5">{formData.semester}</span></div>
                      <div className="ms-auto badge bg-primary">Otomatis</div>
                    </div>
                  </div>
                  <div className="col-md-4"><label className="form-label small text-muted fw-bold">Risk No</label><input type="text" className="form-control bg-light" value="Auto Generated" disabled /></div>
                  <div className="col-md-4">
                    <label className="form-label small text-muted fw-bold">Klasifikasi Aset</label>
                    <select name="klasifikasi_aset" className={`form-select ${errors.klasifikasi_aset ? 'is-invalid' : ''}`} onChange={handleChange} value={formData.klasifikasi_aset}><option>Data dan Informasi</option><option>Perangkat Lunak</option><option>Perangkat Keras</option><option>Sarana Pendukung</option><option>SDM & Pihak Ketiga</option></select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small text-muted fw-bold">Jenis Risiko</label>
                    <select name="jenis_risiko" className={`form-select ${errors.jenis_risiko ? 'is-invalid' : ''}`} onChange={handleChange} value={formData.jenis_risiko}><option value="Negatif">Negatif</option><option value="Positif">Positif</option></select>
                  </div>
                  <div className="col-12"><label className="form-label small text-muted fw-bold">Nama Aset / Sistem</label><input type="text" name="aset" className={`${inputClass} ${errors.aset ? 'is-invalid' : ''}`} placeholder="Contoh: Server Database Kepegawaian" value={formData.aset} onChange={handleChange} />{renderError('aset')}</div>
                  <div className="col-12">
                    <label className="form-label small text-muted fw-bold">Kategori</label>
                    <select name="kategori" className={`form-select ${errors.kategori ? 'is-invalid' : ''}`} onChange={handleChange} value={formData.kategori}><option>Penyalahgunaan Kontrol Akses</option><option>Pencurian Data Pribadi</option><option>Insiden Web Defacement</option><option>Keamanan Cloud Service</option><option>Keamanan Infrastruktur</option><option>Ketidaksesuaian Pengelolaan Aplikasi</option><option>Kesalahan Pengelolaan Data dan Informasi Terbatas</option><option>Kesalahan Pengelolaan SDM</option><option>Kesalahan Pengelolaan Aset</option><option>Kesalahan Pengelolaan Pihak Ketiga</option><option>Terganggunya Keberlangsungan Layanan</option><option>Insiden Serangan Malware</option><option>Lainnya</option></select>
                  </div>
                  <div className="col-md-4"><label className="form-label small text-muted fw-bold">Tanggal Identifikasi</label><input type="date" name="tanggal_identifikasi" className={inputClass} value={formData.tanggal_identifikasi} onChange={handleChange} /></div>
                </div>
              </div>
            </div>

            {/* 2. ANALISA RISIKO */}
            <div className="card border-0 shadow-sm mb-4" style={cardStyle}>
              <div className="card-header bg-white border-bottom-0 pt-4 px-4 pb-0"><div className="d-flex align-items-center gap-2 text-danger"><i className="bi bi-search fs-5"></i><h5 className="fw-bold m-0">2. Analisa Risiko</h5></div><hr className="my-2 opacity-10" /></div>
              <div className="card-body p-4">
                <div className="row g-3">
                  <div className="col-md-6"><label className="form-label small text-muted fw-bold">Ancaman</label><textarea name="ancaman" className={`${inputClass} ${errors.ancaman?'is-invalid':''}`} rows="2" onChange={handleChange} value={formData.ancaman}></textarea>{renderError('ancaman')}</div>
                  <div className="col-md-6"><label className="form-label small text-muted fw-bold">Kerawanan</label><textarea name="kerawanan" className={`${inputClass} ${errors.kerawanan?'is-invalid':''}`} rows="2" onChange={handleChange} value={formData.kerawanan}></textarea>{renderError('kerawanan')}</div>
                  <div className="col-md-12"><label className="form-label small text-muted fw-bold">Dampak</label><textarea name="dampak_identifikasi" className={`${inputClass} ${errors.dampak_identifikasi?'is-invalid':''}`} rows="2" onChange={handleChange} value={formData.dampak_identifikasi}></textarea>{renderError('dampak_identifikasi')}</div>
                  <div className="col-md-6"><label className="form-label small text-muted fw-bold">Area Dampak</label><select name="area_dampak" className="form-select" onChange={handleChange} value={formData.area_dampak}><option>Layanan Organisasi</option><option>Finansial</option><option>Reputasi</option><option>Kinerja</option><option>Operasional dan Aset TIK</option><option>Hukum dan Regulasi</option><option>SDM</option></select></div>
                  <div className="col-md-6"><label className="form-label small text-muted fw-bold">Kontrol Saat Ini</label><input type="text" name="kontrol_saat_ini" className={`${inputClass} ${errors.kontrol_saat_ini?'is-invalid':''}`} onChange={handleChange} value={formData.kontrol_saat_ini} />{renderError('kontrol_saat_ini')}</div>
                </div>
              </div>
            </div>

            {/* 3. EVALUASI RISIKO */}
            <div className="card border-0 shadow-sm mb-4" style={{...cardStyle, borderLeft:'5px solid #0d6efd'}}>
              <div className="card-header bg-white border-bottom-0 pt-4 px-4 pb-0"><div className="d-flex align-items-center gap-2 text-primary"><i className="bi bi-sliders fs-5"></i><h5 className="fw-bold m-0">3. Evaluasi Risiko</h5></div><hr className="my-2 opacity-10" /></div>
              <div className="card-body p-4">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small text-muted fw-bold">Keputusan Penanganan</label>
                    <select name="keputusan_penanganan" className="form-select fw-bold" value={formData.keputusan_penanganan} onChange={handleChange}><option value="Ya">Ya (Perlu Penanganan)</option><option value="Tidak">Tidak (Terima Risiko)</option></select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small text-muted fw-bold">Prioritas Risiko</label>
                    <select name="prioritas_risiko" className="form-select" value={formData.prioritas_risiko} onChange={handleChange}><option value="1">1 (Sangat Tinggi)</option><option value="2">2 (Tinggi)</option><option value="3">3 (Sedang)</option><option value="4">4 (Rendah)</option><option value="5">5 (Sangat Rendah)</option></select>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. RENCANA PENANGANAN */}
            <div className={`card border-0 shadow-sm mb-4 ${isDisabled?'bg-light opacity-75':''}`} style={{...cardStyle, borderLeft:'5px solid #198754'}}>
              <div className="card-header bg-white border-bottom-0 pt-4 px-4 pb-0"><div className="d-flex align-items-center gap-2 text-success"><i className="bi bi-shield-check fs-5"></i><h5 className="fw-bold m-0">4. Rencana Penanganan</h5>{isDisabled && <span className="badge bg-secondary ms-2">Tidak Diperlukan</span>}</div><hr className="my-2 opacity-10" /></div>
              <div className="card-body p-4">
                <div className="row g-3">
                  <div className="col-md-4"><label className="form-label small text-muted fw-bold">Opsi</label><select name="opsi_penanganan" className="form-select" onChange={handleChange} value={formData.opsi_penanganan} disabled={isDisabled}><option>Mitigasi</option><option>Transfer</option><option>Hindari</option><option>Terima</option></select></div>
                  <div className="col-md-8"><label className="form-label small text-muted fw-bold">Rencana Aksi</label><input type="text" name="rencana_aksi" className={`${inputClass} ${errors.rencana_aksi?'is-invalid':''}`} onChange={handleChange} value={formData.rencana_aksi} disabled={isDisabled} placeholder={isDisabled?'-':'Langkah konkret...'} />{renderError('rencana_aksi')}</div>
                  <div className="col-md-6"><label className="form-label small text-muted fw-bold">Keluaran</label><input type="text" name="keluaran" className={`${inputClass} ${errors.keluaran?'is-invalid':''}`} onChange={handleChange} value={formData.keluaran} disabled={isDisabled} />{renderError('keluaran')}</div>
                  <div className="col-md-6"><label className="form-label small text-muted fw-bold">Target</label><input type="date" name="target_jadwal" className={inputClass} onChange={handleChange} value={formData.target_jadwal} disabled={isDisabled} /></div>
                  <div className="col-md-6"><label className="form-label small text-muted fw-bold">Penanggung Jawab</label><input type="text" name="penanggung_jawab" className={`${inputClass} ${errors.penanggung_jawab?'is-invalid':''}`} onChange={handleChange} value={formData.penanggung_jawab} disabled={isDisabled} />{renderError('penanggung_jawab')}</div>
                  <div className="col-md-6"><label className="form-label small text-muted fw-bold">Risk Owner</label><input type="text" name="risk_owner" className={`${inputClass} ${errors.risk_owner?'is-invalid':''}`} onChange={handleChange} value={formData.risk_owner} disabled={isDisabled} />{renderError('risk_owner')}</div>
                  <div className="col-12"><label className="form-label small text-muted fw-bold">Kontrol Tambahan</label><input type="text" name="rencana_kontrol_tambahan" className={inputClass} onChange={handleChange} value={formData.rencana_kontrol_tambahan} disabled={isDisabled} /></div>
                </div>
              </div>
            </div>
          </div>

          {/* KOLOM KANAN (SKORING & PROGRESS) */}
          <div className="col-lg-4">
            <div style={{ position: 'sticky', top: '20px' }}>
              
              {/* --- INHERENT RISK --- */}
              <div className="card border-0 shadow-sm mb-3" style={{ ...cardStyle, background: '#fffbeb' }}>
                <div className="card-body p-4 text-center">
                  <div className="d-flex justify-content-center align-items-center gap-2 mb-1">
                    <h6 className="fw-bold text-warning m-0">INHERENT RISK (Awal)</h6>
                    <button type="button" className="btn btn-link p-0 m-0 text-muted" onClick={() => setShowInherentHelp(true)}><i className="bi bi-question-circle-fill"></i></button>
                  </div>
                  <small className="text-muted d-block mb-3">Sebelum Penanganan</small>

                  <div className="row g-2 text-start">
                    <div className="col-6">
                      <label className="small fw-bold text-muted">Kemungkinan</label>
                      <select name="inherent_kemungkinan" className="form-select border-warning bg-white" onChange={handleChange} value={formData.inherent_kemungkinan}>
                        {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="small fw-bold text-muted">Dampak</label>
                      <select name="inherent_dampak" className="form-select border-warning bg-white" onChange={handleChange} value={formData.inherent_dampak}>
                        {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                  </div>

                  <div 
                    className="mt-4 bg-white p-3 rounded-3 shadow-sm border border-warning-subtle"
                    style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                    onClick={() => openMatrix(formData.inherent_kemungkinan, formData.inherent_dampak)}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    title="Klik untuk melihat matriks"
                  >
                    <div className="small text-muted">Skor Risiko</div>
                    <h1 className="fw-bold m-0 text-dark display-4">{formData.inherent_ir}</h1>
                    <span 
                      className="badge rounded-pill px-4 py-2 mt-2"
                      style={getBadgeStyle(formData.level_risiko)}
                    >
                      {String(formData.level_risiko).toUpperCase()} <i className="bi bi-grid-3x3 ms-1"></i>
                    </span>
                  </div>
                </div>
              </div>

              {/* --- RESIDUAL RISK --- */}
              <div className="card border-0 shadow-sm mb-3" style={{ ...cardStyle, background: '#f0fdf4' }}>
                <div className="card-body p-4 text-center">
                  <div className="d-flex justify-content-center align-items-center gap-2 mb-1">
                    <h6 className="fw-bold text-success m-0">RESIDUAL RISK</h6>
                    <button type="button" className="btn btn-link p-0 m-0 text-muted" onClick={() => setShowResidualHelp(true)}><i className="bi bi-question-circle-fill"></i></button>
                  </div>
                  <small className="text-muted d-block mb-3">Setelah Penanganan</small>

                  <div className="mb-3">
                    <select name="terdapat_residual" className="form-select form-select-sm border-success text-center fw-bold text-success bg-white" onChange={handleChange} value={formData.terdapat_residual}>
                      <option value="true">Masih Ada Sisa Risiko</option><option value="false">Risiko Hilang / Diterima</option>
                    </select>
                  </div>

                  <div className="row g-2 text-start">
                    <div className="col-6">
                      <label className="small fw-bold text-muted">Kemungkinan</label>
                      <select name="residual_kemungkinan" className="form-select border-success bg-white" onChange={handleChange} value={formData.residual_kemungkinan} disabled={String(formData.terdapat_residual) === 'false'}>
                        {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="small fw-bold text-muted">Dampak</label>
                      <select name="residual_dampak" className="form-select border-success bg-white" onChange={handleChange} value={formData.residual_dampak} disabled={String(formData.terdapat_residual) === 'false'}>
                        {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                  </div>

                  <div 
                    className="mt-4 bg-white p-3 rounded-3 shadow-sm border border-success-subtle"
                    style={{ 
                      cursor: String(formData.terdapat_residual) === 'true' ? 'pointer' : 'default',
                      transition: 'transform 0.2s'
                    }}
                    onClick={() => {
                      if (String(formData.terdapat_residual) === 'true') {
                        openMatrix(formData.residual_kemungkinan, formData.residual_dampak);
                      }
                    }}
                    onMouseEnter={(e) => { if (String(formData.terdapat_residual) === 'true') e.currentTarget.style.transform = 'scale(1.02)'; }}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <div className="small text-muted">Skor Sisa</div>
                    <h1 className="fw-bold m-0 text-dark display-4">
                      {String(formData.terdapat_residual) === 'false' ? 0 : formData.rr}
                    </h1>
                    {String(formData.terdapat_residual) === 'true' && (
                       <span 
                         className="badge rounded-pill px-3 mt-2"
                         style={getBadgeStyle(getRiskLevel(formData.rr))}
                       >
                         Lihat Matriks <i className="bi bi-grid-3x3 ms-1"></i>
                       </span>
                    )}
                  </div>
                </div>
              </div>

              {/* --- PROGRESS --- */}
              <div className="card border-0 shadow-sm" style={cardStyle}>
                <div className="card-body p-4">
                  <label className="form-label small fw-bold d-flex justify-content-between mb-2">
                    <span>Realisasi Progress</span>
                    <span className="text-primary fw-bold">{formData.progress || 0}%</span>
                  </label>
                  <input type="range" className="form-range" min="0" max="100" step="5" name="progress" value={formData.progress || 0} onChange={handleChange} />
                  <div className="d-flex justify-content-between small text-muted mt-1" style={{ fontSize: '0.7rem' }}><span>0%</span><span>50%</span><span>100%</span></div>
                  <div className="mt-3 text-center p-2 bg-light rounded-3">
                    <small>Status: <strong className={formData.status === 'Closed' ? 'text-success' : 'text-primary'}>{formData.status}</strong></small>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* KONFIRMASI SIMPAN */}
          <div className="col-12 mt-2 pb-5">
            {notification && (
              <div className={`alert alert-${notification.type} d-flex align-items-center shadow-sm border-0 mb-3`} style={{ borderRadius: '12px' }}>
                <i className={`bi ${notification.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} fs-4 me-3`}></i>
                <div><strong className="d-block">{notification.type === 'success' ? 'Berhasil!' : 'Pemberitahuan Sistem'}</strong><small>{notification.message}</small></div>
                <button type="button" className="btn-close ms-auto" onClick={() => setNotification(null)}></button>
              </div>
            )}
            <div className="card border-0 shadow-sm p-4" style={cardStyle}>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                <div className="d-flex gap-3 align-items-center"><i className="bi bi-check-circle-fill text-primary fs-3"></i><div><h6 className="fw-bold m-0">Konfirmasi Simpan</h6><small className="text-muted">Pastikan skor risiko di panel kanan sudah sesuai.</small></div></div>
                <button type="submit" className="btn btn-primary py-3 px-5 fw-bold shadow-lg flex-grow-1 flex-md-grow-0" style={{ borderRadius: '12px', fontSize: '1.1rem' }} disabled={loading}>{loading ? 'Menyimpan...' : 'SIMPAN DATA RISIKO'}</button>
              </div>
            </div>
          </div>
        </div>
      </form>

      <RiskHelpModal title="Panduan Penilaian Inherent Risk" visible={showInherentHelp} onClose={() => setShowInherentHelp(false)} />
      <RiskHelpModal title="Panduan Penilaian Residual Risk" visible={showResidualHelp} onClose={() => setShowResidualHelp(false)} />
      <SuccessModal visible={showSuccessModal} message="Data risiko berhasil disimpan. Form telah di-reset." onClose={() => setShowSuccessModal(false)} onAddAnother={handleAddAnother} onViewDatabase={handleViewDatabase} />
      
      {/* RENDER MODAL MATRIKS */}
      <RiskMatrixModal show={showMatrix} onClose={() => setShowMatrix(false)} currentL={matrixValues.l} currentI={matrixValues.i} />
    </div>
  );
};

export default InputData;