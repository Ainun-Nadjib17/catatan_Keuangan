# Uangku — Personal Finance Tracker

Aplikasi pencatat keuangan pribadi berbasis HTML, CSS, dan JavaScript (ES modules) dengan Supabase sebagai autentikasi dan database. Tidak ada framework frontend, tidak ada build step, tidak ada backend Node.js.

## Fitur

- Registrasi, login, logout, dan sesi persisten lewat Supabase Auth.
- Dashboard saldo tersedia, pemasukan, pengeluaran, tabungan, ringkasan pengeluaran per kategori, dan transaksi terbaru.
- CRUD transaksi dengan pencarian deskripsi, filter kategori/tipe/rentang tanggal.
- Halaman kategori dinamis (Makan, Nabung, Transportasi, Kuliah, Belanja, Lainnya) plus kategori buatan sendiri.
- Halaman tabungan: menabung, menarik tabungan, riwayat, dan saldo tabungan.
- Pengaturan profil, saldo awal, dan pengelolaan kategori.
- Validasi finansial di database (trigger + RLS), bukan hanya di browser.

## Setup

### 1. Buat project Supabase

1. Buat project di [supabase.com](https://supabase.com).
2. Buka **SQL Editor**, tempel seluruh isi `supabase/schema.sql`, lalu jalankan.

Schema akan membuat tabel `profiles`, `categories`, `transactions`, trigger validasi saldo, RLS, serta kategori bawaan untuk setiap pengguna baru.

### 2. Isi konfigurasi browser

Aplikasi statis tidak bisa membaca file `.env`, jadi konfigurasi runtime disimpan di file lokal yang di-ignore git:

```bash
cp assets/js/config.local.example.js assets/js/config.local.js
```

Lalu isi `assets/js/config.local.js` dengan **Project URL** dan **Publishable key** (atau anon public key) dari Supabase Dashboard → **Project Settings → API**.

> Hanya gunakan publishable/anon key di browser. Jangan pernah memakai `service_role`/secret key atau password database.

`.env.example` disediakan sebagai referensi nama variabel saja.

### 3. Jalankan development server

Karena aplikasi memakai ES modules, buka lewat HTTP server (bukan `file://`):

```bash
python -m http.server 5500
# atau
npx serve .
```

Buka `http://localhost:5500`.

### 4. Pengaturan Supabase Auth (opsional)

- **Authentication → Providers → Email**: aktifkan email/password.
- Untuk development cepat, matikan **Confirm email** agar pengguna langsung punya sesi setelah daftar. Jika dibiarkan aktif, aplikasi akan menampilkan instruksi cek email.
- Tambahkan URL aplikasi (mis. `http://localhost:5500`) ke **Authentication → URL Configuration → Redirect URLs** jika memakai konfirmasi email.

## Aturan finansial

Semua nominal adalah bilangan bulat rupiah (BIGINT):

```
Saldo tersedia = saldo awal + pemasukan - pengeluaran - menabung + tarik tabungan
Saldo tabungan = menabung - tarik tabungan
Total pengeluaran = hanya transaksi bertipe expense
```

Tipe transaksi: `income`, `expense`, `save`, `unsave`.

Validasi berikut dijalankan di database untuk setiap tulis (termasuk yang mencoba melewati UI):

- nominal > 0, deskripsi tidak kosong, tanggal valid dan tidak di masa depan;
- kategori harus milik pengguna dan hanya kategori `Nabung` yang bisa dipakai untuk `save`/`unsave`;
- pengeluaran/menabung tidak boleh melebihi saldo tersedia;
- penarikan tabungan tidak boleh melebihi saldo tabungan;
- edit/hapus transaksi dan perubahan saldo awal tidak boleh menghasilkan saldo negatif;
- lock per pengguna mencegah dua operasi bersamaan lolos validasi.

## Keamanan

- RLS aktif di ketiga tabel; setiap pengguna hanya bisa membaca/mengubah baris miliknya.
- Kategori transaksi divalidasi kepemilikannya oleh RLS policy dan trigger.
- Profil dibuat otomatis oleh trigger `auth.users`; browser tidak diberi izin INSERT profil.
- Kategori tabungan tidak bisa dibuat/dihapus dari browser.
- Kredensial asli hanya ada di `assets/js/config.local.js` / `.env` yang di-ignore git.

## Struktur

```text
finance-app/
├── index.html              # dashboard
├── login.html
├── register.html
├── transactions.html
├── category.html
├── savings.html
├── settings.html
├── assets/
│   ├── css/
│   │   ├── style.css       # base, shell, komponen, form
│   │   ├── dashboard.css   # layout dashboard & halaman data
│   │   └── responsive.css  # breakpoint mobile/tablet
│   └── js/
│       ├── config.js
│       ├── config.local.example.js
│       ├── supabase.js
│       ├── auth.js
│       ├── layout.js       # sidebar, topbar, guard halaman
│       ├── utils.js        # rupiah, validasi, render list, dialog
│       ├── dashboard.js
│       ├── transactions.js # CRUD + modal form transaksi
│       ├── categories.js
│       ├── savings.js
│       └── settings.js
├── supabase/schema.sql
├── .env.example
├── .gitignore
└── README.md
```

## Catatan

- Ikon memakai Lucide dari CDN.
- Tidak ada data finansial yang disimpan permanen di `localStorage`; semua data berasal dari Supabase milik pengguna yang sedang login.
