// src/pages/InputData.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { calculateRiskScore, getRiskLevel } from '../utils/riskHelpers';

const InputData = ({ semester }) => {
  const [loading, setLoading] = useState(false);
  
  // Fungsi normalisasi: "  Server   Database  " -> "server database"
  const normalizeText = (text) => {
    if (!text) return '';
    return text.trim().toLowerCase().replace(/\s+/g, ' '); 
  };

  // STATE: Notifikasi (Pengganti Alert Pop-up)
  const [notification, setNotification] = useState(null); 

  // --- HELPER FUNCTIONS ---
  const getStatusFromProgress = (p) => {
    const n = Number(p) || 0;
    if (n === 0) return 'Open';
    if (n > 0 && n < 100) return 'On Going';
    return 'Closed';
  };

  const getLevelBadge = (level) => {
    if (level === 'Sangat Tinggi') return 'bg-danger text-white';
    if (level === 'Tinggi') return 'bg-danger text-white';
    if (level === 'Sedang') return 'bg-warning text-dark';
    return 'bg-success text-white';
  };

  // --- STATE FORM DATA ---
  const [formData, setFormData] = useState({
    jenis_risiko: 'Negatif',
    semester: semester,
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

  // --- EFFECTS ---
  useEffect(() => {
    setFormData(prev => ({ ...prev, semester }));
  }, [semester]);

  // Logika jika Keputusan = Tidak (Terima Risiko)
  useEffect(() => {
    if (formData.keputusan_penanganan === 'Tidak') {
      setFormData(prev => ({
        ...prev,
        opsi_penanganan: 'Terima',
        rencana_aksi: '-',
        keluaran: '-',
        target_jadwal: '',
        penanggung_jawab: '-',
        rencana_kontrol_tambahan: '-'
      }));
    } else {
      if (formData.opsi_penanganan === 'Terima') {
        setFormData(prev => ({ ...prev, opsi_penanganan: 'Mitigasi', rencana_aksi: '' }));
      }
    }
  }, [formData.keputusan_penanganan]);

  // Hitung Inherent Risk Otomatis
  useEffect(() => {
    const L = parseInt(formData.inherent_kemungkinan) || 1;
    const I = parseInt(formData.inherent_dampak) || 1;
    const score = calculateRiskScore(L, I);
    const level = getRiskLevel(score);
    setFormData(prev => ({ ...prev, inherent_ir: score, level_risiko: level }));
  }, [formData.inherent_kemungkinan, formData.inherent_dampak]);

  // Hitung Residual Risk Otomatis
  useEffect(() => {
    if (String(formData.terdapat_residual) === 'false') {
      setFormData(prev => ({ ...prev, rr: 0, residual_dampak: 1, residual_kemungkinan: 1 }));
      return;
    }
    const L = parseInt(formData.residual_kemungkinan) || 1;
    const I = parseInt(formData.residual_dampak) || 1;
    const score = calculateRiskScore(L, I);
    setFormData(prev => ({ ...prev, rr: score }));
  }, [formData.residual_kemungkinan, formData.residual_dampak, formData.terdapat_residual]);

  // Sync Status Progress
  useEffect(() => {
    setFormData(prev => ({ ...prev, status: getStatusFromProgress(prev.progress || 0) }));
  }, [formData.progress]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // --- SUBMIT HANDLER ---
  // --- SUBMIT HANDLER ---
  const handleSubmit = async (e) => {

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setNotification({
        type: 'danger',
        message: 'User tidak terdeteksi. Silakan login ulang.'
      });
      setLoading(false);
      return;
    }


    e.preventDefault();
    setLoading(true);
    setNotification(null); // Reset notifikasi lama

    try {
      // 1. NORMALISASI TEXT
      const rawAset = formData.aset; 
      const normAset = normalizeText(rawAset); 

      // 2. CEK MASTER (Cari ID Aset)
      const { data: existingMaster, error: masterErr } = await supabase
        .from('risk_master')
        .select('*')
        .eq('aset_norm', normAset)
        .maybeSingle();

      if (masterErr) throw masterErr;

      let riskNo = existingMaster?.risk_no;

      // 3. JIKA BELUM ADA DI MASTER, BUAT BARU
      if (!riskNo) {
        const { data: inserted, error: insertErr } = await supabase
          .from('risk_master')
          .insert([{
            aset: rawAset,              
            // aset_norm tidak dikirim (dihitung database)
            klasifikasi_aset: formData.klasifikasi_aset,
            kategori: formData.kategori,
            jenis_risiko: formData.jenis_risiko,
            user_id: user.id,
          }])
          .select('risk_no')
          .single();

        if (insertErr) {
            // Handle Race Condition
            const { data: reMaster } = await supabase
              .from('risk_master').select('*').eq('aset_norm', normAset).maybeSingle();
            
            if (reMaster) riskNo = reMaster.risk_no;
            else throw insertErr;
        } else {
            riskNo = inserted.risk_no;
        }
      }

      // ============================================================
      // 4. CEK DUPLIKASI DI HISTORY (Mencegah input berulang di semester sama)
      // ============================================================
      const { data: duplicateCheck, error: dupErr } = await supabase
        .from('risk_history')
        .select('id')
        .eq('risk_no', riskNo)
        .eq('semester', formData.semester)
        .maybeSingle();

      if (dupErr) throw dupErr;

      // JIKA ADA DUPLIKAT -> TAMPILKAN NOTIFIKASI KUNING (WARNING)
      // (Bukan Pop-up Browser)
      if (duplicateCheck) {
        setNotification({
          type: 'warning', // Akan menjadi alert kuning
          message: `Aset "${rawAset}" sudah terdaftar di ${formData.semester}. Tidak bisa input ganda.`
        });
        setLoading(false);
        return; // BERHENTI DI SINI (Data tidak disimpan)
      }
      // ============================================================

      // 5. JIKA AMAN, INSERT KE HISTORY
      const payloadHistory = {
        risk_no: riskNo,
        semester: formData.semester,
        tanggal_identifikasi: formData.tanggal_identifikasi || new Date().toISOString(),
        ancaman: formData.ancaman,
        kerawanan: formData.kerawanan,
        dampak_identifikasi: formData.dampak_identifikasi,
        area_dampak: formData.area_dampak,
        kontrol_saat_ini: formData.kontrol_saat_ini,
        inherent_kemungkinan: parseInt(formData.inherent_kemungkinan) || 1,
        inherent_dampak: parseInt(formData.inherent_dampak) || 1,
        inherent_ir: parseFloat(formData.inherent_ir) || 0,
        level_risiko: formData.level_risiko,
        residual_kemungkinan: parseInt(formData.residual_kemungkinan) || 1,
        residual_dampak: parseInt(formData.residual_dampak) || 1,
        rr: parseFloat(formData.rr) || 0,
        keputusan_penanganan: formData.keputusan_penanganan,
        prioritas_risiko: formData.prioritas_risiko,
        opsi_penanganan: formData.opsi_penanganan,
        rencana_aksi: formData.rencana_aksi,
        keluaran: formData.keluaran,
        target_jadwal: formData.target_jadwal || null,
        penanggung_jawab: formData.penanggung_jawab,
        progress: parseInt(formData.progress) || 0,
        status: formData.status,
        rencana_kontrol_tambahan: formData.rencana_kontrol_tambahan,
        risk_owner: formData.risk_owner,
        user_id: user.id
      };

      const { error: historyErr } = await supabase.from('risk_history').insert([payloadHistory]);
      if (historyErr) throw historyErr;

      // SUKSES -> NOTIFIKASI HIJAU
      setNotification({
        type: 'success',
        message: 'Data risiko berhasil disimpan! Mengalihkan ke database...'
      });

      setTimeout(() => {
        window.location.href = '/database';
      }, 1500);

    } catch (err) {
      console.error('Submit error:', err);
      // ERROR -> NOTIFIKASI MERAH
      setNotification({
        type: 'danger',
        message: 'Gagal menyimpan: ' + (err?.message || 'Terjadi kesalahan sistem.')
      });
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = formData.keputusan_penanganan === 'Tidak';
  const inputClass = "form-control"; 
  const cardStyle = { borderRadius: '16px', overflow: 'visible' };

  // --- RENDER COMPONENT ---
  return (
    <div className="container-fluid p-0">
      
      {/* HEADER PAGE */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold text-dark m-0">Input Risiko Baru</h3>
          <p className="text-muted m-0">Pastikan data yang diinput valid untuk semester <span className="text-primary fw-bold">{semester}</span></p>
        </div>
        <a href="/database" className="btn btn-white text-danger fw-bold border shadow-sm px-4 py-2" style={{ borderRadius: '10px' }}>
          <i className="bi bi-x-lg me-2"></i> Batal
        </a>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="row g-4 align-items-start">
          
          {/* === KOLOM KIRI (FORM INPUT UTAMA) === */}
          <div className="col-lg-8">
            
            {/* 1. IDENTITAS & ASET */}
            <div className="card border-0 shadow-sm mb-4" style={cardStyle}>
              <div className="card-header bg-white border-bottom-0 pt-4 px-4 pb-0" style={{borderTopLeftRadius: '16px', borderTopRightRadius: '16px'}}>
                 <div className="d-flex align-items-center gap-2 text-primary">
                    <i className="bi bi-info-circle-fill fs-5"></i>
                    <h5 className="fw-bold m-0">1. Identitas & Aset</h5>
                 </div>
                 <hr className="my-2 opacity-10"/>
              </div>
              <div className="card-body p-4">
                <div className="row g-3">
                  <div className="col-12">
                    <div className="d-flex align-items-center p-3 rounded-3 mb-2" style={{ backgroundColor: '#eef2ff', border: '1px dashed #6366f1' }}>
                      <i className="bi bi-calendar-check text-primary fs-3 me-3"></i>
                      <div>
                        <small className="text-muted fw-bold text-uppercase d-block" style={{ fontSize: '0.7rem' }}>Target Semester</small>
                        <span className="fw-bold text-dark fs-5">{formData.semester}</span>
                      </div>
                      <div className="ms-auto badge bg-primary">Otomatis</div>
                    </div>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label small text-muted fw-bold">Risk No</label>
                    <input type="text" className="form-control bg-light" value="Auto Generated" disabled />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small text-muted fw-bold">Klasifikasi Aset</label>
                    <select name="klasifikasi_aset" className="form-select" onChange={handleChange} value={formData.klasifikasi_aset}>
                      <option>Data dan Informasi</option>
                      <option>Perangkat Lunak</option>
                      <option>Perangkat Keras</option>
                      <option>Sarana Pendukung</option>
                      <option>SDM & Pihak Ketiga</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small text-muted fw-bold">Jenis Risiko</label>
                    <select name="jenis_risiko" className="form-select" onChange={handleChange} value={formData.jenis_risiko}>
                      <option value="Negatif">Negatif</option>
                      <option value="Positif">Positif</option>
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label small text-muted fw-bold">Nama Aset / Sistem</label>
                    <input type="text" name="aset" className={inputClass} placeholder="Contoh: Server Database Kepegawaian" required value={formData.aset} onChange={handleChange} />
                  </div>
                  <div className="col-12">
                    <label className="form-label small text-muted fw-bold">Kategori SPBE</label>
                    <select name="kategori" className="form-select" onChange={handleChange} value={formData.kategori}>
                      <option>Penyalahgunaan Kontrol Akses</option>
                      <option>Pencurian Data Pribadi</option>
                      <option>Insiden Web Defacement</option>
                      <option>Keamanan Cloud Service</option>
                      <option>Keamanan Infrastruktur</option>
                      <option>Ketidaksesuaian Pengelolaan Aplikasi</option>
                      <option>Kesalahan Pengelolaan Data dan Informasi Terbatas</option>
                      <option>Kesalahan Pengelolaan SDM</option>
                      <option>Kesalahan Pengelolaan Aset</option>
                      <option>Kesalahan Pengelolaan Pihak Ketiga</option>
                      <option>Terganggunya Keberlangsungan Layanan</option>
                      <option>Insiden Serangan Malware</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small text-muted fw-bold">Tanggal Identifikasi</label>
                    <input type="date" name="tanggal_identifikasi" className={inputClass} value={formData.tanggal_identifikasi} onChange={handleChange} required />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. ANALISA RISIKO */}
            <div className="card border-0 shadow-sm mb-4" style={cardStyle}>
              <div className="card-header bg-white border-bottom-0 pt-4 px-4 pb-0" style={{borderTopLeftRadius: '16px', borderTopRightRadius: '16px'}}>
                 <div className="d-flex align-items-center gap-2 text-danger">
                    <i className="bi bi-search fs-5"></i>
                    <h5 className="fw-bold m-0">2. Analisa Risiko</h5>
                 </div>
                 <hr className="my-2 opacity-10"/>
              </div>
              <div className="card-body p-4">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small text-muted fw-bold">Ancaman (Threat)</label>
                    <textarea name="ancaman" className={inputClass} rows="2" onChange={handleChange} value={formData.ancaman}></textarea>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small text-muted fw-bold">Kerawanan</label>
                    <textarea name="kerawanan" className={inputClass} rows="2" onChange={handleChange} value={formData.kerawanan}></textarea>
                  </div>
                  <div className="col-md-12">
                    <label className="form-label small text-muted fw-bold">Uraian Dampak</label>
                    <textarea name="dampak_identifikasi" className={inputClass} rows="2" onChange={handleChange} value={formData.dampak_identifikasi}></textarea>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small text-muted fw-bold">Area Dampak</label>
                    <select name="area_dampak" className="form-select" onChange={handleChange} value={formData.area_dampak}>
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
                    <label className="form-label small text-muted fw-bold">Kontrol Saat Ini</label>
                    <input type="text" name="kontrol_saat_ini" className={inputClass} onChange={handleChange} value={formData.kontrol_saat_ini} />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. EVALUASI RISIKO */}
            <div className="card border-0 shadow-sm mb-4" style={{ ...cardStyle, borderLeft: '5px solid #0d6efd' }}>
               <div className="card-header bg-white border-bottom-0 pt-4 px-4 pb-0" style={{borderTopRightRadius: '16px'}}>
                 <div className="d-flex align-items-center gap-2 text-primary">
                    <i className="bi bi-sliders fs-5"></i>
                    <h5 className="fw-bold m-0">3. Evaluasi Risiko</h5>
                 </div>
                 <hr className="my-2 opacity-10"/>
              </div>
              <div className="card-body p-4">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small text-muted fw-bold">Keputusan Penanganan</label>
                    <select name="keputusan_penanganan" className="form-select fw-bold" value={formData.keputusan_penanganan} onChange={handleChange}>
                      <option value="Ya">Ya (Perlu Penanganan)</option>
                      <option value="Tidak">Tidak (Terima Risiko)</option>
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small text-muted fw-bold">Prioritas Risiko</label>
                    <select name="prioritas_risiko" className="form-select" value={formData.prioritas_risiko} onChange={handleChange}>
                      <option value="1">1 (Sangat Tinggi)</option>
                      <option value="2">2 (Tinggi)</option>
                      <option value="3">3 (Sedang)</option>
                      <option value="4">4 (Rendah)</option>
                      <option value="5">5 (Sangat Rendah)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. RENCANA PENANGANAN */}
            <div className={`card border-0 shadow-sm mb-4 ${isDisabled ? 'bg-light opacity-75' : ''}`} style={{ ...cardStyle, borderLeft: '5px solid #198754' }}>
              <div className="card-header bg-white border-bottom-0 pt-4 px-4 pb-0" style={{borderTopRightRadius: '16px'}}>
                 <div className="d-flex align-items-center gap-2 text-success">
                    <i className="bi bi-shield-check fs-5"></i>
                    <h5 className="fw-bold m-0">4. Rencana Penanganan</h5>
                    {isDisabled && <span className="badge bg-secondary ms-2">Tidak Diperlukan</span>}
                 </div>
                 <hr className="my-2 opacity-10"/>
              </div>
              <div className="card-body p-4">
                <div className="row g-3">
                   <div className="col-md-4">
                    <label className="form-label small text-muted fw-bold">Opsi Penanganan</label>
                    <select name="opsi_penanganan" className="form-select" onChange={handleChange} value={formData.opsi_penanganan} disabled={isDisabled}>
                      <option>Mitigasi</option><option>Transfer</option><option>Hindari</option><option>Terima</option>
                    </select>
                  </div>
                  <div className="col-md-8">
                    <label className="form-label small text-muted fw-bold">Rencana Aksi</label>
                    <input type="text" name="rencana_aksi" className={inputClass} onChange={handleChange} value={formData.rencana_aksi} disabled={isDisabled} placeholder={isDisabled ? '-' : 'Langkah konkret...'} />
                  </div>
                  <div className="col-md-6"><label className="form-label small text-muted fw-bold">Keluaran (Output)</label><input type="text" name="keluaran" className={inputClass} onChange={handleChange} value={formData.keluaran} disabled={isDisabled} /></div>
                  <div className="col-md-6"><label className="form-label small text-muted fw-bold">Target/Jadwal</label><input type="date" name="target_jadwal" className={inputClass} onChange={handleChange} value={formData.target_jadwal} disabled={isDisabled} /></div>
                  <div className="col-md-6"><label className="form-label small text-muted fw-bold">Penanggung Jawab</label><input type="text" name="penanggung_jawab" className={inputClass} onChange={handleChange} value={formData.penanggung_jawab} disabled={isDisabled} /></div>
                  <div className="col-md-6"><label className="form-label small text-muted fw-bold">Risk Owner</label><input type="text" name="risk_owner" className={inputClass} onChange={handleChange} value={formData.risk_owner} disabled={isDisabled} /></div>
                  <div className="col-12"><label className="form-label small text-muted fw-bold">Kontrol Tambahan (Opsional)</label><input type="text" name="rencana_kontrol_tambahan" className={inputClass} onChange={handleChange} value={formData.rencana_kontrol_tambahan} disabled={isDisabled} /></div>
                </div>
              </div>
            </div>

          </div>

          {/* === KOLOM KANAN (STICKY CALCULATOR) === */}
          <div className="col-lg-4">
            <div style={{ position: 'sticky', top: '20px' }}>
              
              {/* Card Inherent */}
              <div className="card border-0 shadow-sm mb-3" style={{ ...cardStyle, background: '#fffbeb' }}>
                <div className="card-body p-4 text-center">
                   <h6 className="fw-bold text-warning m-0">INHERENT RISK (Awal)</h6>
                   <small className="text-muted d-block mb-3">Sebelum Penanganan</small>
                   
                   <div className="row g-2 text-start">
                      <div className="col-6">
                        <label className="small fw-bold text-muted">Kemungkinan</label>
                        <select name="inherent_kemungkinan" className="form-select border-warning bg-white" onChange={handleChange} value={formData.inherent_kemungkinan}>{[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}</select>
                      </div>
                      <div className="col-6">
                        <label className="small fw-bold text-muted">Dampak</label>
                        <select name="inherent_dampak" className="form-select border-warning bg-white" onChange={handleChange} value={formData.inherent_dampak}>{[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}</select>
                      </div>
                   </div>

                   <div className="mt-4 bg-white p-3 rounded-3 shadow-sm border border-warning-subtle">
                      <div className="small text-muted">Skor Risiko</div>
                      <h1 className="fw-bold m-0 text-dark display-4">{formData.inherent_ir}</h1>
                      <span className={`badge ${getLevelBadge(formData.level_risiko)} rounded-pill px-4 py-2 mt-2`}>
                        {String(formData.level_risiko).toUpperCase()}
                      </span>
                   </div>
                </div>
              </div>

              {/* Card Residual */}
              <div className="card border-0 shadow-sm mb-3" style={{ ...cardStyle, background: '#f0fdf4' }}>
                <div className="card-body p-4 text-center">
                   <h6 className="fw-bold text-success m-0">RESIDUAL RISK</h6>
                   <small className="text-muted d-block mb-3">Setelah Penanganan</small>
                   
                   <div className="mb-3">
                     <select name="terdapat_residual" className="form-select form-select-sm border-success text-center fw-bold text-success bg-white" onChange={handleChange} value={formData.terdapat_residual}>
                       <option value="true">Masih Ada Sisa Risiko</option>
                       <option value="false">Risiko Hilang / Diterima</option>
                     </select>
                   </div>

                   <div className="row g-2 text-start">
                      <div className="col-6">
                        <label className="small fw-bold text-muted">Kemungkinan</label>
                        <select name="residual_kemungkinan" className="form-select border-success bg-white" onChange={handleChange} value={formData.residual_kemungkinan} disabled={String(formData.terdapat_residual) === 'false'}>{[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}</select>
                      </div>
                      <div className="col-6">
                        <label className="small fw-bold text-muted">Dampak</label>
                        <select name="residual_dampak" className="form-select border-success bg-white" onChange={handleChange} value={formData.residual_dampak} disabled={String(formData.terdapat_residual) === 'false'}>{[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}</select>
                      </div>
                   </div>

                   <div className="mt-4 bg-white p-3 rounded-3 shadow-sm border border-success-subtle">
                      <div className="small text-muted">Skor Sisa</div>
                      <h1 className="fw-bold m-0 text-dark display-4">{String(formData.terdapat_residual) === 'false' ? 0 : formData.rr}</h1>
                   </div>
                </div>
              </div>

               {/* Progress Slider */}
               <div className="card border-0 shadow-sm" style={cardStyle}>
                 <div className="card-body p-4">
                    <label className="form-label small fw-bold d-flex justify-content-between mb-2">
                       <span>Realisasi Progress</span>
                       <span className="text-primary fw-bold">{formData.progress || 0}%</span>
                    </label>
                    <input type="range" className="form-range" min="0" max="100" step="5" name="progress" value={formData.progress || 0} onChange={handleChange} />
                    <div className="d-flex justify-content-between small text-muted mt-1" style={{fontSize: '0.7rem'}}><span>0%</span><span>50%</span><span>100%</span></div>
                    <div className="mt-3 text-center p-2 bg-light rounded-3">
                       <small>Status: <strong className={formData.status === 'Closed' ? 'text-success' : 'text-primary'}>{formData.status}</strong></small>
                    </div>
                 </div>
               </div>

            </div>
          </div>

          {/* === TOMBOL SUBMIT === */}
          <div className="col-12 mt-2 pb-5">
             
             {/* --- ALERT NOTIFIKASI DI SINI --- */}
             {notification && (
                <div className={`alert alert-${notification.type} d-flex align-items-center shadow-sm border-0 mb-3`} role="alert" style={{ borderRadius: '12px' }}>
                  <i className={`bi ${notification.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} fs-4 me-3`}></i>
                  <div>
                    <strong className="d-block">{notification.type === 'success' ? 'Berhasil!' : 'Pemberitahuan Sistem'}</strong>
                    <small>{notification.message}</small>
                  </div>
                  <button type="button" className="btn-close ms-auto" onClick={() => setNotification(null)}></button>
                </div>
             )}
             {/* ------------------------------- */}

             <div className="card border-0 shadow-sm p-4" style={cardStyle}>
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                   <div className="d-flex gap-3 align-items-center">
                     <i className="bi bi-check-circle-fill text-primary fs-3"></i>
                     <div>
                        <h6 className="fw-bold m-0">Konfirmasi Simpan</h6>
                        <small className="text-muted">Pastikan skor risiko di panel kanan sudah sesuai.</small>
                     </div>
                   </div>
                   <button type="submit" className="btn btn-primary py-3 px-5 fw-bold shadow-lg flex-grow-1 flex-md-grow-0" style={{ borderRadius: '12px', fontSize: '1.1rem' }} disabled={loading}>
                      {loading ? 'Menyimpan...' : 'SIMPAN DATA RISIKO'}
                   </button>
                </div>
             </div>
          </div>

        </div>
      </form>
    </div>
  );
};

export default InputData;