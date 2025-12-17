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

  // --- STATE MODAL COPY ---
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [sourceSemesterInput, setSourceSemesterInput] = useState('');
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

  // --- 2. LOGIKA COPY DATA ---
  const handleCopyData = () => {
    setSourceSemesterInput(''); 
    setTargetDateInput(new Date().toISOString().split('T')[0]);
    setShowCopyModal(true);
  };

  const executeCopy = async () => {
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User tidak terdeteksi. Silakan login ulang.");

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

        // Reset/Update Values
        semester: semester,
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

      showToast(`Berhasil menyalin ${newRows.length} data!`, 'success');
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
        if (name.includes('inherent')) {
            const ik = name === 'inherent_kemungkinan' ? Number(parsedVal) : Number(prev.inherent_kemungkinan);
            const id = name === 'inherent_dampak' ? Number(parsedVal) : Number(prev.inherent_dampak);
            next.inherent_ir = calculateRiskScore(ik, id);
            next.level_risiko = getRiskLevel(next.inherent_ir);
        }
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

  // --- EXPORT EXCEL (KODE LENGKAP DIPULIHKAN) ---
  // --- EXPORT EXCEL DENGAN WARNA ---
  const exportToExcel = async () => {
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Register Risiko');

      // 1. JUDUL & HEADER (SAMA SEPERTI SEBELUMNYA)
      ws.mergeCells('C3:U3');
      ws.getCell('C3').value = 'REGISTER RISIKO KEAMANAN INFORMASI (ASET: PERANGKAT LUNAK)';
      ws.getCell('C3').alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getCell('C3').font = { bold: true, size: 14 };

      // Header Baris 4
      ws.mergeCells('C4:H4'); ws.getCell('C4').value = 'Identifikasi Risiko';
      ws.mergeCells('A4:A5'); ws.getCell('A4').value = 'Risk No';
      ws.mergeCells('B4:B5'); ws.getCell('B4').value = 'Jenis Risiko';
      ws.mergeCells('I4:I5'); ws.getCell('I4').value = 'Kontrol Saat Ini';
      ws.mergeCells('U4:U5'); ws.getCell('U4').value = 'Apakah Terdapat Residual Risk';
      ws.mergeCells('Y4:Y5'); ws.getCell('Y4').value = 'Status';
      ws.mergeCells('Z4:Z5'); ws.getCell('Z4').value = 'Rencana Kontrol Tambahan';
      ws.mergeCells('AA4:AA5'); ws.getCell('AA4').value = 'Risk Owner';

      ws.mergeCells('J4:M4'); ws.getCell('J4').value = 'Nilai Resiko Bawaan (Inherent Risk)';
      ws.mergeCells('N4:O4'); ws.getCell('N4').value = 'Evaluasi Risiko';
      ws.mergeCells('P4:T4'); ws.getCell('P4').value = 'Rencana Penanganan Risiko';
      ws.mergeCells('V4:X4'); ws.getCell('V4').value = 'Residual Risk';

      // Header Baris 5
      ws.getCell('C5').value = 'Aset';
      ws.getCell('D5').value = 'Ancaman';
      ws.getCell('E5').value = 'Kerawanan/Kelemahan';
      ws.getCell('F5').value = 'Kategori';
      ws.getCell('G5').value = 'Dampak';
      ws.getCell('H5').value = 'Area Dampak';

      ws.getCell('J5').value = 'Dampak';
      ws.getCell('K5').value = 'Kemungkinan';
      ws.getCell('L5').value = 'IR';
      ws.getCell('M5').value = 'Level Risiko';

      ws.getCell('N5').value = 'Keputusan Penanganan Risiko';
      ws.getCell('O5').value = 'Prioritas Risiko';

      ws.getCell('P5').value = 'Opsi Penanganan';
      ws.getCell('Q5').value = 'Rencana Aksi Penanganan Risiko';
      ws.getCell('R5').value = 'Keluaran';
      ws.getCell('S5').value = 'Target/Jadwal Implementasi';
      ws.getCell('T5').value = 'Penanggung Jawab';

      ws.getCell('V5').value = 'Dampak';
      ws.getCell('W5').value = 'Kemungkinan';
      ws.getCell('X5').value = 'RR';

      // Styling Header (Biru)
      const headerCells = [
        'A4','A5','B4','B5','C4','C5','D5','E5','F5','G5','H5',
        'I4','I5','J4','J5','K5','L5','M5','N4','N5','O5',
        'P4','P5','Q5','R5','S5','T5','U4','U5',
        'V4','V5','W5','X5','Y4','Y5','Z4','Z5','AA4','AA5'
      ];

      headerCells.forEach(addr => {
        const cell = ws.getCell(addr);
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B5394' } };
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
      });

      // Warna khusus Header Group
      ws.getCell('C4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC00000' } }; // Merah Identifikasi
      ws.getCell('P4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B050' } }; // Hijau Penanganan

      // Lebar Kolom
      ws.columns = [
        { key: 'risk_no', width: 10 }, { key: 'jenis', width: 12 },
        { key: 'aset', width: 25 }, { key: 'ancaman', width: 22 },
        { key: 'kerawanan', width: 26 }, { key: 'kategori', width: 20 },
        { key: 'dampak', width: 22 }, { key: 'area', width: 18 },
        { key: 'kontrol', width: 22 }, 
        
        // Inherent Columns (J, K, L, M)
        { key: 'idampak', width: 10 }, { key: 'ikem', width: 14 }, { key: 'ir', width: 8 }, { key: 'ilevel', width: 15 }, 
        
        { key: 'keputusan', width: 18 }, { key: 'prio', width: 10 }, 
        { key: 'opsi', width: 16 }, { key: 'rencana', width: 26 }, 
        { key: 'keluaran', width: 18 }, { key: 'target', width: 18 }, 
        { key: 'pic', width: 16 }, { key: 'adaRes', width: 16 }, 
        
        // Residual Columns (V, W, X)
        { key: 'rdampak', width: 10 }, { key: 'rkem', width: 14 }, { key: 'rr', width: 8 }, 
        
        { key: 'status', width: 14 }, { key: 'rkontrol', width: 20 }, { key: 'owner', width: 16 }
      ];

      // --- HELPER UNTUK KONVERSI WARNA ---
      const applyRiskColor = (rowObj, level, columnsToColor) => {
        // Ambil style (background & text color) dari helper yang sudah ada
        const style = getBadgeStyle(level);
        
        // Konversi Hex (#ffffff) ke ARGB (FFffffff) untuk ExcelJS
        const bgArgb = 'FF' + style.backgroundColor.replace('#', '');
        const textArgb = 'FF' + style.color.replace('#', '');

        columnsToColor.forEach(colKey => {
          const cell = rowObj.getCell(colKey);
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgArgb }
          };
          cell.font = {
            color: { argb: textArgb },
            bold: true
          };
          cell.alignment = { horizontal: 'center', vertical: 'top', wrapText: true };
        });
      };

      // 4. ISI DATA
      risks.forEach(row => {
        const master = row.risk_master || {};
        
        // Tambahkan baris data
        const newRow = ws.addRow({
          risk_no: row.risk_no,
          jenis: master.jenis_risiko || row.jenis_risiko,
          aset: master.aset,
          ancaman: row.ancaman,
          kerawanan: row.kerawanan,
          kategori: master.kategori,
          dampak: row.dampak_identifikasi,
          area: row.area_dampak,
          kontrol: row.kontrol_saat_ini,
          
          // INHERENT
          idampak: row.inherent_dampak,
          ikem: row.inherent_kemungkinan,
          ir: row.inherent_ir,
          ilevel: row.level_risiko,
          
          keputusan: row.keputusan_penanganan,
          prio: row.prioritas_risiko,
          opsi: row.opsi_penanganan,
          rencana: row.rencana_aksi,
          keluaran: row.keluaran,
          target: row.target_jadwal,
          pic: row.penanggung_jawab,
          adaRes: String(row.terdapat_residual) === 'false' ? 'Tidak' : 'Ya',
          
          // RESIDUAL
          rdampak: row.residual_dampak,
          rkem: row.residual_kemungkinan,
          rr: row.rr,
          
          status: row.status,
          rkontrol: row.rencana_kontrol_tambahan,
          owner: row.risk_owner,
        });

        // === LOGIKA PEWARNAAN OTOMATIS ===
        
        // 1. Warnai Kolom Inherent (Dampak, Kemungkinan, IR, Level)
        // Warna berdasarkan Level Inherent
        applyRiskColor(newRow, row.level_risiko, ['idampak', 'ikem', 'ir', 'ilevel']);

        // 2. Warnai Kolom Residual (Dampak, Kemungkinan, RR)
        // Hitung level residual dulu karena di DB mungkin hanya angka
        if (String(row.terdapat_residual) === 'true' && row.rr !== null) {
           const resLevel = getRiskLevel(Number(row.rr)); // Pakai helper yang sudah ada
           applyRiskColor(newRow, resLevel, ['rdampak', 'rkem', 'rr']);
        }
      });

      // Border Data untuk semua sel
      const startRow = 6;
      const lastRow = ws.lastRow.number;
      if (lastRow >= startRow) {
          for (let r = startRow; r <= lastRow; r++) {
            ws.getRow(r).eachCell(cell => {
              // Pertahankan fill color jika sudah ada (dari logika pewarnaan di atas)
              const existingFill = cell.fill;
              const existingFont = cell.font;
              
              cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
              cell.alignment = cell.alignment || { vertical: 'top', wrapText: true }; // Keep existing alignment if set
              
              if(existingFill) cell.fill = existingFill;
              if(existingFont) cell.font = existingFont;
            });
          }
      }

      // 5. DOWNLOAD
      const buf = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buf]), `Register Risiko ${semester}.xlsx`);
    } catch (err) {
      console.error('Export Excel error:', err);
      alert('Gagal membuat file Excel.');
    }
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