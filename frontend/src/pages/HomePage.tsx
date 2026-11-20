import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Box,
  CalendarDays,
  Cctv,
  CreditCard,
  FileText,
  MessageCircle,
  TrendingUp,
  Users,
} from 'lucide-react';
import { api, formatRupiah } from '../api/client';
import type { DashboardData } from '../types';

const QUICK_SERVICES = [
  { label: 'Direktori warga', icon: Users, to: '/direktori' },
  { label: 'Fasilitas', icon: CalendarDays, to: '/fasilitas' },
  { label: 'Lapor Masalah', icon: AlertTriangle, to: '/fasilitas?tab=tiket' },
  { label: 'Pinjam Barang', icon: Box, to: '/pinjam-barang' },
  { label: 'Pengajuan kartu akses', icon: CreditCard, to: '/kartu-akses' },
  { label: 'Laporan IPL', icon: FileText, to: '/laporan-ipl' },
  { label: 'Laporan KAS', icon: TrendingUp, to: '/laporan-kas' },
  { label: 'Pantau CCTV', icon: Cctv, to: '/cctv' },
];

export function HomePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getDashboard()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const latestAnnouncements = data?.announcements.slice(0, 2) ?? [];

  return (
    <div className="space-y-8">
      {/* Hero Banner — matches Frame 2 */}
      <section className="vh-hero-gradient rounded-3xl border border-[#dce5df] p-6 sm:p-8 md:p-10 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-xs font-bold tracking-[0.12em] uppercase text-[#176b4b]">
              PORTAL WARGA VICTORIA HILL
            </p>
            <h1 className="mt-2.5 text-3xl sm:text-4xl font-black tracking-tight text-[#17251f] leading-tight">
              Halo, warga Victoria Hill
            </h1>
            <p className="mt-3 text-sm sm:text-base text-[#42564a] leading-relaxed">
              Akses layanan lingkungan, cek fasilitas, dan sampaikan laporan dari satu tempat.
            </p>
          </div>

          {data && (
            <div className="grid grid-cols-3 gap-2 sm:gap-4 shrink-0">
              <div className="rounded-2xl bg-white/85 border border-[#dce5df] px-2.5 sm:px-4 py-3 text-center">
                <div className="text-xl sm:text-2xl font-black text-[#1b4532]">{data.stats.occupied_houses}</div>
                <div className="text-[10px] sm:text-[11px] font-medium text-[#506457]">Rumah Dihuni</div>
              </div>
              <div className="rounded-2xl bg-white/85 border border-[#dce5df] px-2.5 sm:px-4 py-3 text-center">
                <div className="text-xl sm:text-2xl font-black text-[#176b4b]">{data.stats.facilities}</div>
                <div className="text-[10px] sm:text-[11px] font-medium text-[#506457]">Fasilitas Aktif</div>
              </div>
              <div className="rounded-2xl bg-white/85 border border-[#dce5df] px-2.5 sm:px-4 py-3 text-center">
                <div className="text-xl sm:text-2xl font-black text-[#ee4129]">{data.stats.open_tickets}</div>
                <div className="text-[10px] sm:text-[11px] font-medium text-[#506457]">Laporan Aktif</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Layanan Warga — 8 Service Tiles */}
      <section>
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-[#17251f]">Layanan warga</h2>
            <p className="text-sm text-[#506457]">Pilih layanan yang Anda butuhkan</p>
          </div>
          <Link
            to="/layanan"
            className="text-sm font-semibold text-[#176b4b] underline underline-offset-4 hover:text-[#1b4532]"
          >
            Lihat semua
          </Link>
        </div>

        <div className="grid grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-4">
          {QUICK_SERVICES.map((svc) => (
            <Link
              key={svc.label}
              to={svc.to}
              className="group flex flex-col items-center text-center gap-2"
            >
              <div className="flex h-14 w-14 sm:h-[76px] sm:w-[76px] items-center justify-center rounded-2xl bg-white border border-[#dce5df] text-[#176b4b] shadow-xs transition group-hover:border-[#176b4b] group-hover:bg-[#eef4ef] group-hover:-translate-y-0.5">
                <svc.icon className="w-6 h-6 sm:w-7 sm:h-7 stroke-[1.75]" />
              </div>
              <span className="text-[11px] sm:text-[13px] font-medium text-[#1b4532] leading-tight group-hover:text-[#176b4b]">
                {svc.label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Two-Column Middle Row on Web: Pengumuman Warga + Bantuan Darurat */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pengumuman Warga */}
        <section className="lg:col-span-2 rounded-3xl bg-white border border-[#dce5df] p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#17251f]">Pengumuman warga</h2>
            <Link
              to="/info"
              className="rounded-full bg-[#eef4ef] px-3.5 py-1 text-xs font-semibold text-[#176b4b] hover:bg-[#d8e8dd] transition"
            >
              Terbaru
            </Link>
          </div>

          {loading ? (
            <div className="h-24 animate-pulse rounded-2xl bg-[#f4f7f5]" />
          ) : latestAnnouncements.length === 0 ? (
            <div className="flex items-center gap-4 rounded-2xl bg-[#f7f9f7] border border-[#edf1ee] p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e8f0eb] text-[#176b4b]">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#17251f]">Belum ada pengumuman baru</p>
                <p className="text-xs text-[#506457] mt-0.5">
                  Informasi lingkungan akan muncul di sini.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {latestAnnouncements.map((ann) => (
                <div
                  key={ann.id}
                  className="flex items-start gap-4 rounded-2xl bg-[#f7f9f7] border border-[#edf1ee] p-4 hover:border-[#d8e8dd] transition"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8f0eb] text-[#176b4b]">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#d8e8dd] px-2.5 py-0.5 text-[11px] font-semibold text-[#1b4532]">
                        {ann.category}
                      </span>
                      <span className="text-[11px] text-[#5c6b63]">
                        {new Date(ann.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <h3 className="mt-1 text-sm font-bold text-[#17251f]">{ann.title}</h3>
                    <p className="mt-1 text-xs text-[#506457] line-clamp-2 leading-relaxed">
                      {ann.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Butuh bantuan darurat? — matches warm cream card in Frame 2 */}
        <section className="flex flex-col justify-between rounded-3xl bg-[#fff7ed] border border-[#e8c6aa] p-6 shadow-xs">
          <div>
            <h2 className="text-lg font-bold text-[#17251f]">Butuh bantuan darurat?</h2>
            <p className="mt-2 text-sm text-[#70533d] leading-relaxed">
              Hubungi pengurus untuk keadaan yang perlu ditangani segera.
            </p>
          </div>
          <div className="mt-6 space-y-2.5">
            <a
              href="https://wa.me/6281190002424?text=Halo%20Pengurus%20Victoria%20Hill%2C%20saya%20membutuhkan%20bantuan%20darurat."
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#e8c6aa] bg-white px-5 py-3 text-sm font-bold text-[#873e13] shadow-xs hover:bg-[#fef2e4] transition"
            >
              <MessageCircle className="w-4 h-4" />
              Hubungi via WhatsApp
            </a>
            <Link
              to="/kontak"
              className="block text-center text-xs font-semibold text-[#873e13] hover:underline"
            >
              Lihat semua kontak pengurus →
            </Link>
          </div>
        </section>
      </div>

      {/* Galleri aktifitas warga */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#17251f]">Galleri aktifitas warga</h2>
          <Link
            to="/info?section=galeri"
            className="text-sm font-semibold text-[#176b4b] underline underline-offset-4 hover:text-[#1b4532]"
          >
            Lihat semua
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(data?.gallery ?? []).map((photo) => (
            <div
              key={photo.id}
              className="group overflow-hidden rounded-2xl bg-white border border-[#dce5df] shadow-xs"
            >
              <div className="aspect-[16/10] overflow-hidden bg-[#eef4ef]">
                <img
                  src={photo.image_url}
                  alt={photo.title}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
              </div>
              <div className="p-3.5">
                <div className="text-[11px] font-semibold text-[#176b4b]">{photo.date}</div>
                <div className="mt-0.5 text-sm font-bold text-[#17251f] line-clamp-1">
                  {photo.title}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* UMKM Warga */}
      <section>
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-[#17251f]">UMKM warga</h2>
            <p className="text-sm text-[#506457]">Promosikan apapun disini, siapa tau cuan</p>
          </div>
          <Link
            to="/info?section=umkm"
            className="text-sm font-semibold text-[#176b4b] underline underline-offset-4 hover:text-[#1b4532]"
          >
            Lihat semua
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {(data?.umkm ?? []).map((item) => (
            <div
              key={item.id}
              className="flex flex-col overflow-hidden rounded-3xl bg-white border border-[#dce5df] shadow-xs hover:shadow-md transition"
            >
              <div className="aspect-[16/10] overflow-hidden bg-[#eef4ef]">
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-[#17251f]">{item.name}</h3>
                    <p className="text-xs text-[#506457]">
                      {item.seller_name} · Blok {item.house_code}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#eef4ef] px-3 py-1 text-xs font-bold text-[#1b4532]">
                    {formatRupiah(item.price)}
                  </span>
                </div>
                <p className="mt-2.5 text-sm text-[#506457] line-clamp-2 flex-1">
                  {item.description}
                </p>
                <a
                  href={`https://wa.me/${item.whatsapp}?text=${encodeURIComponent(
                    `Halo ${item.seller_name}, saya warga Victoria Hill tertarik memesan ${item.name}.`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-[#ee4129] bg-white px-5 py-2.5 text-sm font-bold text-[#ee4129] hover:bg-[#ee4129] hover:text-white transition"
                >
                  Pesan Sekarang
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Akses Cepat */}
      <section className="rounded-3xl bg-white border border-[#dce5df] p-6 shadow-xs">
        <h2 className="text-lg font-bold text-[#17251f] mb-2">Akses cepat</h2>
        <div className="divide-y divide-[#edf1ee]">
          {[
            { label: 'Cek status laporan', to: '/kontak?tab=status' },
            { label: 'Panduan layanan', to: '/info?section=panduan' },
            { label: 'Kontak pengurus', to: '/kontak' },
          ].map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="flex items-center justify-between py-3.5 text-sm font-semibold text-[#17251f] hover:text-[#176b4b] transition group"
            >
              <span>{item.label}</span>
              <ArrowRight className="w-4 h-4 text-[#506457] transition group-hover:translate-x-1 group-hover:text-[#176b4b]" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
