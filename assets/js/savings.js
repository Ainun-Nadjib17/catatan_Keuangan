import { getClient } from './supabase.js';
import { initAppShell, loadSidebarCategories, showConfigNotice } from './layout.js';
import { openTransactionForm } from './transactions.js';
import {
  deleteTransactionWithConfirm,
  fetchCategories,
  fetchTransactions,
  formatRupiah,
  getErrorMessage,
  refreshIcons,
  renderTransactionList,
  setLoading,
  showAlert,
  showToast,
  summarize,
} from './utils.js';

async function initSavingsPage() {
  if (!getClient()) {
    showConfigNotice();
    return;
  }

  const session = await initAppShell({
    active: 'savings',
    title: 'Tabungan',
    eyebrow: 'Tabungan',
  });
  if (!session) return;

  await loadSidebarCategories();

  const elements = {
    alertBox: document.getElementById('page-alert'),
    balance: document.getElementById('savings-balance'),
    saved: document.getElementById('savings-saved'),
    withdrawn: document.getElementById('savings-withdrawn'),
    count: document.getElementById('savings-count'),
    list: document.getElementById('savings-list'),
    addButton: document.getElementById('add-savings'),
    withdrawButton: document.getElementById('withdraw-savings'),
  };

  const state = {
    categories: [],
    transactions: [],
  };

  function renderList() {
    renderTransactionList(elements.list, state.transactions, {
      onEdit: (transaction) => {
        openTransactionForm({
          transaction,
          categories: state.categories,
          onSaved: loadData,
        });
      },
      onDelete: async (transaction) => {
        const shouldReload = await deleteTransactionWithConfirm(transaction);
        if (shouldReload) await loadData();
      },
      emptyTitle: 'Belum ada aktivitas tabungan',
      emptyMessage:
        'Mulai menabung lewat tombol Menabung di kanan atas, atau tambahkan catatan dari halaman transaksi.',
    });
  }

  function render() {
    const summary = summarize(state.transactions, 0);

    elements.balance.textContent = formatRupiah(summary.savings);
    elements.saved.textContent = formatRupiah(summary.saved);
    elements.withdrawn.textContent = formatRupiah(summary.withdrawn);
    elements.count.textContent = String(state.transactions.length);

    renderList();
  }

  async function loadData() {
    if (elements.alertBox) elements.alertBox.hidden = true;
    setLoading(elements.list, 'Memuat riwayat tabungan…');

    try {
      const [categories, transactions] = await Promise.all([
        fetchCategories(),
        fetchTransactions(),
      ]);

      state.categories = categories;
      state.transactions = transactions.filter(
        (transaction) => transaction.type === 'save' || transaction.type === 'unsave'
      );

      render();
    } catch (error) {
      showAlert(
        elements.alertBox,
        getErrorMessage(error, 'Gagal memuat tabungan. Coba muat ulang halaman.'),
        'error'
      );
      renderTransactionList(elements.list, [], {
        emptyTitle: 'Data gagal dimuat',
        emptyMessage: 'Periksa koneksi dan konfigurasi Supabase, lalu muat ulang halaman.',
      });
    }
  }

  elements.addButton?.addEventListener('click', () => {
    openTransactionForm({
      categories: state.categories,
      defaultType: 'save',
      onSaved: async () => {
        await loadData();
        showToast('Tabungan diperbarui.');
      },
    });
  });

  elements.withdrawButton?.addEventListener('click', () => {
    openTransactionForm({
      categories: state.categories,
      defaultType: 'unsave',
      onSaved: async () => {
        await loadData();
        showToast('Tabungan diperbarui.');
      },
    });
  });

  await loadData();
}

if (document.body?.dataset.page === 'savings') {
  initSavingsPage();
}
