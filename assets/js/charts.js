import { emptyState, formatRupiah, refreshIcons } from './utils.js';

const PALETTE = ['#0d9488', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#0f766e', '#14b8a6', '#94a3b8'];
const compact = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });
const dayLabel = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric' });

const charts = { donut: null, cashflow: null };

function chartAvailable() {
  return typeof window.Chart === 'function';
}

function compactRupiah(value) {
  return `Rp${compact.format(value)}`;
}

function ensureCanvas(wrapper) {
  let canvas = wrapper.querySelector('canvas');
  if (!canvas) {
    emptyMsg(wrapper, '', '');
    canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    wrapper.replaceChildren(canvas);
  }
  return canvas;
}

function emptyMsg(wrapper, title, message) {
  wrapper.replaceChildren();
  if (title) {
    wrapper.appendChild(emptyState({ icon: 'chart-no-axes-column', title, message }));
    refreshIcons();
  }
}

function configureDefaults() {
  if (charts.configured) return;
  charts.configured = true;
  window.Chart.defaults.color = '#475569';
  window.Chart.defaults.font.family = "'Plus Jakarta Sans', 'Segoe UI', sans-serif";
  window.Chart.defaults.font.size = 11.5;
}

function drawComposition(wrapper, groups) {
  if (!chartAvailable()) {
    emptyMsg(wrapper, '', 'Grafik tidak dapat dimuat (CDN Chart.js diblokir).');
    return;
  }

  if (groups.length === 0) {
    destroyDonut();
    emptyMsg(wrapper, 'Belum ada data grafik', 'Grafik komposisi pengeluaran muncul setelah ada transaksi pengeluaran.');
    return;
  }

  configureDefaults();
  const canvas = ensureCanvas(wrapper);

  const labels = groups.map((g) => g.name);
  const data = {
    labels,
    datasets: [
      {
        data: groups.map((g) => g.amount),
        backgroundColor: groups.map((_, i) => PALETTE[i % PALETTE.length]),
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 6,
      },
    ],
  };

  if (charts.donut) {
    charts.donut.data = data;
    charts.donut.update();
    return;
  }

  charts.donut = new window.Chart(canvas, {
    type: 'doughnut',
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      layout: { padding: 4 },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 9, boxHeight: 9, padding: 10, usePointStyle: true, pointStyle: 'circle' },
        },
        tooltip: {
          callbacks: {
            label: (item) => {
              const total = item.dataset.data.reduce((sum, v) => sum + (Number(v) || 0), 0) || 1;
              const pct = Math.round(((Number(item.parsed) || 0) / total) * 100);
              return ` ${item.label}: ${formatRupiah(item.parsed)} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

function destroyDonut() {
  if (charts.donut) {
    charts.donut.destroy();
    charts.donut = null;
  }
}

function dayKey(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function drawCashFlow(wrapper, transactions) {
  if (!chartAvailable()) {
    emptyMsg(wrapper, '', 'Grafik tidak dapat dimuat (CDN Chart.js diblokir).');
    return;
  }

  const days = [];
  const flows = new Map();
  const today = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = dayKey(date);
    days.push({ key, date });
    flows.set(key, { income: 0, expense: 0 });
  }

  for (const tx of transactions) {
    if (tx.type !== 'income' && tx.type !== 'expense') continue;
    const bucket = flows.get(String(tx.transaction_date ?? '').slice(0, 10));
    if (!bucket) continue;
    bucket[tx.type] += Number(tx.amount) || 0;
  }

  const hasAny = days.some(({ key }) => {
    const bucket = flows.get(key);
    return bucket.income > 0 || bucket.expense > 0;
  });

  if (!hasAny) {
    destroyCashFlow();
    emptyMsg(wrapper, 'Belum ada arus kas minggu ini', 'Grafik 7 hari terakhir muncul setelah kamu mencatat transaksi.');
    return;
  }

  configureDefaults();
  const canvas = ensureCanvas(wrapper);

  const data = {
    labels: days.map(({ date }) => dayLabel.format(date)),
    datasets: [
      {
        label: 'Pemasukan',
        data: days.map(({ key }) => flows.get(key).income),
        backgroundColor: 'rgba(16, 185, 129, 0.85)',
        hoverBackgroundColor: '#059669',
        borderRadius: 5,
        maxBarThickness: 22,
      },
      {
        label: 'Pengeluaran',
        data: days.map(({ key }) => flows.get(key).expense),
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        hoverBackgroundColor: '#dc2626',
        borderRadius: 5,
        maxBarThickness: 22,
      },
    ],
  };

  const config = {
    type: 'bar',
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      categoryPercentage: 0.62,
      barPercentage: 0.86,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 10, boxHeight: 10, padding: 10, usePointStyle: true, pointStyle: 'circle' },
        },
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.dataset.label}: ${formatRupiah(item.parsed.y)}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          border: { display: false },
          ticks: {
            maxTicksLimit: 5,
            callback: (value) => compactRupiah(value),
          },
        },
      },
    },
  };

  if (charts.cashflow) {
    charts.cashflow.data = data;
    charts.cashflow.update();
    return;
  }

  charts.cashflow = new window.Chart(canvas, config);
}

function destroyCashFlow() {
  if (charts.cashflow) {
    charts.cashflow.destroy();
    charts.cashflow = null;
  }
}

export function updateDashboardCharts(transactions, groups) {
  const donutWrap = document.getElementById('composition-chart');
  const cashWrap = document.getElementById('cashflow-chart');
  drawComposition(donutWrap, groups);
  drawCashFlow(cashWrap, transactions);
}
