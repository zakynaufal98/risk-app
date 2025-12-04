// src/pages/Dashboard.jsx
import React, { useEffect, useState } from 'react';
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

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

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

  useEffect(() => {
    loadDashboardData();
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
      // PERBAIKAN PENTING DI SINI:
      // 1. Ambil dari 'risk_history'
      // 2. Join ke 'risk_master' untuk ambil aset dan klasifikasi
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

      // init counters
      const monthly = Array(12).fill(0);
      const levels = { SangatTinggi: 0, Tinggi: 0, Sedang: 0, Rendah: 0, SangatRendah: 0 };
      const assets = {};
      let closed = 0;

      // Extract year from semester string (e.g., "Semester 2 2025" -> 2025)
      const selectedYear = (() => {
        const m = semester?.match(/(\d{4})$/);
        return m ? parseInt(m[1], 10) : new Date().getFullYear();
      })();

      data.forEach(r => {
        // 1. Monthly Data
        const dateStr = r.tanggal_identifikasi || r.created_at;
        const d = dateStr ? new Date(dateStr) : null;
        if (d && !isNaN(d) && d.getFullYear() === selectedYear) {
          monthly[d.getMonth()]++;
        }

        // 2. Level Counts
        let key = normalizeLevelKey(r.level_risiko) || (r.inherent_ir !== undefined ? levelKeyFromScore(r.inherent_ir) : null);
        if (!key) key = 'Sedang';
        if (levels[key] !== undefined) levels[key]++;

        // 3. Asset Counts (Ambil dari relation risk_master)
        // Karena di-join, datanya ada di r.risk_master.klasifikasi_aset
        const ast = r.risk_master?.klasifikasi_aset || 'Lainnya';
        assets[ast] = (assets[ast] || 0) + 1;

        // 4. Closed Count
        if ((r.status || '').toLowerCase() === 'closed') closed++;
      });

      // Top 5 Risks
      const top5 = [...data]
        .sort((a, b) => (b.inherent_ir || 0) - (a.inherent_ir || 0))
        .slice(0, 5);

      // Dominance
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

  // --- CHART OPTIONS ---
  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#6b7280' } },
      y: { display: true, grid: { display: false }, ticks: { color: '#6b7280' }, beginAtZero: true }
    },
    elements: { bar: { borderRadius: 6 } }
  };

  const donutOptions = {
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed}` } }
    },
    cutout: '75%'
  };

  return (
    <div className="container-fluid p-0">
      {/* Row 1 */}
      <div className="row g-4 mb-4">
        {/* Bar Chart */}
        <div className="col-lg-8">
          <div className="card-custom p-4 d-flex flex-column" style={{minHeight: 350}}>
            <div className="d-flex justify-content-between align-items-start mb-4">
              <div>
                <span className="text-muted d-block small fw-bold text-uppercase">Risiko Teridentifikasi</span>
                <h2 className="mb-0 fw-bold text-dark">{stats.total} <span className="text-muted fs-6 fw-normal">Risiko</span></h2>
              </div>
              <div className="bg-light rounded-circle p-3">
                <i className="bi bi-bar-chart-fill text-primary fs-4"></i>
              </div>
            </div>

            <div className="row align-items-end">
              {/* Grafik */}
              <div className="col-12 col-lg-9">
                <div className="chart-bar-container">
                  <Bar
                    data={{
                      labels: MONTH_LABELS,
                      datasets: [{
                        data: stats.monthlyData,
                        backgroundColor: '#4318ff',
                        barThickness: 20,
                        hoverBackgroundColor: '#2d1eea'
                      }]
                    }}
                    options={barOptions}
                  />
                </div>
              </div>

              {/* Panel kanan */}
              <div className="col-12 col-lg-3 border-top border-lg-start ps-lg-4 pt-3 pt-lg-0 mt-3 mt-lg-0 d-flex flex-column justify-content-center">
                <div className="mb-4">
                  <span className="text-muted d-block small">Tertinggi Bulan Ini</span>
                  <div className="d-flex align-items-center gap-2">
                    <h3 className="fw-bold mb-0 text-dark">{stats.highestMonth}</h3>
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
        <div className="col-lg-4">
          <div className="card-custom p-4 text-center" style={{minHeight: 350}}>
            <h5 className="mb-4 fw-bold text-start">Komposisi Level</h5>
            <div style={{height: 200, position: 'relative'}} className="d-flex justify-content-center mb-3">
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
              <div style={{position:'absolute', top:'50%', left:'50%', transform:'translate(-50%, -50%)', textAlign:'center'}}>
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
        {/* Top 5 Table */}
        <div className="col-lg-7">
          <div className="card-custom p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5 className="mb-0 fw-bold">Top 5 Risiko Tertinggi</h5>
              <button className="btn btn-light btn-sm rounded-circle"><i className="bi bi-three-dots"></i></button>
            </div>

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
                        {/* AMBIL DATA DARI RISK_MASTER */}
                        <div className="fw-bold text-dark">{r.risk_master?.aset || 'Nama Aset Tidak Ditemukan'}</div>
                        <small className="text-muted">{r.risk_no}</small>
                      </td>
                      <td className="text-center">
                        <span className="fw-bold text-primary fs-6">{r.inherent_ir ?? '-'}</span>
                      </td>
                      <td>
                        { (r.level_risiko || '').toUpperCase().includes('SANGAT TINGGI') ? (
                          <span className="badge bg-danger rounded-pill px-3">Sangat Tinggi</span>
                        ) : (r.level_risiko || '').toUpperCase().includes('TINGGI') ? (
                          <span className="badge bg-warning text-dark rounded-pill px-3">Tinggi</span>
                        ) : (r.level_risiko || '').toUpperCase().includes('SEDANG') ? (
                          <span className="badge bg-warning text-dark rounded-pill px-3">Sedang</span>
                        ) : (r.level_risiko || '').toUpperCase().includes('SANGAT RENDAH') ? (
                          <span className="badge bg-info text-dark rounded-pill px-3">Sangat Rendah</span>
                        ) : (
                          <span className="badge bg-success rounded-pill px-3">Rendah</span>
                        )}
                      </td>
                      <td style={{width:'25%'}}>
                        <div className="d-flex align-items-center gap-2">
                          <div className="progress flex-grow-1" style={{height:6, borderRadius:10, backgroundColor:'#eff4fb'}}>
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
          </div>
        </div>

        {/* Asset Chart */}
        <div className="col-lg-5">
          <div className="card-custom p-4">
            <h5 className="mb-4 fw-bold">Sebaran Aset</h5>
            <div style={{height: 300}}>
              {Object.keys(stats.assetCounts).length === 0 ? (
                 <div className="d-flex align-items-center justify-content-center h-100 text-muted">Belum ada data aset.</div>
              ) : (
                <Bar
                    data={{
                    labels: Object.keys(stats.assetCounts),
                    datasets: [{ 
                        data: Object.values(stats.assetCounts), 
                        backgroundColor: '#4318ff', 
                        borderRadius: 4, 
                        barThickness: 20 
                    }]
                    }}
                    options={{
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { 
                        x: { display: false }, 
                        y: { 
                            grid: { display: false },
                            ticks: { 
                                color: '#2b3674',
                                font: { weight: '500' }
                            }
                        } 
                    }
                    }}
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
    <span style={{width:8, height:8, background: color, borderRadius:'50%', display:'inline-block'}}></span>
    <small style={{fontSize: '0.75rem', fontWeight: 600, color: '#555'}}>{label}</small>
  </div>
);

export default Dashboard;