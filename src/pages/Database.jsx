// src/pages/Database.jsx
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { calculateRiskScore, getRiskLevel, getBadgeStyle } from '../utils/riskHelpers';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';




const Database = ({ semester }) => {
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // --- STATE MODAL / EDIT / VIEW ---
  const [viewData, setViewData] = useState(null);
  const [editData, setEditData] = useState(null);

  // TOAST (non-blocking notification)
  const [toast, setToast] = useState({
    show: false,
    message: '',
    variant: 'success', // 'success' | 'danger' | 'warning' | 'info'
  });

  // Confirm Delete Modal state
  const [confirmDelete, setConfirmDelete] = useState({
    show: false,
    id: null,
    label: '',
  });

  const tableRef = useRef(null);

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

  // 1. FETCH DATA
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
        .select(`
          *,
          risk_master (
            aset,
            klasifikasi_aset,
            kategori,
            jenis_risiko,
            risk_no
          )
        `)
        .eq('semester', semester)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching risks:', error);
        setRisks([]);
        showToast('Gagal memuat data.', 'danger');
      } else {
        setRisks(data || []);
      }
    } catch (err) {
      console.error(err);
      setRisks([]);
      showToast('Terjadi kesalahan saat memuat data.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // 2. HAPUS DATA -> confirm modal + performDelete
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

      if (error) {
        throw error;
      }

      showToast('Data berhasil dihapus.', 'success');
      setConfirmDelete({ show: false, id: null, label: '' });
      fetchRisks();
    } catch (error) {
      console.error('Delete error:', error);
      showToast('Gagal menghapus: ' + (error?.message || String(error)), 'danger', 8000);
      setConfirmDelete({ show: false, id: null, label: '' });
    }
  };

  // 3. PERSIAPAN EDIT (Flatten Data)
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
      inherent_ir: row.inherent_ir ?? calculateRiskScore(row.inherent_kemungkinan || 1, row.inherent_dampak || 1),
      residual_kemungkinan: row.residual_kemungkinan ?? 1,
      residual_dampak: row.residual_dampak ?? 1,
      rr: row.rr ?? (row.terdapat_residual ? calculateRiskScore(row.residual_kemungkinan || 1, row.residual_dampak || 1) : 0),
      terdapat_residual: Boolean(row.terdapat_residual),
      status: row.status || getStatusFromProgress(row.progress)
    });
  };

  // --- LOGIKA UPDATE STATE SAAT EDIT (OTOMATISASI STATUS + live calc) ---
  const handleEditChange = (e) => {
    const target = e?.target ?? e;
    const { name, value } = target;

    const numericFields = [
      'inherent_kemungkinan',
      'inherent_dampak',
      'residual_kemungkinan',
      'residual_dampak',
      'progress'
    ];

    if (name === 'terdapat_residual') {
      const valBool = value === 'true' || value === true;
      setEditData(prev => ({
        ...prev,
        [name]: valBool,
        ...(valBool ? {} : { residual_kemungkinan: 1, residual_dampak: 1, rr: 0 })
      }));
      return;
    }

    let parsedVal = value;
    if (numericFields.includes(name)) {
      parsedVal = value === '' ? '' : parseInt(value, 10);
      if (Number.isNaN(parsedVal)) parsedVal = 0;

      if (['inherent_kemungkinan','inherent_dampak','residual_kemungkinan','residual_dampak'].includes(name)) {
        if (parsedVal === '') {
          parsedVal = '';
        } else {
          parsedVal = Math.max(1, Math.min(5, parsedVal));
        }
      }

      if (name === 'progress') {
        parsedVal = Math.max(0, Math.min(100, parsedVal));
      }
    }

    setEditData(prev => {
      const next = { ...prev, [name]: parsedVal };

      if (['inherent_kemungkinan', 'inherent_dampak'].includes(name)) {
        const ik = Number(next.inherent_kemungkinan) || 1;
        const id = Number(next.inherent_dampak) || 1;
        const newIR = calculateRiskScore(ik, id);
        next.inherent_ir = newIR;
        next.level_risiko = getRiskLevel(newIR);
      }

      if (['residual_kemungkinan', 'residual_dampak'].includes(name) || name === 'terdapat_residual') {
        const isRes = String(next.terdapat_residual) === 'true' || next.terdapat_residual === true;
        if (isRes) {
          const rk = Number(next.residual_kemungkinan) || 1;
          const rd = Number(next.residual_dampak) || 1;
          next.rr = calculateRiskScore(rk, rd);
        } else {
          next.rr = 0;
        }
      }

      if (name === 'progress') {
        const p = Number(parsedVal) || 0;
        next.status = getStatusFromProgress(p);
      }

      return next;
    });
  };

  // 4. UPDATE DATA
  const handleUpdate = async (e) => {
    e.preventDefault();

    if (!editData) return;

    const newInherentIR = calculateRiskScore(editData.inherent_kemungkinan, editData.inherent_dampak);
    const newLevel = getRiskLevel(newInherentIR);

    let newRR = 0;
    const isResidual = String(editData.terdapat_residual) === 'true' || editData.terdapat_residual === true;

    if (isResidual) {
      newRR = calculateRiskScore(editData.residual_kemungkinan, editData.residual_dampak);
    }

    const progressInt = parseInt(editData.progress) || 0;

    const historyPayload = {
      ancaman: editData.ancaman,
      kerawanan: editData.kerawanan,
      dampak_identifikasi: editData.dampak_identifikasi,
      area_dampak: editData.area_dampak,
      kontrol_saat_ini: editData.kontrol_saat_ini,

      inherent_kemungkinan: editData.inherent_kemungkinan,
      inherent_dampak: editData.inherent_dampak,
      inherent_ir: newInherentIR,
      level_risiko: newLevel,

      terdapat_residual: isResidual,
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
      const { error: errHist } = await supabase
        .from('risk_history')
        .update(historyPayload)
        .eq('id', editData.id);

      if (errHist) throw errHist;

      const { error: errMast } = await supabase
        .from('risk_master')
        .update(masterPayload)
        .eq('risk_no', editData.risk_no);

      if (errMast) throw errMast;

      showToast('Data berhasil diperbarui!', 'success');

      setEditData(null);
      fetchRisks();
    } catch (error) {
      const msg = error?.message || String(error) || 'Gagal update';
      showToast('Gagal update: ' + msg, 'danger', 6000);
      console.error('Update error:', error);
    }
  };

  // Filter Search
  const filteredData = risks.filter(item =>
    (item.risk_master?.aset || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.risk_no || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // === Pagination logic ===
  const totalItems = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(totalItems, startIndex + pageSize);
  const pagedData = filteredData.slice(startIndex, endIndex);

  const goToPage = (p) => {
    const page = Math.max(1, Math.min(totalPages, p));
    setCurrentPage(page);
    setTimeout(() => {
      if (tableRef.current) {
        tableRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 80);
  };

  const handlePrev = () => goToPage(currentPage - 1);
  const handleNext = () => goToPage(currentPage + 1);

  const getPageItems = () => {
    const pages = [];
    const delta = 2;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }
    return pages;
  };

  const displayStatusForRow = (row) => {
    const p = Number(row.progress);
    if (!Number.isNaN(p)) return getStatusFromProgress(p);
    return row.status || 'Open';
  };

  // === EXPORT KE TEMPLATE EXCEL BSSN ===
// taruh di dalam komponen Database, sebelum `return ( ... )`
const exportToExcel = async () => {
  try {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Register Risiko');

    // =======================
    // 1. JUDUL ATAS
    // =======================
    ws.mergeCells('C3:U3');
    ws.getCell('C3').value =
      'REGISTER RISIKO KEAMANAN INFORMASI (ASET: PERANGKAT LUNAK)';
    ws.getCell('C3').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    ws.getCell('C3').font = { bold: true, size: 14 };

    // =======================
    // 2. HEADER MERGED BARIS 4–5
    // =======================

    // --- Kelompok Identifikasi Risiko ---
    ws.mergeCells('C4:H4');
    ws.getCell('C4').value = 'Identifikasi Risiko';

    // --- Kolom tunggal yang merge vertikal 4–5 ---
    ws.mergeCells('A4:A5'); // Risk No
    ws.mergeCells('B4:B5'); // Jenis Risiko
    ws.mergeCells('I4:I5'); // Kontrol Saat Ini
    ws.mergeCells('U4:U5'); // Apakah Terdapat Residual Risk
    ws.mergeCells('Y4:Y5'); // Status
    ws.mergeCells('Z4:Z5'); // Rencana Kontrol Tambahan
    ws.mergeCells('AA4:AA5'); // Risk Owner

    ws.getCell('A4').value = 'Risk No';
    ws.getCell('B4').value = 'Jenis Risiko';
    ws.getCell('I4').value = 'Kontrol Saat Ini';
    ws.getCell('U4').value = 'Apakah Terdapat Residual Risk';
    ws.getCell('Y4').value = 'Status';
    ws.getCell('Z4').value = 'Rencana Kontrol Tambahan';
    ws.getCell('AA4').value = 'Risk Owner';

    // --- Grup Nilai Risiko Bawaan (Inherent Risk) ---
    ws.mergeCells('J4:M4');
    ws.getCell('J4').value = 'Nilai Resiko Bawaan (Inherent Risk)';

    // --- Grup Evaluasi Risiko ---
    ws.mergeCells('N4:O4');
    ws.getCell('N4').value = 'Evaluasi Risiko';

    // --- Grup Rencana Penanganan Risiko ---
    ws.mergeCells('P4:T4');
    ws.getCell('P4').value = 'Rencana Penanganan Risiko';

    // --- Grup Residual Risk ---
    ws.mergeCells('V4:X4');
    ws.getCell('V4').value = 'Residual Risk';

    // =======================
    // 3. LABEL KOLOM (BARIS 5)
    // =======================
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

    // =======================
    // 4. STYLING HEADER
    // =======================

    // warna dasar biru untuk header 4–5
    const headerCells = [
      'A4','A5','B4','B5','C4','C5','D5','E5','F5','G5','H5',
      'I4','I5',
      'J4','J5','K5','L5','M5',
      'N4','N5','O5',
      'P4','P5','Q5','R5','S5','T5',
      'U4','U5',
      'V4','V5','W5','X5',
      'Y4','Y5','Z4','Z5','AA4','AA5'
    ];

    headerCells.forEach(addr => {
      const cell = ws.getCell(addr);
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0B5394' }, // biru
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // warna merah untuk "Identifikasi Risiko"
    ws.getCell('C4').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFC00000' },
    };

    // warna hijau untuk "Rencana Penanganan Risiko"
    ws.getCell('P4').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF00B050' },
    };

    // =======================
    // 5. LEBAR KOLOM
    // =======================
    ws.columns = [
      { key: 'risk_no', width: 10 },     // A
      { key: 'jenis', width: 12 },       // B
      { key: 'aset', width: 25 },        // C
      { key: 'ancaman', width: 22 },     // D
      { key: 'kerawanan', width: 26 },   // E
      { key: 'kategori', width: 20 },    // F
      { key: 'dampak', width: 22 },      // G
      { key: 'area', width: 18 },        // H
      { key: 'kontrol', width: 22 },     // I
      { key: 'idampak', width: 10 },     // J
      { key: 'ikem', width: 14 },        // K
      { key: 'ir', width: 6 },           // L
      { key: 'ilevel', width: 15 },      // M
      { key: 'keputusan', width: 18 },   // N
      { key: 'prio', width: 10 },        // O
      { key: 'opsi', width: 16 },        // P
      { key: 'rencana', width: 26 },     // Q
      { key: 'keluaran', width: 18 },    // R
      { key: 'target', width: 18 },      // S
      { key: 'pic', width: 16 },         // T
      { key: 'adaRes', width: 16 },      // U
      { key: 'rdampak', width: 10 },     // V
      { key: 'rkem', width: 14 },        // W
      { key: 'rr', width: 8 },           // X
      { key: 'status', width: 14 },      // Y
      { key: 'rkontrol', width: 20 },    // Z
      { key: 'owner', width: 16 },       // AA
    ];

    // =======================
    // 6. ISI DATA (mulai baris 6)
    // =======================
    risks.forEach(row => {
      const master = row.risk_master || {};
      ws.addRow({
        risk_no: row.risk_no,
        jenis: master.jenis_risiko || row.jenis_risiko,
        aset: master.aset,
        ancaman: row.ancaman,
        kerawanan: row.kerawanan,
        kategori: master.kategori,
        dampak: row.dampak_identifikasi,
        area: row.area_dampak,
        kontrol: row.kontrol_saat_ini,
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
        adaRes:
          String(row.terdapat_residual) === 'false' ? 'Tidak' : 'Ya',
        rdampak: row.residual_dampak,
        rkem: row.residual_kemungkinan,
        rr: row.rr,
        status: row.status,
        rkontrol: row.rencana_kontrol_tambahan,
        owner: row.risk_owner,
      });
    });

    // border untuk semua data baris 6 ke bawah
    const startRow = 6;
    const lastRow = ws.lastRow.number;
    for (let r = startRow; r <= lastRow; r++) {
      ws.getRow(r).eachCell(cell => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
        cell.alignment = { vertical: 'top', wrapText: true };
      });
    }

    // =======================
    // 7. DOWNLOAD
    // =======================
    const buf = await wb.xlsx.writeBuffer();
    const fileName = `Register Risiko Semester ${semester}.xlsx`;
    saveAs(new Blob([buf]), fileName);
  } catch (err) {
    console.error('Export Excel error:', err);
    alert('Gagal membuat file Excel. Coba lagi atau cek console browser.');
  }
};


  return (
    <div className="container-fluid p-0">
      {/* --- Toast Notifikasi --- */}
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 2000 }}>
        {toast.show && (
          <div className={`alert alert-${toast.variant} shadow-sm`} role="alert" style={{ minWidth: 260 }}>
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <strong className="me-1">
                  {toast.variant === 'success' ? 'Sukses' : toast.variant === 'danger' ? 'Error' : 'Info'}
                </strong>
                <div style={{ fontSize: '0.9rem' }}>{toast.message}</div>
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={() => setToast(prev => ({ ...prev, show: false }))}
              />
            </div>
          </div>
        )}
      </div>

      {/* Confirm Delete Modal */}
      {confirmDelete.show && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="modal-dialog modal-sm modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h6 className="modal-title">Konfirmasi Hapus</h6>
                <button
                  className="btn-close"
                  onClick={() => setConfirmDelete({ show: false, id: null, label: '' })}
                />
              </div>
              <div className="modal-body">
                <p className="mb-0">
                  Yakin ingin menghapus riwayat risiko <strong>{confirmDelete.label || confirmDelete.id}</strong> ?
                </p>
                <small className="text-muted">Aksi ini tidak dapat dibatalkan.</small>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setConfirmDelete({ show: false, id: null, label: '' })}
                >
                  Batal
                </button>
                <button className="btn btn-danger" onClick={performDelete}>
                  Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold text-dark m-0">Database Risiko</h3>
          <small className="text-muted">
            Semester: <strong>{semester}</strong>
          </small>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-success shadow-sm" onClick={exportToExcel}>
            <i className="bi bi-file-earmark-excel me-1"></i> Export Template
          </button>
          <button className="btn btn-light shadow-sm border" onClick={fetchRisks}>
            <i className="bi bi-arrow-clockwise text-primary"></i> Refresh
          </button>
        </div>
      </div>

      {/* CARD TABEL UTAMA */}
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
            <div className="text-muted small align-self-center">Total: {totalItems} Data</div>
            <div>
              <select
                className="form-select form-select-sm"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value={10}>10 / halaman</option>
                <option value={25}>25 / halaman</option>
                <option value={50}>50 / halaman</option>
              </select>
            </div>
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
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-5">
                    Memuat...
                  </td>
                </tr>
              ) : totalItems === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-5 text-muted">
                    Belum ada data.
                  </td>
                </tr>
              ) : (
                pagedData.map((row) => {
                  const displayStatus = displayStatusForRow(row);
                  return (
                    <tr key={row.id}>
                      <td>
                        <span className="badge bg-white border border-primary text-primary">
                          {row.risk_no}
                        </span>
                      </td>

                      <td>
                        <div className="fw-bold text-dark">
                          {row.risk_master?.aset || <em className="text-danger">Aset Terhapus</em>}
                        </div>
                        <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                          {row.risk_master?.klasifikasi_aset || '-'}
                        </small>
                      </td>

                      <td className="align-middle" style={{ minWidth: '340px' }}>
                        <div className="d-flex align-items-center">
                          <div style={{ flex: 1 }}>
                            <small
                              className="text-muted d-block fw-bold mb-1"
                              style={{ fontSize: '0.65rem', paddingLeft: '4px' }}
                            >
                              Inherent
                            </small>
                            <span
                              className="badge d-block py-2 w-100"
                              style={{
                                ...getBadgeStyle(row.level_risiko),
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                borderRadius: '8px',
                              }}
                            >
                              {row.level_risiko ?? '-'}
                            </span>
                          </div>
                          <div
                            className="mx-3"
                            style={{ width: '1px', height: '40px', background: '#e9ecef' }}
                          />
                          <div style={{ flex: 1 }}>
                            <small
                              className="text-muted d-block fw-bold mb-1 text-end"
                              style={{ fontSize: '0.65rem', paddingRight: '4px' }}
                            >
                              Residual
                            </small>
                            {String(row.terdapat_residual) === 'true' && row.rr !== null ? (
                              <span
                                className="badge d-block py-2 w-100"
                                style={{
                                  ...getBadgeStyle(getRiskLevel(Number(row.rr))),
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  borderRadius: '8px',
                                }}
                              >
                                {getRiskLevel(Number(row.rr))}
                              </span>
                            ) : (
                              <span
                                className="badge bg-light text-secondary border d-block py-2 w-100"
                                style={{ fontSize: '0.75rem', borderRadius: '8px' }}
                              >
                                -
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="align-middle" style={{ width: '150px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                          <div
                            className="progress flex-grow-1"
                            style={{ height: 8, backgroundColor: '#eff4fb', minWidth: 0 }}
                          >
                            <div
                              className="progress-bar"
                              role="progressbar"
                              style={{
                                width: `${row.progress || 0}%`,
                                height: '100%',
                                backgroundColor:
                                  (row.progress || 0) === 100 ? '#198754' : '#0d6efd',
                              }}
                            />
                          </div>
                          <small
                            className="fw-bold text-muted"
                            style={{ fontSize: '0.7rem', lineHeight: 1, alignSelf: 'center' }}
                          >
                            {row.progress || 0}%
                          </small>
                        </div>
                      </td>

                      <td className="text-center align-middle">
                        <span
                          className={`badge ${
                            displayStatus === 'Closed'
                              ? 'bg-success'
                              : displayStatus === 'On Going'
                              ? 'bg-primary text-white'
                              : 'bg-warning text-dark'
                          }`}
                        >
                          {displayStatus}
                        </span>
                      </td>

                      <td className="text-end align-middle">
                        <div className="d-flex gap-2 justify-content-end">
                          <button
                            className="btn btn-sm btn-light border text-info"
                            onClick={() => setViewData(row)}
                            title="Detail"
                          >
                            <i className="bi bi-eye"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-light border text-warning"
                            onClick={() => handleEditClick(row)}
                            title="Edit"
                          >
                            <i className="bi bi-pencil-square"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-light border text-danger"
                            onClick={() => handleDelete(row.id, row.risk_no)}
                            title="Hapus"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        {totalItems > 0 && (
          <div className="d-flex align-items-center justify-content-between mt-3">
            <div>
              <small className="text-muted">
                Menampilkan {startIndex + 1} - {endIndex} dari {totalItems} data
              </small>
            </div>

            <nav>
              <ul className="pagination mb-0">
                <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={handlePrev}>
                    Prev
                  </button>
                </li>
                {getPageItems().map((p, idx) =>
                  p === '...' ? (
                    <li key={`dots-${idx}`} className="page-item disabled">
                      <span className="page-link">…</span>
                    </li>
                  ) : (
                    <li
                      key={p}
                      className={`page-item ${p === currentPage ? 'active' : ''}`}
                    >
                      <button className="page-link" onClick={() => goToPage(p)}>
                        {p}
                      </button>
                    </li>
                  )
                )}
                <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={handleNext}>
                    Next
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        )}
      </div>

      {/* MODAL VIEW */}
      {viewData && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-shield-lock me-2"></i>Detail Risiko: {viewData.risk_no}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setViewData(null)}
                ></button>
              </div>
              <div className="modal-body bg-light">
                <div className="row g-4">
                  <div className="col-lg-8">
                    <div className="card border-0 shadow-sm mb-3">
                      <div className="card-body">
                        <h6 className="fw-bold text-primary mb-3 border-bottom pb-2">
                          1. Identifikasi Aset & Risiko
                        </h6>
                        <table className="table table-sm table-borderless mb-0">
                          <tbody>
                            <tr>
                              <td className="text-muted w-25">Nama Aset</td>
                              <td className="fw-bold text-dark">
                                {viewData.risk_master?.aset}
                              </td>
                            </tr>
                            <tr>
                              <td className="text-muted">Klasifikasi</td>
                              <td>{viewData.risk_master?.klasifikasi_aset}</td>
                            </tr>
                            <tr>
                              <td className="text-muted">Jenis Risiko</td>
                              <td>{viewData.risk_master?.jenis_risiko}</td>
                            </tr>
                            <tr>
                              <td className="text-muted">Kategori</td>
                              <td>{viewData.risk_master?.kategori}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="card border-0 shadow-sm mb-3">
                      <div className="card-body">
                        <h6 className="fw-bold text-primary mb-3 border-bottom pb-2">
                          2. Analisa & Dampak
                        </h6>
                        <div className="row g-3">
                          <div className="col-12">
                            <label className="small text-muted fw-bold">ANCAMAN</label>
                            <div className="bg-light p-2 rounded border">
                              {viewData.ancaman}
                            </div>
                          </div>
                          <div className="col-12">
                            <label className="small text-muted fw-bold">KERAWANAN</label>
                            <div className="bg-light p-2 rounded border">
                              {viewData.kerawanan}
                            </div>
                          </div>
                          <div className="col-md-12">
                            <label className="small text-muted fw-bold">URAIAN DAMPAK</label>
                            <p className="mb-1">{viewData.dampak_identifikasi}</p>
                          </div>
                          <div className="col-md-6">
                            <label className="small text-muted fw-bold">AREA DAMPAK</label>
                            <p className="mb-0 fw-bold">{viewData.area_dampak}</p>
                          </div>
                          <div className="col-md-6">
                            <label className="small text-muted fw-bold">KONTROL SAAT INI</label>
                            <p className="mb-0">
                              {viewData.kontrol_saat_ini || '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                      className="card border-0 shadow-sm"
                      style={{ borderLeft: '4px solid #198754' }}
                    >
                      <div className="card-body">
                        <h6 className="fw-bold text-success mb-3">4. Rencana Penanganan</h6>
                        <div className="mb-3">
                          <label className="form-label small fw-bold d-block mb-1">
                            REALISASI PROGRESS
                          </label>
                          <div className="d-flex align-items-center gap-2">
                            <div
                              className="progress w-100"
                              style={{ height: 10, backgroundColor: '#eff4fb' }}
                            >
                              <div
                                className="progress-bar bg-success"
                                style={{ width: `${viewData.progress || 0}%` }}
                              ></div>
                            </div>
                            <span className="fw-bold text-success">
                              {viewData.progress || 0}%
                            </span>
                          </div>
                        </div>
                        <table className="table table-sm table-borderless mb-0">
                          <tbody>
                            <tr>
                              <td className="text-muted w-25">Rencana Aksi</td>
                              <td className="fw-bold">{viewData.rencana_aksi}</td>
                            </tr>
                            <tr>
                              <td className="text-muted">Opsi</td>
                              <td>{viewData.opsi_penanganan}</td>
                            </tr>
                            <tr>
                              <td className="text-muted">Target Jadwal</td>
                              <td>{viewData.target_jadwal}</td>
                            </tr>
                            <tr>
                              <td className="text-muted">PIC</td>
                              <td>{viewData.penanggung_jawab}</td>
                            </tr>
                            <tr>
                              <td className="text-muted">Output</td>
                              <td>{viewData.keluaran}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div className="col-lg-4">
                    <div className="card border-0 shadow-sm mb-3 text-center border-start border-4 border-warning">
                      <div className="card-body bg-warning bg-opacity-10">
                        <small className="text-muted fw-bold">
                          LEVEL AWAL (Inherent)
                        </small>
                        <h1 className="display-4 fw-bold my-0 text-dark">
                          {viewData.inherent_ir}
                        </h1>
                        <span
                          className="badge px-3 mb-2"
                          style={getBadgeStyle(
                            getRiskLevel(Number(viewData.inherent_ir))
                          )}
                        >
                          {getRiskLevel(Number(viewData.inherent_ir)) ||
                            viewData.level_risiko ||
                            '-'}
                        </span>
                      </div>
                    </div>

                    <div className="card border-0 shadow-sm mb-3 text-center border-start border-4 border-success">
                      <div className="card-body bg-success bg-opacity-10">
                        <small className="text-muted fw-bold">
                          LEVEL SISA (Residual)
                        </small>
                        <h1 className="display-4 fw-bold my-0 text-dark">
                          {viewData.rr || 0}
                        </h1>
                        <span
                          className="badge px-3 mb-2"
                          style={getBadgeStyle(
                            getRiskLevel(Number(viewData.rr))
                          )}
                        >
                          {getRiskLevel(Number(viewData.rr)) ||
                            (viewData.terdapat_residual
                              ? 'Masih Ada Risiko'
                              : 'Risiko Hilang')}
                        </span>
                      </div>
                    </div>

                    <div className="card border-0 shadow-sm bg-primary text-white">
                      <div className="card-body text-center">
                        <h6 className="m-0">
                          Status:{' '}
                          <strong>{displayStatusForRow(viewData)}</strong>
                        </h6>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setViewData(null)}>
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT */}
      {editData && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header bg-warning text-dark">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-pencil-square me-2"></i>Edit Data: {editData.risk_no}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setEditData(null)}
                ></button>
              </div>
              <div className="modal-body p-4 bg-light">
                <form id="formEdit" onSubmit={handleUpdate}>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <div className="card p-3 border-0 shadow-sm h-100">
                        <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">
                          Identitas Aset
                        </h6>
                        <div className="mb-2">
                          <label className="form-label small">Nama Aset</label>
                          <input
                            type="text"
                            className="form-control"
                            name="aset"
                            value={editData.aset || ''}
                            onChange={handleEditChange}
                          />
                        </div>

                        <div className="row g-2">
                          <div className="col-6">
                            <label className="form-label small">Klasifikasi</label>
                            <select
                              className="form-select"
                              name="klasifikasi_aset"
                              value={editData.klasifikasi_aset || ''}
                              onChange={handleEditChange}
                            >
                              <option>Data dan Informasi</option>
                              <option>Perangkat Lunak</option>
                              <option>Perangkat Keras</option>
                              <option>Sarana Pendukung</option>
                              <option>SDM & Pihak Ketiga</option>
                            </select>
                          </div>
                          <div className="col-6">
                            <label className="form-label small">Jenis Risiko</label>
                            <select
                              className="form-select"
                              name="jenis_risiko"
                              value={editData.jenis_risiko || ''}
                              onChange={handleEditChange}
                            >
                              <option>Negatif</option>
                              <option>Positif</option>
                            </select>
                          </div>
                          <div className="col-12 mt-2">
                            <label className="form-label small">Kategori (SPBE)</label>
                            <select
                              className="form-select"
                              name="kategori"
                              value={editData.kategori || ''}
                              onChange={handleEditChange}
                            >
                              <option>Penyalahgunaan Kontrol Akses</option>
                              <option>Pencurian Data Pribadi</option>
                              <option>Insiden Web Defacement</option>
                              <option>Keamanan Cloud Service</option>
                              <option>Keamanan Infrastruktur</option>
                              <option>Ketidaksesuaian Pengelolaan Aplikasi</option>
                              <option>
                                Kesalahan Pengelolaan Data dan Informasi Terbatas
                              </option>
                              <option>Kesalahan Pengelolaan SDM</option>
                              <option>Kesalahan Pengelolaan Aset</option>
                              <option>Kesalahan Pengelolaan Pihak Ketiga</option>
                              <option>Terganggunya Keberlangsungan Layanan</option>
                              <option>Insiden Serangan Malware</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="col-md-6">
                      <div className="card p-3 border-0 shadow-sm h-100">
                        <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">
                          Analisa Risiko
                        </h6>
                        <div className="mb-2">
                          <label className="form-label small">Ancaman</label>
                          <textarea
                            className="form-control"
                            rows="2"
                            name="ancaman"
                            value={editData.ancaman || ''}
                            onChange={handleEditChange}
                          ></textarea>
                        </div>
                        <div className="mb-2">
                          <label className="form-label small">Kerawanan</label>
                          <textarea
                            className="form-control"
                            rows="2"
                            name="kerawanan"
                            value={editData.kerawanan || ''}
                            onChange={handleEditChange}
                          ></textarea>
                        </div>
                        <div className="mb-2">
                          <label className="form-label small">Dampak</label>
                          <textarea
                            className="form-control"
                            rows="2"
                            name="dampak_identifikasi"
                            value={editData.dampak_identifikasi || ''}
                            onChange={handleEditChange}
                          ></textarea>
                        </div>
                      </div>
                    </div>

                    {/* Analisa Kuantitatif */}
                    <div className="col-12">
                      <div className="card p-3 border-0 shadow-sm mb-3">
                        <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">
                          Analisa Kuantitatif
                        </h6>
                        <div className="row g-2">
                          <div className="col-md-3">
                            <label className="form-label small">
                              Inherent - Kemungkinan
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="5"
                              step="1"
                              className="form-control"
                              name="inherent_kemungkinan"
                              value={editData.inherent_kemungkinan ?? 1}
                              onChange={handleEditChange}
                            />
                          </div>
                          <div className="col-md-3">
                            <label className="form-label small">Inherent - Dampak</label>
                            <input
                              type="number"
                              min="1"
                              max="5"
                              step="1"
                              className="form-control"
                              name="inherent_dampak"
                              value={editData.inherent_dampak ?? 1}
                              onChange={handleEditChange}
                            />
                          </div>

                          <div className="col-md-3">
                            <label className="form-label small d-flex justify-content-between align-items-center">
                              <span>Residual - Kemungkinan</span>
                              <div className="form-check form-switch ms-2">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  id="toggleResidual"
                                  checked={Boolean(editData.terdapat_residual)}
                                  onChange={(ev) =>
                                    handleEditChange({
                                      target: {
                                        name: 'terdapat_residual',
                                        value: ev.target.checked,
                                      },
                                    })
                                  }
                                />
                              </div>
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="5"
                              step="1"
                              className="form-control"
                              name="residual_kemungkinan"
                              value={editData.residual_kemungkinan ?? 1}
                              onChange={handleEditChange}
                              disabled={!Boolean(editData?.terdapat_residual)}
                            />
                          </div>
                          <div className="col-md-3">
                            <label className="form-label small">Residual - Dampak</label>
                            <input
                              type="number"
                              min="1"
                              max="5"
                              step="1"
                              className="form-control"
                              name="residual_dampak"
                              value={editData.residual_dampak ?? 1}
                              onChange={handleEditChange}
                              disabled={!Boolean(editData?.terdapat_residual)}
                            />
                          </div>
                        </div>

                        <div className="d-flex gap-3 mt-3 align-items-center">
                          <div>
                            <small className="text-muted d-block">Inherent IR</small>
                            <div className="fw-bold">
                              {editData.inherent_ir ??
                                calculateRiskScore(
                                  editData.inherent_kemungkinan || 1,
                                  editData.inherent_dampak || 1
                                )}
                            </div>
                          </div>
                          <div>
                            <small className="text-muted d-block">Level</small>
                            <div
                              className="badge"
                              style={getBadgeStyle(
                                getRiskLevel(
                                  Number(
                                    editData.inherent_ir ??
                                      calculateRiskScore(
                                        editData.inherent_kemungkinan || 1,
                                        editData.inherent_dampak || 1
                                      )
                                  )
                                )
                              )}
                            >
                              {getRiskLevel(
                                Number(
                                  editData.inherent_ir ??
                                    calculateRiskScore(
                                      editData.inherent_kemungkinan || 1,
                                      editData.inherent_dampak || 1
                                    )
                                )
                              )}
                            </div>
                          </div>

                          <div className="ms-auto text-end">
                            <small className="text-muted d-block">Residual RR</small>
                            {(() => {
                              const residualValue =
                                Number(
                                  editData.rr ??
                                    (String(editData.terdapat_residual) ===
                                    'true'
                                      ? calculateRiskScore(
                                          editData.residual_kemungkinan || 1,
                                          editData.residual_dampak || 1
                                        )
                                      : 0)
                                ) || 0;

                              const residualLevel =
                                residualValue > 0
                                  ? getRiskLevel(residualValue)
                                  : editData.terdapat_residual
                                  ? getRiskLevel(residualValue)
                                  : 'Risiko Hilang';

                              return (
                                <div>
                                  <div className="fw-bold">{residualValue}</div>

                                  {residualValue > 0 ? (
                                    <div className="mt-1">
                                      <span
                                        className="badge"
                                        style={{
                                          ...getBadgeStyle(residualLevel),
                                          fontWeight: 600,
                                        }}
                                      >
                                        {residualLevel}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="mt-1">
                                      <span className="text-muted small">
                                        {editData.terdapat_residual
                                          ? residualLevel
                                          : 'Risiko Hilang'}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="col-12">
                      <div className="card p-3 border-0 shadow-sm">
                        <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">
                          Penanganan & Progress
                        </h6>
                        <div className="row g-3">
                          <div className="col-md-12">
                            <label className="form-label small">Rencana Aksi</label>
                            <input
                              type="text"
                              className="form-control"
                              name="rencana_aksi"
                              value={editData.rencana_aksi || ''}
                              onChange={handleEditChange}
                            />
                          </div>

                          <div className="col-12">
                            <div className="bg-white p-3 border rounded">
                              <label className="form-label small fw-bold d-flex justify-content-between mb-2">
                                <span>Realisasi Progress</span>
                                <span className="text-primary fw-bold">
                                  {editData.progress || 0}%
                                </span>
                              </label>
                              <input
                                type="range"
                                className="form-range"
                                min="0"
                                max="100"
                                step="5"
                                name="progress"
                                value={editData.progress || 0}
                                onChange={handleEditChange}
                              />
                              <div className="d-flex justify-content-between small text-muted mt-1">
                                <span>0%</span>
                                <span>50%</span>
                                <span>100%</span>
                              </div>
                            </div>
                          </div>

                          <div className="col-md-4">
                            <label className="form-label small">
                              Status (Otomatis)
                            </label>
                            <select
                              className="form-select bg-light"
                              name="status"
                              value={editData.status || 'Open'}
                              onChange={handleEditChange}
                              disabled
                            >
                              <option value="Open">Open</option>
                              <option value="On Going">On Going</option>
                              <option value="Closed">Closed</option>
                            </select>
                          </div>

                          <div className="col-md-4">
                            <label className="form-label small">PIC</label>
                            <input
                              type="text"
                              className="form-control"
                              name="penanggung_jawab"
                              value={editData.penanggung_jawab || ''}
                              onChange={handleEditChange}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditData(null)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  form="formEdit"
                  className="btn btn-primary fw-bold px-4"
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Database;
