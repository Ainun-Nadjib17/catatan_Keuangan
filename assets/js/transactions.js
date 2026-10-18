import { getClient } from './supabase.js';
import { initAppShell, loadSidebarCategories, showConfigNotice } from './layout.js';
import {
  MAX_AMOUNT,
  debounce,
  deleteTransactionWithConfirm,
  fetchCategories,
  fetchProfile,
  fetchTransactions,
  formatRupiah,
  getErrorMessage,
  hideAlert,
  isValidDateString,
  parseAmount,
  refreshIcons,
  renderTransactionList,
  setButtonLoading,
  setLoading,
  showAlert,
  showToast,
  summarize,
  todayISO,
} from './utils.js';

/* -------------------------------------------------------------------------- */
/* Modal tambah/edit transaksi (dipakai juga oleh dashboard & kategori)       */
/* -------------------------------------------------------------------------- */

export async function openTransactionForm({
  transaction = null,
  categories = null,
  defaultCategoryId = null,
  defaultType = null,
  onSaved = null,
} = {}) {
  const client = getClient();
  if (!client) {
    showToast('Supabase belum dikonfigurasi.', 'error');
    return;
  }

  let categoryList = categories;

  if (!categoryList) {
    try {
      categoryList = await fetchCategories();
    } catch (error) {
      showToast(getErrorMessage(error, 'Gagal memuat kategori.'), 'error');
      return;
    }
  }

  let userId = null;
  try {
    const { data } = await client.auth.getSession();
    userId = data?.session?.user?.id ?? null;
  } catch (error) {
    console.error('Gagal memeriksa sesi:', error.message);
  }

  if (!userId) {
    showToast('Sesi kamu berakhir. Silakan masuk kembali.', 'error');
    return;
  }

  const dialog = document.createElement('dialog');
  dialog.className = 'modal';
  dialog.setAttribute('aria-labelledby', 'tx-modal-title');

  dialog.innerHTML = `
    <form class="modal-card" novalidate>
      <div class="modal-head">
        <div>
          <p class="eyebrow">${transaction ? 'Ubah catatan' : 'Catatan baru'}</p>
          <h2 id="tx-modal-title">${transaction ? 'Edit transaksi' : 'Tambah transaksi'}</h2>
        </div>
        <button type="button" class="icon-btn" data-close aria-label="Tutup">
          <i data-lucide="x" aria-hidden="true"></i>
        </button>
      </div>

      <div class="alert" data-form-error role="alert" hidden></div>

      <div class="field">
        <label for="tx-type">Jenis transaksi</label>
        <select id="tx-type" name="type">
          <option value="expense">Pengeluaran</option>
          <option value="income">Pemasukan</option>
          <option value="save">Menabung</option>
          <option value="unsave">Tarik tabungan</option>
        </select>
      </div>

      <div class="field">
        <label for="tx-category">Kategori</label>
        <select id="tx-category" name="category_id" required></select>
      </div>

      <div class="field">
        <label for="tx-amount">Nominal (Rp)</label>
        <input
          id="tx-amount"
          name="amount"
          class="input amount-input"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          placeholder="0"
          required
        />
        <p class="hint" data-amount-preview>Rp0</p>
      </div>

      <div class="field">
        <label for="tx-date">Tanggal</label>
        <input id="tx-date" name="transaction_date" class="input" type="date" required />
      </div>

      <div class="field">
        <label for="tx-description">Deskripsi</label>
        <input
          id="tx-description"
          name="description"
          class="input"
          type="text"
          maxlength="200"
          autocomplete="off"
          placeholder="Contoh: Makan siang di kantin"
          required
        />
      </div>

      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-close>Batal</button>
        <button type="submit" class="btn btn-primary">
          <span data-label>${transaction ? 'Simpan perubahan' : 'Simpan transaksi'}</span>
        </button>
      </div>
    </form>
  `;

  document.body.appendChild(dialog);

  const form = dialog.querySelector('form');
  const typeSelect = form.querySelector('#tx-type');
  const categorySelect = form.querySelector('#tx-category');
  const amountInput = form.querySelector('#tx-amount');
  const amountPreview = form.querySelector('[data-amount-preview]');
  const dateInput = form.querySelector('#tx-date');
  const descriptionInput = form.querySelector('#tx-description');
  const errorBox = form.querySelector('[data-form-error]');
  const submitButton = form.querySelector('button[type="submit"]');

  const today = todayISO();
  dateInput.max = today;

  const defaultCategory = defaultCategoryId
    ? categoryList.find((category) => category.id === defaultCategoryId)
    : null;

  const initialType =
    transaction?.type ??
    defaultType ??
    (defaultCategory?.is_savings ? 'save' : 'expense');

  typeSelect.value = initialType;
  dateInput.value = transaction?.transaction_date ?? today;
  descriptionInput.value = transaction?.description ?? '';

  if (transaction) {
    amountInput.value = new Intl.NumberFormat('id-ID').format(transaction.amount);
  }

  function syncAmountPreview() {
    const amount = parseAmount(amountInput.value);
    amountPreview.textContent = Number.isFinite(amount)
      ? formatRupiah(amount)
      : 'Masukkan nominal';
  }

  function populateCategories(preferredId = null) {
    const wantsSavings = typeSelect.value === 'save' || typeSelect.value === 'unsave';
    const options = categoryList.filter(
      (category) => Boolean(category.is_savings) === wantsSavings
    );
    const previous = preferredId ?? categorySelect.value;

    categorySelect.replaceChildren();

    if (options.length === 0) {
      const emptyOption = new Option(
        wantsSavings ? 'Kategori Nabung belum tersedia' : 'Belum ada kategori',
        ''
      );
      emptyOption.disabled = true;
      categorySelect.add(emptyOption);
      categorySelect.disabled = true;
      return;
    }

    for (const category of options) {
      categorySelect.add(new Option(category.name, category.id));
    }

    categorySelect.disabled = false;

    if (options.some((category) => category.id === previous)) {
      categorySelect.value = previous;
    }
  }

  populateCategories(transaction?.category_id ?? defaultCategoryId);
  syncAmountPreview();

  typeSelect.addEventListener('change', () => {
    hideAlert(errorBox);
    populateCategories();
  });

  amountInput.addEventListener('input', () => {
    const digits = amountInput.value.replace(/[^\d]/g, '').slice(0, 15);
    amountInput.value = digits ? new Intl.NumberFormat('id-ID').format(Number(digits)) : '';
    syncAmountPreview();
  });

  function closeDialog() {
    dialog.close();
  }

  for (const closeButton of form.querySelectorAll('[data-close]')) {
    closeButton.addEventListener('click', closeDialog);
  }

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  dialog.addEventListener('close', () => {
    dialog.remove();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert(errorBox);

    const description = descriptionInput.value.trim();
    const amount = parseAmount(amountInput.value);
    const categoryId = categorySelect.value;
    const transactionDate = dateInput.value;

    if (!description) {
      showAlert(errorBox, 'Deskripsi transaksi wajib diisi.');
      descriptionInput.focus();
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      showAlert(errorBox, 'Nominal harus lebih dari 0.');
      amountInput.focus();
      return;
    }

    if (amount > MAX_AMOUNT) {
      showAlert(errorBox, 'Nominal terlalu besar.');
      amountInput.focus();
      return;
    }

    if (!isValidDateString(transactionDate)) {
      showAlert(errorBox, 'Tanggal transaksi tidak valid.');
      dateInput.focus();
      return;
    }

    if (transactionDate > todayISO()) {
      showAlert(errorBox, 'Tanggal transaksi tidak boleh melewati hari ini.');
      dateInput.focus();
      return;
    }

    if (!categoryId) {
      showAlert(errorBox, 'Pilih kategori terlebih dahulu.');
      categorySelect.focus();
      return;
    }

    const payload = {
      description,
      amount,
      type: typeSelect.value,
      category_id: categoryId,
      transaction_date: transactionDate,
    };

    setButtonLoading(submitButton, true, 'Menyimpan…');

    let error = null;
    let saved = null;

    if (transaction) {
      const response = await client
        .from('transactions')
        .update(payload)
        .eq('id', transaction.id)
        .select('id');
      error = response.error;
      saved = response.data;
    } else {
      const response = await client
        .from('transactions')
        .insert({ ...payload, user_id: userId })
        .select('id');
      error = response.error;
      saved = response.data;
    }

    if (error) {
      showAlert(errorBox, getErrorMessage(error, 'Gagal menyimpan transaksi.'));
      setButtonLoading(submitButton, false);
      return;
    }

    if (!saved || saved.length === 0) {
      showAlert(
        errorBox,
        'Transaksi tidak ditemukan atau bukan milik akun ini. Coba muat ulang halaman.'
      );
      setButtonLoading(submitButton, false);
      return;
    }

    closeDialog();
    showToast(transaction ? 'Perubahan transaksi disimpan.' : 'Transaksi berhasil disimpan.');
    onSaved?.();
  });

  dialog.showModal();
  refreshIcons();

  if (transaction) {
    descriptionInput.focus();
    descriptionInput.setSelectionRange(descriptionInput.value.length, descriptionInput.value.length);
  } else {
    descriptionInput.focus();
  }
}

/* -------------------------------------------------------------------------- */
/* Halaman transaksi                                                          */
/* -------------------------------------------------------------------------- */

async function initTransactionsPage() {
  if (!getClient()) {
    showConfigNotice();
    return;
  }

  const session = await initAppShell({
    active: 'transactions',
    title: 'Transaksi',
    eyebrow: 'Arus kas',
  });
  if (!session) return;

  await loadSidebarCategories();

  const elements = {
    alertBox: document.getElementById('page-alert'),
    list: document.getElementById('transaction-list'),
    listCount: document.getElementById('trx-list-count'),
    balance: document.getElementById('trx-balance'),
    income: document.getElementById('trx-income'),
    expense: document.getElementById('trx-expense'),
    count: document.getElementById('trx-count'),
    search: document.getElementById('filter-search'),
    category: document.getElementById('filter-category'),
    type: document.getElementById('filter-type'),
    from: document.getElementById('filter-from'),
    to: document.getElementById('filter-to'),
    reset: document.getElementById('filter-reset'),
    addButton: document.getElementById('add-transaction'),
  };

  const state = {
    profile: null,
    categories: [],
    transactions: [],
  };

  function getFilters() {
    return {
      query: elements.search?.value.trim().toLowerCase() ?? '',
      categoryId: elements.category?.value ?? '',
      type: elements.type?.value ?? '',
      from: elements.from?.value ?? '',
      to: elements.to?.value ?? '',
    };
  }

  function applyFilters() {
    const filters = getFilters();

    return state.transactions.filter((transaction) => {
      if (filters.query && !transaction.description.toLowerCase().includes(filters.query)) {
        return false;
      }
      if (filters.categoryId && transaction.category_id !== filters.categoryId) {
        return false;
      }
      if (filters.type && transaction.type !== filters.type) {
        return false;
      }
      if (filters.from && transaction.transaction_date < filters.from) {
        return false;
      }
      if (filters.to && transaction.transaction_date > filters.to) {
        return false;
      }
      return true;
    });
  }

  function populateCategoryFilter() {
    const current = elements.category.value;
    elements.category.replaceChildren(new Option('Semua kategori', ''));

    for (const category of state.categories) {
      elements.category.add(new Option(category.name, category.id));
    }

    if ([...elements.category.options].some((option) => option.value === current)) {
      elements.category.value = current;
    }
  }

  function render() {
    if (!state.profile) return;

    const filtered = applyFilters();
    const overall = summarize(state.transactions, state.profile.initial_balance);
    const shown = summarize(filtered, 0);

    elements.balance.textContent = formatRupiah(overall.available);
    elements.income.textContent = formatRupiah(shown.income);
    elements.expense.textContent = formatRupiah(shown.expense);
    elements.count.textContent = String(filtered.length);

    elements.listCount.textContent = `${filtered.length} dari ${state.transactions.length} transaksi`;

    renderTransactionList(elements.list, filtered, {
      onEdit: (transaction) => {
        openTransactionForm({
          transaction,
          categories: state.categories,
          onSaved: loadData,
        });
      },
      onDelete: handleDelete,
      emptyTitle: state.transactions.length === 0 ? 'Belum ada transaksi' : 'Tidak ada hasil',
      emptyMessage:
        state.transactions.length === 0
          ? 'Mulai catat pemasukan atau pengeluaran pertamamu lewat tombol tambah transaksi.'
          : 'Coba ubah kata kunci atau filter yang kamu pakai.',
    });
  }

  async function handleDelete(transaction) {
    const shouldReload = await deleteTransactionWithConfirm(transaction);
    if (shouldReload) await loadData();
  }

  async function loadData() {
    hideAlert(elements.alertBox);
    setLoading(elements.list, 'Memuat transaksi…');

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

      state.profile = profile;
      state.categories = categories;
      state.transactions = transactions;

      populateCategoryFilter();
      render();
    } catch (error) {
      showAlert(elements.alertBox, getErrorMessage(error, 'Gagal memuat transaksi.'));
      renderTransactionList(elements.list, [], {
        emptyTitle: 'Data gagal dimuat',
        emptyMessage: 'Periksa koneksi dan konfigurasi Supabase, lalu muat ulang halaman.',
      });
    }
  }

  elements.search?.addEventListener('input', debounce(render, 180));
  elements.category?.addEventListener('change', render);
  elements.type?.addEventListener('change', render);
  elements.from?.addEventListener('change', render);
  elements.to?.addEventListener('change', render);

  elements.reset?.addEventListener('click', () => {
    elements.search.value = '';
    elements.category.value = '';
    elements.type.value = '';
    elements.from.value = '';
    elements.to.value = '';
    render();
    elements.search.focus();
  });

  elements.addButton?.addEventListener('click', () => {
    openTransactionForm({
      categories: state.categories,
      onSaved: loadData,
    });
  });

  await loadData();
}

if (document.body?.dataset.page === 'transactions') {
  initTransactionsPage();
}
