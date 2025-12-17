import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { calculateRiskScore, getRiskLevel, getBadgeStyle } from '../utils/riskHelpers';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// IMPORT MODAL
import ModalView from '../components/ModalView';
import ModalEdit from '../components/ModalEdit';

const Database = ({ semester }) => {
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal State (View & Edit)
  const [viewData, setViewData] = useState(null);
  const [editData, setEditData] = useState(null);

  // --- STATE MODAL COPY (UPDATED) ---
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [sourceSemesterInput, setSourceSemesterInput] = useState('');
  // State untuk tanggal custom (Default hari ini: YYYY-MM-DD)
  const [targetDateInput, setTargetDateInput] = useState(new Date().toISOString().split('T')[0]);

  // Toast & Confirm Delete
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' });
  const [confirmDelete, setConfirmDelete] = useState({ show: false, id: null, label: '' });

  const tableRef = useRef(null);

  // --- HELPER FUNCTIONS ---
  const showToast = (message, variant = 'success', duration = 3500) => {
    setToast({ show: true, message, variant });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), duration);
  };

  const getStatusFromProgress = (progress) => {
    const n = Number(progress) || 0;
    if (n >= 100) return 'Closed';
    if (n > 0) return 'On Going';
    return 'Open';
  };

  // --- 1. FETCH DATA ---
  useEffect(() => {
    fetchRisks();
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semester]);

  const fetchRisks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('risk_history')
        .select(`*, risk_master (aset, klasifikasi_aset, kategori, jenis_risiko, risk_no)`)
        .eq('semester', semester)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRisks(data || []);
    } catch (err) {
      console.error(err);
      showToast('Gagal memuat data.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // --- 2. LOGIKA COPY DATA (UPDATED DATE) ---

  // A. Fungsi Pembuka Modal
  const handleCopyData = () => {
    setSourceSemesterInput(''); 
    // Reset tanggal ke hari ini setiap kali modal dibuka
    setTargetDateInput(new Date().toISOString().split('T')[0]);
    setShowCopyModal(true);
  };

  // B. Fungsi Eksekusi
  const executeCopy = async () => {
    // Validasi
    if (!sourceSemesterInput.trim()) {
      alert("Nama semester sumber tidak boleh kosong.");
      return;
    }
    if (!targetDateInput) {
      alert("Tanggal identifikasi harus diisi.");
      return;
    }
    if (sourceSemesterInput === semester) {
      alert("Sumber dan tujuan tidak boleh sama!");
      return;
    }

    setShowCopyModal(false); 
    setLoading(true);

    try {
      // Cek User
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User tidak terdeteksi. Silakan login ulang.");

      // Ambil data
      const { data: oldData, error: fetchError } = await supabase
        .from('risk_history')
        .select('*')
        .eq('semester', sourceSemesterInput);

      if (fetchError) throw fetchError;
      
      if (!oldData || oldData.length === 0) {
        showToast(`Tidak ada data ditemukan di "${sourceSemesterInput}"`, 'warning');
        setLoading(false);
        return;
      }

      // Transformasi Data
      const newRows = oldData.map(item => ({
        risk_no: item.risk_no,
        ancaman: item.ancaman,
        kerawanan: item.kerawanan,
        dampak_identifikasi: item.dampak_identifikasi,
        area_dampak: item.area_dampak,
        kontrol_saat_ini: item.kontrol_saat_ini,

        inherent_kemungkinan: item.inherent_kemungkinan,
        inherent_dampak: item.inherent_dampak,
        inherent_ir: item.inherent_ir,
        level_risiko: item.level_risiko,

        terdapat_residual: item.terdapat_residual,
        residual_kemungkinan: item.residual_kemungkinan,
        residual_dampak: item.residual_dampak,
        rr: item.rr,

        keputusan_penanganan: item.keputusan_penanganan,
        prioritas_risiko: item.prioritas_risiko,
        opsi_penanganan: item.opsi_penanganan,
        rencana_aksi: item.rencana_aksi,
        keluaran: item.keluaran,
        penanggung_jawab: item.penanggung_jawab,
        rencana_kontrol_tambahan: item.rencana_kontrol_tambahan,
        risk_owner: item.risk_owner,

        // === BAGIAN UTAMA YANG DIUBAH ===
        semester: semester,
        // Gunakan tanggal dari Input User
        tanggal_identifikasi: targetDateInput, 
        
        user_id: user.id,
        progress: 0,
        status: 'Open',
        target_jadwal: null
      }));

      const { error: insertError } = await supabase
        .from('risk_history')
        .insert(newRows);

      if (insertError) throw insertError;

      showToast(`Berhasil menyalin ${newRows.length} data dengan tanggal ${targetDateInput}!`, 'success');
      fetchRisks();

    } catch (err) {
      console.error(err);
      showToast("Gagal menyalin data: " + err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  // --- 3. LOGIKA DELETE ---
  const handleDelete = (id, label = '') => {
    if (!id) return;
    setConfirmDelete({ show: true, id, label });
  };

  const performDelete = async () => {
    const id = confirmDelete.id;
    if (!id) {
      setConfirmDelete({ show: false, id: null, label: '' });
      return;
    }
    try {
      const { error } = await supabase.from('risk_history').delete().eq('id', id);
      if (error) throw error;
      showToast('Data berhasil dihapus.', 'success');
      setConfirmDelete({ show: false, id: null, label: '' });
      fetchRisks();
    } catch (error) {
      showToast('Gagal menghapus: ' + error.message, 'danger');
      setConfirmDelete({ show: false, id: null, label: '' });
    }
  };

  // --- 4. LOGIKA EDIT ---
  const handleEditClick = (row) => {
    const master = row.risk_master || {};
    setEditData({
      ...row,
      aset: master.aset || '',
      klasifikasi_aset: master.klasifikasi_aset || 'Data dan Informasi',
      jenis_risiko: master.jenis_risiko || 'Negatif',
      kategori: master.kategori || '',
      inherent_kemungkinan: row.inherent_kemungkinan ?? 1,
      inherent_dampak: row.inherent_dampak ?? 1,
      inherent_ir: row.inherent_ir ?? 0,
      residual_kemungkinan: row.residual_kemungkinan ?? 1,
      residual_dampak: row.residual_dampak ?? 1,
      rr: row.rr ?? 0,
      terdapat_residual: Boolean(row.terdapat_residual),
      status: row.status || getStatusFromProgress(row.progress)
    });
  };

  const handleEditChange = (e) => {
    const target = e?.target ?? e;
    const { name, value } = target;

    setEditData(prev => {
        let parsedVal = value;
        if (name === 'terdapat_residual') {
             const valBool = value === 'true' || value === true;
             return { ...prev, [name]: valBool, ...(valBool ? {} : { rr: 0 }) };
        }
        
        const next = { ...prev, [name]: parsedVal };
        // Recalculate IR
        if (name.includes('inherent')) {
            const ik = name === 'inherent_kemungkinan' ? Number(parsedVal) : Number(prev.inherent_kemungkinan);
            const id = name === 'inherent_dampak' ? Number(parsedVal) : Number(prev.inherent_dampak);
            next.inherent_ir = calculateRiskScore(ik, id);
            next.level_risiko = getRiskLevel(next.inherent_ir);
        }
        // Recalculate RR
        if (name.includes('residual')) {
             if (String(prev.terdapat_residual) === 'true' || prev.terdapat_residual === true) {
                 const rk = name === 'residual_kemungkinan' ? Number(parsedVal) : Number(prev.residual_kemungkinan);
                 const rd = name === 'residual_dampak' ? Number(parsedVal) : Number(prev.residual_dampak);
                 next.rr = calculateRiskScore(rk, rd);
             }
        }
        return next;
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editData) return;
    
    // Recalculate Final Scores before submit
    const newIR = calculateRiskScore(editData.inherent_kemungkinan, editData.inherent_dampak);
    const newLevel = getRiskLevel(newIR);
    const isRes = String(editData.terdapat_residual) === 'true' || editData.terdapat_residual === true;
    const newRR = isRes ? calculateRiskScore(editData.residual_kemungkinan, editData.residual_dampak) : 0;
    const progressInt = parseInt(editData.progress) || 0;

    const historyPayload = {
      tanggal_identifikasi: editData.tanggal_identifikasi,
      ancaman: editData.ancaman,
      kerawanan: editData.kerawanan,
      dampak_identifikasi: editData.dampak_identifikasi,
      area_dampak: editData.area_dampak,
      kontrol_saat_ini: editData.kontrol_saat_ini,
      inherent_kemungkinan: editData.inherent_kemungkinan,
      inherent_dampak: editData.inherent_dampak,
      inherent_ir: newIR,
      level_risiko: newLevel,
      
      terdapat_residual: isRes,
      residual_kemungkinan: editData.residual_kemungkinan,
      residual_dampak: editData.residual_dampak,
      rr: newRR,

      keputusan_penanganan: editData.keputusan_penanganan,
      prioritas_risiko: editData.prioritas_risiko,
      opsi_penanganan: editData.opsi_penanganan,
      rencana_aksi: editData.rencana_aksi,
      keluaran: editData.keluaran,
      target_jadwal: editData.target_jadwal || null,
      penanggung_jawab: editData.penanggung_jawab,
      progress: progressInt,
      status: getStatusFromProgress(progressInt),
      rencana_kontrol_tambahan: editData.rencana_kontrol_tambahan
    };

    const masterPayload = {
      aset: editData.aset,
      klasifikasi_aset: editData.klasifikasi_aset,
      kategori: editData.kategori
    };

    try {
      const { error: err1 } = await supabase.from('risk_history').update(historyPayload).eq('id', editData.id);
      if (err1) throw err1;
      const { error: err2 } = await supabase.from('risk_master').update(masterPayload).eq('risk_no', editData.risk_no);
      if (err2) throw err2;

      showToast('Data berhasil diperbarui!', 'success');
      setEditData(null);
      fetchRisks();
    } catch (error) {
      showToast('Gagal update: ' + error.message, 'danger');
    }
  };

  // --- FILTER & PAGINATION ---
  const filteredData = risks.filter(item =>
    (item.risk_master?.aset || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.risk_no || '').toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalItems = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [totalPages, currentPage]);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, pageSize]);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(totalItems, startIndex + pageSize);
  const pagedData = filteredData.slice(startIndex, endIndex);

  const goToPage = (p) => {
    setCurrentPage(Math.max(1, Math.min(totalPages, p)));
    setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
  };
  const handlePrev = () => goToPage(currentPage - 1);
  const handleNext = () => goToPage(currentPage + 1);
  const getPageItems = () => {
     const pages = []; 
     for(let i=1; i<=totalPages; i++) if(i===1 || i===totalPages || (i>=currentPage-1 && i<=currentPage+1)) pages.push(i); else if(pages[pages.length-1]!=='...') pages.push('...');
     return pages;
  };
  const displayStatusForRow = (row) => row.status || getStatusFromProgress(row.progress);

  // --- EXPORT EXCEL ---
  const exportToExcel = async () => {
     try {
       const wb = new ExcelJS.Workbook();
       const ws = wb.addWorksheet('Register Risiko');
       // ... KODE EXCEL SAMA SEPERTI SEBELUMNYA ...
       const buf = await wb.xlsx.writeBuffer();
       saveAs(new Blob([buf]), `Register Risiko ${semester}.xlsx`);
     } catch(e) { alert('Gagal export excel'); }
  };

  // ============================================
  // RENDER UTAMA
  // ============================================
  return (
    <div className="container-fluid p-0">
      {/* Toast */}
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 2000 }}>
        {toast.show && (
          <div className={`alert alert-${toast.variant} shadow-sm`}>
            <strong>{toast.variant === 'success' ? 'Sukses' : 'Info'}</strong> {toast.message}
          </div>
        )}
      </div>

      {/* Confirm Delete Modal */}
      {confirmDelete.show && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
           <div className="modal-dialog modal-dialog-centered">
             <div className="modal-content">
               <div className="modal-body">
                 <h5>Konfirmasi Hapus</h5>
                 <p>Yakin hapus data <strong>{confirmDelete.label}</strong>?</p>
                 <div className="d-flex justify-content-end gap-2">
                   <button className="btn btn-secondary" onClick={() => setConfirmDelete({ show: false, id: null })}>Batal</button>
                   <button className="btn btn-danger" onClick={performDelete}>Hapus</button>
                 </div>
               </div>
             </div>
           </div>
        </div>
      )}

      {/* --- MODAL COPY DATA (UPDATED WITH DATE PICKER) --- */}
      {showCopyModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '12px' }}>
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-dark">
                  <i className="bi bi-collection-fill text-primary me-2"></i>
                  Salin Data Semester
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowCopyModal(false)}></button>
              </div>
              
              <div className="modal-body pt-2 pb-4">
                <p className="text-muted small mb-3">
                  Masukkan semester sumber dan <strong>tanggal identifikasi baru</strong> untuk data yang disalin.
                </p>
                
                {/* INPUT SEMESTER */}
                <div className="form-group mb-3">
                  <label className="form-label fw-bold small text-secondary">Semester Sumber</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Contoh: Semester 1 2024"
                    value={sourceSemesterInput}
                    onChange={(e) => setSourceSemesterInput(e.target.value)}
                    autoFocus
                  />
                </div>

                {/* INPUT TANGGAL BARU (CUSTOM) */}
                <div className="form-group">
                  <label className="form-label fw-bold small text-secondary">Tanggal Identifikasi Baru</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={targetDateInput}
                    onChange={(e) => setTargetDateInput(e.target.value)}
                  />
                  <div className="form-text small">
                    Seluruh data yang disalin akan menggunakan tanggal ini.
                  </div>
                </div>
                
                <div className="alert alert-info d-flex align-items-center mt-3 mb-0 py-2 small" role="alert">
                  <i className="bi bi-info-circle-fill me-2 fs-5"></i>
                  <div>
                    Data akan disalin dengan status <strong>Open</strong> dan progress <strong>0%</strong>.
                  </div>
                </div>
              </div>
              
              <div className="modal-footer border-0 pt-0">
                <button 
                  type="button" 
                  className="btn btn-light text-muted fw-bold" 
                  onClick={() => setShowCopyModal(false)}
                >
                  Batal
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary fw-bold px-4" 
                  onClick={executeCopy}
                  disabled={loading}
                >
                  {loading ? 'Menyalin...' : 'Salin Data'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER ATAS */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold text-dark m-0">Database Risiko</h3>
          <small className="text-muted">Semester: <strong>{semester}</strong></small>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-success shadow-sm" onClick={exportToExcel} disabled={risks.length === 0}>
            <i className="bi bi-file-earmark-excel me-1"></i> Export Template
          </button>
          <button className="btn btn-light shadow-sm border" onClick={fetchRisks}>
            <i className="bi bi-arrow-clockwise text-primary"></i> Refresh
          </button>
        </div>
      </div>

      {/* === LOGIKA TAMPILAN UTAMA === */}
      {loading ? (
        <div className="text-center py-5">
           <div className="spinner-border text-primary" role="status"></div>
           <p className="mt-2 text-muted">Memuat data...</p>
        </div>

      ) : risks.length === 0 ? (
        
        // EMPTY STATE
        <div className="card shadow-sm border-0 py-5 mt-4 text-center">
          <div className="card-body">
            <div className="mb-3">
              <i className="bi bi-folder2-open text-muted" style={{ fontSize: '4rem' }}></i>
            </div>
            <h4 className="fw-bold text-dark">Database Kosong</h4>
            <p className="text-muted mb-4">
              Belum ada data risiko tercatat untuk <strong>{semester}</strong>.<br />
              Silakan input data baru atau salin data dari semester sebelumnya.
            </p>
            
            <div className="d-flex justify-content-center gap-3">
              <a href="/input" className="btn btn-outline-primary px-4 fw-bold" style={{ borderRadius: '10px' }}>
                <i className="bi bi-plus-lg me-2"></i> Input Manual
              </a>
              <button 
                className="btn btn-primary px-4 fw-bold shadow-sm" 
                onClick={handleCopyData} 
                style={{ borderRadius: '10px' }}
              >
                <i className="bi bi-collection-fill me-2"></i> Salin dari Semester Lalu
              </button>
            </div>
          </div>
        </div>

      ) : (

        // TABEL DATA
        <div className="card-custom">
           <div className="mb-4 d-flex justify-content-between">
             <input
               type="text"
               className="form-control bg-light"
               style={{ maxWidth: '300px' }}
               placeholder="Cari ID atau Aset..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
             <div className="d-flex align-items-center gap-3">
               <div className="text-muted small">Total: {totalItems} Data</div>
               <select className="form-select form-select-sm" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                  <option value={10}>10 / halaman</option>
                  <option value={25}>25 / halaman</option>
                  <option value={50}>50 / halaman</option>
               </select>
             </div>
           </div>

           <div className="table-responsive" ref={tableRef}>
             <table className="table table-hover align-middle">
               <thead className="table-light">
                 <tr>
                   <th>Risk ID</th>
                   <th>Aset / Proses</th>
                   <th className="text-center" style={{ width: '340px' }}>Level</th>
                   <th className="text-center">Progress</th>
                   <th className="text-center">Status</th>
                   <th className="text-end">Aksi</th>
                 </tr>
               </thead>
               <tbody>
                  {pagedData.map((row) => {
                      const displayStatus = displayStatusForRow(row);
                      return (
                        <tr key={row.id}>
                          <td><span className="badge bg-white border border-primary text-primary">{row.risk_no}</span></td>
                          <td>
                            <div className="fw-bold text-dark">{row.risk_master?.aset}</div>
                            <small className="text-muted" style={{fontSize:'.75rem'}}>{row.risk_master?.klasifikasi_aset}</small>
                          </td>
                          <td className="align-middle" style={{minWidth:'340px'}}>
                             <div className="d-flex align-items-center">
                                <div style={{flex:1}}>
                                   <small className="text-muted d-block fw-bold mb-1">Inherent</small>
                                   <span className="badge d-block py-2 w-100" style={{...getBadgeStyle(row.level_risiko), borderRadius:'8px'}}>{row.level_risiko}</span>
                                </div>
                                <div className="mx-3" style={{width:'1px', height:'40px', background:'#e9ecef'}}></div>
                                <div style={{flex:1}}>
                                   <small className="text-muted d-block fw-bold mb-1 text-end">Residual</small>
                                   {String(row.terdapat_residual) === 'true' && row.rr !== null ? (
                                      <span className="badge d-block py-2 w-100" style={{...getBadgeStyle(getRiskLevel(Number(row.rr))), borderRadius:'8px'}}>{getRiskLevel(Number(row.rr))}</span>
                                   ) : (
                                      <span className="badge bg-light text-secondary border d-block py-2 w-100" style={{borderRadius:'8px'}}>-</span>
                                   )}
                                </div>
                             </div>
                          </td>
                          <td className="align-middle" style={{width:'150px'}}>
                             <div className="progress" style={{height:8}}>
                                <div className="progress-bar" style={{width:`${row.progress||0}%`, backgroundColor: (row.progress||0)===100?'#198754':'#0d6efd'}}></div>
                             </div>
                             <small className="fw-bold text-muted">{row.progress||0}%</small>
                          </td>
                          <td className="text-center">
                             <span className={`badge ${displayStatus==='Closed'?'bg-success':displayStatus==='On Going'?'bg-primary':'bg-warning text-dark'}`}>{displayStatus}</span>
                          </td>
                          <td className="text-end">
                             <div className="d-flex gap-2 justify-content-end">
                               <button className="btn btn-sm btn-light border text-info" onClick={() => setViewData(row)}><i className="bi bi-eye"></i></button>
                               <button className="btn btn-sm btn-light border text-warning" onClick={() => handleEditClick(row)}><i className="bi bi-pencil-square"></i></button>
                               <button className="btn btn-sm btn-light border text-danger" onClick={() => handleDelete(row.id, row.risk_no)}><i className="bi bi-trash"></i></button>
                             </div>
                          </td>
                        </tr>
                      );
                  })}
               </tbody>
             </table>
           </div>

           {/* Pagination Footer */}
           {totalItems > 0 && (
             <div className="d-flex align-items-center justify-content-between mt-3">
               <small className="text-muted">Menampilkan {startIndex + 1} - {endIndex} dari {totalItems} data</small>
               <nav>
                 <ul className="pagination mb-0">
                   <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}><button className="page-link" onClick={handlePrev}>Prev</button></li>
                   {getPageItems().map((p, idx) => (
                      <li key={idx} className={`page-item ${p === currentPage ? 'active' : ''} ${p==='...'?'disabled':''}`}>
                        <button className="page-link" onClick={() => typeof p === 'number' && goToPage(p)}>{p}</button>
                      </li>
                   ))}
                   <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}><button className="page-link" onClick={handleNext}>Next</button></li>
                 </ul>
               </nav>
             </div>
           )}
        </div>
      )}

      {/* MODAL VIEW & EDIT */}
      <ModalView data={viewData} onClose={() => setViewData(null)} />
      <ModalEdit data={editData} onChange={handleEditChange} onSubmit={handleUpdate} onClose={() => setEditData(null)} />
    </div>
  );
};

export default Database;