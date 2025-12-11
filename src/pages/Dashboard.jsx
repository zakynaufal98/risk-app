// src/pages/Dashboard.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { getBadgeStyle } from '../utils/riskHelpers';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

/** Helper: potong teks jika terlalu panjang */
const truncate = (text, max = 18) => {
  if (!text) return '';
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
};

const Dashboard = ({ semester }) => {
  const [stats, setStats] = useState({
    total: 0,
    monthlyData: Array(12).fill(0),
    levelCounts: { SangatTinggi: 0, Tinggi: 0, Sedang: 0, Rendah: 0, SangatRendah: 0 },
    assetCounts: {},
    topRisks: [],
    closedCount: 0,
    highestMonth: 0,
    dominance: '-'
  });

  // detect mobile
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e) => setIsMobile(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else mq.removeListener(handler);
    };
  }, []);

  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semester]);

  // --- HELPER FUNCTIONS ---
  const normalizeLevelKey = (raw) => {
    const s = String(raw || '').toUpperCase();
    if (s.includes('SANGAT TINGGI') || s.includes('S-TINGGI') || s.includes('EXTREME')) return 'SangatTinggi';
    if (s.includes('TINGGI') && !s.includes('SANGAT')) return 'Tinggi';
    if (s.includes('SEDANG') || s.includes('MEDIUM')) return 'Sedang';
    if (s.includes('SANGAT RENDAH') || s.includes('S-RENDAH')) return 'SangatRendah';
    if (s.includes('RENDAH') || s.includes('LOW')) return 'Rendah';
    return null;
  };

  const levelKeyFromScore = (score) => {
    const s = Number(score) || 0;
    if (s >= 21) return 'SangatTinggi';
    if (s >= 16) return 'Tinggi';
    if (s >= 11) return 'Sedang';
    if (s >= 6) return 'Rendah';
    return 'SangatRendah';
  };

  const mapKeyToLabel = (key) => {
    return key === 'SangatTinggi' ? 'Sangat Tinggi'
         : key === 'Tinggi' ? 'Tinggi'
         : key === 'Sedang' ? 'Sedang'
         : key === 'Rendah' ? 'Rendah'
         : key === 'SangatRendah' ? 'Sangat Rendah'
         : '-';
  };

  // --- LOAD DATA ---
  const loadDashboardData = async () => {
    try {
      const { data, error } = await supabase
        .from('risk_history')
        .select(`
          *,
          risk_master ( aset, klasifikasi_aset )
        `)
        .eq('semester', semester);

      if (error) {
        console.error('Error fetch dashboard data:', error);
        return;
      }

      if (!data || data.length === 0) {
        setStats({
          total: 0,
          monthlyData: Array(12).fill(0),
          levelCounts: { SangatTinggi: 0, Tinggi: 0, Sedang: 0, Rendah: 0, SangatRendah: 0 },
          assetCounts: {},
          topRisks: [],
          closedCount: 0,
          highestMonth: 0,
          dominance: '-'
        });
        return;
      }

      const monthly = Array(12).fill(0);
      const levels = { SangatTinggi: 0, Tinggi: 0, Sedang: 0, Rendah: 0, SangatRendah: 0 };
      const assets = {};
      let closed = 0;

      const selectedYear = (() => {
        const m = semester?.match(/(\d{4})$/);
        return m ? parseInt(m[1], 10) : new Date().getFullYear();
      })();

      data.forEach(r => {
        const dateStr = r.tanggal_identifikasi || r.created_at;
        const d = dateStr ? new Date(dateStr) : null;
        if (d && !isNaN(d) && d.getFullYear() === selectedYear) {
          monthly[d.getMonth()]++;
        }

        let key = normalizeLevelKey(r.level_risiko) || (r.inherent_ir !== undefined ? levelKeyFromScore(r.inherent_ir) : null);
        if (!key) key = 'Sedang';
        if (levels[key] !== undefined) levels[key]++;

        const ast = r.risk_master?.klasifikasi_aset || 'Lainnya';
        assets[ast] = (assets[ast] || 0) + 1;

        if ((r.status || '').toLowerCase() === 'closed') closed++;
      });

      const top5 = [...data]
        .sort((a, b) => (b.inherent_ir || 0) - (a.inherent_ir || 0))
        .slice(0, 5);

      const entries = Object.entries(levels);
      const sorted = entries.sort((a, b) => b[1] - a[1]);
      const dominance = (sorted[0] && sorted[0][1] > 0) ? mapKeyToLabel(sorted[0][0]) : '-';

      setStats({
        total: data.length,
        monthlyData: monthly,
        levelCounts: levels,
        assetCounts: assets,
        topRisks: top5,
        closedCount: closed,
        highestMonth: Math.max(...monthly),
        dominance
      });
    } catch (err) {
      console.error('Unexpected error loadDashboardData:', err);
    }
  };

  // --- CHART OPTIONS (responsive tweaks) ---
  const barOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: '#6b7280',
          maxRotation: isMobile ? 0 : 45,
          minRotation: 0,
          font: { size: isMobile ? 10 : 12 }
        }
      },
      y: {
        display: true,
        grid: { display: false },
        ticks: { color: '#6b7280', beginAtZero: true, font: { size: isMobile ? 10 : 12 } }
      }
    },
    elements: { bar: { borderRadius: 6 } }
  }), [isMobile]);

  const donutOptions = useMemo(() => ({
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed}` } }
    },
    cutout: '70%'
  }), []);

  // monthly dataset
  const monthlyDataset = {
    labels: MONTH_LABELS,
    datasets: [{
      data: stats.monthlyData,
      backgroundColor: '#4318ff',
      barThickness: isMobile ? 12 : 20,
      hoverBackgroundColor: '#2d1eea'
    }]
  };

  // Assets: prepare full labels + truncated labels for chart display
  const assetLabelsFull = Object.keys(stats.assetCounts);
  const assetLabelsTruncated = assetLabelsFull.map(l => truncate(String(l), 18));
  const assetsData = {
    labels: assetLabelsTruncated,
    datasets: [{
      data: Object.values(stats.assetCounts),
      backgroundColor: '#4318ff',
      borderRadius: 6,
      barThickness: isMobile ? 12 : 20
    }]
  };

  const assetsOptions = useMemo(() => ({
    indexAxis: isMobile ? 'x' : 'y', // vertical bars on mobile, horizontal on desktop
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const idx = ctx.dataIndex;
            const full = assetLabelsFull[idx] || ctx.label || '';
            return `${full}: ${ctx.parsed}`;
          }
        }
      }
    },
    scales: {
      x: { display: isMobile, grid: { display: false }, ticks: { color: '#2b3674', font: { size: isMobile ? 10 : 12 } } },
      y: { grid: { display: false }, ticks: { color: '#2b3674', font: { size: isMobile ? 10 : 12 } } }
    }
  }), [isMobile, assetLabelsFull]);

  // --- render helpers for Top 5 on mobile ---
  const renderTop5Mobile = () => {
    return stats.topRisks.length === 0 ? (
      <div className="text-center text-muted py-4">Belum ada data risiko.</div>
    ) : (
      <div className="d-flex flex-column gap-3">
        {stats.topRisks.map((r, idx) => (
          <div key={idx} className="card p-3 top5-mobile-card">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <div className="fw-bold text-dark asset-label" style={{ fontSize: 14 }}>{r.risk_master?.aset || 'Nama Aset Tidak Ditemukan'}</div>
                <small className="text-muted risk-no">{r.risk_no}</small>
              </div>
              <div className="text-end">
                <div className="fw-bold text-primary" style={{ fontSize: 16 }}>{r.inherent_ir ?? '-'}</div>
                <small className="d-block text-muted">Skor</small>
              </div>
            </div>

            <div className="mt-2 d-flex align-items-center justify-content-between gap-2">
              <div style={{ flex: 1, marginRight: 8 }}>
                <div className="progress" style={{ height: 8, borderRadius: 10, backgroundColor: '#eff4fb' }}>
                  <div className="progress-bar" style={{ width: `${r.progress || 0}%`, backgroundColor: (r.progress || 0) === 100 ? '#05cd99' : '#4318ff', borderRadius: 10 }}></div>
                </div>
              </div>
              <div style={{ minWidth: 42 }}>
                <small className="fw-bold text-dark">{r.progress || 0}%</small>
              </div>
            </div>

            <div className="mt-2 d-flex gap-2 flex-wrap">
              <span className="badge" style={{ ...getBadgeStyle(r.level_risiko), fontSize: 11 }}>
                {(r.level_risiko || 'Sedang').toString()}
              </span>
              <span className="badge" style={{ backgroundColor: '#eff4fb', color: '#2b3674', fontSize: 11 }}>
                {r.risk_master?.klasifikasi_aset || 'Lainnya'}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="container-fluid p-0">
      {/* Row 1 */}
      <div className="row g-4 mb-4">
        {/* Bar Chart */}
        <div className="col-12 col-lg-8">
          <div className="card-custom p-3 p-lg-4 d-flex flex-column" style={{ minHeight: isMobile ? 300 : 350 }}>
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div>
                <span className="text-muted d-block small fw-bold text-uppercase">Risiko Teridentifikasi</span>
                <h2 className="mb-0 fw-bold text-dark" style={{ fontSize: isMobile ? '1.2rem' : '1.5rem' }}>{stats.total} <span className="text-muted fs-6 fw-normal">Risiko</span></h2>
              </div>
              <div className="bg-light rounded-circle p-3">
                <i className="bi bi-bar-chart-fill text-primary fs-4"></i>
              </div>
            </div>

            <div className="row align-items-end" style={{ gap: isMobile ? 12 : 0 }}>
              <div className={`col-12 ${isMobile ? '' : 'col-lg-9'}`}>
                <div className="chart-bar-container" style={{ height: isMobile ? 180 : 240 }}>
                  <Bar data={monthlyDataset} options={barOptions} />
                </div>
              </div>

              <div className={`col-12 ${isMobile ? 'mt-3' : 'col-lg-3 border-top border-lg-start ps-lg-4 pt-3 pt-lg-0 mt-3 mt-lg-0'}`}>
                <div className="mb-3">
                  <span className="text-muted d-block small">Tertinggi Bulan Ini</span>
                  <div className="d-flex align-items-center gap-2">
                    <h3 className="fw-bold mb-0 text-dark" style={{ fontSize: isMobile ? 20 : 26 }}>{stats.highestMonth}</h3>
                    <i className="bi bi-arrow-up-right-circle-fill text-success fs-5"></i>
                  </div>
                </div>
                <div>
                  <span className="text-muted d-block small">Dominasi Level</span>
                  <h5 className="fw-bold text-primary mb-0">{stats.dominance}</h5>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Donut Chart */}
        <div className="col-12 col-lg-4">
          <div className="card-custom p-3 p-lg-4 text-center" style={{ minHeight: isMobile ? 300 : 350 }}>
            <h5 className="mb-3 fw-bold text-start">Komposisi Level</h5>
            <div style={{ height: isMobile ? 160 : 200, position: 'relative' }} className="d-flex justify-content-center mb-3">
              <Doughnut
                data={{
                  labels: ['Sangat Tinggi','Tinggi','Sedang','Rendah','Sangat Rendah'],
                  datasets: [{
                    data: [
                      stats.levelCounts.SangatTinggi,
                      stats.levelCounts.Tinggi,
                      stats.levelCounts.Sedang,
                      stats.levelCounts.Rendah,
                      stats.levelCounts.SangatRendah
                    ],
                    backgroundColor: ['#ee5d50','#ff7a3d','#ffb547','#05cd99','#0dcaf0'],
                    borderWidth: 0
                  }]
                }}
                options={donutOptions}
              />
              <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%, -50%)', textAlign:'center' }}>
                <small className="text-muted d-block">Total</small>
                <h3 className="m-0 fw-bold">{stats.total}</h3>
              </div>
            </div>

            <div className="d-flex justify-content-center gap-2 flex-wrap">
              <LegendItem color="#ee5d50" label="Sangat Tinggi" />
              <LegendItem color="#ff7a3d" label="Tinggi" />
              <LegendItem color="#ffb547" label="Sedang" />
              <LegendItem color="#05cd99" label="Rendah" />
              <LegendItem color="#0dcaf0" label="Sangat Rendah" />
            </div>
          </div>
        </div>
      </div>

      {/* Row 2 - Details */}
      <div className="row g-4">
        {/* Top 5 */}
        <div className="col-12 col-lg-7">
          <div className="card-custom p-3 p-lg-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0 fw-bold">Top 5 Risiko Tertinggi</h5>
            </div>

            {/* Desktop: table; Mobile: card list */}
            {!isMobile ? (
              <div className="table-responsive">
                <table className="table table-custom w-100 align-middle">
                  <thead>
                    <tr className="text-muted small text-uppercase">
                      <th className="border-0">ASET / RISK NO</th>
                      <th className="border-0 text-center">SKOR</th>
                      <th className="border-0">LEVEL</th>
                      <th className="border-0">PROGRESS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topRisks.length === 0 ? (
                      <tr><td colSpan="4" className="text-center text-muted py-4">Belum ada data risiko.</td></tr>
                    ) : stats.topRisks.map((r, idx) => (
                      <tr key={idx}>
                        <td>
                          <div className="fw-bold text-dark">{r.risk_master?.aset || 'Nama Aset Tidak Ditemukan'}</div>
                          <small className="text-muted">{r.risk_no}</small>
                        </td>
                        <td className="text-center">
                          <span className="fw-bold text-primary fs-6">{r.inherent_ir ?? '-'}</span>
                        </td>
                        <td>
                          <span className="badge rounded-pill px-3" style={getBadgeStyle(r.level_risiko)}>
                            {r.level_risiko ?? '-'}
                          </span>
                        </td>
                        <td style={{ width:'25%' }}>
                          <div className="d-flex align-items-center gap-2">
                            <div className="progress flex-grow-1" style={{ height:6, borderRadius:10, backgroundColor:'#eff4fb' }}>
                              <div className="progress-bar" style={{ width: `${r.progress || 0}%`, backgroundColor: (r.progress || 0) === 100 ? '#05cd99' : '#4318ff', borderRadius: 10 }}></div>
                            </div>
                            <small className="fw-bold text-dark">{r.progress || 0}%</small>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div>
                {renderTop5Mobile()}
              </div>
            )}
          </div>
        </div>

        {/* Asset Chart */}
        <div className="col-12 col-lg-5">
          <div className="card-custom p-3 p-lg-4">
            <h5 className="mb-3 fw-bold">Sebaran Aset</h5>
            <div style={{ height: isMobile ? 220 : 300 }}>
              {Object.keys(stats.assetCounts).length === 0 ? (
                <div className="d-flex align-items-center justify-content-center h-100 text-muted">Belum ada data aset.</div>
              ) : (
                <Bar
                  data={assetsData}
                  options={assetsOptions}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// small legend helper
const LegendItem = ({ color, label }) => (
  <div className="d-flex align-items-center gap-1 border px-2 py-1 rounded-pill bg-light">
    <span style={{ width: 8, height: 8, background: color, borderRadius: '50%', display: 'inline-block' }}></span>
    <small style={{ fontSize: '0.75rem', fontWeight: 600, color: '#555' }}>{label}</small>
  </div>
);

export default Dashboard;
