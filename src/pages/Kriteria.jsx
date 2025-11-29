// src/pages/Kriteria.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const Kriteria = () => {
  const [libraryData, setLibraryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAset, setFilterAset] = useState('All');

  // Accordion state
  const [openIndex, setOpenIndex] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6); 

  useEffect(() => {
    fetchLibrary();
  }, []);

  const fetchLibrary = async () => {
    setLoading(true);
    try {
      // AMBIL DATA DARI TABEL library_ancaman
      const { data, error } = await supabase
        .from('library_ancaman')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        console.error('Error fetching library:', error);
        setLibraryData([]);
      } else {
        setLibraryData(data || []);
      }
    } catch (err) {
      console.error('Unexpected error fetching library:', err);
      setLibraryData([]);
    } finally {
      setLoading(false);
      setCurrentPage(1);
    }
  };

  // --- LOGIKA FILTER & PENCARIAN ---
  const filteredData = libraryData.filter((item) => {
    const term = (searchTerm || '').toLowerCase();
    const matchSearch =
      (item.ancaman || '').toLowerCase().includes(term) ||
      (item.kerentanan || '').toLowerCase().includes(term) ||
      (item.kategori_spbe || '').toLowerCase().includes(term) ||
      (item.aset || '').toLowerCase().includes(term);

    const matchFilter = filterAset === 'All' || item.aset === filterAset;

    return matchSearch && matchFilter;
  });

  // Ambil list aset unik untuk dropdown filter
  const uniqueAssets = [...new Set(libraryData.map((item) => item.aset))].filter(Boolean).sort();

  // --- LOGIKA GROUPING ---
  // Mengelompokkan baris berdasarkan 'ancaman' yang sama
  // Contoh: Ancaman X punya Kerentanan A, B, C (3 baris di database -> 1 grup di UI)
  const groupedMap = {};
  filteredData.forEach((item) => {
    // Kita gunakan kombinasi Ancaman + Aset sebagai kunci unik grup
    const key = `${item.ancaman}-${item.aset}`; 
    
    if (!groupedMap[key]) {
      groupedMap[key] = {
        ancaman: item.ancaman || 'Tanpa Nama Ancaman',
        aset: item.aset || '-',
        kategori: item.kategori_spbe || '-',
        kerentanan: new Set(), // Pakai Set biar tidak duplikat
      };
    }
    if (item.kerentanan) {
        groupedMap[key].kerentanan.add(item.kerentanan);
    }
  });

  // Convert map ke array untuk ditampilkan
  const groupedArray = Object.values(groupedMap).map(info => ({
    ...info,
    kerentanan: Array.from(info.kerentanan) // Ubah Set jadi Array
  }));

  // --- PAGINATION ---
  const totalGroups = groupedArray.length;
  const totalPages = Math.max(1, Math.ceil(totalGroups / pageSize));
  
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * pageSize;
  const pagedGroups = groupedArray.slice(startIndex, startIndex + pageSize);

  const goToPage = (p) => {
    const page = Math.max(1, Math.min(totalPages, p));
    setCurrentPage(page);
    setOpenIndex(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrev = () => goToPage(currentPage - 1);
  const handleNext = () => goToPage(currentPage + 1);

  return (
    <div className="container-fluid p-0">
      {/* HEADER */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h3 className="fw-bold text-dark m-0">Kamus Risiko (Library)</h3>
          <small className="text-muted">Referensi Ancaman & Kerentanan SPBE</small>
        </div>
        <div className="badge bg-primary fs-6 rounded-pill px-3">Total: {totalGroups} Ancaman</div>
      </div>

      <div className="card-custom">
        {/* TOOLBAR */}
        <div className="row g-3 mb-3 align-items-center bg-light p-3 rounded-3 border">
          <div className="col-md-5">
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0 text-muted">
                <i className="bi bi-search" />
              </span>
              <input
                type="text"
                className="form-control border-start-0 ps-0"
                placeholder="Cari Ancaman / Kerentanan..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
            </div>
          </div>

          <div className="col-md-3">
            <select
              className="form-select"
              value={filterAset}
              onChange={(e) => { setFilterAset(e.target.value); setCurrentPage(1); }}
            >
              <option value="All">Semua Aset</option>
              {uniqueAssets.map((aset, idx) => (
                <option key={idx} value={aset}>{aset}</option>
              ))}
            </select>
          </div>

          <div className="col-md-2">
            <select
              className="form-select"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
            >
              <option value={6}>6 per halaman</option>
              <option value={10}>10 per halaman</option>
              <option value={20}>20 per halaman</option>
            </select>
          </div>

          <div className="col-md-2 text-end">
            <button className="btn btn-outline-primary w-100" onClick={fetchLibrary}>
              <i className="bi bi-arrow-clockwise me-1" /> Refresh
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="table-responsive">
          {loading ? (
            <div className="text-center py-5">
               <div className="spinner-border text-primary mb-2" role="status"></div>
               <div className="text-muted">Memuat Library...</div>
            </div>
          ) : totalGroups === 0 ? (
            <div className="text-center py-5 text-muted">
              Data tidak ditemukan.<br/>
              <small>Pastikan tabel <b>library_ancaman</b> memiliki data dan RLS Policy sudah aktif.</small>
            </div>
          ) : (
            <>
              <div className="accordion" id="riskAccordion">
                {pagedGroups.map((grp, idx) => {
                  const globalIdx = startIndex + idx;
                  const isOpen = openIndex === globalIdx;
                  return (
                    <div className="accordion-item mb-2 shadow-sm border-0" key={globalIdx} style={{ borderRadius: '10px', overflow: 'hidden' }}>
                      <h2 className="accordion-header" id={`heading${globalIdx}`}>
                        <button
                          type="button"
                          className={`accordion-button ${isOpen ? '' : 'collapsed'} fw-semibold bg-white`}
                          onClick={() => setOpenIndex(isOpen ? null : globalIdx)}
                          style={{ boxShadow: 'none', borderBottom: isOpen ? '1px solid #eee' : 'none' }}
                        >
                          <span className="me-3 badge bg-light text-dark border">{grp.aset}</span>
                          <span className="flex-grow-1 text-start text-dark">{grp.ancaman}</span>
                          <span className="ms-3 badge bg-secondary-subtle text-secondary rounded-pill">{grp.kerentanan.length} Kerentanan</span>
                        </button>
                      </h2>

                      {isOpen && (
                        <div id={`panel-${globalIdx}`} className="accordion-collapse show">
                          <div className="accordion-body bg-light">
                            
                            <div className="mb-3">
                                <label className="small text-muted fw-bold text-uppercase d-block mb-1">Kategori SPBE</label>
                                {grp.kategori ? (
                                    <span className="badge bg-info text-dark bg-opacity-10 border border-info">{grp.kategori}</span>
                                ) : '-'}
                            </div>

                            <label className="small text-muted fw-bold text-uppercase d-block mb-1">Daftar Kerentanan Terkait</label>
                            <ul className="list-group list-group-flush rounded border">
                              {grp.kerentanan.map((vul, i) => (
                                <li className="list-group-item bg-white d-flex align-items-start" key={i}>
                                    <i className="bi bi-exclamation-triangle text-danger me-2 mt-1"></i>
                                    <div>{vul}</div>
                                </li>
                              ))}
                            </ul>

                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* PAGINATION */}
              <div className="d-flex align-items-center justify-content-between mt-3">
                <div>
                  <small className="text-muted">
                    Menampilkan {Math.min(totalGroups, startIndex + 1)} - {Math.min(totalGroups, startIndex + pagedGroups.length)} dari {totalGroups} grup
                  </small>
                </div>

                <nav>
                  <ul className="pagination mb-0">
                    <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                      <button className="page-link" onClick={handlePrev}>Prev</button>
                    </li>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                      const gap = 2;
                      if (p === 1 || p === totalPages || (p >= currentPage - gap && p <= currentPage + gap)) {
                        return (
                          <li className={`page-item ${p === currentPage ? 'active' : ''}`} key={p}>
                            <button className="page-link" onClick={() => goToPage(p)}>{p}</button>
                          </li>
                        );
                      }
                      const before = p < currentPage - gap && p > 1;
                      const after = p > currentPage + gap && p < totalPages;
                      if ((before && p === 2) || (after && p === totalPages - 1)) {
                          return <li key={`dots-${p}`} className="page-item disabled"><span className="page-link">…</span></li>;
                      }
                      return null;
                    })}

                    <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                      <button className="page-link" onClick={handleNext}>Next</button>
                    </li>
                  </ul>
                </nav>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Kriteria;