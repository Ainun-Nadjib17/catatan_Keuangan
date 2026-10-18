import { getClient } from './supabase.js';
import { initAppShell, loadSidebarCategories, showConfigNotice } from './layout.js';
import { openTransactionForm } from './transactions.js';
import { updateDashboardCharts } from './charts.js';
import {
  fetchCategories,
  fetchProfile,
  fetchTransactions,
  formatLongDate,
  formatRupiah,
  getErrorMessage,
  groupExpensesByCategory,
  refreshIcons,
  renderTransactionList,
  setLoading,
  showAlert,
  summarize,
  emptyState,
} from './utils.js';

function renderCategoryBreakdown(container, groups, totalExpense) {
  if (!container) return;
  container.replaceChildren();

  if (groups.length === 0) {
    container.appendChild(
      emptyState({
        icon: 'pie-chart',
        title: 'Belum ada pengeluaran',
        message: 'Setelah kamu mencatat pengeluaran, rinciannya muncul di sini.',
      })
    );
    refreshIcons();
    return;
  }

  const list = document.createElement('ul');
  list.className = 'category-list';

  for (const group of groups) {
    const item = document.createElement('li');
    item.className = 'category-row';

    const iconWrap = document.createElement('span');
    iconWrap.className = 'category-icon';
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', /^[a-z0-9-]+$/.test(group.icon) ? group.icon : 'circle');
    icon.setAttribute('aria-hidden', 'true');
    iconWrap.appendChild(icon);

    const info = document.createElement('div');
    info.className = 'category-info';

    const line = document.createElement('div');
    line.className = 'category-line';

    const name = document.createElement('span');
    name.className = 'category-name';
    name.textContent = group.name;

    const amount = document.createElement('span');
    amount.className = 'category-amount';
    amount.textContent = formatRupiah(group.amount);

    line.append(name, amount);

    const track = document.createElement('div');
    track.className = 'progress';
    track.setAttribute('aria-hidden', 'true');

    const bar = document.createElement('span');
    const percentage = totalExpense > 0 ? (group.amount / totalExpense) * 100 : 0;
    bar.style.width = `${Math.max(percentage, 1.5)}%`;
    track.appendChild(bar);

    const meta = document.createElement('p');
    meta.className = 'category-meta';
    meta.textContent = `${group.count} transaksi · ${Math.round(percentage)}% dari pengeluaran`;

    info.append(line, track, meta);
    item.append(iconWrap, info);
    list.appendChild(item);
  }

  container.appendChild(list);
  refreshIcons();
}

async function initDashboardPage() {
  if (!getClient()) {
    showConfigNotice();
    return;
  }

  const session = await initAppShell({
    active: 'dashboard',
    title: 'Dashboard',
    eyebrow: 'Ringkasan',
  });
  if (!session) return;

  await loadSidebarCategories();

  const elements = {
    alertBox: document.getElementById('page-alert'),
    greeting: document.getElementById('dashboard-greeting'),
    date: document.getElementById('today-label'),
    balance: document.getElementById('dashboard-balance'),
    initialHint: document.getElementById('balance-initial'),
    income: document.getElementById('dashboard-income'),
    expense: document.getElementById('dashboard-expense'),
    savings: document.getElementById('dashboard-savings'),
    breakdown: document.getElementById('category-breakdown'),
    recent: document.getElementById('recent-transactions'),
    addButton: document.getElementById('add-transaction'),
  };

  const state = {
    categories: [],
  };

  if (elements.date) elements.date.textContent = formatLongDate();

  function setGreeting(profile) {
    if (!elements.greeting) return;
    const fallbackName = session.user.email ? session.user.email.split('@')[0] : 'kamu';
    const name = profile?.full_name?.trim() || fallbackName;
    elements.greeting.textContent = `Halo, ${name}`;
  }

  function render(profile, transactions) {
    const summary = summarize(transactions, profile.initial_balance);

    elements.balance.textContent = formatRupiah(summary.available);
    elements.income.textContent = formatRupiah(summary.income);
    elements.expense.textContent = formatRupiah(summary.expense);
    elements.savings.textContent = formatRupiah(summary.savings);
    elements.initialHint.textContent = `Saldo awal ${formatRupiah(profile.initial_balance)}`;

    const groups = groupExpensesByCategory(transactions);
    renderCategoryBreakdown(elements.breakdown, groups, summary.expense);

    renderTransactionList(elements.recent, transactions.slice(0, 6), {
      emptyTitle: 'Belum ada transaksi',
      emptyMessage:
        'Tambahkan pemasukan atau pengeluaran pertamamu untuk melihat ringkasan di dashboard.',
    });

    updateDashboardCharts(transactions, groups);
  }

  async function loadData() {
    if (elements.alertBox) elements.alertBox.hidden = true;
    setLoading(elements.recent, 'Memuat transaksi terbaru…');
    setLoading(elements.breakdown, 'Memuat ringkasan kategori…');

    try {
      const [profile, categories, transactions] = await Promise.all([
        fetchProfile(session.user.id),
        fetchCategories(),
        fetchTransactions(),
      ]);

      if (!profile) {
        throw new Error(
          'Profil tidak ditemukan. Pastikan schema Supabase sudah dijalankan dengan benar.'
        );
      }

      state.categories = categories;
      setGreeting(profile);
      render(profile, transactions);
    } catch (error) {
      showAlert(
        elements.alertBox,
        getErrorMessage(error, 'Gagal memuat data dashboard. Coba muat ulang halaman.'),
        'error'
      );
      renderTransactionList(elements.recent, [], {
        emptyTitle: 'Data gagal dimuat',
        emptyMessage: 'Periksa koneksi dan konfigurasi Supabase, lalu muat ulang halaman.',
      });
      renderCategoryBreakdown(elements.breakdown, [], 0);
    }
  }

  elements.addButton?.addEventListener('click', () => {
    openTransactionForm({
      categories: state.categories,
      onSaved: loadData,
    });
  });

  await loadData();
}

if (document.body?.dataset.page === 'dashboard') {
  initDashboardPage();
}
