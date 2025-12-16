import React from 'react';
import { getRiskLevel, getBadgeStyle } from '../utils/riskHelpers';

const ModalView = ({ data, onClose }) => {
  if (!data) return null;

  // Helper lokal untuk display status (sama seperti di parent)
  const getStatusFromProgress = (progress) => {
    const n = Number(progress) || 0;
    if (n >= 100) return 'Closed';
    if (n > 0) return 'On Going';
    return 'Open';
  };

  const displayStatus = (() => {
    const p = Number(data.progress);
    if (!Number.isNaN(p)) return getStatusFromProgress(p);
    return data.status || 'Open';
  })();

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-shield-lock me-2"></i>Detail Risiko: {data.risk_no}
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
            ></button>
          </div>
          <div className="modal-body bg-light">
            <div className="row g-4">
              {/* KOLOM KIRI */}
              <div className="col-lg-8">
                {/* 1. Identifikasi Aset */}
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
                            {data.risk_master?.aset}
                          </td>
                        </tr>
                        <tr>
                          <td className="text-muted">Klasifikasi</td>
                          <td>{data.risk_master?.klasifikasi_aset}</td>
                        </tr>
                        <tr>
                          <td className="text-muted">Jenis Risiko</td>
                          <td>{data.risk_master?.jenis_risiko}</td>
                        </tr>
                        <tr>
                          <td className="text-muted">Kategori</td>
                          <td>{data.risk_master?.kategori}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2. Analisa & Dampak */}
                <div className="card border-0 shadow-sm mb-3">
                  <div className="card-body">
                    <h6 className="fw-bold text-primary mb-3 border-bottom pb-2">
                      2. Analisa & Dampak
                    </h6>
                    <div className="row g-3">
                      <div className="col-12">
                        <label className="small text-muted fw-bold">ANCAMAN</label>
                        <div className="bg-light p-2 rounded border">
                          {data.ancaman}
                        </div>
                      </div>
                      <div className="col-12">
                        <label className="small text-muted fw-bold">KERAWANAN</label>
                        <div className="bg-light p-2 rounded border">
                          {data.kerawanan}
                        </div>
                      </div>
                      <div className="col-md-12">
                        <label className="small text-muted fw-bold">URAIAN DAMPAK</label>
                        <p className="mb-1">{data.dampak_identifikasi}</p>
                      </div>
                      <div className="col-md-6">
                        <label className="small text-muted fw-bold">AREA DAMPAK</label>
                        <p className="mb-0 fw-bold">{data.area_dampak}</p>
                      </div>
                      <div className="col-md-6">
                        <label className="small text-muted fw-bold">KONTROL SAAT INI</label>
                        <p className="mb-0">
                          {data.kontrol_saat_ini || '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Rencana Penanganan */}
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
                            style={{ width: `${data.progress || 0}%` }}
                          ></div>
                        </div>
                        <span className="fw-bold text-success">
                          {data.progress || 0}%
                        </span>
                      </div>
                    </div>
                    <table className="table table-sm table-borderless mb-0">
                      <tbody>
                        <tr>
                          <td className="text-muted w-25">Rencana Aksi</td>
                          <td className="fw-bold">{data.rencana_aksi}</td>
                        </tr>
                        <tr>
                          <td className="text-muted">Opsi</td>
                          <td>{data.opsi_penanganan}</td>
                        </tr>
                        <tr>
                          <td className="text-muted">Target Jadwal</td>
                          <td>{data.target_jadwal}</td>
                        </tr>
                        <tr>
                          <td className="text-muted">PIC</td>
                          <td>{data.penanggung_jawab}</td>
                        </tr>
                        <tr>
                          <td className="text-muted">Output</td>
                          <td>{data.keluaran}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* KOLOM KANAN (Skor) */}
              <div className="col-lg-4">
                {/* Level Awal */}
                <div className="card border-0 shadow-sm mb-3 text-center border-start border-4 border-warning">
                  <div className="card-body bg-warning bg-opacity-10">
                    <small className="text-muted fw-bold">
                      LEVEL AWAL (Inherent)
                    </small>
                    <h1 className="display-4 fw-bold my-0 text-dark">
                      {data.inherent_ir}
                    </h1>
                    <span
                      className="badge px-3 mb-2"
                      style={getBadgeStyle(
                        getRiskLevel(Number(data.inherent_ir))
                      )}
                    >
                      {getRiskLevel(Number(data.inherent_ir)) ||
                        data.level_risiko ||
                        '-'}
                    </span>
                  </div>
                </div>

                {/* Level Sisa */}
                <div className="card border-0 shadow-sm mb-3 text-center border-start border-4 border-success">
                  <div className="card-body bg-success bg-opacity-10">
                    <small className="text-muted fw-bold">
                      LEVEL SISA (Residual)
                    </small>
                    <h1 className="display-4 fw-bold my-0 text-dark">
                      {data.rr || 0}
                    </h1>
                    <span
                      className="badge px-3 mb-2"
                      style={getBadgeStyle(
                        getRiskLevel(Number(data.rr))
                      )}
                    >
                      {getRiskLevel(Number(data.rr)) ||
                        (data.terdapat_residual
                          ? 'Masih Ada Risiko'
                          : 'Risiko Hilang')}
                    </span>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="card border-0 shadow-sm bg-primary text-white">
                  <div className="card-body text-center">
                    <h6 className="m-0">
                      Status:{' '}
                      <strong>{displayStatus}</strong>
                    </h6>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalView;