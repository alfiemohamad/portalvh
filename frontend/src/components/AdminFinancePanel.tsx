import { useEffect, useState } from 'react';
import {
  Check,
  Eye,
  FileSpreadsheet,
  Plus,
  Receipt,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import { api, formatRupiah } from '../api/client';
import type { FinanceReport, KasPaymentSubmission } from '../types';

type FundType = 'IPL' | 'KAS_WARGA' | 'KAS_MESJID';

export function AdminFinancePanel() {
  const [reports, setReports] = useState<FinanceReport[]>([]);
  const [kasPayments, setKasPayments] = useState<KasPaymentSubmission[]>([]);
  const [previewProof, setPreviewProof] = useState<KasPaymentSubmission | null>(null);
  const [fundType, setFundType] = useState<FundType>('KAS_WARGA');
  const [selectedId, setSelectedId] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Create new period state
  const [showNewPeriod, setShowNewPeriod] = useState(false);
  const [newPeriod, setNewPeriod] = useState({
    period: new Date().toISOString().slice(0, 7),
    month_label: '',
    opening_balance: 0,
    paid_houses: 0,
    total_houses: 30,
    notes: '',
  });

  // Add single transaction state
  const [txForm, setTxForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: '',
    category: 'KAS Warga',
    kind: 'Masuk' as 'Masuk' | 'Keluar',
    amount: '',
  });

  // Import Excel/CSV state
  const [importPeriod, setImportPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [importLabel, setImportLabel] = useState('');

  const loadReports = async (preferredId?: string) => {
    try {
      const all = await api.getFinance('ALL');
      setReports(all);
      const matching = all.filter((r) =>
        fundType === 'KAS_WARGA' ? r.type === 'KAS_WARGA' || r.type === 'KAS' : r.type === fundType
      );
      if (preferredId && matching.some((r) => r.id === preferredId)) {
        setSelectedId(preferredId);
      } else if (matching.length > 0 && !matching.some((r) => r.id === selectedId)) {
        setSelectedId(matching[0].id);
      } else if (matching.length === 0) {
        setSelectedId('');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal memuat laporan keuangan');
    }
  };

  const loadKasPayments = () => {
    api
      .getKasPayments()
      .then(setKasPayments)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Gagal memuat konfirmasi pembayaran kas'));
  };

  useEffect(() => {
    loadReports();
    loadKasPayments();
  }, [fundType]);

  const handleReviewKas = async (id: string, status: 'Disetujui' | 'Ditolak') => {
    setBusy(true);
    setMsg('');
    setErr('');
    try {
      const updated = await api.reviewKasPayment(id, status);
      setMsg(
        status === 'Disetujui'
          ? `Pembayaran ${updated.house_code} (${formatRupiah(updated.amount)}) disetujui & otomatis masuk ke rincian KAS.`
          : `Pembayaran ${updated.house_code} ditolak.`
      );
      loadKasPayments();
      await loadReports();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal memproses verifikasi pembayaran');
    } finally {
      setBusy(false);
    }
  };

  const filtered = reports.filter((r) =>
    fundType === 'KAS_WARGA' ? r.type === 'KAS_WARGA' || r.type === 'KAS' : r.type === fundType
  );
  const current = filtered.find((r) => r.id === selectedId) ?? filtered[0];

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    setErr('');
    try {
      const created = await api.createFinanceReport({
        type: fundType,
        period: newPeriod.period,
        month_label: newPeriod.month_label || newPeriod.period,
        opening_balance: Number(newPeriod.opening_balance) || 0,
        paid_houses: fundType === 'IPL' ? Number(newPeriod.paid_houses) || 0 : 0,
        total_houses: fundType === 'IPL' ? Number(newPeriod.total_houses) || 0 : 0,
        notes: newPeriod.notes,
      });
      setMsg(`Periode ${created.month_label} (${created.type}) berhasil dibuat.`);
      setShowNewPeriod(false);
      await loadReports(created.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal membuat periode baru');
    } finally {
      setBusy(false);
    }
  };

  const handleAddTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;
    const amount = Number(txForm.amount);
    if (!amount || amount <= 0) {
      setErr('Nominal transaksi harus lebih dari 0');
      return;
    }
    setBusy(true);
    setMsg('');
    setErr('');
    try {
      await api.addFinanceItem(current.id, {
        date: txForm.date,
        description: txForm.description,
        category: txForm.category,
        kind: txForm.kind,
        amount,
      });
      setTxForm({ ...txForm, description: '', amount: '' });
      setMsg('Transaksi cashflow berhasil ditambahkan & saldo otomatis diperbarui.');
      await loadReports(current.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menambah transaksi');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteTx = async (itemId: string) => {
    if (!current || !confirm('Hapus transaksi ini dari laporan?')) return;
    setBusy(true);
    setErr('');
    try {
      await api.deleteFinanceItem(current.id, itemId);
      setMsg('Transaksi berhasil dihapus.');
      await loadReports(current.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menghapus transaksi');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteReport = async () => {
    if (!current || !confirm(`Hapus seluruh laporan ${current.type} ${current.month_label}?`)) return;
    setBusy(true);
    setErr('');
    try {
      await api.deleteFinanceReport(current.id);
      setMsg(`Laporan ${current.month_label} dihapus.`);
      await loadReports();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menghapus laporan');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {msg && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-[#1b4532]">
          {msg}
        </div>
      )}
      {err && (
        <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* Main Finance Manager Card */}
      <section className="rounded-3xl bg-white border border-[#dce5df] p-6 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-bold text-[#17251f]">
            <Wallet className="w-5 h-5 text-[#176b4b]" />
            Posting & Kelola Cashflow Keuangan (IPL / KAS)
          </div>
          <button
            type="button"
            onClick={() => setShowNewPeriod((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#1b4532] px-4 py-2 text-xs font-bold text-white hover:bg-[#133325] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {showNewPeriod ? 'Tutup Form Periode' : 'Buat Periode Bulan Baru'}
          </button>
        </div>

        {/* Fund Type Tabs & Period Dropdown */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { key: 'KAS_WARGA', label: 'KAS Warga' },
                { key: 'KAS_MESJID', label: 'KAS Mesjid' },
                { key: 'IPL', label: 'IPL Bulanan' },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  setFundType(f.key);
                  setTxForm((prev) => ({
                    ...prev,
                    category:
                      f.key === 'IPL'
                        ? 'Iuran IPL'
                        : f.key === 'KAS_MESJID'
                        ? 'Infaq Mesjid'
                        : 'KAS Warga',
                  }));
                }}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition cursor-pointer ${
                  fundType === f.key
                    ? 'bg-[#1b4532] text-white'
                    : 'bg-[#f4f7f5] text-[#42564a] hover:bg-[#e8f0eb]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {filtered.length > 0 && (
              <select
                value={current?.id || ''}
                onChange={(e) => setSelectedId(e.target.value)}
                className="rounded-full border border-[#dce5df] bg-[#f7f9f7] px-4 py-1.5 text-xs font-bold text-[#17251f]"
              >
                {filtered.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.month_label} ({r.period})
                  </option>
                ))}
              </select>
            )}
            {current && (
              <button
                type="button"
                onClick={handleDeleteReport}
                className="rounded-full p-2 text-red-600 hover:bg-red-50 cursor-pointer"
                title="Hapus periode laporan ini"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Form Create New Period */}
        {showNewPeriod && (
          <form
            onSubmit={handleCreatePeriod}
            className="rounded-2xl bg-[#f4f7f5] border border-[#dce5df] p-4 space-y-3"
          >
            <div className="text-xs font-bold text-[#1b4532]">
              Buat Periode Baru untuk {fundType.replace('_', ' ')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                placeholder="Periode (YYYY-MM, mis. 2026-12)"
                value={newPeriod.period}
                onChange={(e) => setNewPeriod({ ...newPeriod, period: e.target.value })}
                className="rounded-xl border border-[#dce5df] bg-white px-3.5 py-2 text-xs"
              />
              <input
                type="text"
                required
                placeholder="Label Bulan (mis. Desember 2026)"
                value={newPeriod.month_label}
                onChange={(e) => setNewPeriod({ ...newPeriod, month_label: e.target.value })}
                className="rounded-xl border border-[#dce5df] bg-white px-3.5 py-2 text-xs"
              />
              <input
                type="number"
                placeholder="Saldo Awal (0 = otomatis dari bulan lalu)"
                value={newPeriod.opening_balance}
                onChange={(e) =>
                  setNewPeriod({ ...newPeriod, opening_balance: Number(e.target.value) })
                }
                className="rounded-xl border border-[#dce5df] bg-white px-3.5 py-2 text-xs"
              />
            </div>
            {fundType === 'IPL' && (
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  placeholder="Jumlah Rumah Lunas"
                  value={newPeriod.paid_houses}
                  onChange={(e) =>
                    setNewPeriod({ ...newPeriod, paid_houses: Number(e.target.value) })
                  }
                  className="rounded-xl border border-[#dce5df] bg-white px-3.5 py-2 text-xs"
                />
                <input
                  type="number"
                  placeholder="Total Rumah Aktif"
                  value={newPeriod.total_houses}
                  onChange={(e) =>
                    setNewPeriod({ ...newPeriod, total_houses: Number(e.target.value) })
                  }
                  className="rounded-xl border border-[#dce5df] bg-white px-3.5 py-2 text-xs"
                />
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Catatan singkat pengurus (opsional)"
                value={newPeriod.notes}
                onChange={(e) => setNewPeriod({ ...newPeriod, notes: e.target.value })}
                className="flex-1 rounded-xl border border-[#dce5df] bg-white px-3.5 py-2 text-xs"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-[#ee4129] px-5 py-2 text-xs font-bold text-white hover:bg-[#d8351e] cursor-pointer"
              >
                Simpan Periode
              </button>
            </div>
          </form>
        )}

        {/* Active Period Summary + Quick Transaction Form */}
        {current && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-2xl bg-[#f7f9f7] border border-[#edf1ee] p-3.5">
                <div className="text-[11px] text-[#506457]">Saldo Awal</div>
                <div className="text-base font-bold text-[#42564a]">
                  {formatRupiah(current.opening_balance || 0)}
                </div>
              </div>
              <div className="rounded-2xl bg-[#eef7f1] border border-[#cde3d4] p-3.5">
                <div className="flex items-center gap-1 text-[11px] text-[#176b4b] font-semibold">
                  <TrendingUp className="w-3 h-3" /> Pemasukan
                </div>
                <div className="text-base font-bold text-[#176b4b]">
                  + {formatRupiah(current.total_income)}
                </div>
              </div>
              <div className="rounded-2xl bg-red-50/70 border border-red-100 p-3.5">
                <div className="flex items-center gap-1 text-[11px] text-[#ee4129] font-semibold">
                  <TrendingDown className="w-3 h-3" /> Pengeluaran
                </div>
                <div className="text-base font-bold text-[#ee4129]">
                  - {formatRupiah(current.total_spend)}
                </div>
              </div>
              <div className="rounded-2xl bg-[#1b4532] text-white p-3.5">
                <div className="text-[11px] text-white/80">Saldo Akhir</div>
                <div className="text-base font-black">{formatRupiah(current.balance)}</div>
              </div>
            </div>

            {/* Inline Quick Add Transaction */}
            <form
              onSubmit={handleAddTx}
              className="rounded-2xl bg-[#f7f9f7] border border-[#edf1ee] p-4 space-y-3"
            >
              <div className="text-xs font-bold text-[#17251f]">
                + Tambah Transaksi Cashflow ({current.month_label})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
                <input
                  type="date"
                  required
                  value={txForm.date}
                  onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
                  className="rounded-xl border border-[#dce5df] bg-white px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  required
                  placeholder="Keterangan transaksi..."
                  value={txForm.description}
                  onChange={(e) => setTxForm({ ...txForm, description: e.target.value })}
                  className="lg:col-span-2 rounded-xl border border-[#dce5df] bg-white px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  required
                  placeholder="Kategori (Keamanan/Sosial/dll)"
                  value={txForm.category}
                  onChange={(e) => setTxForm({ ...txForm, category: e.target.value })}
                  className="rounded-xl border border-[#dce5df] bg-white px-3 py-2 text-xs"
                />
                <select
                  value={txForm.kind}
                  onChange={(e) =>
                    setTxForm({ ...txForm, kind: e.target.value as 'Masuk' | 'Keluar' })
                  }
                  className="rounded-xl border border-[#dce5df] bg-white px-3 py-2 text-xs font-semibold"
                >
                  <option value="Masuk">Masuk (+)</option>
                  <option value="Keluar">Keluar (-)</option>
                </select>
                <input
                  type="number"
                  required
                  min={1}
                  placeholder="Nominal (Rp)"
                  value={txForm.amount}
                  onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                  className="rounded-xl border border-[#dce5df] bg-white px-3 py-2 text-xs"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#1b4532] px-5 py-2 text-xs font-bold text-white hover:bg-[#133325] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Transaksi
                </button>
              </div>
            </form>

            {/* Transaction List */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[#edf1ee] text-xs text-[#506457]">
                    <th className="py-2 pr-3">Tanggal</th>
                    <th className="py-2 pr-3">Keterangan</th>
                    <th className="py-2 pr-3">Kategori</th>
                    <th className="py-2 pr-3 text-right">Nominal</th>
                    <th className="py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1ee]">
                  {current.items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2.5 pr-3 text-xs text-[#5c6b63] whitespace-nowrap">
                        {it.date}
                      </td>
                      <td className="py-2.5 pr-3 font-medium text-[#17251f]">{it.description}</td>
                      <td className="py-2.5 pr-3 text-xs text-[#506457]">{it.category}</td>
                      <td
                        className={`py-2.5 pr-3 text-right font-bold whitespace-nowrap ${
                          it.kind === 'Masuk' ? 'text-[#176b4b]' : 'text-[#ee4129]'
                        }`}
                      >
                        {it.kind === 'Masuk' ? '+' : '-'} {formatRupiah(it.amount)}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteTx(it.id)}
                          className="rounded-full p-1.5 text-red-600 hover:bg-red-50 cursor-pointer"
                          title="Hapus transaksi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Bulk Import Excel / CSV */}
      <section className="rounded-3xl bg-white border border-[#dce5df] p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold text-[#17251f] text-sm">
            <FileSpreadsheet className="w-5 h-5 text-[#176b4b]" />
            Atau Impor Massal dari CSV / Excel (.xlsx)
          </div>
          <div className="flex gap-3 text-xs">
            <button
              type="button"
              onClick={() => api.downloadTemplate('finance', 'csv')}
              className="text-[#176b4b] font-semibold underline cursor-pointer"
            >
              Unduh Template CSV
            </button>
            <button
              type="button"
              onClick={() => api.downloadTemplate('finance', 'xlsx')}
              className="text-[#1b4532] font-semibold underline cursor-pointer"
            >
              Unduh Template Excel
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={importPeriod}
            onChange={(e) => setImportPeriod(e.target.value)}
            placeholder="Periode (mis. 2026-12)"
            className="rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3.5 py-2 text-xs"
          />
          <input
            type="text"
            value={importLabel}
            onChange={(e) => setImportLabel(e.target.value)}
            placeholder="Label Bulan (mis. Desember 2026)"
            className="rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3.5 py-2 text-xs"
          />
          <label className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ee4129] px-5 py-2 text-xs font-bold text-white hover:bg-[#d8351e] transition cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>{busy ? 'Mengimpor...' : `Upload Excel/CSV (${fundType.replace('_', ' ')})`}</span>
            <input
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBusy(true);
                setMsg('');
                setErr('');
                try {
                  const res = await api.importFinance(
                    file,
                    fundType,
                    importPeriod,
                    importLabel || importPeriod
                  );
                  setMsg(res.message);
                  await loadReports(res.report.id);
                } catch (ex) {
                  setErr(ex instanceof Error ? ex.message : 'Gagal impor laporan');
                } finally {
                  setBusy(false);
                  e.target.value = '';
                }
              }}
            />
          </label>
        </div>
      </section>

      {/* Verifikasi Bukti Pembayaran KAS dari Warga */}
      <section className="rounded-3xl bg-white border border-[#dce5df] p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold text-[#17251f] text-sm">
            <Receipt className="w-5 h-5 text-[#176b4b]" />
            Verifikasi Bukti Pembayaran KAS Warga ({kasPayments.filter((p) => p.status === 'Menunggu Verifikasi').length} Menunggu)
          </div>
        </div>

        {kasPayments.length === 0 ? (
          <p className="text-xs sm:text-sm text-[#506457]">
            Belum ada bukti pembayaran KAS yang diunggah warga.
          </p>
        ) : (
          <div className="space-y-3">
            {kasPayments.map((kp) => (
              <div
                key={kp.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-[#f7f9f7] border border-[#edf1ee] p-4 text-xs sm:text-sm"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#eef4ef] px-2.5 py-0.5 text-[11px] font-bold text-[#1b4532]">
                      {kp.fund_type === 'KAS_MESJID' ? 'KAS Mesjid' : 'KAS Warga'}
                    </span>
                    <span className="font-bold text-[#17251f]">
                      {kp.payer_name} ({kp.house_code})
                    </span>
                    <span className="text-xs text-[#5c6b63]">· {kp.payment_date}</span>
                  </div>
                  <div className="text-base font-black text-[#176b4b]">
                    {formatRupiah(kp.amount)}
                  </div>
                  {kp.note && <div className="text-xs text-[#506457]">Catatan: {kp.note}</div>}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewProof(kp)}
                    className="inline-flex items-center gap-1 rounded-full border border-[#dce5df] bg-white px-3.5 py-1.5 text-xs font-bold text-[#17251f] hover:bg-[#eef4ef] cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" /> Lihat Bukti
                  </button>

                  {kp.status === 'Menunggu Verifikasi' ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleReviewKas(kp.id, 'Disetujui')}
                        className="inline-flex items-center gap-1 rounded-full bg-[#1b4532] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#133325] disabled:opacity-60 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleReviewKas(kp.id, 'Ditolak')}
                        className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3.5 py-1.5 text-xs font-bold text-[#ee4129] hover:bg-red-200 disabled:opacity-60 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" /> Tolak
                      </button>
                    </>
                  ) : (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        kp.status === 'Disetujui'
                          ? 'bg-[#dff0e4] text-[#176b4b]'
                          : 'bg-red-100 text-[#ee4129]'
                      }`}
                    >
                      {kp.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal Preview Bukti Pembayaran */}
      {previewProof && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setPreviewProof(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl border border-[#dce5df] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-[#17251f]">
                  Bukti Transfer — {previewProof.payer_name} ({previewProof.house_code})
                </h4>
                <p className="text-xs text-[#506457]">
                  {formatRupiah(previewProof.amount)} · {previewProof.payment_date}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewProof(null)}
                className="rounded-full p-1.5 hover:bg-[#f4f7f5] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden bg-[#f7f9f7] border border-[#edf1ee] max-h-[65vh] flex items-center justify-center">
              <img
                src={previewProof.proof_url}
                alt="Bukti pembayaran kas"
                className="max-h-[60vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
