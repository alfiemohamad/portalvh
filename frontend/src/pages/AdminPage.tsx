import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, CreditCard, FileSpreadsheet, ShieldAlert, Trash2, Upload, Wrench, Calendar } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type {
  AccessCardRequest,
  Announcement,
  FacilityBooking,
  PanicAlert,
  Ticket,
} from '../types';
import { PageHeader } from '../components/PageHeader';

export function AdminPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [cards, setCards] = useState<AccessCardRequest[]>([]);
  const [bookings, setBookings] = useState<FacilityBooking[]>([]);
  const [panics, setPanics] = useState<PanicAlert[]>([]);

  const [newAnn, setNewAnn] = useState({ title: '', content: '', category: 'Umum' });
  const [finType, setFinType] = useState<'IPL' | 'KAS'>('IPL');
  const [finPeriod, setFinPeriod] = useState('2026-12');
  const [finLabel, setFinLabel] = useState('Desember 2026');
  const [importMsg, setImportMsg] = useState('');
  const [importErr, setImportErr] = useState('');
  const [importing, setImporting] = useState(false);

  const loadAll = () => {
    api.getAnnouncements().then(setAnnouncements).catch(console.error);
    api.getTickets().then(setTickets).catch(console.error);
    api.getAccessCards().then(setCards).catch(console.error);
    api.getFacilities().then((r) => setBookings(r.bookings)).catch(console.error);
    api.getPanics().then(setPanics).catch(console.error);
  };

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    loadAll();
  }, [isAdmin, navigate]);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createAnnouncement({ ...newAnn, pinned: false });
    setNewAnn({ title: '', content: '', category: 'Umum' });
    loadAll();
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard Pengurus"
        subtitle="Kelola pengumuman, laporan masalah, kartu akses, pemesanan fasilitas, dan sinyal darurat"
      />

      {/* Panic Alerts Section */}
      {panics.length > 0 && (
        <section className="rounded-3xl bg-red-50 border border-red-200 p-6">
          <div className="flex items-center gap-2 text-red-700 font-bold mb-3">
            <ShieldAlert className="w-5 h-5" />
            Sinyal Panic Button ({panics.filter((p) => p.status === 'Aktif').length} Aktif)
          </div>
          <div className="space-y-2.5">
            {panics.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 border border-red-100 text-sm"
              >
                <div>
                  <span className="font-bold text-red-700">[{p.category}]</span>{' '}
                  <span className="font-semibold">{p.reporter_name}</span> ({p.house_code})
                  {p.note && <p className="text-xs text-[#506457] mt-0.5">{p.note}</p>}
                </div>
                {p.status === 'Aktif' ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await api.resolvePanic(p.id);
                      loadAll();
                    }}
                    className="rounded-full bg-[#1b4532] px-4 py-1.5 text-xs font-bold text-white cursor-pointer"
                  >
                    Tandai Ditangani
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#176b4b]">
                    <CheckCircle2 className="w-4 h-4" /> Ditangani
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Manage Announcements */}
      <section className="rounded-3xl bg-white border border-[#dce5df] p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-2 font-bold text-[#17251f]">
          <Bell className="w-5 h-5 text-[#176b4b]" />
          Kelola Pengumuman Warga
        </div>
        <form onSubmit={handleCreateAnnouncement} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            required
            placeholder="Judul pengumuman"
            value={newAnn.title}
            onChange={(e) => setNewAnn({ ...newAnn, title: e.target.value })}
            className="md:col-span-2 rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-4 py-2.5 text-sm"
          />
          <select
            value={newAnn.category}
            onChange={(e) => setNewAnn({ ...newAnn, category: e.target.value })}
            className="rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-4 py-2.5 text-sm"
          >
            <option value="Umum">Umum</option>
            <option value="Kegiatan">Kegiatan</option>
            <option value="Keamanan">Keamanan</option>
            <option value="Iuran">Iuran</option>
          </select>
          <button
            type="submit"
            className="rounded-xl bg-[#1b4532] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#133325] cursor-pointer"
          >
            Terbitkan
          </button>
          <textarea
            rows={2}
            required
            placeholder="Isi pengumuman untuk warga Victoria Hill..."
            value={newAnn.content}
            onChange={(e) => setNewAnn({ ...newAnn, content: e.target.value })}
            className="md:col-span-4 rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-4 py-2.5 text-sm"
          />
        </form>

        <div className="divide-y divide-[#edf1ee]">
          {announcements.map((a) => (
            <div key={a.id} className="py-3 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-bold text-[#17251f]">{a.title}</div>
                <div className="text-xs text-[#506457]">{a.category}</div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await api.deleteAnnouncement(a.id);
                  loadAll();
                }}
                className="rounded-full p-2 text-red-600 hover:bg-red-50 cursor-pointer"
                title="Hapus"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Tickets & Access Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-3xl bg-white border border-[#dce5df] p-6 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-[#17251f] mb-4">
            <Wrench className="w-5 h-5 text-[#176b4b]" />
            Tiket Laporan Masalah ({tickets.length})
          </div>
          <div className="space-y-3">
            {tickets.map((t) => (
              <div key={t.id} className="rounded-2xl bg-[#f7f9f7] border border-[#edf1ee] p-4 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">
                    {t.ticket_no} · {t.category}
                  </span>
                  <select
                    value={t.status}
                    onChange={async (e) => {
                      await api.updateTicket(t.id, e.target.value, t.admin_note || 'Sedang ditindaklanjuti pengurus.');
                      loadAll();
                    }}
                    className="rounded-full border border-[#dce5df] bg-white px-3 py-1 text-xs font-bold"
                  >
                    <option value="Open">Open</option>
                    <option value="Diproses">Diproses</option>
                    <option value="Selesai">Selesai</option>
                  </select>
                </div>
                <p className="text-xs text-[#506457] mt-1">{t.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-white border border-[#dce5df] p-6 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-[#17251f] mb-4">
            <CreditCard className="w-5 h-5 text-[#176b4b]" />
            Pengajuan Kartu Akses ({cards.length})
          </div>
          <div className="space-y-3">
            {cards.map((c) => (
              <div key={c.id} className="rounded-2xl bg-[#f7f9f7] border border-[#edf1ee] p-4 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-bold">{c.full_name}</div>
                    <div className="text-xs text-[#506457]">
                      {c.request_no} · {c.block} No. {c.house_no}
                    </div>
                  </div>
                  <select
                    value={c.status}
                    onChange={async (e) => {
                      await api.updateAccessCard(c.id, e.target.value);
                      loadAll();
                    }}
                    className="rounded-full border border-[#dce5df] bg-white px-3 py-1 text-xs font-bold"
                  >
                    <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
                    <option value="Diproses">Diproses</option>
                    <option value="Siap Diambil">Siap Diambil</option>
                    <option value="Ditolak">Ditolak</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Upload / Import CSV & Excel */}
      <section className="rounded-3xl bg-white border border-[#dce5df] p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-2 font-bold text-[#17251f]">
          <FileSpreadsheet className="w-5 h-5 text-[#176b4b]" />
          Upload / Import Data (CSV & Excel .xlsx)
        </div>

        {importMsg && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-[#1b4532]">
            {importMsg}
          </div>
        )}
        {importErr && (
          <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {importErr}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Import Finance */}
          <div className="rounded-2xl bg-[#f7f9f7] border border-[#edf1ee] p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-sm text-[#17251f]">Import Laporan Keuangan (IPL / KAS)</h3>
              <div className="flex gap-2 text-xs">
                <a
                  href={api.getTemplateUrl('finance', 'csv')}
                  download
                  className="text-[#176b4b] font-semibold underline"
                >
                  Template CSV
                </a>
                <a
                  href={api.getTemplateUrl('finance', 'xlsx')}
                  download
                  className="text-[#1b4532] font-semibold underline"
                >
                  Template Excel
                </a>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={finType}
                onChange={(e) => setFinType(e.target.value as 'IPL' | 'KAS')}
                className="rounded-xl border border-[#dce5df] bg-white px-3 py-2 text-xs font-semibold"
              >
                <option value="IPL">IPL</option>
                <option value="KAS">KAS</option>
              </select>
              <input
                type="text"
                value={finPeriod}
                onChange={(e) => setFinPeriod(e.target.value)}
                placeholder="2026-12"
                className="rounded-xl border border-[#dce5df] bg-white px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={finLabel}
                onChange={(e) => setFinLabel(e.target.value)}
                placeholder="Desember 2026"
                className="rounded-xl border border-[#dce5df] bg-white px-3 py-2 text-xs"
              />
            </div>
            <label className="inline-flex items-center gap-2 rounded-full bg-[#1b4532] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#133325] transition cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>{importing ? 'Mengimpor...' : 'Upload File CSV / Excel (.xlsx)'}</span>
              <input
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setImporting(true);
                  setImportMsg('');
                  setImportErr('');
                  try {
                    const res = await api.importFinance(file, finType, finPeriod, finLabel);
                    setImportMsg(res.message);
                  } catch (err) {
                    setImportErr(err instanceof Error ? err.message : 'Gagal impor laporan');
                  } finally {
                    setImporting(false);
                    e.target.value = '';
                  }
                }}
              />
            </label>
          </div>

          {/* Import Directory */}
          <div className="rounded-2xl bg-[#f7f9f7] border border-[#edf1ee] p-5 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-sm text-[#17251f]">Import Data Warga (Direktori)</h3>
                <div className="flex gap-2 text-xs">
                  <a
                    href={api.getTemplateUrl('directory', 'csv')}
                    download
                    className="text-[#176b4b] font-semibold underline"
                  >
                    Template CSV
                  </a>
                  <a
                    href={api.getTemplateUrl('directory', 'xlsx')}
                    download
                    className="text-[#1b4532] font-semibold underline"
                  >
                    Template Excel
                  </a>
                </div>
              </div>
              <p className="text-xs text-[#506457] mt-1.5">
                Unggah daftar blok, kode rumah, status hunian, dan kepala keluarga dalam format CSV atau Excel (.xlsx).
              </p>
            </div>
            <div>
              <label className="inline-flex items-center gap-2 rounded-full bg-[#ee4129] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#d8351e] transition cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>{importing ? 'Mengimpor...' : 'Upload Data Warga CSV / Excel'}</span>
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setImporting(true);
                    setImportMsg('');
                    setImportErr('');
                    try {
                      const res = await api.importDirectory(file);
                      setImportMsg(res.message);
                    } catch (err) {
                      setImportErr(err instanceof Error ? err.message : 'Gagal impor data warga');
                    } finally {
                      setImporting(false);
                      e.target.value = '';
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* Facility Bookings */}
      <section className="rounded-3xl bg-white border border-[#dce5df] p-6 shadow-xs">
        <div className="flex items-center gap-2 font-bold text-[#17251f] mb-4">
          <Calendar className="w-5 h-5 text-[#176b4b]" />
          Pemesanan Fasilitas ({bookings.length})
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {bookings.map((b) => (
            <div key={b.id} className="rounded-2xl bg-[#f7f9f7] border border-[#edf1ee] p-4 text-sm flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-[#17251f]">{b.facility_name}</div>
                <div className="text-xs text-[#506457]">
                  {b.resident_name} ({b.house_code}) · {b.date} {b.time_slot}
                </div>
              </div>
              <select
                value={b.status}
                onChange={async (e) => {
                  await api.updateBooking(b.id, e.target.value);
                  loadAll();
                }}
                className="rounded-full border border-[#dce5df] bg-white px-3 py-1 text-xs font-bold"
              >
                <option value="Menunggu">Menunggu</option>
                <option value="Disetujui">Disetujui</option>
                <option value="Ditolak">Ditolak</option>
              </select>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
