// utils/riskHelpers.js

/**
 * Menghitung Skor Risiko berdasarkan Matriks 5x5
 * @param {number|string} L - Nilai Kemungkinan (Likelihood)
 * @param {number|string} I - Nilai Dampak (Impact)
 * @returns {number} Skor Risiko
 */
export const calculateRiskScore = (L, I) => {
  const l = Number.isFinite(Number(L)) ? parseInt(L, 10) : NaN;
  const i = Number.isFinite(Number(I)) ? parseInt(I, 10) : NaN;

  // jika input invalid -> kembalikan 0
  if (Number.isNaN(l) || Number.isNaN(i)) return 0;

  // Matriks Risiko 5x5 (Baris = Kemungkinan, Kolom = Dampak)
  const matrix = {
    5: { 1: 9, 2: 15, 3: 18, 4: 23, 5: 25 },
    4: { 1: 6, 2: 12, 3: 16, 4: 19, 5: 24 },
    3: { 1: 4, 2: 10, 3: 14, 4: 17, 5: 22 },
    2: { 1: 2, 2: 7,  3: 11, 4: 13, 5: 21 },
    1: { 1: 1, 2: 3,  3: 5,  4: 8,  5: 20 }
  };

  return matrix[l]?.[i] || 0;
};

/**
 * Menentukan Level Risiko berdasarkan Skor
 * @param {number} score - Skor Risiko
 * @returns {string} Level Risiko (Sangat Tinggi, Tinggi, Sedang, Rendah, Sangat Rendah)
 */
export const getRiskLevel = (score) => {
  const s = Number(score) || 0;
  if (s >= 21) return 'Sangat Tinggi';
  if (s >= 16) return 'Tinggi';
  if (s >= 11) return 'Sedang';
  if (s >= 6)  return 'Rendah';
  return 'Sangat Rendah';
};

/* ---------------------------
   Palette & Badge helpers
   ---------------------------
   Palette order: Sangat Tinggi, Tinggi, Sedang, Rendah, Sangat Rendah
   These hex values are the same used in the Doughnut chart.
*/
export const RISK_PALETTE = ['#ee5d50', '#ff7a3d', '#ffb547', '#05cd99', '#0dcaf0'];

/**
 * Mengembalikan inline style untuk badge agar warna hex konsisten
 * @param {string} level - Level Risiko (expected: 'Sangat Tinggi','Tinggi','Sedang','Rendah','Sangat Rendah')
 * @returns {{backgroundColor: string, color: string}}
 */
export const getBadgeStyle = (level) => {
  const s = String(level || '').trim().toLowerCase();

  // default: abu-abu gelap
  let bg = '#6c757d';
  let color = '#ffffff';

  if (s === 'sangat tinggi') {
    bg = RISK_PALETTE[0]; color = '#ffffff';
  } else if (s === 'tinggi') {
    bg = RISK_PALETTE[1]; color = '#ffffff';
  } else if (s === 'sedang') {
    bg = RISK_PALETTE[2]; color = '#1b2559'; // teks gelap agar terbaca di kuning
  } else if (s === 'rendah') {
    bg = RISK_PALETTE[3]; color = '#ffffff';
  } else if (s === 'sangat rendah') {
    bg = RISK_PALETTE[4]; color = '#1b2559';
  }

  return { backgroundColor: bg, color };
};

/**
 * Mengembalikan class Bootstrap fallback (jika ingin memakai kelas)
 * mapping disesuaikan agar tidak tumpang tindih
 * @param {string} level
 * @returns {string} kelas bootstrap (contoh: 'bg-danger text-white')
 */
export const getBadgeColor = (level) => {
  if (!level) return 'bg-secondary text-white';

  const s = String(level).trim().toLowerCase();
  if (s === 'sangat tinggi') return 'bg-danger text-white';
  if (s === 'tinggi') return 'bg-warning text-dark';
  if (s === 'sedang') return 'bg-primary text-white';
  if (s === 'rendah') return 'bg-success text-white';
  if (s === 'sangat rendah') return 'bg-info text-dark';

  return 'bg-secondary text-white';
};

/**
 * Format Tanggal Indonesia
 * @param {string} dateString - String tanggal ISO
 * @returns {string} Tanggal terformat (dd MMM yyyy)
 */
export const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * Menentukan status berdasarkan progress (0–100)
 */
export const getStatusFromProgress = (progress) => {
  const p = Number(progress) || 0;
  if (p === 0) return 'Open';
  if (p > 0 && p < 100) return 'On Going';
  if (p === 100) return 'Closed';
  return 'Open';
};
