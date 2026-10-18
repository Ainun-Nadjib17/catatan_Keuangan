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

async function initCategoryPage() {
  if (!getClient()) {
    showConfigNotice();
    return;
  }

  const session = await initAppShell({
    active: 'category',
    title: 'Kategori',
    eyebrow: 'Kategori',
  });
  if (!session) return;

  const categoryId = new URLSearchParams(window.location.search).get('id');

  await loadSidebarCategories(categoryId);

  const elements = {
    alertBox: document.getElementById('page-alert'),
    icon: document.getElementById('category-icon'),
    name: document.getElementById('category-name'),
    subtitle: document.getElementById('category-subtitle'),
    labelMain: document.getElementById('cat-label-main'),
    labelSecondary: document.getElementById('cat-label-secondary'),
    labelTertiary: document.getElementById('cat-label-tertiary'),
    valueMain: document.getElementById('cat-value-main'),
    valueSecondary: document.getElementById('cat-value-secondary'),
    valueTertiary: document.getElementById('cat-value-tertiary'),
    count: document.getElementById('cat-count'),
    list: document.getElementById('category-transaction-list'),
    addButton: document.getElementById('add-category-transaction'),
  };

  const state = {
    category: null,
    categories: [],
    transactions: [],
  };

  function showNotFound(message) {
    if (elements.alertBox) showAlert(elements.alertBox, message, 'warning');
    if (elements.name) elements.name.textContent = 'Kategori tidak ditemukan';
    if (elements.subtitle) {
      elements.subtitle.innerHTML =
        '<a class="link" href="index.html">Kembali ke dashboard</a>';
    }
    if (elements.addButton) elements.addButton.disabled = true;
    renderTransactionList(elements.list, [], {
      emptyTitle: 'Tidak ada yang bisa ditampilkan',
      emptyMessage: 'Kategori mungkin sudah dihapus atau bukan milik akun ini.',
    });
  }

  function renderCategoryHeader() {
    const category = state.category;
    const isSavings = Boolean(category.is_savings);

    document.title = `${category.name} · Uangku`;

    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = category.name;

    if (elements.name) elements.name.textContent = category.name;
    if (elements.subtitle) {
      elements.subtitle.textContent = isSavings
        ? 'Kategori khusus untuk menabung dan menarik tabungan.'
        : 'Semua transaksi dengan kategori ini.';
    }

    if (elements.icon) {
      elements.icon.replaceChildren();
      const icon = document.createElement('i');
      icon.setAttribute('data-lucide', /^[a-z0-9-]+$/.test(category.icon) ? category.icon : 'circle');
      icon.setAttribute('aria-hidden', 'true');
      elements.icon.appendChild(icon);
    }

    if (elements.addButton) {
      elements.addButton.querySelector('span').textContent = isSavings
        ? 'Tambah tabungan'
        : 'Tambah transaksi';
    }
  }

  function renderSummary() {
    const isSavings = Boolean(state.category.is_savings);
    const summary = summarize(state.transactions, 0);

    if (isSavings) {
      elements.labelMain.textContent = 'Saldo tabungan';
      elements.labelSecondary.textContent = 'Total menabung';
      elements.labelTertiary.textContent = 'Total penarikan';

      elements.valueMain.textContent = formatRupiah(summary.savings);
      elements.valueSecondary.textContent = formatRupiah(summary.saved);
      elements.valueTertiary.textContent = formatRupiah(summary.withdrawn);
    } else {
      const expenseCount = state.transactions.filter((item) => item.type === 'expense').length;

      elements.labelMain.textContent = 'Total pengeluaran';
      elements.labelSecondary.textContent = 'Total pemasukan';
      elements.labelTertiary.textContent = 'Rata-rata pengeluaran';

      elements.valueMain.textContent = formatRupiah(summary.expense);
      elements.valueSecondary.textContent = formatRupiah(summary.income);
      elements.valueTertiary.textContent = formatRupiah(
        expenseCount > 0 ? Math.round(summary.expense / expenseCount) : 0
      );
    }

    elements.count.textContent = String(state.transactions.length);
  }

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
      emptyTitle: 'Belum ada transaksi di kategori ini',
      emptyMessage: state.category.is_savings
        ? 'Catat tabungan pertamamu lewat tombol tambah tabungan.'
        : 'Tambahkan transaksi dengan kategori ini untuk melihat riwayatnya.',
    });
  }

  async function loadData() {
    if (!categoryId) {
      showNotFound('Parameter kategori tidak ada di URL.');
      return;
    }

    setLoading(elements.list, 'Memuat transaksi kategori…');

    try {
      const [categories, transactions] = await Promise.all([
        fetchCategories(),
        fetchTransactions(),
      ]);

      const category = categories.find((item) => item.id === categoryId);

      if (!category) {
        showNotFound('Kategori tidak ditemukan atau bukan milik akun ini.');
        return;
      }

      state.category = category;
      state.categories = categories;
      state.transactions = transactions.filter(
        (transaction) => transaction.category_id === category.id
      );

      if (elements.alertBox) elements.alertBox.hidden = true;

      renderCategoryHeader();
      renderSummary();
      renderList();
      refreshIcons();
    } catch (error) {
      showAlert(
        elements.alertBox,
        getErrorMessage(error, 'Gagal memuat kategori.'),
        'error'
      );
      renderTransactionList(elements.list, [], {
        emptyTitle: 'Data gagal dimuat',
        emptyMessage: 'Periksa koneksi dan konfigurasi Supabase, lalu muat ulang halaman.',
      });
    }
  }

  elements.addButton?.addEventListener('click', () => {
    if (!state.category) return;

    openTransactionForm({
      categories: state.categories,
      defaultCategoryId: state.category.id,
      defaultType: state.category.is_savings ? 'save' : 'expense',
      onSaved: async () => {
        await loadData();
        showToast('Kategori diperbarui.');
      },
    });
  });

  await loadData();
}

if (document.body?.dataset.page === 'category') {
  initCategoryPage();
}
