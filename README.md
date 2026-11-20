# Victoria Hill — Portal Warga (`portalvh`)

Aplikasi web **Portal Warga Victoria Hill** berbasis **React (TypeScript + Vite + Tailwind CSS)** untuk frontend, **Golang (`net/http`)** untuk backend REST API, dan **PostgreSQL** sebagai database utama.

## Fitur Utama

- **Beranda**: Hero sambutan warga, 8 layanan cepat, pengumuman terbaru, kartu bantuan darurat WhatsApp, galeri aktifitas warga, katalog UMKM warga, dan akses cepat.
- **Direktori Warga**: Statistik rumah terdata/dihuni/kosong, filter blok, pencarian warga, serta detail penghuni & pengurus.
- **Fasilitas (`Ringkasan`, `Pemanfaatan`, `Tiket`)**: Ringkasan aset & grafik pemanfaatan bulanan, daftar fasilitas (*Lapangan Basket VH, Kolam renang, Mesjid Algulfrah, Cabanna, Playground*) dengan booking & jadwal, serta pembuatan tiket laporan masalah lengkap dengan upload foto.
- **Pengajuan Kartu Akses**: Form tambah kartu akses gerbang utama (Rp 50.000) dengan upload foto STNK dan pelacakan status.
- **Laporan IPL & Laporan KAS**: Transparansi pemasukan/pengeluaran bulanan, unduh laporan **CSV & Excel (`.xlsx`)**, salin nomor rekening, serta QRIS **KAS warga** & **KAS mesjid** yang dapat diunduh sebagai PNG.
- **Pantau CCTV**: Grid kamera realtime dengan filter area (`Semua`, `Gerbang Utama`, `Kolam Renang`) dan tampilan layar penuh.
- **Pinjam Barang**: Inventaris aset paguyuban dan pengajuan peminjaman barang.
- **Panic Button**: Tombol darurat di header desktop & navigasi bawah mobile yang mengirim sinyal langsung ke Dashboard Pengurus dan tautan cepat ke WhatsApp Security.
- **Dashboard Pengurus (`Masuk pengurus`)**: Autentikasi pengurus (konfigurasi via `.env`) untuk mengelola pengumuman, tiket laporan, kartu akses, pemesanan fasilitas, sinyal darurat, serta **Upload / Import CSV & Excel (`.xlsx`)** untuk Laporan Keuangan & Data Warga.

---

## Menjalankan di Local (Development)

### Prasyarat
- **Go** `>= 1.24` (akan otomatis menggunakan toolchain `go1.26` sesuai `go.mod`)
- **Node.js** `>= 18` & `npm`
- **PostgreSQL** `>= 14`

### 1. Buat Database PostgreSQL
```bash
psql -U postgres -c "CREATE DATABASE victoria_hill;"
```
*(Tabel dan data awal Victoria Hill akan otomatis dibuat/di-seed saat backend pertama kali dijalankan.)*

### 2. Konfigurasi Environment (`.env`)
Salin file template `.env.example` ke `backend/.env`:
```bash
cp .env.example backend/.env
```
Isi `backend/.env` sesuai kredensial lokal Anda:
```env
DATABASE_URL=postgres://<user>:<password>@localhost:5432/victoria_hill?sslmode=disable
PORT=8080
ADMIN_USERNAME=pengurus
ADMIN_PASSWORD=<password_pengurus_anda>
```

### 3. Jalankan Backend (Golang — Port 8080)
```bash
cd backend
go mod download
go run .
```
Backend berjalan di `http://localhost:8080` (cek `http://localhost:8080/api/health`).

### 4. Jalankan Frontend (React + Vite — Port 5173)
Buka terminal baru:
```bash
cd frontend
npm install
npm run dev
```
Buka **http://localhost:5173** di browser.

### 5. Menjalankan Unit Test Backend & Build Production Frontend
```bash
# Test Backend
cd backend && go test -v ./...

# Build Production Frontend
cd frontend && npm run build
```

---

## Opsi Deployment (Agar Bisa Diakses Rekan Lain)

Karena aplikasi ini terdiri dari **Frontend (React)**, **Backend (Golang)**, dan **Database (PostgreSQL)**, berikut perbandingan opsi deploy:

1. **Vercel saja?** — Vercel sangat ideal untuk hosting **Frontend React**, tetapi kurang cocok untuk menjalankan backend Golang yang stateful/long-running beserta database PostgreSQL lokal. Jika pakai Vercel untuk Frontend, Backend + PostgreSQL tetap perlu ditaruh di tempat lain (misalnya **Render / Railway / Neon / Fly.io**).
2. **GCP Free Trial (Cloud Run + Cloud SQL / Compute Engine)** — Pilihan yang sangat solid dan profesional:
   - **Cara termudah di GCP**: Deploy 1 VM **Compute Engine (`e2-micro` / `e2-small`)** dengan Docker Compose (React via Nginx + Golang API + PostgreSQL) agar semua langsung jalan dalam 1 server dengan biaya minimal/gratis dari kredit Free Trial.
   - **Cara serverless di GCP**: **Cloud Run** (untuk Golang backend + React static) + **Neon / Supabase** (PostgreSQL gratis) agar tidak perlu bayar Cloud SQL yang biayanya cukup besar per jam.
3. **Alternatif Paling Cepat untuk Review Rekan (Tanpa Setup Server)**:
   - **Frontend di Vercel** (gratis, langsung terhubung ke repo GitHub `portalvh`) + **Backend Golang di Render/Fly.io** + **PostgreSQL di Neon.tech** (semuanya punya *free tier*), **atau**
   - Jalankan di laptop Anda lalu bagikan sementara pakai **Cloudflare Tunnel (`cloudflared tunnel --url http://localhost:5173`)** jika hanya untuk demo cepat 1-2 jam ke rekan.
