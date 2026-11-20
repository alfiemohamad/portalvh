import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bell, BookOpen, Image as ImageIcon, Plus, Store, X } from 'lucide-react';
import { api, formatRupiah } from '../api/client';
import type { DashboardData } from '../types';
import { PageHeader } from '../components/PageHeader';

export function InfoPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const section = searchParams.get('section') || 'pengumuman';
  const [data, setData] = useState<DashboardData | null>(null);
  const [showAddUmkm, setShowAddUmkm] = useState(false);
  const [umkmForm, setUmkmForm] = useState({
    name: '',
    seller_name: '',
    house_code: '',
    category: 'Kuliner',
    price: 25000,
    description: '',
    whatsapp: '62812',
    image_url: '/images/umkm-brownies.png',
  });

  const load = () => {
    api.getDashboard().then(setData).catch(console.error);
  };

  useEffect(() => {
    load();
  }, []);

  const handleAddUmkm = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createUmkm(umkmForm);
    setShowAddUmkm(false);
    setUmkmForm({
      name: '',
      seller_name: '',
      house_code: '',
      category: 'Kuliner',
      price: 25000,
      description: '',
      whatsapp: '62812',
      image_url: '/images/umkm-brownies.png',
    });
    load();
  };

  const tabs = [
    { key: 'pengumuman', label: 'Pengumuman', icon: Bell },
    { key: 'galeri', label: 'Laporan Kegiatan', icon: ImageIcon },
    { key: 'umkm', label: 'UMKM Warga', icon: Store },
    { key: 'panduan', label: 'Panduan Layanan', icon: BookOpen },
  ];

  return (
    <div>
      <PageHeader
        title="Informasi & Komunitas"
        subtitle="Pengumuman warga, dokumentasi kegiatan, UMKM, dan panduan layanan"
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSearchParams({ section: t.key })}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition cursor-pointer ${
              section === t.key
                ? 'bg-[#1b4532] text-white shadow-xs'
                : 'bg-white border border-[#dce5df] text-[#42564a] hover:bg-[#eef4ef]'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Pengumuman */}
      {section === 'pengumuman' && (
        <div className="space-y-4">
          {(data?.announcements ?? []).map((ann) => (
            <article
              key={ann.id}
              className="rounded-3xl bg-white border border-[#dce5df] p-6 shadow-xs"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#dff0e4] px-3 py-0.5 text-xs font-bold text-[#176b4b]">
                  {ann.category}
                </span>
                <span className="text-xs text-[#5c6b63]">
                  {new Date(ann.created_at).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
                <span className="text-xs text-[#5c6b63]">· {ann.author}</span>
              </div>
              <h2 className="mt-2 text-lg font-bold text-[#17251f]">{ann.title}</h2>
              <p className="mt-2 text-sm text-[#42564a] leading-relaxed">{ann.content}</p>
            </article>
          ))}
        </div>
      )}

      {/* Laporan Kegiatan Warga */}
      {section === 'galeri' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {(data?.activities ?? []).length === 0 ? (
            <div className="col-span-full rounded-3xl bg-white border border-[#dce5df] p-8 text-center text-sm text-[#506457]">
              Belum ada laporan kegiatan warga yang dipublikasikan.
            </div>
          ) : (
            (data?.activities ?? []).map((act) => (
              <article
                key={act.id}
                className="flex flex-col overflow-hidden rounded-3xl bg-white border border-[#dce5df] shadow-xs"
              >
                <div className="aspect-[16/10] bg-[#eef4ef]">
                  <img
                    src={act.image_url || '/images/gallery-1.png'}
                    alt={act.title}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="rounded-full bg-[#dff0e4] px-2.5 py-0.5 font-bold text-[#176b4b]">
                      {act.category}
                    </span>
                    <span className="text-[#5c6b63] font-medium">{act.activity_date}</span>
                  </div>
                  <h3 className="mt-2 text-base font-bold text-[#17251f]">{act.title}</h3>
                  {act.location && (
                    <p className="mt-1 text-xs font-medium text-[#176b4b]">Lokasi: {act.location}</p>
                  )}
                  <p className="mt-2 text-sm text-[#506457] leading-relaxed flex-1">{act.summary}</p>
                  {act.budget_used > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#edf1ee] flex items-center justify-between text-xs">
                      <span className="text-[#506457]">Realisasi Anggaran</span>
                      <span className="font-bold text-[#1b4532]">{formatRupiah(act.budget_used)}</span>
                    </div>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      )}

      {/* UMKM */}
      {section === 'umkm' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              type="button"
              onClick={() => setShowAddUmkm(true)}
              className="inline-flex items-center gap-2 rounded-full bg-[#ee4129] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#d8351e] transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Promosikan UMKM Anda
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(data?.umkm ?? []).map((item) => (
              <div
                key={item.id}
                className="flex flex-col overflow-hidden rounded-3xl bg-white border border-[#dce5df] shadow-xs"
              >
                <div className="aspect-[16/10] bg-[#eef4ef]">
                  <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-[#17251f]">{item.name}</h3>
                      <p className="text-xs text-[#506457]">
                        {item.seller_name} · Blok {item.house_code}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#eef4ef] px-2.5 py-1 text-xs font-bold text-[#1b4532]">
                      {formatRupiah(item.price)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[#506457] flex-1">{item.description}</p>
                  <a
                    href={`https://wa.me/${item.whatsapp}?text=${encodeURIComponent(
                      `Halo ${item.seller_name}, saya tertarik memesan ${item.name}.`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-[#ee4129] py-2.5 text-sm font-bold text-[#ee4129] hover:bg-[#ee4129] hover:text-white transition"
                  >
                    Pesan Sekarang
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Panduan Layanan */}
      {section === 'panduan' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            {
              title: '1. Pemesanan Fasilitas Umum',
              body: 'Buka menu Fasilitas → Tab Pemanfaatan, pilih fasilitas yang diinginkan (Lapangan Basket, Kolam Renang, Mesjid Algulfrah, Cabanna, atau Playground), lalu klik Book dan pilih tanggal serta sesi waktu.',
            },
            {
              title: '2. Pelaporan Masalah & Fasum',
              body: 'Gunakan menu Lapor Masalah (atau Fasilitas → Tab Tiket). Sertakan kategori, lokasi, deskripsi, dan foto pendukung agar tim teknisi dapat menindaklanjuti lebih cepat.',
            },
            {
              title: '3. Pengajuan Kartu Akses Gerbang',
              body: 'Isi formulir Pengajuan Kartu Akses dengan melampirkan foto STNK kendaraan. Biaya administrasi sebesar Rp 50.000 per kartu dibayarkan saat pengambilan di pos pengurus.',
            },
            {
              title: '4. Pembayaran IPL & KAS Warga',
              body: 'Pembayaran IPL dan KAS dapat ditransfer ke rekening BNI 7790080086 a/n Perkumpulan Forum Warga Victoria Hill atau menggunakan kode QRIS pada halaman Laporan KAS.',
            },
          ].map((g) => (
            <div key={g.title} className="rounded-3xl bg-white border border-[#dce5df] p-6 shadow-xs">
              <h3 className="text-base font-bold text-[#17251f]">{g.title}</h3>
              <p className="mt-2 text-sm text-[#506457] leading-relaxed">{g.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add UMKM Modal */}
      {showAddUmkm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => setShowAddUmkm(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-[#dce5df]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#17251f]">Tambah Promosi UMKM</h3>
              <button
                type="button"
                onClick={() => setShowAddUmkm(false)}
                className="rounded-full p-1 hover:bg-[#f4f7f5] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddUmkm} className="space-y-3">
              <input
                type="text"
                required
                placeholder="Nama Produk / Jasa"
                value={umkmForm.name}
                onChange={(e) => setUmkmForm({ ...umkmForm, name: e.target.value })}
                className="w-full rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3.5 py-2.5 text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Nama Toko / Penjual"
                  value={umkmForm.seller_name}
                  onChange={(e) => setUmkmForm({ ...umkmForm, seller_name: e.target.value })}
                  className="w-full rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3.5 py-2.5 text-sm"
                />
                <input
                  type="text"
                  required
                  placeholder="Blok (mis. U16)"
                  value={umkmForm.house_code}
                  onChange={(e) => setUmkmForm({ ...umkmForm, house_code: e.target.value })}
                  className="w-full rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3.5 py-2.5 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  required
                  placeholder="Harga (Rp)"
                  value={umkmForm.price}
                  onChange={(e) => setUmkmForm({ ...umkmForm, price: Number(e.target.value) })}
                  className="w-full rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3.5 py-2.5 text-sm"
                />
                <input
                  type="text"
                  required
                  placeholder="No WA (628xxx)"
                  value={umkmForm.whatsapp}
                  onChange={(e) => setUmkmForm({ ...umkmForm, whatsapp: e.target.value })}
                  className="w-full rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3.5 py-2.5 text-sm"
                />
              </div>
              <textarea
                rows={3}
                required
                placeholder="Deskripsi singkat produk / sistem PO..."
                value={umkmForm.description}
                onChange={(e) => setUmkmForm({ ...umkmForm, description: e.target.value })}
                className="w-full rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3.5 py-2.5 text-sm"
              />
              <button
                type="submit"
                className="w-full rounded-full bg-[#ee4129] py-3 text-sm font-bold text-white hover:bg-[#d8351e] cursor-pointer"
              >
                Tayangkan UMKM
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
