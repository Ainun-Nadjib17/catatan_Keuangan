import { getClient } from './supabase.js';
import { initAppShell, loadSidebarCategories, updateSidebarUser, showConfigNotice } from './layout.js';
import {
  fetchCategories,
  fetchProfile,
  fetchTransactions,
  formatRupiah,
  formatDate,
  getErrorMessage,
  hideAlert,
  parseAmount,
  refreshIcons,
  setButtonLoading,
  setLoading,
  showAlert,
  showToast,
  confirmAction,
  summarize,
} from './utils.js';

const CATEGORY_ICONS = [
  'circle',
  'utensils',
  'coffee',
  'shopping-bag',
  'shopping-cart',
  'bus',
  'car',
  'plane',
  'graduation-cap',
  'book-open',
  'home',
  'heart-pulse',
  'gamepad-2',
  'music',
  'film',
  'gift',
  'smartphone',
  'more-horizontal',
];

function buildDialog({ title, eyebrowText = 'Pengaturan' }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'modal';
  dialog.setAttribute('aria-labelledby', 'settings-dialog-title');

  const form = document.createElement('form');
  form.className = 'modal-card';
  form.novalidate = true;

  const head = document.createElement('div');
  head.className = 'modal-head';
  head.innerHTML = `
    <div>
      <p class="eyebrow">${eyebrowText}</p>
      <h2 id="settings-dialog-title">${title}</h2>
    </div>
    <button type="button" class="icon-btn" data-close aria-label="Tutup">
      <i data-lucide="x" aria-hidden="true"></i>
    </button>
  `;

  form.append(head);
  dialog.appendChild(form);
  document.body.appendChild(dialog);

  for (const button of form.querySelectorAll('[data-close]')) {
    button.addEventListener('click', () => dialog.close());
  }

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  dialog.addEventListener('close', () => dialog.remove());

  return { dialog, form };
}

async function initSettingsPage() {
  if (!getClient()) {
    showConfigNotice();
    return;
  }

  const session = await initAppShell({
    active: 'settings',
    title: 'Pengaturan',
    eyebrow: 'Akun & preferensi',
  });
  if (!session) return;

  await loadSidebarCategories();

  const elements = {
    alertBox: document.getElementById('page-alert'),
    accountEmail: document.getElementById('account-email'),
    accountJoined: document.getElementById('account-joined'),
    accountName: document.getElementById('account-name'),
    nameForm: document.getElementById('name-form'),
    nameInput: document.getElementById('name-input'),
    balanceCurrent: document.getElementById('balance-current'),
    balanceForm: document.getElementById('balance-form'),
    balanceInput: document.getElementById('balance-input'),
    balanceAvailable: document.getElementById('balance-available'),
    categoryList: document.getElementById('category-manage-list'),
    categoryCount: document.getElementById('category-count'),
    addForm: document.getElementById('add-category-form'),
    addName: document.getElementById('category-new-name'),
    addIcon: document.getElementById('category-new-icon'),
    addError: document.getElementById('add-category-error'),
  };

  const client = getClient();
  const state = {
    profile: null,
    categories: [],
    transactions: [],
  };

  for (const icon of CATEGORY_ICONS) {
    elements.addIcon.add(new Option(icon, icon));
  }

  /* ---------- Profil ------------------------------------------------------ */

  function renderProfile() {
    const profile = state.profile;

    elements.accountEmail.textContent = session.user.email ?? '—';
    elements.accountJoined.textContent = formatDate(profile.created_at?.slice(0, 10));
    elements.accountName.textContent = profile.full_name?.trim() || 'Belum diisi';
    elements.balanceCurrent.textContent = formatRupiah(profile.initial_balance);

    if (!elements.nameInput.value) {
      elements.nameInput.value = profile.full_name?.trim() ?? '';
    }

    elements.balanceInput.placeholder = new Intl.NumberFormat('id-ID').format(
      profile.initial_balance
    );
  }

  function renderAvailableBalance() {
    const summary = summarize(state.transactions, state.profile.initial_balance);
    elements.balanceAvailable.textContent = `Saldo tersedia saat ini: ${formatRupiah(
      summary.available
    )}`;
  }

  elements.nameForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert(elements.alertBox);

    const name = elements.nameInput.value.trim();
    if (name.length > 80) {
      showAlert(elements.alertBox, 'Nama maksimal 80 karakter.');
      return;
    }

    const button = elements.nameForm.querySelector('button[type="submit"]');
    setButtonLoading(button, true, 'Menyimpan…');

    const { error } = await client
      .from('profiles')
      .update({ full_name: name || null })
      .eq('id', session.user.id);

    if (error) {
      showAlert(elements.alertBox, getErrorMessage(error, 'Gagal menyimpan nama.'));
      setButtonLoading(button, false);
      return;
    }

    state.profile.full_name = name || null;
    elements.accountName.textContent = name || 'Belum diisi';
    updateSidebarUser({ fullName: name, email: session.user.email });
    setButtonLoading(button, false);
    showToast('Nama profil diperbarui.');
  });

  /* ---------- Saldo awal -------------------------------------------------- */

  elements.balanceInput.addEventListener('input', () => {
    const digits = elements.balanceInput.value.replace(/[^\d]/g, '').slice(0, 15);
    elements.balanceInput.value = digits
      ? new Intl.NumberFormat('id-ID').format(Number(digits))
      : '';
  });

  elements.balanceForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert(elements.alertBox);

    const amount = parseAmount(elements.balanceInput.value);

    if (!Number.isFinite(amount)) {
      showAlert(elements.alertBox, 'Nominal tidak valid.');
      elements.balanceInput.focus();
      return;
    }

    if (amount === state.profile.initial_balance) {
      hideAlert(elements.alertBox);
      showToast('Saldo awal tidak berubah.');
      return;
    }

    // Pra-validasi: saldo tersedia hasil perubahan tidak boleh negatif.
    const summary = summarize(state.transactions, amount);
    if (summary.available < 0) {
      showAlert(
        elements.alertBox,
        `Saldo awal terlalu kecil: saldo tersedia akan menjadi ${formatRupiah(
          summary.available
        )}. Validasi yang sama juga dijalankan di database.`
      );
      return;
    }

    const button = elements.balanceForm.querySelector('button[type="submit"]');
    setButtonLoading(button, true, 'Menyimpan…');

    const { error } = await client
      .from('profiles')
      .update({ initial_balance: amount })
      .eq('id', session.user.id);

    if (error) {
      showAlert(
        elements.alertBox,
        getErrorMessage(error, 'Gagal menyimpan saldo awal.')
      );
      setButtonLoading(button, false);
      return;
    }

    state.profile.initial_balance = amount;
    elements.balanceInput.value = '';
    elements.balanceInput.placeholder = new Intl.NumberFormat('id-ID').format(amount);
    renderAvailableBalance();
    setButtonLoading(button, false);
    showToast('Saldo awal diperbarui. Riwayat transaksi tidak diubah.');
  });

  /* ---------- Kategori ---------------------------------------------------- */

  function iconOptionsHtml(selected) {
    return CATEGORY_ICONS.map((icon) => {
      const isPicked = icon === selected;
      return `<option value="${icon}" ${isPicked ? 'selected' : ''}>${icon}</option>`;
    }).join('');
  }

  function renderCategories() {
    elements.categoryList.replaceChildren();
    elements.categoryCount.textContent =
      `${state.categories.length} kategori · termasuk 1 kategori tabungan bawaan`;

    if (state.categories.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'nav-empty';
      empty.textContent = 'Belum ada kategori.';
      elements.categoryList.appendChild(empty);
      return;
    }

    for (const category of state.categories) {
      const item = document.createElement('li');
      item.className = 'category-manage-item';

      const iconWrap = document.createElement('span');
      iconWrap.className = 'category-manage-icon';
      const icon = document.createElement('i');
      icon.setAttribute(
        'data-lucide',
        /^[a-z0-9-]+$/.test(category.icon) ? category.icon : 'circle'
      );
      icon.setAttribute('aria-hidden', 'true');
      iconWrap.appendChild(icon);

      const body = document.createElement('div');
      body.className = 'category-manage-body';

      const name = document.createElement('span');
      name.className = 'category-manage-name';
      name.textContent = category.name;

      body.appendChild(name);

      if (category.is_savings) {
        const badge = document.createElement('span');
        badge.className = 'badge badge-accent';
        badge.textContent = 'Khusus tabungan';
        body.appendChild(badge);
      }

      item.append(iconWrap, body);

      if (!category.is_savings) {
        const actions = document.createElement('div');
        actions.className = 'tx-actions';

        const renameButton = document.createElement('button');
        renameButton.type = 'button';
        renameButton.className = 'icon-btn icon-btn-sm';
        renameButton.setAttribute('aria-label', `Ganti nama kategori ${category.name}`);
        renameButton.innerHTML = '<i data-lucide="pencil" aria-hidden="true"></i>';
        renameButton.addEventListener('click', () => renameCategory(category));
        actions.appendChild(renameButton);

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'icon-btn icon-btn-sm danger';
        deleteButton.setAttribute('aria-label', `Hapus kategori ${category.name}`);
        deleteButton.innerHTML = '<i data-lucide="trash-2" aria-hidden="true"></i>';
        deleteButton.addEventListener('click', () => removeCategory(category));
        actions.appendChild(deleteButton);

        item.appendChild(actions);
      }

      elements.categoryList.appendChild(item);
    }

    refreshIcons();
  }

  async function refreshCategoryData() {
    const [categories, transactions] = await Promise.all([
      fetchCategories(),
      fetchTransactions(),
    ]);

    state.categories = categories;
    state.transactions = transactions;
    renderCategories();
  }

  async function renameCategory(category) {
    const { dialog, form } = buildDialog({
      title: 'Ganti nama kategori',
      eyebrowText: 'Kategori',
    });

    const field = document.createElement('div');
    field.className = 'field';

    const label = document.createElement('label');
    label.setAttribute('for', 'rename-input');
    label.textContent = 'Nama kategori baru';

    const input = document.createElement('input');
    input.id = 'rename-input';
    input.className = 'input';
    input.type = 'text';
    input.maxLength = 40;
    input.value = category.name;
    input.autocomplete = 'off';
    input.required = true;

    field.append(label, input);

    const alertBox = document.createElement('div');
    alertBox.className = 'alert';
    alertBox.setAttribute('role', 'alert');
    alertBox.hidden = true;

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn btn-ghost';
    cancel.textContent = 'Batal';
    cancel.addEventListener('click', () => dialog.close());

    const save = document.createElement('button');
    save.type = 'submit';
    save.className = 'btn btn-primary';
    save.innerHTML = '<span data-label>Simpan</span>';

    actions.append(cancel, save);
    form.append(field, alertBox, actions);

    dialog.showModal();
    refreshIcons();
    input.focus();
    input.select();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      hideAlert(alertBox);

      const newName = input.value.trim();
      if (!newName) {
        showAlert(alertBox, 'Nama kategori wajib diisi.');
        return;
      }
      if (newName === category.name) {
        dialog.close();
        return;
      }

      setButtonLoading(save, true, 'Menyimpan…');

      const { error } = await client
        .from('categories')
        .update({ name: newName })
        .eq('id', category.id);

      if (error) {
        showAlert(alertBox, getErrorMessage(error, 'Gagal mengubah kategori.'));
        setButtonLoading(save, false);
        return;
      }

      dialog.close();
      await refreshCategoryData();
      await loadSidebarCategories();
      showToast('Kategori diperbarui.');
    });
  }

  async function removeCategory(category) {
    const related = state.transactions.filter(
      (transaction) => transaction.category_id === category.id
    );

    if (related.length > 0) {
      showAlert(
        elements.alertBox,
        `"${category.name}" masih dipakai ${related.length} transaksi. Hapus atau pindahkan transaksinya dulu di halaman transaksi.`,
        'warning'
      );
      return;
    }

    const confirmed = await confirmAction({
      title: 'Hapus kategori?',
      message: `"${category.name}" akan dihapus permanen. Kategori yang punya transaksi tidak akan bisa dihapus.`,
      confirmLabel: 'Hapus kategori',
    });

    if (!confirmed) return;

    const { error } = await client
      .from('categories')
      .delete()
      .eq('id', category.id);

    if (error) {
      showAlert(elements.alertBox, getErrorMessage(error, 'Gagal menghapus kategori.'));
      return;
    }

    await refreshCategoryData();
    await loadSidebarCategories();
    showToast('Kategori dihapus.');
  }

  elements.addForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert(elements.alertBox);
    hideAlert(elements.addError);

    const name = elements.addName.value.trim();
    const icon = elements.addIcon.value;

    if (!name) {
      showAlert(elements.addError, 'Nama kategori wajib diisi.', 'warning');
      elements.addName.focus();
      return;
    }

    const button = elements.addForm.querySelector('button[type="submit"]');
    setButtonLoading(button, true, 'Menambah…');

    const { data, error } = await client
      .from('categories')
      .insert({ user_id: session.user.id, name, icon })
      .select('id');

    if (error) {
      showAlert(
        elements.addError,
        getErrorMessage(error, 'Gagal menambah kategori.'),
        'warning'
      );
      setButtonLoading(button, false);
      return;
    }

    if (!data || data.length === 0) {
      showAlert(
        elements.addError,
        'Kategori tidak tersimpan. Coba lagi atau muat ulang halaman.',
        'warning'
      );
      setButtonLoading(button, false);
      return;
    }

    elements.addName.value = '';
    setButtonLoading(button, false);
    await refreshCategoryData();
    await loadSidebarCategories();
    showToast('Kategori ditambahkan.');
  });

  /* ---------- Data awal --------------------------------------------------- */

  setLoading(elements.categoryList, 'Memuat kategori…');

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

    renderProfile();
    renderAvailableBalance();
    renderCategories();
  } catch (error) {
    showAlert(
      elements.alertBox,
      getErrorMessage(error, 'Gagal memuat pengaturan. Coba muat ulang halaman.'),
      'error'
    );
    elements.categoryList.replaceChildren();
    const empty = document.createElement('li');
    empty.className = 'nav-empty';
    empty.textContent = 'Data gagal dimuat.';
    elements.categoryList.appendChild(empty);
  }
}

if (document.body?.dataset.page === 'settings') {
  initSettingsPage();
}
