# Victoria Hill — Portal Warga (`portalvh`)

Aplikasi web **Portal Warga Victoria Hill** berbasis **React (TypeScript + Vite + Tailwind CSS)** untuk frontend, **Golang (`net/http`)** untuk backend REST API, dan **PostgreSQL** sebagai database utama.

## Fitur Utama

- **Beranda**: Hero sambutan warga, 8 layanan cepat, pengumuman terbaru, kartu bantuan darurat WhatsApp, galeri aktifitas warga, katalog UMKM warga, dan akses cepat.
- **Direktori Warga**: Statistik rumah terdata/dihuni/kosong, filter blok, pencarian warga, serta detail penghuni & pengurus.
- **Fasilitas (`Ringkasan`, `Pemanfaatan`, `Tiket`)**: Ringkasan aset & grafik pemanfaatan bulanan, daftar fasilitas (*Lapangan Basket VH, Kolam renang, Mesjid Algulfrah, Cabanna, Playground*) dengan booking & jadwal, serta pembuatan tiket laporan masalah lengkap dengan upload foto.
- **Pengajuan Kartu Akses**: Form tambah kartu akses gerbang utama dengan upload foto STNK dan pelacakan status.
- **Laporan IPL & Laporan KAS**: Transparansi pemasukan/pengeluaran bulanan, unduh laporan **CSV & Excel (`.xlsx`)**, salin nomor rekening, serta QRIS **KAS warga** & **KAS mesjid** yang dapat diunduh sebagai PNG.
- **Pantau CCTV**: Grid kamera realtime dengan filter area dan tampilan layar penuh.
- **Pinjam Barang**: Inventaris aset paguyuban dan pengajuan peminjaman barang.
- **Panic Button**: Tombol darurat yang mengirim sinyal langsung ke Dashboard Pengurus dan tautan cepat ke WhatsApp Security.
- **Dashboard Pengurus (`Masuk pengurus`)**: Autentikasi pengurus (konfigurasi via `.env`) untuk mengelola pengumuman, tiket laporan, kartu akses, pemesanan fasilitas, sinyal darurat, serta **Upload / Import CSV & Excel (`.xlsx`)** untuk Laporan Keuangan & Data Warga.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, React Router v6
- **Backend**: Go (`net/http`), `github.com/lib/pq` (PostgreSQL), `github.com/xuri/excelize/v2` (Excel `.xlsx`)
- **Database**: PostgreSQL

## Setup untuk Developer / Kolaborator

### Prasyarat
- **Go** `>= 1.24`
- **Node.js** `>= 18` & `npm`
- **PostgreSQL** `>= 14`

### 1. Clone Repository
```bash
git clone <repo-url>
cd portalvh
```

### 2. Siapkan Database PostgreSQL
Buat database baru di PostgreSQL:
```bash
psql -U postgres -c "CREATE DATABASE victoria_hill;"
```
Tabel dan data awal (*seed*) akan otomatis dibuat saat backend dijalankan pertama kali.

### 3. Konfigurasi Environment
Salin `.env.example` menjadi `backend/.env` lalu isi kredensial environment Anda:
```bash
cp .env.example backend/.env
```
Variabel yang dibutuhkan di `backend/.env`:
- `DATABASE_URL` — Connection string PostgreSQL
- `PORT` — Port API backend (default `8080`)
- `ADMIN_USERNAME` — Username login pengurus
- `ADMIN_PASSWORD` — Password login pengurus

### 4. Jalankan Backend (Port 8080)
```bash
cd backend
go mod download
go run .
```

### 5. Jalankan Frontend (Port 5173)
```bash
cd frontend
npm install
npm run dev
```
Buka **http://localhost:5173** di browser.

### 6. Menjalankan Test & Build
```bash
# Unit test backend
cd backend && go test -v ./...

# Build production frontend
cd frontend && npm run build
```

## Opsi Deployment

- **Frontend (Vercel)** + **Backend (Render / Fly.io)** + **PostgreSQL (Neon / Supabase)**
- **GCP (Cloud Run / Compute Engine)** dengan Docker Compose untuk menjalankan Frontend, Backend, dan PostgreSQL secara terintegrasi.
