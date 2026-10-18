import { getClient } from './supabase.js';
import {
  getErrorMessage,
  hideAlert,
  refreshIcons,
  setButtonLoading,
  showAlert,
} from './utils.js';

const ALLOWED_NEXT = /^(index|transactions|category|savings|settings)\.html(\?[A-Za-z0-9=&_%.\-]*)?$/;

/** Hanya izinkan redirect internal agar tidak bisa dipakai open redirect. */
export function safeNextPath() {
  const next = new URLSearchParams(window.location.search).get('next') ?? '';
  return ALLOWED_NEXT.test(next) ? next : 'index.html';
}

export async function getSession() {
  const client = getClient();
  if (!client) return null;

  const { data, error } = await client.auth.getSession();
  if (error) throw new Error(error.message);
  return data.session ?? null;
}

/**
 * Dipakai setiap halaman privat. Mengembalikan session atau mengarahkan
 * pengguna ke halaman login (data tetap dilindungi RLS di server).
 */
export async function requireSession() {
  try {
    const session = await getSession();
    if (session) return session;
  } catch (error) {
    console.error('Gagal memeriksa sesi:', error.message);
  }

  const next = encodeURIComponent(
    `${window.location.pathname.split('/').pop() || 'index.html'}${window.location.search}`
  );
  window.location.replace(`login.html?next=${next}`);
  return null;
}

export async function signOut() {
  const client = getClient();
  if (!client) {
    window.location.replace('login.html');
    return;
  }

  const { error } = await client.auth.signOut();
  if (error) throw new Error(error.message);
  window.location.replace('login.html');
}

function mapAuthError(message = '') {
  if (/invalid login credentials/i.test(message)) {
    return 'Email atau password salah.';
  }
  if (/email not confirmed/i.test(message)) {
    return 'Email belum diverifikasi. Cek inbox kamu terlebih dahulu.';
  }
  if (/user already registered|already been registered/i.test(message)) {
    return 'Email ini sudah terdaftar. Silakan masuk.';
  }
  if (/password should be at least/i.test(message)) {
    return 'Password terlalu pendek. Gunakan minimal 8 karakter.';
  }
  if (/invalid email|unable to validate email/i.test(message)) {
    return 'Format email tidak valid.';
  }
  if (/rate limit|too many requests/i.test(message)) {
    return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
  }
  return getErrorMessage(message);
}

function showConfigError(alertBox) {
  showAlert(
    alertBox,
    'Supabase belum dikonfigurasi. Salin assets/js/config.local.example.js menjadi assets/js/config.local.js, lalu isi URL dan publishable key project-mu.',
    'warning'
  );

  const form = document.querySelector('form');
  if (form) {
    for (const element of form.elements) element.disabled = true;
  }
}

async function initLoginPage() {
  const alertBox = document.getElementById('auth-alert');
  const form = document.getElementById('login-form');
  const client = getClient();

  if (!client) {
    showConfigError(alertBox);
    return;
  }

  try {
    const session = await getSession();
    if (session) {
      window.location.replace(safeNextPath());
      return;
    }
  } catch (error) {
    console.error('Gagal memeriksa sesi:', error.message);
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert(alertBox);

    const email = form.querySelector('#email').value.trim();
    const password = form.querySelector('#password').value;
    const submitButton = form.querySelector('button[type="submit"]');

    if (!email || !password) {
      showAlert(alertBox, 'Email dan password wajib diisi.');
      return;
    }

    setButtonLoading(submitButton, true, 'Masuk…');

    const { error } = await client.auth.signInWithPassword({ email, password });

    if (error) {
      showAlert(alertBox, mapAuthError(error.message));
      setButtonLoading(submitButton, false);
      return;
    }

    window.location.replace(safeNextPath());
  });
}

async function initRegisterPage() {
  const alertBox = document.getElementById('auth-alert');
  const form = document.getElementById('register-form');
  const client = getClient();

  if (!client) {
    showConfigError(alertBox);
    return;
  }

  try {
    const session = await getSession();
    if (session) {
      window.location.replace('index.html');
      return;
    }
  } catch (error) {
    console.error('Gagal memeriksa sesi:', error.message);
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert(alertBox);

    const fullName = form.querySelector('#full_name').value.trim();
    const email = form.querySelector('#email').value.trim();
    const password = form.querySelector('#password').value;
    const confirmation = form.querySelector('#confirm_password').value;
    const submitButton = form.querySelector('button[type="submit"]');

    if (!fullName) {
      showAlert(alertBox, 'Nama wajib diisi.');
      return;
    }

    if (!email || !password) {
      showAlert(alertBox, 'Email dan password wajib diisi.');
      return;
    }

    if (password.length < 8) {
      showAlert(alertBox, 'Password minimal 8 karakter.');
      return;
    }

    if (password !== confirmation) {
      showAlert(alertBox, 'Konfirmasi password tidak sama.');
      return;
    }

    setButtonLoading(submitButton, true, 'Mendaftar…');

    const redirectTo = `${window.location.origin}${window.location.pathname.replace(
      /register\.html$/,
      'index.html'
    )}`;

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      showAlert(alertBox, mapAuthError(error.message));
      setButtonLoading(submitButton, false);
      return;
    }

    if (data.session) {
      window.location.replace('index.html');
      return;
    }

    form.reset();
    showAlert(
      alertBox,
      'Akun berhasil dibuat. Cek email kamu untuk memverifikasi akun sebelum masuk.',
      'success'
    );
    setButtonLoading(submitButton, false);
  });
}

const page = document.body?.dataset.page;
if (page === 'login') {
  refreshIcons();
  initLoginPage();
}
if (page === 'register') {
  refreshIcons();
  initRegisterPage();
}
