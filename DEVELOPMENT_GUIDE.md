# Panduan Pengembangan & Audit Sistem — Portal Warga Victoria Hill

Dokumen ini disusun sebagai hasil inspeksi menyeluruh terhadap codebase **Portal Warga Victoria Hill** (`backend/` dan `frontend/`). Dokumen ini mencakup ringkasan kondisi saat ini, temuan audit teknis yang diurutkan berdasarkan tingkat keparahan, rancangan pemisahan peran (RBAC), matriks & usulan fitur bertahap, rancangan skema data & API, roadmap pengembangan, serta checklist implementasi.

---

## 1. Ringkasan Kondisi Saat Ini

### 1.1 Arsitektur & Teknologi
- **Backend (`backend/`)**: Go (`go 1.26.0`) menggunakan `net/http` standard library (`http.ServeMux`), driver PostgreSQL `github.com/lib/pq`, dan `github.com/xuri/excelize/v2` untuk impor/ekspor CSV & Excel (`.xlsx`).
- **Frontend (`frontend/`)**: React 18, TypeScript, Vite 6, Tailwind CSS v4, `react-router-dom` v6, dan `lucide-react`.
- **Penyimpanan Data**:
  - Konfigurasi utama menggunakan PostgreSQL (`backend/pg_store.go`), dengan fallback JSON lokal pada `NewStore` (`backend/store.go`) yang digunakan oleh unit test (`backend/handlers_test.go`).
  - Seluruh data dimuat ke dalam struct `Database` di memori (`Store.db`) saat startup dan disinkronkan setiap kali ada perubahan.

### 1.2 Fitur yang Sudah Berjalan
1. **Autentikasi Dasar**: Login mode Warga (Blok + Nomor Rumah + Password bersama) dan Pengurus (Username + Password).
2. **Beranda & Informasi**: Pengumuman warga, galeri aktivitas (data seed statis), katalog UMKM warga, dan kontak pengurus.
3. **Layanan Lingkungan**: Direktori rumah/blok (dengan masking nama & nomor HP), pemesanan fasilitas umum, tiket pelaporan masalah, pengajuan kartu akses, peminjaman barang paguyuban, pantauan CCTV, dan Panic Button.
4. **Keuangan Dasar**: Laporan IPL & KAS dengan impor CSV/Excel dan ekspor CSV/Excel.
5. **Dashboard Pengurus (`/pengurus`)**: Pengelolaan pengumuman, perubahan status tiket/kartu akses/booking/pinjaman/panic, impor CSV/Excel, dan Audit Trail.

### 1.3 Kesenjangan Utama Terhadap Kebutuhan Operasional
- **Keamanan & Privasi Data Warga**: Sebagian besar endpoint `GET` dan `POST` terbuka tanpa autentikasi, sehingga data pribadi warga (nama, no. HP, foto STNK, riwayat laporan) dapat diakses tanpa login.
- **Kemudahan Admin Memposting Laporan**: Admin belum memiliki form input transaksi kas/IPL satuan, belum bisa mengedit/menghapus laporan keuangan, dan belum memiliki modul untuk memposting laporan kegiatan warga beserta dokumentasinya (saat ini galeri hanya data statis di `store.go`).
- **Kemudahan Warga Memantau Cashflow & IPL**: Halaman Laporan KAS belum menampilkan grafik/tabel cashflow bulanan dan tidak memiliki pemilih periode (hanya menampilkan 1 laporan terbaru), sedangkan Laporan IPL belum menampilkan status pembayaran per rumah/blok milik warga yang sedang login.

---

## 2. Temuan Audit Codebase (Berdasarkan Tingkat Keparahan)

### 2.1 KRITIS (Critical)

#### [CRIT-01] Endpoint Sensitif & Data Pribadi (PII) Terbuka Tanpa Autentikasi
- **Lokasi**: `backend/main.go:92-132`, `backend/handlers.go:502, 593-596, 667-672, 739, 837-849, 964-967, 1024-1062`
- **Detail Temuan**:
  - Di `backend/main.go:92-130`, hanya endpoint tertentu yang dibungkus `srv.requireAdmin(...)`. Endpoint seperti `GET /api/access-cards`, `GET /api/tickets`, `GET /api/facilities`, `GET /api/assets`, `GET /api/panic`, `GET /api/cctv`, `GET /api/finance`, `GET /api/finance/{id}/download`, `POST /api/upload`, dan `GET /uploads/` **tidak memiliki middleware autentikasi sama sekali**.
  - `GET /api/access-cards` (`handlers.go:667-672`) mengembalikan `full_name`, `block`, `house_no`, dan `stnk_photo_url` dalam bentuk plaintext tanpa masking.
  - `GET /api/facilities` (`handlers.go:502`) dan `GET /api/assets` (`handlers.go:739`) mengembalikan daftar booking/peminjaman lengkap dengan `resident_name`/`borrower_name`, `house_code`, dan `phone` tanpa masking.
  - `GET /uploads/` (`main.go:132`) menyajikan seluruh file unggahan (termasuk foto STNK) secara publik.
  - `POST /api/upload` (`handlers.go:1024`) mengizinkan siapa pun mengunggah file hingga 10MB tanpa login.
- **Dampak**: Kebocoran data pribadi warga (PII), penyalahgunaan foto STNK, akses ilegal ke feed CCTV, serta potensi penyalahgunaan storage server.

#### [CRIT-02] Autentikasi Warga Menggunakan Password Bersama & Tidak Ada Verifikasi Akun Per Rumah
- **Lokasi**: `backend/handlers.go:193-260`, `backend/handlers.go:262-291`, `backend/handlers.go:30-31`, `frontend/src/context/AuthContext.tsx:17-20`
- **Detail Temuan**:
  - Login warga (`handlers.go:194-202`) hanya memeriksa `RESIDENT_PASSWORD` tunggal dari `.env`. Siapa saja yang mengetahui password tersebut dapat memilih `block` dan `house_no` rumah tetangga mana saja (termasuk rumah kosong atau rumah pengurus) untuk masuk dan membuat laporan/booking atas nama rumah tersebut.
  - Token sesi disimpan di map memori `Server.tokens` (`handlers.go:31`) tanpa masa kedaluwarsa (TTL), tanpa endpoint logout/revokasi, dan hilang setiap kali server restart.
  - Di frontend (`AuthContext.tsx:17-20`), status login hanya dicek dari `localStorage.getItem('vh_user')` tanpa validasi token ke server, sehingga setelah server restart UI tetap terlihat login tetapi seluruh request admin/terproteksi akan gagal.
  - Perbandingan password menggunakan `==` secara plaintext (`handlers.go:199, 269`), bukan hash (`bcrypt`/`argon2id`), dan tidak ada rate-limiting terhadap brute-force login.
- **Dampak**: Penyamaran identitas antar-warga (impersonation), sesi tidak aman, dan tidak ada mekanisme blokir akun/ganti password per rumah.

#### [CRIT-03] Kunci Enkripsi Hardcoded Fallback & Enkripsi PII Tidak Konsisten
- **Lokasi**: `backend/crypto.go:16-23`, `backend/pg_store.go:495-538`
- **Detail Temuan**:
  - Jika `DATA_ENCRYPTION_KEY` tidak diatur di environment, `getEncryptionKey()` (`crypto.go:18-20`) diam-diam menggunakan key default `"victoria-hill-default-dev-key"`.
  - Enkripsi hanya diterapkan pada `head_of_home` dan `phone` di tabel `resident_houses` (`pg_store.go:496-497`). Data sensitif pada tabel lain (`facility_bookings.phone`, `asset_loans.phone`, `access_card_requests.stnk_photo_url`, `tickets.reporter_name`, `panic_alerts.reporter_name`) tetap disimpan plaintext.
- **Dampak**: Jika database bocor atau env salah konfigurasi, data kontak dan identitas warga tetap terbaca dengan mudah.

---

### 2.2 TINGGI (High)

#### [HIGH-01] Pola Persistensi PostgreSQL "Delete-All & Re-Insert" Tidak Aman untuk Produksi
- **Lokasi**: `backend/pg_store.go:470-589`, `backend/store.go:37-46`
- **Detail Temuan**:
  - Setiap kali `s.store.saveLocked()` dipanggil (termasuk saat mencatat 1 audit log di `handlers.go:115, 140`), `savePostgresLocked()` menjalankan `DELETE FROM` pada **seluruh 16 tabel** (`pg_store.go:477-487`), lalu meng-insert ulang seluruh baris dari memori dalam 1 transaksi.
  - `finance_items` menggunakan `SERIAL PRIMARY KEY` (`pg_store.go:142`) yang ID-nya terus bertambah pada setiap simpan ulang.
  - Seluruh database dimuat ke RAM saat startup (`loadFromPostgres` di `pg_store.go:222`).
- **Dampak**: Penurunan performa drastis seiring pertumbuhan data, risiko lock contention di PostgreSQL, boros I/O, dan tidak mendukung deployment multi-instance/horizontal scaling.

#### [HIGH-02] Pengiriman Token Sesi Melalui URL Query Parameter
- **Lokasi**: `frontend/src/api/client.ts:74-77, 178-185`, `backend/handlers.go:64-66`
- **Detail Temuan**:
  - Endpoint download laporan keuangan, template, dan ekspor audit trail mengirim token via `?token=...` di query string URL.
- **Dampak**: Token (termasuk token Admin) berisiko bocor melalui browser history, log akses reverse proxy/Nginx, dan header `Referer`.

#### [HIGH-03] CORS Wildcard, Validasi Upload Hanya Cek Ekstensi, & Spoofing `X-Forwarded-For`
- **Lokasi**: `backend/main.go:36-47`, `backend/handlers.go:81-86, 1036-1042`
- **Detail Temuan**:
  - `corsMiddleware` (`main.go:38`) mengatur `Access-Control-Allow-Origin: *`.
  - `handleUpload` (`handlers.go:1036-1042`) hanya memeriksa ekstensi nama file (`filepath.Ext`), tidak memvalidasi MIME type / magic bytes (`http.DetectContentType`).
  - `clientIP` (`handlers.go:81-86`) langsung mempercayai header `X-Forwarded-For` dari client tanpa verifikasi trusted proxy, sehingga IP di `audit_logs` dapat dipalsukan.
- **Dampak**: Potensi unggahan file berbahaya berkamuflase ekstensi gambar/dokumen dan pemalsuan jejak audit.

#### [HIGH-04] Tidak Ada Isolasi Data Milik Warga (Privacy & IDOR Risk)
- **Lokasi**: `frontend/src/pages/AccessCardPage.tsx:19-25, 180-196`, `frontend/src/pages/ContactPage.tsx:16, 88-125`, `frontend/src/pages/AssetLoanPage.tsx:22-30, 100-117`
- **Detail Temuan**:
  - Semua warga yang masuk dapat melihat seluruh pengajuan kartu akses warga lain, seluruh tiket pengaduan warga lain, dan seluruh riwayat peminjaman barang warga lain beserta nama lengkap dan nomor rumahnya.
- **Dampak**: Pelanggaran privasi antar-warga (terutama untuk pengajuan kartu akses/STNK dan pengaduan yang bersifat sensitif).

---

### 2.3 SEDANG (Medium)

#### [MED-01] Validasi Input & Transisi Status Belum Ketat di Backend
- **Lokasi**: `backend/handlers.go:516-588, 639-664, 711-731, 743-834, 934-956`, `backend/spreadsheet.go:76-87`
- **Detail Temuan**:
  - Endpoint `PATCH` untuk booking, tiket, kartu akses, dan peminjaman aset tidak memvalidasi daftar status yang diizinkan (enum whitelist).
  - `handleCreateBooking` (`handlers.go:516-566`) tidak mengecek bentrok jadwal (`facility_id` + `date` + `time_slot` yang sudah berstatus `Disetujui`/`Menunggu`).
  - `handleCreateAssetLoan` (`handlers.go:783`) langsung mengurangi `Available` saat pengajuan masih `"Menunggu"` dan tidak memvalidasi `return_date >= borrow_date`.
  - `POST /api/umkm` (`handlers.go:934-956`) terbuka tanpa cek auth dan tidak memvalidasi harga (`Price >= 0`) maupun format nomor WhatsApp.
  - `handleImportFinance` (`spreadsheet.go:76-87`) menggunakan fallback hardcoded `period = "2026-11"` jika kosong dan diam-diam mengubah tipe tidak dikenal menjadi `"IPL"`.
  - Banyak pemanggilan `s.store.saveLocked()` mengabaikan error (`_ = s.store.saveLocked()`).

#### [MED-02] Aksi Mutasi Admin Tidak Tercatat Lengkap di Audit Trail
- **Lokasi**: `backend/handlers.go:394-414, 568-588, 639-664, 711-731, 803-834, 1008-1021`
- **Detail Temuan**:
  - Penghapusan pengumuman, perubahan status tiket, persetujuan booking, pembaruan kartu akses, pembaruan pinjaman aset, dan penyelesaian panic alert tidak memanggil `s.recordAudit(...)`.

#### [MED-03] Keterbatasan Fitur Posting Laporan Keuangan & Kegiatan untuk Admin dan Warga
- **Lokasi**: `backend/spreadsheet.go:53-165`, `backend/models.go:125-144`, `frontend/src/pages/AdminPage.tsx:434-567`, `frontend/src/pages/KasReportPage.tsx:16, 44-151`, `frontend/src/pages/IplReportPage.tsx:115-184`
- **Detail Temuan**:
  - **Posting Keuangan Kaku**: Admin hanya bisa memperbarui laporan IPL/KAS lewat upload file CSV/XLSX. Tidak ada form input transaksi manual (pemasukan/pengeluaran harian/bulanan), tidak ada fitur edit/hapus item transaksi, dan tidak ada catatan saldo awal/saldo kumulatif otomatis.
  - **Pemisahan KAS Warga vs KAS Mesjid Belum Konsisten**: `KasReportPage.tsx:45-58` menampilkan dua kartu (KAS Warga & KAS Mesjid) dengan nomor rekening yang sama (`BNI 7790080086`), sementara di backend keduanya digabung dalam `Type: "KAS"`.
  - **Tampilan Laporan KAS Kurang Informatif**: `KasReportPage.tsx:16, 127-151` hanya mengambil `reports[0]` (tanpa pemilih bulan/periode) dan **tidak menampilkan tabel rincian item pemasukan/pengeluaran** seperti pada `IplReportPage.tsx:149-182`.
  - **Belum Ada Posting Laporan Kegiatan Warga**: `GalleryPhoto` hanya berupa seed statis di `backend/store.go:346-351`. Admin belum bisa memposting laporan kegiatan warga (judul, tanggal, ringkasan kegiatan, anggaran/realisasi jika ada, dan foto dokumentasi) dari `AdminPage.tsx`.

#### [MED-04] Kualitas Kode & UX Frontend
- **Lokasi**: `frontend/src/pages/AdminPage.tsx:65-81`, `frontend/src/context/AuthContext.tsx:17-20`, `frontend/src/api/client.ts:44-47`, `frontend/src/pages/LoginPage.tsx:6`, `frontend/src/pages/IplReportPage.tsx:25, 95`, `frontend/src/pages/KasReportPage.tsx:19, 80`, `frontend/src/components/PanicModal.tsx:11-12`
- **Detail Temuan**:
  - `AdminPage.tsx:65-73` memanggil 7 API sekaligus pada setiap perubahan dan hanya melakukan `console.error` tanpa feedback error ke UI.
  - `AuthContext.tsx:19` melakukan `JSON.parse(saved)` tanpa `try/catch`.
  - `api/client.ts:44-47` tidak menangani status `401 Unauthorized` untuk otomatis membersihkan sesi yang sudah kedaluwarsa.
  - Formulir warga (`PanicModal.tsx`, `FacilitiesPage.tsx`, `AccessCardPage.tsx`, `AssetLoanPage.tsx`) tidak melakukan pre-fill nama/blok rumah dari `useAuth().user`.
  - Nomor rekening pembayaran (`BNI 7790080086`) dan daftar blok (`DEFAULT_BLOCKS`) di-hardcode di frontend.

---

### 2.4 RENDAH (Low)

#### [LOW-01] Inkonsistensi Data Seed, Filter Statis, & Cakupan Unit Test
- **Lokasi**: `backend/store.go:347-350`, `frontend/src/pages/CctvPage.tsx:7`, `backend/handlers_test.go:36-37`
- **Detail Temuan**:
  - `GalleryPhoto.Date` di `store.go:347` menggunakan format string bebas (`"15 Nov 2026"`), sulit untuk sorting kronologis.
  - `AREAS` di `CctvPage.tsx:7` di-hardcode hanya 3 opsi, tidak dinamis mengikuti data kamera dari API.
  - `handlers_test.go:36-37` mendaftarkan `/api/finance/import` dan `/api/directory/import` **tanpa** `srv.requireAdmin(...)`, sehingga pengujian tidak memverifikasi proteksi otorisasi admin.

---

## 3. Rancangan Pemisahan Peran (Role & Access Control)

Untuk menjaga keamanan data warga sekaligus membagi tanggung jawab operasional pengurus paguyuban secara jelas, sistem sebaiknya memisahkan pengguna menjadi **4 peran (role)** dengan prinsip *least privilege*.

### 3.1 Definisi Role & Alasan Teknis

| Role (`role_code`) | Siapa Penggunanya | Alasan Teknis Pemisahan |
| :--- | :--- | :--- |
| **`warga`** | Kepala keluarga / penghuni terverifikasi per unit rumah (`house_id`) | Hanya boleh mengakses layanan lingkungan, membaca laporan transparansi (tanpa melihat data pribadi sensitif tetangga), serta melihat/mengelola pengajuan & tagihan milik rumahnya sendiri (mencegah IDOR). |
| **`bendahara`** | Pengurus bagian keuangan (IPL, KAS Warga, KAS Mesjid) | Memisahkan wewenang finansial dari admin umum agar pencatatan cashflow, verifikasi bukti bayar IPL, dan publikasi laporan keuangan memiliki akuntabilitas yang jelas dan tercatat di audit log. |
| **`keamanan`** | Koordinator Keamanan & Petugas Pos Security | Fokus pada penanganan `Panic Alert` secara real-time, pantauan CCTV, serta verifikasi pengambilan/aktivasi Kartu Akses tanpa perlu akses ke pengeditan data keuangan atau penghapusan pengumuman. |
| **`admin`** | Ketua / Sekretaris / Pengurus Inti Paguyuban | Memiliki kendali penuh manajemen akun warga, direktori rumah, pengumuman, laporan kegiatan warga, persetujuan fasilitas/aset, serta melihat seluruh Audit Trail. |

> **Catatan Implementasi Bertahap**: Jika pada tahap awal pengurus belum membutuhkan pemisahan `bendahara` dan `keamanan` secara terpisah, backend tetap harus membangun struktur RBAC berbasis role/permission di atas, lalu di MVP minimal memisahkan secara tegas **`warga`** vs **`admin`** (dengan opsi sub-role `bendahara`/`keamanan` di Fase 2).

### 3.2 Pemisahan Navigasi & Halaman (Frontend)

1. **Alur Masuk & Guarding Route**:
   - Tambahkan komponen `<ProtectedRoute allowedRoles={[...]} />` di `frontend/src/App.tsx` yang memvalidasi sesi ke `GET /api/auth/me` saat aplikasi dimuat.
   - Jika `role === 'warga'` mencoba membuka `/pengurus` atau `/admin/*`, langsung redirect ke `/` dengan pesan akses ditolak sebelum komponen admin dirender.

2. **Navigasi Warga (`role === 'warga'`)**:
   - **Topbar / Bottom Nav**: `Beranda` (`/`), `Layanan` (`/layanan`), `Keuangan` (atau akses cepat ke `/laporan-ipl` & `/laporan-kas`), `Info & Kegiatan` (`/info`), `Kontak` (`/kontak`), plus tombol `Panic Button` dan menu `Profil / Rumah Saya` (`/profil` untuk ganti password & lihat pengajuan milik sendiri).
   - **Tidak ada** tautan ke `/pengurus` atau fitur manajemen.

3. **Navigasi Pengurus (`role === 'admin' | 'bendahara' | 'keamanan'`)**:
   - Menggunakan layout atau sub-navigasi khusus `/pengurus/*` yang hanya menampilkan tab/menu sesuai izin role:
     - `admin`: Semua modul (Ringkasan & Panic, Keuangan & Cashflow, Kegiatan & Galeri, Pengumuman, Direktori & Akun Warga, Tiket, Kartu Akses, Booking, Pinjam Barang, Audit Trail).
     - `bendahara`: Ringkasan Keuangan, Input/Import Cashflow IPL & KAS (Warga/Mesjid), Verifikasi Pembayaran IPL Warga, Ekspor Laporan.
     - `keamanan`: Monitor Panic Alert, Pantau CCTV, Verifikasi Kartu Akses.

---

## 4. Matriks Fitur & Role (MVP, Fase 2, Nice-to-Have)

### 4.1 Matriks Hak Akses Fitur per Role

Legenda: **C** = Create, **R** = Read (Semua), **RO** = Read Own (Milik Rumah Sendiri), **U** = Update, **D** = Delete, **E** = Export/Download.

| Modul / Fitur | Warga | Bendahara | Keamanan | Admin |
| :--- | :---: | :---: | :---: | :---: |
| **Autentikasi & Profil Akun Rumah** (Ganti Password) | R, U (Own) | R, U (Own) | R, U (Own) | C, R, U, D |
| **Beranda & Ringkasan Lingkungan** | R | R | R | R |
| **Pengumuman Warga** | R | R | R | C, R, U, D |
| **Laporan Kegiatan Warga & Galeri Dokumentasi** | R | R | R | C, R, U, D |
| **Laporan KAS Bulanan & Cashflow** (KAS Warga & Mesjid) | R, E | C, R, U, D, E | R | C, R, U, D, E |
| **Laporan IPL Bulanan & Cashflow IPL** | R, E | C, R, U, D, E | R | C, R, U, D, E |
| **Status Tagihan IPL Rumah Sendiri & Upload Bukti Bayar** | RO, C (Bukti) | R, U (Verifikasi) | - | R, U |
| **Direktori Warga** (Warga: Masked; Admin: Full + Kelola) | R (Masked) | R (Masked) | R (Masked) | C, R, U, D, Import |
| **Tiket Laporan Masalah** | C, RO (atau Publik Anonim) | R | R, U | R, U, D |
| **Booking Fasilitas Umum** | C, RO, U (Batal) | R | R | R, U (Approve/Reject) |
| **Pengajuan Kartu Akses** | C, RO | R | R, U | R, U |
| **Pinjam Barang Paguyuban** | C, RO | R | R | R, U |
| **Pantau CCTV Lingkungan** | R (terautentikasi) | R | R | C, R, U, D |
| **UMKM Warga** | C, U/D (Own), R | R | R | R, U, D (Moderasi) |
| **Panic Button Darurat** | C, RO | C, R | R, U (Tangani) | R, U (Tangani) |
| **Audit Trail Aktivitas** | - | - | - | R, E |

---

### 4.2 Pengelompokan Fitur per Fase

#### Fase 1: MVP (Pondasi Aman & Transparansi Inti)
Fokus utama: **Menutup celah keamanan kritis** dan **memenuhi kebutuhan utama admin & warga terkait laporan kas, cashflow, IPL, dan kegiatan warga**.

- **Untuk Warga**:
  1. **Login Aman Per Unit Rumah**: Akun unik per rumah (username/kode rumah + password individual yang di-hash, bukan password bersama) + fitur ganti password.
  2. **Dashboard Cashflow & Laporan KAS Bulanan (`/laporan-kas`)**:
     - Pemilih bulan/periode laporan (dropdown bulan/tahun).
     - Pemisahan jelas saldo & mutasi **KAS Warga** dan **KAS Mesjid** (atau kategori dana yang transparan).
     - Kartu ringkasan: Saldo Awal, Total Pemasukan, Total Pengeluaran, Saldo Akhir.
     - **Tabel rincian transaksi (Cashflow)** masuk & keluar lengkap dengan filter jenis/kategori serta tombol unduh CSV/Excel.
  3. **Laporan IPL Bulanan (`/laporan-ipl`)**:
     - Ringkasan pemasukan, pengeluaran operasional lingkungan (keamanan, kebersihan, utilitas), dan persentase rumah lunas.
     - Status pembayaran IPL khusus rumah warga yang sedang login (periode berjalan & riwayat).
  4. **Laporan Kegiatan Warga (`/info?section=kegiatan`)**:
     - Daftar laporan kegiatan yang diposting pengurus (tanggal, judul, ringkasan kegiatan, jumlah peserta/catatan, realisasi anggaran jika ada, dan galeri foto dokumentasi).
  5. **Privasi Data**: Warga hanya melihat detail tiket, pengajuan kartu akses (termasuk foto STNK), dan pinjaman milik rumahnya sendiri (atau tampilan yang sudah di-masking untuk jadwal fasilitas umum).
  6. **Pre-fill Form Otomatis**: Form Tiket, Booking, Kartu Akses, Pinjam Barang, dan Panic Button otomatis mengisi nama & kode rumah dari sesi login.

- **Untuk Pengurus / Admin**:
  1. **Posting Laporan Keuangan Mudah (2 Cara)**:
     - **Cara Cepat (Form Transaksi)**: Admin/Bendahara bisa langsung menambah/edit/hapus transaksi pemasukan atau pengeluaran satu per satu langsung dari Dashboard Pengurus tanpa harus membuat file Excel terlebih dahulu. Total pemasukan, pengeluaran, dan saldo dihitung otomatis oleh backend.
     - **Cara Massal (Import Excel/CSV)**: Tetap tersedia untuk unggah rekap bulanan dari spreadsheet existing (seperti format `LAPORAN UANG KAS VICHIL`), dengan validasi periode & pratinjau sebelum simpan.
  2. **Posting Laporan Kegiatan Warga**:
     - Form CRUD di Dashboard Pengurus untuk membuat, mengedit, dan menghapus laporan kegiatan warga beserta unggah multi-foto dokumentasi.
  3. **Manajemen Akun & Direktori Warga**:
     - Admin bisa menambah/mengedit data rumah, mereset password akun warga jika lupa, dan mengimpor direktori via CSV/Excel.
  4. **Keamanan & Audit Lengkap**:
     - Seluruh endpoint terproteksi JWT/session token yang persisten, upload file tervalidasi MIME type, dan seluruh aksi mutasi admin tercatat di `audit_logs`.

#### Fase 2: Peningkatan Operasional & Interaksi
- **Untuk Warga**:
  1. **Grafik Cashflow Bulanan**: Visualisasi bar/line chart perbandingan pemasukan vs pengeluaran 6–12 bulan terakhir di halaman Laporan IPL & KAS.
  2. **Konfirmasi Pembayaran IPL Mandiri**: Warga mengunggah bukti transfer IPL bulanan dan memantau status verifikasi dari Bendahara (`Menunggu Verifikasi` -> `Lunas`), lengkap dengan kuitansi digital (PDF/cetak).
  3. **Riwayat & Notifikasi Status Pengajuan ("Aktivitas Saya")**: Satu halaman khusus untuk melacak semua tiket, booking fasilitas, kartu akses, dan peminjaman aset milik rumah sendiri.
  4. **Validasi Bentrok Jadwal Fasilitas**: Kalender slot waktu fasilitas yang menampilkan slot yang sudah terisi secara real-time.
- **Untuk Pengurus / Admin / Bendahara / Keamanan**:
  1. **Pemisahan Role Bendahara & Keamanan**: Aktivasi akun khusus `bendahara` dan `keamanan` dengan tampilan menu yang terfokus.
  2. **Verifikasi Pembayaran IPL Per Rumah**: Matriks/checklist status lunas per blok & nomor rumah setiap bulan, serta pengingat tagihan.
  3. **Realtime Alert Panic Button**: Notifikasi suara/SSE/WebSocket di dashboard Pos Security & Pengurus saat ada Panic Alert baru.
  4. **Moderasi UMKM & Manajemen Inventaris**: Admin dapat menyetujui/menonaktifkan listing UMKM serta menambah/mengedit daftar fasilitas dan barang inventaris paguyuban.

#### Fase 3: Nice-to-Have (Ekosistem Digital Perumahan)
- **Untuk Warga**:
  1. **Integrasi Notifikasi WhatsApp / Push Notification**: Pengingat otomatis tagihan IPL, info pembaruan status tiket, dan pengumuman darurat.
  2. **QRIS Dinamis / Payment Gateway**: Pembayaran IPL & KAS otomatis terverifikasi tanpa perlu upload bukti transfer manual.
  3. **E-Voting / Polling Warga**: Pengambilan keputusan lingkungan (misalnya pemilihan ketua paguyuban atau persetujuan program renovasi fasum).
  4. **Surat Pengantar / Administrasi RT/RW Digital**: Pengajuan surat domisili atau izin renovasi rumah secara online.
  5. **Buku Tamu & Izin Kunjungan (Visitor Pass)**: Generate QR code untuk tamu atau kurir yang masuk gerbang utama.
- **Untuk Pengurus / Admin**:
  1. **Laporan Tahunan & Rencana Anggaran (RAB)**: Perbandingan realisasi cashflow terhadap anggaran tahunan paguyuban.
  2. **Integrasi CCTV Stream Asli (RTSP/HLS Proxy)**: Mengganti gambar simulasi CCTV dengan stream kamera lingkungan yang terautentikasi.

---

## 5. Rancangan Data & API

### 5.1 Perbaikan Skema PostgreSQL (Normalisasi & CRUD Langsung)
Mengganti pola `DELETE FROM` + `INSERT` penuh di `backend/pg_store.go` dengan query SQL terarah (`INSERT`, `UPDATE`, `DELETE` per baris, serta indeks dan foreign key).

Berikut rancangan tabel inti yang perlu ditambahkan/disempurnakan:

```sql
-- 1. Akun Pengguna (Menggantikan login password bersama dari .env)
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    house_id TEXT REFERENCES resident_houses(id) ON DELETE SET NULL,
    username TEXT UNIQUE NOT NULL,       -- contoh: "U16" untuk warga, "admin" untuk pengurus
    password_hash TEXT NOT NULL,         -- bcrypt / argon2id
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('warga', 'bendahara', 'keamanan', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Sesi Login Persisten (Agar tidak hilang saat server restart)
CREATE TABLE user_sessions (
    token_hash TEXT PRIMARY KEY,         -- SHA-256 dari bearer token
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

-- 3. Laporan Keuangan (Mendukung pemisahan IPL, KAS_WARGA, KAS_MESJID)
CREATE TABLE finance_reports (
    id TEXT PRIMARY KEY,
    fund_type TEXT NOT NULL CHECK (fund_type IN ('IPL', 'KAS_WARGA', 'KAS_MESJID')),
    period TEXT NOT NULL,                -- format YYYY-MM, contoh: "2026-11"
    month_label TEXT NOT NULL,           -- contoh: "November 2026"
    opening_balance BIGINT NOT NULL DEFAULT 0,
    total_income BIGINT NOT NULL DEFAULT 0,
    total_spend BIGINT NOT NULL DEFAULT 0,
    closing_balance BIGINT NOT NULL DEFAULT 0,
    paid_houses INT NOT NULL DEFAULT 0,
    total_houses INT NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    published BOOLEAN NOT NULL DEFAULT TRUE,
    created_by TEXT REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (fund_type, period)
);

-- 4. Rincian Transaksi Cashflow (Bisa ditambah/edit/hapus satuan oleh Admin/Bendahara)
CREATE TABLE finance_transactions (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL REFERENCES finance_reports(id) ON DELETE CASCADE,
    tx_date DATE NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,              -- misal: "Iuran IPL", "Keamanan", "Kebersihan", "Kegiatan Sosial"
    kind TEXT NOT NULL CHECK (kind IN ('Masuk', 'Keluar')),
    amount BIGINT NOT NULL CHECK (amount > 0),
    proof_url TEXT NOT NULL DEFAULT '',  -- opsional foto nota/struk
    created_by TEXT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_finance_tx_report ON finance_transactions(report_id, tx_date);

-- 5. Status Pembayaran IPL Per Rumah Per Periode
CREATE TABLE ipl_house_payments (
    id TEXT PRIMARY KEY,
    house_id TEXT NOT NULL REFERENCES resident_houses(id) ON DELETE CASCADE,
    period TEXT NOT NULL,                -- YYYY-MM
    amount BIGINT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Belum Lunas', 'Menunggu Verifikasi', 'Lunas')),
    proof_url TEXT NOT NULL DEFAULT '',
    paid_at TIMESTAMPTZ,
    verified_by TEXT REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    UNIQUE (house_id, period)
);

-- 6. Laporan Kegiatan Warga (Menggantikan gallery_photos statis)
CREATE TABLE activity_reports (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,              -- "Olahraga", "Kesehatan", "Sosial", "Keagamaan", "Kerja Bakti"
    activity_date DATE NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL,
    budget_used BIGINT NOT NULL DEFAULT 0,
    author_id TEXT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE activity_photos (
    id TEXT PRIMARY KEY,
    activity_id TEXT NOT NULL REFERENCES activity_reports(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    caption TEXT NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0
);

-- 7. Pengaturan Lingkungan (Rekening Bank, Biaya Kartu Akses, dll - tidak hardcoded)
CREATE TABLE env_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 5.2 Rancangan Kontrak API (RESTful + RBAC)

Seluruh endpoint di bawah `/api/*` (kecuali `GET /api/health` dan `POST /api/auth/login`) wajib melewati middleware `requireAuth` (validasi Bearer token terhadap tabel `user_sessions`).

| Method & Path | Role Diizinkan | Deskripsi & Catatan Keamanan |
| :--- | :--- | :--- |
| `POST /api/auth/login` | Publik | Login dengan `username` (kode rumah / username pengurus) + `password`. Terapkan rate limit. |
| `POST /api/auth/logout` | Semua terautentikasi | Hapus token aktif dari `user_sessions`. |
| `GET /api/auth/me` | Semua terautentikasi | Cek validitas sesi saat frontend startup & ambil profil user (`role`, `house_code`). |
| `PATCH /api/auth/password` | Semua terautentikasi | Ubah password akun sendiri. |
| **Keuangan & Cashflow** | | |
| `GET /api/finance?fund_type=IPL\|KAS_WARGA\|KAS_MESJID&period=YYYY-MM` | Semua terautentikasi | Daftar laporan keuangan + item cashflow. Mendukung filter periode & ringkasan tren bulanan. |
| `POST /api/finance/reports` | `admin`, `bendahara` | Buat/buka periode laporan keuangan baru (saldo awal diambil otomatis dari saldo akhir bulan sebelumnya). |
| `POST /api/finance/reports/{id}/transactions` | `admin`, `bendahara` | Tambah 1 transaksi pemasukan/pengeluaran secara langsung (re-kalkulasi total di server). |
| `PATCH /api/finance/transactions/{txId}` | `admin`, `bendahara` | Edit rincian/nominal transaksi & re-kalkulasi saldo laporan. |
| `DELETE /api/finance/transactions/{txId}` | `admin`, `bendahara` | Hapus transaksi & re-kalkulasi saldo laporan. |
| `POST /api/finance/import` | `admin`, `bendahara` | Impor massal transaksi dari CSV/XLSX. |
| `POST /api/finance/{id}/export` *(atau header `Authorization`)* | Semua terautentikasi | Unduh laporan CSV/XLSX menggunakan `fetch` dengan header `Authorization` (bukan `?token=` di URL). |
| `GET /api/ipl/my-status` | `warga` | Status pembayaran IPL milik rumah user yang login. |
| `POST /api/ipl/payments` | `warga` | Upload bukti transfer IPL rumah sendiri. |
| `PATCH /api/ipl/payments/{id}/verify` | `admin`, `bendahara` | Verifikasi pembayaran IPL warga (`Lunas` / `Ditolak`). |
| **Kegiatan Warga** | | |
| `GET /api/activities` | Semua terautentikasi | Daftar laporan kegiatan warga + foto dokumentasi (terurut dari `activity_date DESC`). |
| `POST /api/activities` | `admin` | Posting laporan kegiatan baru beserta daftar URL foto dokumentasi. |
| `PATCH /api/activities/{id}` | `admin` | Edit laporan kegiatan. |
| `DELETE /api/activities/{id}` | `admin` | Hapus laporan kegiatan. |
| **Layanan Warga (Isolasi Data)** | | |
| `GET /api/tickets` | Semua terautentikasi | `warga` hanya melihat tiket miliknya (atau ringkasan status fasum tanpa PII); `admin`/`keamanan` melihat semua. |
| `GET /api/access-cards` | Semua terautentikasi | `warga` hanya melihat pengajuan milik rumahnya sendiri; `admin`/`keamanan` melihat semua (termasuk STNK). |
| `GET /api/uploads/{filename}` | Terautentikasi | File sensitif (seperti STNK) hanya bisa diakses oleh pemilik pengajuan atau `admin`/`keamanan`. |
| `PATCH /api/bookings/{id}`, `PATCH /api/tickets/{id}`, `PATCH /api/access-cards/{id}`, `PATCH /api/asset-loans/{id}`, `PATCH /api/panic/{id}` | Sesuai matriks role | Wajib validasi enum status dan wajib mencatat `audit_logs`. |

---

## 6. Roadmap Implementasi per Fase

### Fase 1 — MVP (Estimasi: 2–3 Minggu)
1. **Minggu 1: Keamanan Inti & Refactor Database**
   - Migrasi `pg_store.go` dari pola full-delete ke query SQL per entitas + tabel `users` & `user_sessions`.
   - Implementasi password hashing (`bcrypt`), middleware `requireAuth` & `requireRole(...)`, serta penutupan seluruh endpoint publik sensitif.
   - Perbaikan upload file (validasi MIME type/magic bytes) & CORS whitelist.
2. **Minggu 2: Modul Keuangan & Kegiatan (Admin + Warga)**
   - Implementasi API & UI Admin untuk input/edit/hapus transaksi cashflow IPL, KAS Warga, dan KAS Mesjid secara langsung (selain impor Excel).
   - Pembaruan `KasReportPage.tsx` dan `IplReportPage.tsx` (pemilih periode, ringkasan saldo awal/masuk/keluar/akhir, tabel rincian cashflow, download aman via Blob/header).
   - Implementasi API & UI Admin untuk posting Laporan Kegiatan Warga + foto dokumentasi, dan menampilkannya di Beranda & halaman Info.
3. **Minggu 3: Isolasi Data Warga, Audit Lengkap & Pengujian**
   - Filter kepemilikan data untuk `tickets`, `access-cards`, `bookings`, `asset-loans`.
   - Penambahan `ProtectedRoute` dan validasi token `GET /api/auth/me` di frontend, pre-fill form dari sesi user, serta pencatatan audit log di semua aksi mutasi admin.
   - Pembaruan `handlers_test.go` untuk menguji otorisasi tiap role.

### Fase 2 — Operasional Lanjutan (Estimasi: 2–3 Minggu)
1. Aktivasi sub-role `bendahara` dan `keamanan` dengan dashboard terfokus.
2. Fitur status IPL per rumah (`ipl_house_payments`), upload bukti transfer warga, dan verifikasi oleh Bendahara.
3. Grafik cashflow bulanan (6–12 bulan) di halaman Laporan IPL & KAS.
4. Validasi anti-bentrok jadwal booking fasilitas & perbaikan logika pengurangan stok peminjaman aset (berkurang saat `Dipinjam`, bukan saat `Menunggu`).
5. Notifikasi real-time Panic Button untuk admin/keamanan (SSE/WebSocket).

### Fase 3 — Nice-to-Have (Berkelanjutan)
1. Notifikasi WhatsApp Gateway (tagihan IPL, status tiket, panic alert).
2. Integrasi QRIS dinamis / Payment Gateway untuk rekonsiliasi IPL otomatis.
3. E-Voting warga, Visitor Pass (QR tamu), dan integrasi stream CCTV (HLS/WebRTC).

---

## 7. Checklist Implementasi

### Backend (`backend/`)
- [ ] Tambahkan `bcrypt` (`golang.org/x/crypto/bcrypt`) untuk hash password di tabel `users` dan hapus ketergantungan pada `RESIDENT_PASSWORD` tunggal.
- [ ] Wajibkan `DATA_ENCRYPTION_KEY` di environment (fail fast saat startup jika kosong di mode produksi, hapus hardcoded fallback di `crypto.go:19`).
- [ ] Buat tabel `user_sessions` agar sesi login bertahan saat server restart dan tambahkan endpoint `POST /api/auth/logout` & `GET /api/auth/me`.
- [ ] Terapkan middleware `requireAuth` pada seluruh endpoint `/api/*` selain `/api/health` dan `/api/auth/login`, serta `requireRole(...)` untuk endpoint admin/bendahara/keamanan.
- [ ] Refactor `pg_store.go`: hapus `savePostgresLocked()` yang melakukan `DELETE FROM` seluruh tabel, ganti dengan operasi CRUD per tabel dalam transaksi yang tepat.
- [ ] Pisahkan tipe dana keuangan menjadi `IPL`, `KAS_WARGA`, dan `KAS_MESJID`, serta buat endpoint CRUD transaksi satuan (`finance_transactions`).
- [ ] Buat tabel & endpoint CRUD `activity_reports` + `activity_photos` untuk laporan kegiatan warga.
- [ ] Validasi MIME type / magic bytes pada `handleUpload` (`handlers.go:1024`) dan lindungi akses file sensitif (STNK).
- [ ] Validasi enum `status`, cek bentrok jadwal booking, perbaiki logika stok `AssetLoan`, dan catat `recordAudit` pada semua endpoint `PATCH`/`DELETE` admin.
- [ ] Hapus dukungan `?token=` pada query string (`handlers.go:64-66`) dan batasi `Access-Control-Allow-Origin` sesuai domain frontend di `.env`.
- [ ] Tambahkan unit test otorisasi (401/403 untuk akses ilegal) di `handlers_test.go`.

### Frontend (`frontend/`)
- [ ] Bungkus `JSON.parse(localStorage.getItem('vh_user'))` dengan `try/catch` di `AuthContext.tsx` dan validasi token ke `GET /api/auth/me` saat inisialisasi.
- [ ] Tangani response `401` di `api/client.ts` untuk otomatis logout dan redirect ke halaman login.
- [ ] Tambahkan komponen `<ProtectedRoute>` di `App.tsx` untuk memblokir akses `/pengurus` dari role `warga`.
- [ ] Ubah mekanisme download CSV/XLSX di `api/client.ts` menggunakan `fetch` + `Authorization: Bearer ...` lalu `URL.createObjectURL(blob)` agar token tidak masuk ke URL.
- [ ] Perbarui `KasReportPage.tsx`: tambahkan pemilih periode bulan, tab/pemisahan `KAS Warga` & `KAS Mesjid`, ringkasan saldo awal/akhir, dan tabel rincian transaksi cashflow.
- [ ] Perbarui `AdminPage.tsx`: tambahkan form input/edit/hapus transaksi keuangan satuan dan form posting/edit/hapus Laporan Kegiatan Warga + upload foto.
- [ ] Tambahkan pre-fill otomatis `name` dan `house_code` dari `useAuth().user` pada `PanicModal.tsx`, `FacilitiesPage.tsx`, `AccessCardPage.tsx`, dan `AssetLoanPage.tsx`.
- [ ] Pindahkan konfigurasi rekening bank (`BNI 7790080086`) dan daftar blok dari hardcoded frontend ke response API `GET /api/settings` atau `/api/auth/houses`.
