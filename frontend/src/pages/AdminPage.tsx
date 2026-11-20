import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  Box,
  Calendar,
  CheckCircle2,
  CreditCard,
  Download,
  FileSpreadsheet,
  LayoutDashboard,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  Wrench,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type {
  AccessCardRequest,
  Announcement,
  AssetLoan,
  AuditLog,
  FacilityBooking,
  PanicAlert,
  Ticket,
} from '../types';
import { PageHeader } from '../components/PageHeader';

type AdminTab =
  | 'overview'
  | 'announcements'
  | 'tickets'
  | 'cards'
  | 'bookings'
  | 'loans'
  | 'import'
  | 'audit';

export function AdminPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<AdminTab>('overview');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [cards, setCards] = useState<AccessCardRequest[]>([]);
  const [bookings, setBookings] = useState<FacilityBooking[]>([]);
  const [loans, setLoans] = useState<AssetLoan[]>([]);
  const [panics, setPanics] = useState<PanicAlert[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditQuery, setAuditQuery] = useState('');
  const [auditAction, setAuditAction] = useState('ALL');

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
    api.getAssets().then((r) => setLoans(r.loans)).catch(console.error);
    api.getPanics().then(setPanics).catch(console.error);
    api.getAuditLogs(auditQuery, auditAction).then(setAuditLogs).catch(console.error);
  };

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    loadAll();
  }, [isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin && tab === 'audit') {
      api.getAuditLogs(auditQuery, auditAction).then(setAuditLogs).catch(console.error);
    }
  }, [isAdmin, tab, auditQuery, auditAction]);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createAnnouncement({ ...newAnn, pinned: false });
    setNewAnn({ title: '', content: '', category: 'Umum' });
    loadAll();
  };

  const activePanics = panics.filter((p) => p.status === 'Aktif').length;
  const openTickets = tickets.filter((t) => t.status !== 'Selesai').length;
  const pendingCards = cards.filter((c) => c.status === 'Menunggu Verifikasi').length;
  const pendingBookings = bookings.filter((b) => b.status === 'Menunggu').length;

  const menuItems: { key: AdminTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: 'overview', label: 'Ringkasan & Panic', icon: LayoutDashboard, badge: activePanics },
    { key: 'announcements', label: 'Pengumuman', icon: Bell, badge: announcements.length },
    { key: 'tickets', label: 'Tiket Laporan', icon: Wrench, badge: openTickets },
    { key: 'cards', label: 'Kartu Akses', icon: CreditCard, badge: pendingCards },
    { key: 'bookings', label: 'Booking Fasilitas', icon: Calendar, badge: pendingBookings },
    { key: 'loans', label: 'Pinjam Barang', icon: Box, badge: loans.length },
    { key: 'import', label: 'Import CSV / Excel', icon: FileSpreadsheet },
    { key: 'audit', label: 'Audit Trail', icon: Activity, badge: auditLogs.length },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Pengurus"
        subtitle="Pusat kendali layanan warga, persetujuan, import data, dan audit trail Victoria Hill"
      />

      {/* Admin Menu Navigation */}
      <div className="flex flex-wrap gap-2">
        {menuItems.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setTab(m.key)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs sm:text-sm font-bold transition cursor-pointer ${
              tab === m.key
                ? 'bg-[#1b4532] text-white shadow-sm'
                : 'bg-white border border-[#dce5df] text-[#42564a] hover:bg-[#eef4ef]'
            }`}
          >
            <m.icon className="w-4 h-4" />
            <span>{m.label}</span>
            {m.badge !== undefined && m.badge > 0 && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  tab === m.key ? 'bg-white/20 text-white' : 'bg-[#eef4ef] text-[#176b4b]'
                }`}
              >
                {m.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB: OVERVIEW & PANIC */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-red-50 border border-red-200 p-5">
              <div className="text-xs font-semibold text-red-700">Panic Alert Aktif</div>
              <div className="mt-2 text-3xl font-black text-[#ee4129]">{activePanics}</div>
            </div>
            <div className="rounded-2xl bg-[#dff0e4] border border-[#cde3d4] p-5">
              <div className="text-xs font-semibold text-[#1b4532]">Tiket Belum Selesai</div>
              <div className="mt-2 text-3xl font-black text-[#176b4b]">{openTickets}</div>
            </div>
            <div className="rounded-2xl bg-[#dff0e4] border border-[#cde3d4] p-5">
              <div className="text-xs font-semibold text-[#1b4532]">Pengajuan Kartu Akses</div>
              <div className="mt-2 text-3xl font-black text-[#1b4532]">{cards.length}</div>
            </div>
            <div className="rounded-2xl bg-white border border-[#dce5df] p-5">
              <div className="text-xs font-semibold text-[#506457]">Catatan Audit Trail</div>
              <div className="mt-2 text-3xl font-black text-[#17251f]">{auditLogs.length}</div>
            </div>
          </div>

          <section className="rounded-3xl bg-white border border-[#dce5df] p-6 shadow-xs">
            <div className="flex items-center gap-2 text-[#ee4129] font-bold mb-4">
              <ShieldAlert className="w-5 h-5" />
              Sinyal Panic Button Terbaru
            </div>
            {panics.length === 0 ? (
              <p className="text-sm text-[#506457]">Belum ada sinyal darurat dari warga. Situasi lingkungan aman.</p>
            ) : (
              <div className="space-y-2.5">
                {panics.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f7f9f7] p-4 border border-[#edf1ee] text-sm"
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
            )}
          </section>
        </div>
      )}

      {/* TAB: ANNOUNCEMENTS */}
      {tab === 'announcements' && (
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
      )}

      {/* TAB: TICKETS */}
      {tab === 'tickets' && (
        <section className="rounded-3xl bg-white border border-[#dce5df] p-6 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-[#17251f] mb-4">
            <Wrench className="w-5 h-5 text-[#176b4b]" />
            Tiket Laporan Masalah ({tickets.length})
          </div>
          <div className="space-y-3">
            {tickets.map((t) => (
              <div key={t.id} className="rounded-2xl bg-[#f7f9f7] border border-[#edf1ee] p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">
                    {t.ticket_no} · {t.category} ({t.location})
                  </span>
                  <select
                    value={t.status}
                    onChange={async (e) => {
                      await api.updateTicket(
                        t.id,
                        e.target.value,
                        t.admin_note || 'Sedang ditindaklanjuti pengurus.'
                      );
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
                <p className="text-[11px] text-[#5c6b63] mt-1">
                  Pelapor: {t.reporter_name} {t.house_code ? `(${t.house_code})` : ''}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TAB: ACCESS CARDS */}
      {tab === 'cards' && (
        <section className="rounded-3xl bg-white border border-[#dce5df] p-6 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-[#17251f] mb-4">
            <CreditCard className="w-5 h-5 text-[#176b4b]" />
            Pengajuan Kartu Akses ({cards.length})
          </div>
          <div className="space-y-3">
            {cards.map((c) => (
              <div key={c.id} className="rounded-2xl bg-[#f7f9f7] border border-[#edf1ee] p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
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
      )}

      {/* TAB: BOOKINGS */}
      {tab === 'bookings' && (
        <section className="rounded-3xl bg-white border border-[#dce5df] p-6 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-[#17251f] mb-4">
            <Calendar className="w-5 h-5 text-[#176b4b]" />
            Pemesanan Fasilitas ({bookings.length})
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="rounded-2xl bg-[#f7f9f7] border border-[#edf1ee] p-4 text-sm flex items-center justify-between gap-3"
              >
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
      )}

      {/* TAB: ASSET LOANS */}
      {tab === 'loans' && (
        <section className="rounded-3xl bg-white border border-[#dce5df] p-6 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-[#17251f] mb-4">
            <Box className="w-5 h-5 text-[#176b4b]" />
            Peminjaman Barang Paguyuban ({loans.length})
          </div>
          <div className="space-y-3">
            {loans.map((l) => (
              <div
                key={l.id}
                className="rounded-2xl bg-[#f7f9f7] border border-[#edf1ee] p-4 text-sm flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <div className="font-bold text-[#17251f]">
                    {l.asset_name} ({l.quantity} unit)
                  </div>
                  <div className="text-xs text-[#506457]">
                    {l.borrower_name} ({l.house_code}) · {l.borrow_date} s/d {l.return_date}
                  </div>
                </div>
                <select
                  value={l.status}
                  onChange={async (e) => {
                    await api.updateAssetLoan(l.id, e.target.value);
                    loadAll();
                  }}
                  className="rounded-full border border-[#dce5df] bg-white px-3 py-1 text-xs font-bold"
                >
                  <option value="Menunggu">Menunggu</option>
                  <option value="Dipinjam">Dipinjam</option>
                  <option value="Dikembalikan">Dikembalikan</option>
                  <option value="Ditolak">Ditolak</option>
                </select>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TAB: IMPORT CSV & EXCEL */}
      {tab === 'import' && (
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
            <div className="rounded-2xl bg-[#f7f9f7] border border-[#edf1ee] p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-sm text-[#17251f]">
                  Import Laporan Keuangan (IPL / KAS)
                </h3>
                <div className="flex gap-2 text-xs">
                  <a href={api.getTemplateUrl('finance', 'csv')} download className="text-[#176b4b] font-semibold underline">
                    Template CSV
                  </a>
                  <a href={api.getTemplateUrl('finance', 'xlsx')} download className="text-[#1b4532] font-semibold underline">
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
                      loadAll();
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

            <div className="rounded-2xl bg-[#f7f9f7] border border-[#edf1ee] p-5 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold text-sm text-[#17251f]">Import Data Warga (Direktori)</h3>
                  <div className="flex gap-2 text-xs">
                    <a href={api.getTemplateUrl('directory', 'csv')} download className="text-[#176b4b] font-semibold underline">
                      Template CSV
                    </a>
                    <a href={api.getTemplateUrl('directory', 'xlsx')} download className="text-[#1b4532] font-semibold underline">
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
                        loadAll();
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
      )}

      {/* TAB: AUDIT TRAIL */}
      {tab === 'audit' && (
        <section className="rounded-3xl bg-white border border-[#dce5df] p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-bold text-[#17251f]">
              <Activity className="w-5 h-5 text-[#176b4b]" />
              Audit Trail Aktivitas & Unduhan Data
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={api.getAuditExportUrl('csv')}
                download
                className="inline-flex items-center gap-1.5 rounded-full border border-[#dce5df] bg-[#f7f9f7] px-4 py-2 text-xs font-bold text-[#17251f] hover:bg-[#eef4ef]"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </a>
              <a
                href={api.getAuditExportUrl('xlsx')}
                download
                className="inline-flex items-center gap-1.5 rounded-full bg-[#1b4532] px-4 py-2 text-xs font-bold text-white hover:bg-[#133325]"
              >
                <Download className="w-3.5 h-3.5" /> Export Excel
              </a>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#5c6b63] absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={auditQuery}
                onChange={(e) => setAuditQuery(e.target.value)}
                placeholder="Cari nama warga, blok rumah, atau detail aktivitas..."
                className="w-full rounded-full border border-[#dce5df] bg-[#f7f9f7] pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#1b4532] focus:bg-white"
              />
            </div>
            <select
              value={auditAction}
              onChange={(e) => setAuditAction(e.target.value)}
              className="rounded-full border border-[#dce5df] bg-[#f7f9f7] px-4 py-2.5 text-sm font-medium"
            >
              <option value="ALL">Semua Aktivitas</option>
              <option value="DOWNLOAD_IPL_CSV">Download IPL (CSV)</option>
              <option value="DOWNLOAD_IPL_XLSX">Download IPL (Excel)</option>
              <option value="DOWNLOAD_KAS_CSV">Download KAS (CSV)</option>
              <option value="DOWNLOAD_KAS_XLSX">Download KAS (Excel)</option>
              <option value="LOGIN_WARGA">Login Warga</option>
              <option value="LOGIN_PENGURUS">Login Pengurus</option>
              <option value="IMPORT_FINANCE">Import Keuangan</option>
              <option value="IMPORT_DIRECTORY">Import Data Warga</option>
              <option value="TRIGGER_PANIC">Panic Button</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[#edf1ee] text-xs text-[#506457]">
                  <th className="py-2.5 pr-4">Waktu</th>
                  <th className="py-2.5 pr-4">Aktor</th>
                  <th className="py-2.5 pr-4">Blok</th>
                  <th className="py-2.5 pr-4">Aksi</th>
                  <th className="py-2.5 pr-4">Target & Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1ee]">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-[#506457]">
                      Belum ada catatan aktivitas yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((l) => (
                    <tr key={l.id}>
                      <td className="py-3 pr-4 text-xs text-[#5c6b63] whitespace-nowrap">
                        {new Date(l.created_at).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="font-semibold text-[#17251f]">{l.actor_name}</div>
                        <div className="text-[11px] text-[#506457]">{l.actor_role}</div>
                      </td>
                      <td className="py-3 pr-4 font-bold text-[#1b4532]">{l.house_code}</td>
                      <td className="py-3 pr-4">
                        <span className="rounded-full bg-[#eef4ef] px-2.5 py-0.5 text-[11px] font-bold text-[#176b4b]">
                          {l.action}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="font-medium text-[#17251f]">{l.target}</div>
                        {l.details && <div className="text-xs text-[#506457]">{l.details}</div>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
