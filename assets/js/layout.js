import { requireSession, signOut } from './auth.js';
import { getClient } from './supabase.js';
import {
  fetchCategories,
  getErrorMessage,
  initials,
  refreshIcons,
  showToast,
} from './utils.js';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', href: 'index.html', icon: 'layout-dashboard' },
  { key: 'transactions', label: 'Transaksi', href: 'transactions.html', icon: 'arrow-left-right' },
  { key: 'savings', label: 'Tabungan', href: 'savings.html', icon: 'piggy-bank' },
  { key: 'settings', label: 'Pengaturan', href: 'settings.html', icon: 'settings' },
];

export async function initAppShell({ active = '', title = '', eyebrow = '' } = {}) {
  const session = await requireSession();
  if (!session) return null;

  document.title = `${title} · Uangku`;

  const titleEl = document.getElementById('page-title');
  if (titleEl && title) titleEl.textContent = title;

  const eyebrowEl = document.getElementById('page-eyebrow');
  if (eyebrowEl && eyebrow) eyebrowEl.textContent = eyebrow;

  renderSidebar(session.user, active);
  setupMobileNav();
  setupLogout();

  const client = getClient();
  client?.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT' && !window.location.pathname.endsWith('login.html')) {
      window.location.replace('login.html');
    }
  });

  refreshIcons();
  return session;
}

function renderSidebar(user, active) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const displayName = user.user_metadata?.full_name || user.email || 'Pengguna';

  sidebar.innerHTML = `
    <a class="brand" href="index.html" aria-label="Uangku — kembali ke dashboard">
      <span class="brand-mark"><i data-lucide="wallet-minimal" aria-hidden="true"></i></span>
      <span class="brand-text">
        <span class="brand-name">Uangku</span>
        <span class="brand-sub">Finance tracker</span>
      </span>
    </a>

    <nav class="nav" aria-label="Navigasi utama">
      <p class="nav-label">Menu</p>
      ${NAV_ITEMS.map(
        (item) => `
        <a class="nav-item ${active === item.key ? 'is-active' : ''}" href="${item.href}"
           ${active === item.key ? 'aria-current="page"' : ''}>
          <i data-lucide="${item.icon}" aria-hidden="true"></i>
          <span>${item.label}</span>
        </a>`
      ).join('')}

      <div class="nav-label nav-label-split">
        <span>Kategori</span>
        <a class="nav-add" href="settings.html#categories" aria-label="Kelola kategori">
          <i data-lucide="plus" aria-hidden="true"></i>
        </a>
      </div>
      <div class="nav-categories" id="sidebar-categories">
        <p class="nav-empty">Memuat…</p>
      </div>
    </nav>

    <div class="sidebar-footer">
      <div class="user-block">
        <span class="avatar" data-user-avatar>${initials(displayName)}</span>
        <span class="user-info">
          <span class="user-name" data-user-name></span>
          <span class="user-email" data-user-email></span>
        </span>
      </div>
      <button type="button" class="btn btn-ghost btn-sm btn-block" id="logout-button">
        <i data-lucide="log-out" aria-hidden="true"></i>
        <span>Keluar</span>
      </button>
    </div>
  `;

  sidebar.querySelector('[data-user-name]').textContent = displayName;
  sidebar.querySelector('[data-user-email]').textContent = user.email ?? '';
  refreshIcons();
}

function setupLogout() {
  const button = document.getElementById('logout-button');
  if (!button) return;

  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await signOut();
    } catch (error) {
      showToast(getErrorMessage(error, 'Gagal keluar. Coba lagi.'), 'error');
      button.disabled = false;
    }
  });
}

function setupMobileNav() {
  const sidebar = document.getElementById('sidebar');
  const button = document.getElementById('menu-toggle');
  if (!sidebar || !button) return;

  let scrim = document.getElementById('sidebar-scrim');
  if (!scrim) {
    scrim = document.createElement('div');
    scrim.id = 'sidebar-scrim';
    scrim.className = 'sidebar-scrim';
    document.body.appendChild(scrim);
  }

  const setOpen = (open) => {
    document.body.classList.toggle('nav-open', open);
    button.setAttribute('aria-expanded', String(open));
  };

  button.addEventListener('click', () => {
    setOpen(!document.body.classList.contains('nav-open'));
  });

  scrim.addEventListener('click', () => setOpen(false));

  sidebar.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 1024) setOpen(false);
  });
}

export async function loadSidebarCategories(activeCategoryId = null) {
  const container = document.getElementById('sidebar-categories');
  if (!container) return;

  try {
    const categories = await fetchCategories();
    container.replaceChildren();

    if (!categories.length) {
      const message = document.createElement('p');
      message.className = 'nav-empty';
      message.textContent = 'Belum ada kategori.';
      container.appendChild(message);
      return;
    }

    for (const category of categories) {
      const link = document.createElement('a');
      link.className = 'nav-item nav-item-sub';
      link.href = `category.html?id=${encodeURIComponent(category.id)}`;

      if (activeCategoryId && category.id === activeCategoryId) {
        link.classList.add('is-active');
        link.setAttribute('aria-current', 'page');
      }

      const icon = document.createElement('i');
      icon.setAttribute('data-lucide', /^[a-z0-9-]+$/.test(category.icon) ? category.icon : 'circle');
      icon.setAttribute('aria-hidden', 'true');

      const label = document.createElement('span');
      label.textContent = category.name;

      link.append(icon, label);
      container.appendChild(link);
    }

    refreshIcons();
  } catch (error) {
    container.replaceChildren();
    const message = document.createElement('p');
    message.className = 'nav-empty';
    message.textContent = 'Gagal memuat kategori.';
    container.appendChild(message);
    console.error('Gagal memuat kategori sidebar:', error.message);
  }
}

export function updateSidebarUser({ fullName, email } = {}) {
  const nameEl = document.querySelector('[data-user-name]');
  const emailEl = document.querySelector('[data-user-email]');
  const avatarEl = document.querySelector('[data-user-avatar]');
  const displayName = fullName || email || 'Pengguna';

  if (nameEl) nameEl.textContent = displayName;
  if (emailEl && email) emailEl.textContent = email;
  if (avatarEl) avatarEl.textContent = initials(displayName);
}

export function showConfigNotice() {
  const target = document.getElementById('page-alert') ?? document.querySelector('.content');
  if (!target) return;

  const box = document.createElement('div');
  box.className = 'alert alert-warning';
  box.innerHTML =
    '<strong>Supabase belum dikonfigurasi.</strong> Salin <code>assets/js/config.local.example.js</code> menjadi ' +
    '<code>assets/js/config.local.js</code>, lalu isi <code>SUPABASE_URL</code> dan ' +
    '<code>SUPABASE_PUBLISHABLE_KEY</code>.';

  target.prepend(box);

  for (const button of document.querySelectorAll('button')) {
    if (button.id === 'menu-toggle') continue;
    button.disabled = true;
  }
}
