
# DESIGN SYSTEM SPECIFICATION: ARTHA (Emerald Ledger)

Dokumentasi arsitektur desain, prinsip visual, token warna, tipografi, komponen antarmuka, dan panduan pengalaman pengguna aplikasi manajemen keuangan personal **Artha**.

---

## 1. Brand Essence & Karakter Visual

- **Nama Produk:** Artha (Financial Management & Wealth Tracking)
- **Personality:** Amanah, Modern, Akurat, Tenang, dan Progresif.
- **Karakter Visual:** Modern Clean Fintech dengan perpaduan warna **Emerald Teal** yang melambangkan stabilitas finansial dan pertumbuhan aset, dikombinasikan dengan latar belakang netral bertekstur sejuk serta aksen kontras yang ramah mata.

---

## 2. Palet Warna (Color System)

Sistem warna dirancang menggunakan struktur token semantik untuk kemudahan adaptasi tema dan konsistensi lintas halaman.

### A. Brand & Primary Colors
| Token | Nilai Hex | Penggunaan |
| :--- | :--- | :--- |
| `primary` | `#0D9488` | Tombol CTA utama, status aktif nav item, aksen progres |
| `primary-dark` | `#0F766E` | Hover state CTA, gradient start kartu hero saldo |
| `primary-light` | `#CCFBF1` | Background badge status positif, active pill indicator |
| `primary-surface`| `#F0FDFA` | Latar belakang highlight kartu AI & rekomendasi |

### B. Functional & Financial Semantic Colors
| Token | Nilai Hex | Makna & Penggunaan |
| :--- | :--- | :--- |
| `finance-income` | `#10B981` (Emerald) | Pemasukan kas, tren pertumbuhan, status lunas |
| `finance-expense`| `#EF4444` (Coral Red)| Pengeluaran kas, saldo berkurang, alert limit |
| `finance-warning`| `#F59E0B` (Amber) | Anggaran mendekati batas (>=80%), tagihan jatuh tempo |
| `finance-info` | `#3B82F6` (Royal Blue) | Transfer antar rekening, aset pasar modal, sinkronisasi bank |
| `finance-purple` | `#8B5CF6` (Violet) | Audit langganan otomatis, tag khusus |

### C. Neutral & Surface System
| Token | Nilai Hex | Peran |
| :--- | :--- | :--- |
| `surface-ground` | `#F8FAFC` | Latar belakang utama seluruh aplikasi (canvas background) |
| `surface-card` | `#FFFFFF` | Latar belakang modul kartu, tabel, dan form input |
| `surface-subtle` | `#F1F5F9` | Latar belakang input disabled, filter pills, striping baris |
| `border-subtle` | `#E2E8F0` | Garis pembatas kartu, separator tabel, dan border input |
| `text-primary` | `#0F172A` | Judul, angka saldo utama, teks berkontras tertinggi |
| `text-secondary`| `#475569` | Label keterangan, subjudul, waktu transaksi |
| `text-muted` | `#94A3B8` | Placeholder, tanggal sekunder, metadata |

---

## 3. Sistem Tipografi (Typography Hierarchy)

- **Primary Font Family:** `Plus Jakarta Sans`, sans-serif (Google Fonts)
- **Monospace/Numbers:** Angka keuangan diformat dengan *tabular numbers* (`font-feature-settings: "tnum"`) untuk kelurusan perataan desimal/ribuan.

### Skala Hierarki Tipografi:
- **Display 1 (Hero Metric):** `font-size: 2.25rem` (36px), `font-weight: 700`, `line-height: 1.2` (contoh: *Rp 48.750.000* saldo bersih).
- **Heading 1 (Page Title):** `font-size: 1.75rem` (28px), `font-weight: 700`, `letter-spacing: -0.02em` (contoh: *Laporan & Analitik Keuangan*).
- **Heading 2 (Section Title):** `font-size: 1.25rem` (20px), `font-weight: 600` (contoh: *Arus Kas & Likuiditas*).
- **Heading 3 (Card Subheading):** `font-size: 1.0rem` (16px), `font-weight: 600`.
- **Body Regular:** `font-size: 0.875rem` (14px), `font-weight: 400`, `line-height: 1.5` (deskripsi tabel dan keterangan).
- **Caption / Badge:** `font-size: 0.75rem` (12px), `font-weight: 500` / `600` (chip status, info tren).

---

## 4. Spacing, Elevasi & Radius

### A. Border Radius
- `radius-sm`: `6px` (Badge kecil, pill filter mutasi)
- `radius-md`: `10px` (Button CTA, input field pencarian)
- `radius-lg`: `16px` (Kartu metrik standar, tabel container)
- `radius-xl`: `24px` (Kartu hero gradient saldo utama, banner AI)

### B. Bayangan (Elevation & Shadow)
- **Card Flat:** `box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)`
- **Hover Card:** `box-shadow: 0 10px 15px -3px rgba(13, 148, 136, 0.08), 0 4px 6px -4px rgba(13, 148, 136, 0.05)`
- **Glow Accent:** `box-shadow: 0 8px 24px -4px rgba(13, 148, 136, 0.35)` (untuk tombol aksi utama dan cincin skor kesehatan).

---

## 5. Komponen Inti Antarmuka (Core UI Components)

1. **Persistent Global App Shell:**
   - **Sidebar Navigasi Kiri (260px):** Logo identitas Artha, menu link (Dashboard, Transaksi, Anggaran & Target, Laporan, Pengaturan), serta mini widget ringkasan saldo aktif di sudut bawah.
   - **Header Bar Atas:** Search bar global ("Cari transaksi, kategori, atau tag..."), shortcut tombol cepat `+ Catat Transaksi`, notifikasi interaktif, dan profil user (*Dimas Prakoso*).

2. **Metric Summary Cards:**
   - Dilengkapi indikator ikon berlatar belakang lingkaran halus, angka nominal tebal, badge perbandingan persentase bulanan (`+12.4% vs bln lalu`), dan micro progress bar.

3. **Data Table Transaksi:**
   - Checkbox batch action, ikon kategori berwarna tematik, nama merchant beserta tanggal & jam, pill kategori semantik, badge nama rekening bank penyimpan, serta angka mutasi dengan warna hijau (+) atau merah (-).

4. **Progress Ring & Budget Gauge:**
   - Indikator cincin SVG interaktif untuk pemantauan target impian finansial (*Dana Darurat*, *DP Rumah*, *Liburan*) dan budget bar dengan zona peringatan (*Safe*, *Menipis*, *Terlampaui*).

5. **AI Insight Callout Banner:**
   - Komponen pemicu tindakan pintar dengan aksen gradasi halus, ikon sparkle, teks wawasan penghematan terukur, dan tombol aksi otomatis langsung.

---

## 6. Prinsip Desain & Tata Kelola Kode
- **Mobile & Desktop First Responsiveness:** Menggunakan CSS Grid 12-kolom dan Flexbox adaptif.
- **Aksesibilitas (WCAG AA):** Kontras rasio teks terhadap latar belakang selalu >= 4.5:1.
- **Micro-Interactions:** Transisi halus 200ms (`cubic-bezier(0.4, 0, 0.2, 1)`) pada hover state kartu dan tombol.
