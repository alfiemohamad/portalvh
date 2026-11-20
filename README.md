# Victoria Hill — Portal Warga (Web)

Aplikasi web **Portal Warga Victoria Hill** yang dibangun berdasarkan desain Figma, menggunakan **React (TypeScript + Vite + Tailwind CSS)** untuk frontend dan **Golang (`net/http`)** untuk backend REST API.

## Fitur Utama

- **Beranda**: Hero sambutan warga, 8 layanan cepat, pengumuman terbaru, kartu bantuan darurat WhatsApp, galeri aktifitas warga, katalog UMKM warga, dan akses cepat.
- **Direktori Warga**: Statistik rumah terdata/dihuni/kosong, filter blok, pencarian warga, dan modal detail penghuni & pengurus.
- **Fasilitas (Ringkasan, Pemanfaatan, Tiket)**: Ringkasan aset & grafik pemanfaatan bulanan, daftar fasilitas (Lapangan Basket VH, Kolam renang, Mesjid Algulfrah, Cabanna, Playground) dengan fitur booking & jadwal, serta formulir pembuatan tiket laporan masalah dengan upload foto.
- **Pengajuan Kartu Akses**: Form pengajuan tambah kartu akses gerbang utama (Rp 50.000) dengan upload foto STNK dan pelacakan status.
- **Laporan IPL & Laporan KAS**: Transparansi pemasukan/pengeluaran bulanan, tombol unduh laporan CSV, salin rekening BNI `7790080086`, serta QRIS KAS Warga & KAS Mesjid yang dapat diunduh sebagai PNG.
- **Pantau CCTV**: Grid kamera realtime dengan filter area (`Semua`, `Gerbang Utama`, `Kolam Renang`) dan tampilan layar penuh.
- **Pinjam Barang**: Inventaris aset paguyuban dan pengajuan peminjaman barang.
- **Panic Button**: Tombol darurat di header desktop & navigasi bawah mobile yang mengirim sinyal langsung ke Dashboard Pengurus dan tautan cepat ke WhatsApp Security.
- **Dashboard Pengurus (`Masuk pengurus`)**: Autentikasi pengurus (konfigurasi melalui `.env`) untuk mengelola pengumuman, tiket laporan, kartu akses, pemesanan fasilitas, import CSV/Excel, dan sinyal darurat.

## Cara Menjalankan

### 0. Siapkan Konfigurasi Environment
Salin `.env.example` menjadi `backend/.env` dan sesuaikan `DATABASE_URL`, `ADMIN_USERNAME`, dan `ADMIN_PASSWORD`:
```bash
cp .env.example backend/.env
```

### 1. Jalankan Backend (Golang — Port 8080)
```bash
cd backend
go run .
```

### 2. Jalankan Frontend (React + Vite — Port 5173)
```bash
cd frontend
npm install
npm run dev
```

Buka browser di **http://localhost:5173**.
