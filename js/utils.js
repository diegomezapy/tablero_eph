// ============================================================
// utils.js - Formatting, palettes, helpers
// ============================================================

const COLORS = {
  primary: '#0056b3',
  primaryLight: '#4a90d9',
  danger: '#e63946',
  success: '#2a9d8f',
  warning: '#e9c46a',
  dark: '#2b2d42',
  gray: '#8d99ae',
  palette: [
    '#0056b3', '#e63946', '#2a9d8f', '#e9c46a', '#6c5ce7',
    '#fd79a8', '#00b894', '#fdcb6e', '#636e72', '#d63031',
    '#0984e3', '#00cec9', '#6c5ce7', '#e17055', '#74b9ff', '#55efc4'
  ],
  paletteLight: [
    'rgba(0,86,179,0.15)', 'rgba(230,57,70,0.15)', 'rgba(42,157,143,0.15)',
    'rgba(233,196,106,0.15)', 'rgba(108,92,231,0.15)', 'rgba(253,121,168,0.15)'
  ]
};

function formatNumber(n) {
  if (n == null) return 'N/D';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return n.toLocaleString('es-PY');
  return n.toLocaleString('es-PY', { maximumFractionDigits: 1 });
}

function formatPct(n) {
  if (n == null) return 'N/D';
  return n.toFixed(1) + '%';
}

function formatGs(n) {
  if (n == null) return 'N/D';
  return 'Gs. ' + Math.round(n).toLocaleString('es-PY');
}

function formatValue(v, unit) {
  if (v == null) return 'N/D';
  if (unit === '%') return formatPct(v);
  if (unit === 'Gs.') return formatGs(v);
  if (unit === 'años') return v.toFixed(1);
  if (unit === 'personas' && v > 1000) return formatNumber(v);
  return formatNumber(v);
}

function trendIcon(current, previous, unit) {
  if (current == null || previous == null) return '';
  const diff = current - previous;
  const arrow = diff > 0 ? 'bi-arrow-up-short' : diff < 0 ? 'bi-arrow-down-short' : 'bi-dash';
  const cls = diff > 0 ? 'up' : diff < 0 ? 'down' : '';
  let suffix = 'pp';
  let diffText = Math.abs(diff).toFixed(1);
  if (unit === 'Gs.') {
    suffix = '';
    diffText = 'Gs. ' + Math.round(Math.abs(diff)).toLocaleString('es-PY');
  } else if (unit === 'años') {
    suffix = '';
    diffText = Math.abs(diff).toFixed(1) + ' años';
  }
  return `<span class="kpi-trend ${cls}"><i class="bi ${arrow}"></i>${diffText}${suffix}</span>`;
}

function destroyChart(chartRef) {
  if (chartRef) {
    chartRef.destroy();
  }
  return null;
}

function getChartDefaults() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { font: { size: 11, family: 'Inter' } } },
      tooltip: {
        backgroundColor: 'rgba(43,45,66,0.9)',
        titleFont: { size: 12 },
        bodyFont: { size: 11 },
        cornerRadius: 8,
        padding: 10
      }
    },
    scales: {
      y: { ticks: { font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
      x: { ticks: { font: { size: 11 } }, grid: { display: false } }
    }
  };
}

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}
