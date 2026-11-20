import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Box,
  CalendarDays,
  Cctv,
  CreditCard,
  FileText,
  TrendingUp,
  Users,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';

const ALL_SERVICES = [
  {
    title: 'Direktori warga',
    description: 'Cari informasi blok, status rumah, dan daftar pengurus.',
    cta: 'Buka direktori',
    to: '/direktori',
    icon: Users,
  },
  {
    title: 'Pesan fasilitas',
    description: 'Lihat jadwal dan ajukan pemakaian fasilitas lingkungan.',
    cta: 'Cek jadwal',
    to: '/fasilitas?tab=pemanfaatan',
    icon: CalendarDays,
  },
  {
    title: 'Lapor Masalah',
    description: 'Sampaikan kerusakan atau kendala fasilitas umum.',
    cta: 'Buat Laporan',
    to: '/fasilitas?tab=tiket',
    icon: AlertTriangle,
  },
  {
    title: 'Pinjam Barang',
    description: 'Lihat aset paguyuban dan status peminjaman barang.',
    cta: 'Lihat barang',
    to: '/pinjam-barang',
    icon: Box,
  },
  {
    title: 'Laporan IPL',
    description: 'Pantau tagihan, transparansi, dan unduh laporan IPL bulanan.',
    cta: 'Lihat Laporan',
    to: '/laporan-ipl',
    icon: FileText,
  },
  {
    title: 'Laporan kas',
    description: 'Ringkasan pemasukan, pengeluaran, dan QRIS KAS warga & mesjid.',
    cta: 'Lihat KAS',
    to: '/laporan-kas',
    icon: TrendingUp,
  },
  {
    title: 'Pengajuan Kartu Akses',
    description: 'Ajukan penambahan kartu akses gerbang utama Victoria Hill.',
    cta: 'Ajukan',
    to: '/kartu-akses',
    icon: CreditCard,
  },
  {
    title: 'Pantau CCTV',
    description: 'Cek pantauan kamera CCTV lingkungan secara realtime.',
    cta: 'Buka CCTV',
    to: '/cctv',
    icon: Cctv,
  },
];

export function ServicesPage() {
  return (
    <div>
      <PageHeader
        title="Layanan warga"
        subtitle="Pilih layanan lingkungan Victoria Hill yang Anda butuhkan"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {ALL_SERVICES.map((svc) => (
          <Link
            key={svc.title}
            to={svc.to}
            className="group flex flex-col justify-between rounded-3xl bg-white border border-[#dce5df] p-5 shadow-xs hover:border-[#176b4b] hover:shadow-md transition"
          >
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8f0eb] text-[#176b4b] group-hover:bg-[#1b4532] group-hover:text-white transition">
                <svc.icon className="w-6 h-6" />
              </div>
              <h2 className="mt-4 text-base font-bold text-[#17251f]">{svc.title}</h2>
              <p className="mt-1.5 text-sm text-[#506457] leading-relaxed">{svc.description}</p>
            </div>

            <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-[#176b4b] group-hover:gap-2.5 transition-all">
              <span>{svc.cta}</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
