import { getClient } from './supabase.js';

/** Batas atas nominal agar tetap aman di BIGINT dan JavaScript. */
export const MAX_AMOUNT = 999_999_999_999_999;

export const TYPE_META = {
  income: { label: 'Pemasukan', sign: '+', tone: 'income', icon: 'arrow-down-left' },
  expense: { label: 'Pengeluaran', sign: '−', tone: 'expense', icon: 'arrow-up-right' },
  save: { label: 'Menabung', sign: '−', tone: 'save', icon: 'piggy-bank' },
  unsave: { label: 'Tarik tabungan', sign: '+', tone: 'unsave', icon: 'arrow-down-to-line' },
};

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const longDateFormatter = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/* -------------------------------------------------------------------------- */
/* Format & parsing                                                           */
/* -------------------------------------------------------------------------- */

export function formatRupiah(value) {
  const amount = Number(value ?? 0);
  return rupiahFormatter.format(Number.isFinite(amount) ? amount : 0);
}

export function formatDate(value) {
  if (!value) return '—';
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return '—';

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

export function formatLongDate(date = new Date()) {
  return longDateFormatter.format(date);
}

export function todayISO() {
  const now = new Date();
  const pad = (part) => String(part).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Mengubah "Rp 1.250.000" atau "1250000" menjadi 1250000. */
export function parseAmount(value) {
  const digits = String(value ?? '').replace(/[^\d]/g, '');
  if (!digits) return Number.NaN;
  const amount = Number(digits);
  return Number.isSafeInteger(amount) ? amount : Number.NaN;
}

export function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function initials(nameOrEmail) {
  const source = String(nameOrEmail ?? '').trim();
  if (!source) return 'U';

  const words = source.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

/* -------------------------------------------------------------------------- */
/* Kalkulasi keuangan (satu sumber aturan untuk semua halaman)                 */
/* -------------------------------------------------------------------------- */

export function summarize(transactions = [], initialBalance = 0) {
  let income = 0;
  let expense = 0;
  let saved = 0;
  let withdrawn = 0;

  for (const transaction of transactions) {
    const amount = Number(transaction.amount) || 0;
    switch (transaction.type) {
      case 'income':
        income += amount;
        break;
      case 'expense':
        expense += amount;
        break;
      case 'save':
        saved += amount;
        break;
      case 'unsave':
        withdrawn += amount;
        break;
      default:
        break;
    }
  }

  return {
    income,
    expense,
    saved,
    withdrawn,
    savings: saved - withdrawn,
    available: Number(initialBalance || 0) + income - expense - saved + withdrawn,
  };
}

export function groupExpensesByCategory(transactions = []) {
  const groups = new Map();

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue;

    const category = transaction.categories ?? {};
    const key = category.id ?? transaction.category_id ?? 'unknown';
    const current = groups.get(key) ?? {
      id: key,
      name: category.name ?? 'Tanpa kategori',
      icon: category.icon ?? 'circle',
      amount: 0,
      count: 0,
    };

    current.amount += Number(transaction.amount) || 0;
    current.count += 1;
    groups.set(key, current);
  }

  return [...groups.values()].sort((a, b) => b.amount - a.amount);
}

/* -------------------------------------------------------------------------- */
/* Error                                                                      */
/* -------------------------------------------------------------------------- */

export function getErrorMessage(error, fallback = 'Terjadi kesalahan. Coba lagi.') {
  const message = String(error?.message ?? '').trim();
  if (!message) return fallback;

  if (/duplicate key|already exists/i.test(message)) {
    return 'Nama sudah digunakan. Pilih nama lain.';
  }

  if (/new row violates row-level security/i.test(message)) {
    return 'Kamu tidak punya akses ke data ini.';
  }

  if (/JWT expired|invalid claim|not authenticated|session.*missing/i.test(message)) {
    return 'Sesi kamu berakhir. Silakan masuk kembali.';
  }

  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
    return 'Gagal terhubung ke server. Periksa koneksi internetmu.';
  }

  return message;
}

/* -------------------------------------------------------------------------- */
/* Data access (selalu lewat RLS pengguna yang sedang login)                   */
/* -------------------------------------------------------------------------- */

export async function fetchProfile(userId) {
  const client = getClient();
  if (!client) throw new Error('Supabase belum dikonfigurasi.');

  const { data, error } = await client
    .from('profiles')
    .select('id, full_name, initial_balance, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function fetchCategories() {
  const client = getClient();
  if (!client) throw new Error('Supabase belum dikonfigurasi.');

  const { data, error } = await client
    .from('categories')
    .select('id, user_id, name, icon, is_savings, created_at')
    .order('created_at', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchTransactions() {
  const client = getClient();
  if (!client) throw new Error('Supabase belum dikonfigurasi.');

  const { data, error } = await client
    .from('transactions')
    .select(
      'id, user_id, category_id, description, amount, type, transaction_date, created_at, categories ( id, name, icon, is_savings )'
    )
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/* -------------------------------------------------------------------------- */
/* UI helpers                                                                 */
/* -------------------------------------------------------------------------- */

export function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
  }
}

export function showAlert(container, message, variant = 'error') {
  if (!container) return;
  container.textContent = message;
  container.hidden = false;
  container.className = `alert alert-${variant}`;
}

export function hideAlert(container) {
  if (!container) return;
  container.hidden = true;
  container.textContent = '';
}

export function showToast(message, variant = 'success') {
  let region = document.getElementById('toast-region');
  if (!region) {
    region = document.createElement('div');
    region.id = 'toast-region';
    region.className = 'toast-region';
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${variant}`;
  toast.setAttribute('role', 'status');

  const icon = document.createElement('i');
  icon.setAttribute('data-lucide', variant === 'error' ? 'alert-circle' : 'check');
  icon.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.textContent = message;

  toast.append(icon, text);
  region.appendChild(toast);
  refreshIcons();

  window.setTimeout(() => {
    toast.classList.add('is-leaving');
    window.setTimeout(() => toast.remove(), 220);
  }, 4000);
}

export function setLoading(container, message = 'Memuat data…') {
  if (!container) return;
  container.replaceChildren();

  const wrapper = document.createElement('div');
  wrapper.className = 'loading-state';

  const spinner = document.createElement('span');
  spinner.className = 'spinner';
  spinner.setAttribute('aria-hidden', 'true');

  const label = document.createElement('p');
  label.textContent = message;

  wrapper.append(spinner, label);
  container.appendChild(wrapper);
}

export function setButtonLoading(button, loading, loadingLabel = 'Memproses…') {
  if (!button) return;

  const label = button.querySelector('[data-label]') ?? button;

  if (loading) {
    if (!button.dataset.idleLabel) {
      button.dataset.idleLabel = label.textContent;
    }
    button.disabled = true;
    button.classList.add('is-loading');
    label.textContent = loadingLabel;
    return;
  }

  button.disabled = false;
  button.classList.remove('is-loading');
  if (button.dataset.idleLabel) {
    label.textContent = button.dataset.idleLabel;
    delete button.dataset.idleLabel;
  }
}

export function emptyState({
  icon = 'inbox',
  title = 'Belum ada data',
  message = '',
  action = null,
} = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'empty-state';

  const iconWrap = document.createElement('span');
  iconWrap.className = 'empty-icon';
  const iconEl = document.createElement('i');
  iconEl.setAttribute('data-lucide', icon);
  iconEl.setAttribute('aria-hidden', 'true');
  iconWrap.appendChild(iconEl);

  const heading = document.createElement('p');
  heading.className = 'empty-title';
  heading.textContent = title;

  wrapper.append(iconWrap, heading);

  if (message) {
    const description = document.createElement('p');
    description.className = 'empty-message';
    description.textContent = message;
    wrapper.appendChild(description);
  }

  if (action) {
    const link = document.createElement('a');
    link.className = 'btn btn-ghost btn-sm';
    link.href = action.href;
    link.textContent = action.label;
    wrapper.appendChild(link);
  }

  return wrapper;
}

export function renderTransactionList(
  container,
  transactions,
  { onEdit = null, onDelete = null, emptyTitle, emptyMessage } = {}
) {
  if (!container) return;
  container.replaceChildren();

  if (!transactions || transactions.length === 0) {
    container.appendChild(
      emptyState({
        icon: 'receipt-text',
        title: emptyTitle ?? 'Belum ada transaksi',
        message:
          emptyMessage ??
          'Transaksi yang kamu catat akan muncul di sini. Mulai dari tombol tambah transaksi.',
      })
    );
    refreshIcons();
    return;
  }

  const list = document.createElement('ul');
  list.className = 'tx-list';

  for (const transaction of transactions) {
    const meta = TYPE_META[transaction.type] ?? TYPE_META.expense;
    const category = transaction.categories ?? {};
    const iconName = /^[a-z0-9-]+$/.test(String(category.icon ?? ''))
      ? category.icon
      : meta.icon;

    const item = document.createElement('li');
    item.className = 'tx-item';

    const iconWrap = document.createElement('span');
    iconWrap.className = `tx-icon tone-${meta.tone}`;
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', iconName);
    icon.setAttribute('aria-hidden', 'true');
    iconWrap.appendChild(icon);

    const body = document.createElement('div');
    body.className = 'tx-body';

    const description = document.createElement('p');
    description.className = 'tx-description';
    description.textContent = transaction.description;

    const details = document.createElement('p');
    details.className = 'tx-meta';
    details.textContent = `${category.name ?? 'Tanpa kategori'} · ${formatDate(
      transaction.transaction_date
    )}`;

    body.append(description, details);

    const trailing = document.createElement('div');
    trailing.className = 'tx-trailing';

    const amount = document.createElement('p');
    amount.className = `tx-amount tone-${meta.tone}`;
    amount.textContent = `${meta.sign}${formatRupiah(transaction.amount)}`;

    const typeLabel = document.createElement('p');
    typeLabel.className = 'tx-type';
    typeLabel.textContent = meta.label;

    trailing.append(amount, typeLabel);

    item.append(iconWrap, body, trailing);

    if (onEdit || onDelete) {
      const actions = document.createElement('div');
      actions.className = 'tx-actions';

      if (onEdit) {
        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'icon-btn icon-btn-sm';
        editButton.setAttribute('aria-label', `Edit transaksi ${transaction.description}`);
        editButton.innerHTML = '<i data-lucide="pencil" aria-hidden="true"></i>';
        editButton.addEventListener('click', () => onEdit(transaction));
        actions.appendChild(editButton);
      }

      if (onDelete) {
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'icon-btn icon-btn-sm danger';
        deleteButton.setAttribute('aria-label', `Hapus transaksi ${transaction.description}`);
        deleteButton.innerHTML = '<i data-lucide="trash-2" aria-hidden="true"></i>';
        deleteButton.addEventListener('click', () => onDelete(transaction));
        actions.appendChild(deleteButton);
      }

      item.appendChild(actions);
    }

    list.appendChild(item);
  }

  container.appendChild(list);
  refreshIcons();
}

/**
 * Konfirmasi lalu hapus transaksi lewat Supabase.
 * Mengembalikan `true` bila data perlu dimuat ulang (hapus berhasil,
 * karena baris milik pengguna lain tidak akan pernah terhapus).
 */
export async function deleteTransactionWithConfirm(transaction) {
  const confirmed = await confirmAction({
    title: 'Hapus transaksi?',
    message: `"${transaction.description}" sebesar ${formatRupiah(
      transaction.amount
    )} akan dihapus permanen dan saldo dihitung ulang.`,
    confirmLabel: 'Hapus transaksi',
  });

  if (!confirmed) return false;

  const client = getClient();
  const { data, error } = await client
    .from('transactions')
    .delete()
    .eq('id', transaction.id)
    .select('id');

  if (error) {
    showToast(getErrorMessage(error, 'Gagal menghapus transaksi.'), 'error');
    return false;
  }

  if (!data || data.length === 0) {
    showToast('Transaksi tidak ditemukan atau sudah dihapus.', 'error');
    return true;
  }

  showToast('Transaksi dihapus.');
  return true;
}

export function debounce(callback, delay = 200) {
  let timer = null;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => callback(...args), delay);
  };
}

/** Dialog konfirmasi untuk aksi destruktif. */
export function confirmAction({
  title = 'Konfirmasi',
  message = '',
  confirmLabel = 'Lanjutkan',
  cancelLabel = 'Batal',
  danger = true,
} = {}) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'modal confirm-modal';

    const form = document.createElement('form');
    form.method = 'dialog';
    form.className = 'modal-card';

    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = danger ? 'Tindakan permanen' : 'Konfirmasi';

    const heading = document.createElement('h2');
    heading.textContent = title;

    const description = document.createElement('p');
    description.className = 'muted';
    description.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const cancelButton = document.createElement('button');
    cancelButton.type = 'submit';
    cancelButton.value = 'cancel';
    cancelButton.className = 'btn btn-ghost';
    cancelButton.textContent = cancelLabel;

    const confirmButton = document.createElement('button');
    confirmButton.type = 'submit';
    confirmButton.value = 'confirm';
    confirmButton.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
    confirmButton.textContent = confirmLabel;

    actions.append(cancelButton, confirmButton);
    form.append(eyebrow, heading, description, actions);
    dialog.appendChild(form);

    dialog.addEventListener('close', () => {
      const confirmed = dialog.returnValue === 'confirm';
      dialog.remove();
      resolve(confirmed);
    });

    document.body.appendChild(dialog);
    dialog.showModal();
  });
}
