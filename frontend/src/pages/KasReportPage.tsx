import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  Receipt,
  TrendingDown,
  TrendingUp,
  Upload,
  Wallet,
} from 'lucide-react';
import { api, formatRupiah } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { EnvSettings, FinanceReport, KasPaymentSubmission } from '../types';
import { PageHeader } from '../components/PageHeader';
import { QrisCanvas } from '../components/QrisCanvas';

type KasTab = 'KAS_WARGA' | 'KAS_MESJID';

export function KasReportPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<FinanceReport[]>([]);
  const [submissions, setSubmissions] = useState<KasPaymentSubmission[]>([]);
  const [settings, setSettings] = useState<EnvSettings | null>(null);
  const [fundTab, setFundTab] = useState<KasTab>('KAS_WARGA');
  const [selectedId, setSelectedId] = useState<string>('');
  const [kindFilter, setKindFilter] = useState<'ALL' | 'Masuk' | 'Keluar'>('ALL');
  const [copiedKey, setCopiedKey] = useState('');
  const [downloading, setDownloading] = useState(false);

  // Form upload bukti pembayaran KAS
  const [payForm, setPayForm] = useState({
    fund_type: 'KAS_WARGA' as KasTab,
    payer_name: user?.name || '',
    house_code: user?.house_code && user.house_code !== 'Admin' ? user.house_code : '',
    payment_date: new Date().toISOString().slice(0, 10),
    amount: '',
    note: '',
    proof_url: '',
  });
  const [proofName, setProofName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [payMsg, setPayMsg] = useState('');
  const [payErr, setPayErr] = useState('');

  const loadSubmissions = () => {
    api.getKasPayments().then(setSubmissions).catch(console.error);
  };

  useEffect(() => {
    api.getFinance('KAS').then(setReports).catch(console.error);
    api.getSettings().then(setSettings).catch(console.error);
    loadSubmissions();
  }, []);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (fundTab === 'KAS_WARGA') return r.type === 'KAS_WARGA' || r.type === 'KAS';
      return r.type === 'KAS_MESJID';
    });
  }, [reports, fundTab]);

  useEffect(() => {
    if (filteredReports.length > 0 && !filteredReports.some((r) => r.id === selectedId)) {
      setSelectedId(filteredReports[0].id);
    } else if (filteredReports.length === 0) {
      setSelectedId('');
    }
  }, [filteredReports, selectedId]);

  const current = filteredReports.find((r) => r.id === selectedId) ?? filteredReports[0];

  const visibleItems = useMemo(() => {
    if (!current) return [];
    if (kindFilter === 'ALL') return current.items;
    return current.items.filter((it) => it.kind === kindFilter);
  }, [current, kindFilter]);

  const bankName = settings?.bank_name || 'BNI';
  const accountNo = settings?.account_number || '7790080086';
  const accountHolder = settings?.account_holder || 'Perkumpulan Forum Warga Victoria Hill';

  const copyAccount = (key: string) => {
    navigator.clipboard?.writeText(accountNo);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 1800);
  };

  const handleDownload = async (format: 'csv' | 'xlsx') => {
    if (!current) return;
    setDownloading(true);
    try {
      await api.downloadFinance(current.id, format);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal mengunduh laporan');
    } finally {
      setDownloading(false);
    }
  };

  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setPayErr('');
    try {
      const res = await api.uploadFile(file);
      setPayForm((prev) => ({ ...prev, proof_url: res.url }));
      setProofName(res.filename);
    } catch (err) {
      setPayErr(err instanceof Error ? err.message : 'Gagal mengunggah bukti pembayaran');
    } finally {
      setUploading(false);
    }
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayMsg('');
    setPayErr('');
    if (!payForm.proof_url) {
      setPayErr('Silakan unggah foto/screenshot bukti transfer terlebih dahulu.');
      return;
    }
    const amt = Number(payForm.amount);
    if (!amt || amt <= 0) {
      setPayErr('Nominal pembayaran harus lebih dari 0.');
      return;
    }
    setSubmitting(true);
    try {
      await api.createKasPayment({
        fund_type: payForm.fund_type,
        period: payForm.payment_date.slice(0, 7),
        payer_name: payForm.payer_name,
        house_code: payForm.house_code,
        amount: amt,
        payment_date: payForm.payment_date,
        note: payForm.note,
        proof_url: payForm.proof_url,
      });
      setPayMsg(
        'Konfirmasi pembayaran berhasil dikirim! Setelah disetujui pengurus, nominal otomatis masuk ke rincian KAS.'
      );
      setPayForm((prev) => ({
        ...prev,
        amount: '',
        note: '',
        proof_url: '',
      }));
      setProofName('');
      loadSubmissions();
    } catch (err) {
      setPayErr(err instanceof Error ? err.message : 'Gagal mengirim konfirmasi pembayaran');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan KAS & Cashflow"
        subtitle="Transparansi mutasi KAS Warga & KAS Mesjid Victoria Hill setiap bulan"
      />

      {/* Fund Switcher & Period Selector */}
      <div className="rounded-3xl bg-white border border-[#dce5df] p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { key: 'KAS_WARGA', label: 'KAS Warga' },
                { key: 'KAS_MESJID', label: 'KAS Mesjid Algulfrah' },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setFundTab(t.key);
                  setKindFilter('ALL');
                }}
                className={`rounded-full px-5 py-2 text-sm font-bold transition cursor-pointer ${
                  fundTab === t.key
                    ? 'bg-[#1b4532] text-white shadow-xs'
                    : 'bg-[#f4f7f5] text-[#42564a] hover:bg-[#e8f0eb]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {filteredReports.length > 0 && (
              <select
                value={current?.id || ''}
                onChange={(e) => setSelectedId(e.target.value)}
                aria-label="Pilih periode bulan"
                className="rounded-full border border-[#dce5df] bg-[#f4f7f5] px-4 py-2 text-xs sm:text-sm font-semibold text-[#17251f]"
              >
                {filteredReports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.month_label}
                  </option>
                ))}
              </select>
            )}
            {current && (
              <>
                <button
                  type="button"
                  disabled={downloading}
                  onClick={() => handleDownload('csv')}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#ee4129] px-4 py-2 text-xs font-bold text-white hover:bg-[#d8351e] disabled:opacity-60 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV
                </button>
                <button
                  type="button"
                  disabled={downloading}
                  onClick={() => handleDownload('xlsx')}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#1b4532] px-4 py-2 text-xs font-bold text-white hover:bg-[#133325] disabled:opacity-60 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Excel (.xlsx)
                </button>
              </>
            )}
          </div>
        </div>

        {!current ? (
          <div className="rounded-2xl bg-[#f7f9f7] border border-[#edf1ee] p-8 text-center text-sm text-[#506457]">
            Belum ada laporan {fundTab === 'KAS_WARGA' ? 'KAS Warga' : 'KAS Mesjid'} yang dipublikasikan.
          </div>
        ) : (
          <div className="space-y-5">
            {/* 4 Cashflow Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="rounded-2xl bg-[#f7f9f7] border border-[#edf1ee] p-4">
                <div className="text-xs text-[#506457]">Saldo Awal</div>
                <div className="mt-1 text-lg sm:text-xl font-bold text-[#42564a]">
                  {formatRupiah(current.opening_balance || 0)}
                </div>
              </div>
              <div className="rounded-2xl bg-[#eef7f1] border border-[#cde3d4] p-4">
                <div className="flex items-center gap-1.5 text-xs text-[#176b4b] font-semibold">
                  <TrendingUp className="w-3.5 h-3.5" /> Pemasukan
                </div>
                <div className="mt-1 text-lg sm:text-xl font-bold text-[#176b4b]">
                  + {formatRupiah(current.total_income)}
                </div>
              </div>
              <div className="rounded-2xl bg-red-50/70 border border-red-100 p-4">
                <div className="flex items-center gap-1.5 text-xs text-[#ee4129] font-semibold">
                  <TrendingDown className="w-3.5 h-3.5" /> Pengeluaran
                </div>
                <div className="mt-1 text-lg sm:text-xl font-bold text-[#ee4129]">
                  - {formatRupiah(current.total_spend)}
                </div>
              </div>
              <div className="rounded-2xl bg-[#1b4532] text-white p-4">
                <div className="flex items-center gap-1.5 text-xs text-white/80 font-semibold">
                  <Wallet className="w-3.5 h-3.5" /> Saldo Akhir ({current.month_label})
                </div>
                <div className="mt-1 text-lg sm:text-xl font-black">
                  {formatRupiah(current.balance)}
                </div>
              </div>
            </div>

            {current.notes && (
              <div className="rounded-2xl bg-[#f4f7f5] border border-[#dce5df] px-4 py-3 text-xs sm:text-sm text-[#42564a]">
                <span className="font-bold text-[#1b4532]">Catatan Pengurus:</span> {current.notes}
              </div>
            )}

            {/* Cashflow Breakdown Table */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-bold text-[#17251f]">
                  Rincian Cashflow — {current.month_label}
                </h3>
                <div className="flex gap-1.5">
                  {(['ALL', 'Masuk', 'Keluar'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKindFilter(k)}
                      className={`rounded-full px-3 py-1 text-xs font-bold transition cursor-pointer ${
                        kindFilter === k
                          ? 'bg-[#1b4532] text-white'
                          : 'bg-[#f4f7f5] text-[#506457] hover:bg-[#e8f0eb]'
                      }`}
                    >
                      {k === 'ALL' ? `Semua (${current.items.length})` : k}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#edf1ee] text-xs text-[#506457]">
                      <th className="py-2.5 pr-4">Tanggal</th>
                      <th className="py-2.5 pr-4">Keterangan</th>
                      <th className="py-2.5 pr-4">Kategori</th>
                      <th className="py-2.5 text-right">Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf1ee]">
                    {visibleItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-xs text-[#506457]">
                          Belum ada transaksi pada filter ini.
                        </td>
                      </tr>
                    ) : (
                      visibleItems.map((item, idx) => (
                        <tr key={item.id || idx}>
                          <td className="py-3 pr-4 text-xs text-[#5c6b63] whitespace-nowrap">
                            {item.date}
                          </td>
                          <td className="py-3 pr-4 font-medium text-[#17251f]">{item.description}</td>
                          <td className="py-3 pr-4">
                            <span className="rounded-full bg-[#eef4ef] px-2.5 py-0.5 text-xs text-[#1b4532]">
                              {item.category}
                            </span>
                          </td>
                          <td
                            className={`py-3 text-right font-bold whitespace-nowrap ${
                              item.kind === 'Masuk' ? 'text-[#176b4b]' : 'text-[#ee4129]'
                            }`}
                          >
                            {item.kind === 'Masuk' ? '+' : '-'} {formatRupiah(item.amount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info & QRIS Payment Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          {
            key: 'warga',
            title: 'Transfer / QRIS KAS Warga',
            desc: 'Mendukung kerja bakti, HUT RI, dan dana sosial kemasyarakatan.',
            seed: 42,
            filename: 'QRIS_KAS_Warga_VictoriaHill.png',
          },
          {
            key: 'mesjid',
            title: 'Transfer / QRIS KAS Mesjid',
            desc: 'Mendukung operasional, pengajian rutin, dan perawatan Mesjid Algulfrah.',
            seed: 99,
            filename: 'QRIS_KAS_Mesjid_VictoriaHill.png',
          },
        ].map((card) => (
          <div
            key={card.key}
            className="rounded-3xl bg-white border border-[#dce5df] p-6 shadow-xs flex flex-col justify-between gap-5"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-[#17251f]">{card.title}</h3>
                <button
                  type="button"
                  onClick={() => copyAccount(card.key)}
                  className="inline-flex items-center gap-1 rounded-full bg-[#eef4ef] px-3 py-1 text-xs font-semibold text-[#176b4b] hover:bg-[#d8e8dd] transition cursor-pointer"
                >
                  {copiedKey === card.key ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedKey === card.key ? 'Tersalin' : `Salin ${bankName}`}
                </button>
              </div>
              <p className="text-xs text-[#506457] mt-1">{card.desc}</p>
              <div className="mt-3 space-y-0.5 text-sm text-[#506457]">
                <p className="font-semibold text-[#17251f]">
                  {bankName} {accountNo}
                </p>
                <p>a/n {accountHolder}</p>
                <p className="text-xs">Format berita: KAS [Blok & No Rumah]</p>
              </div>
            </div>

            <QrisCanvas
              title={card.title}
              accountInfo={`${bankName} ${accountNo}`}
              seed={card.seed}
              filename={card.filename}
            />
          </div>
        ))}
      </div>

      {/* Form Upload Bukti Pembayaran KAS + Riwayat */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <section className="lg:col-span-3 rounded-3xl bg-white border border-[#dce5df] p-6 sm:p-7 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#176b4b]" />
            <h3 className="text-lg font-bold text-[#17251f]">
              Konfirmasi & Upload Bukti Pembayaran KAS
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-[#506457]">
            Sudah transfer atau scan QRIS? Unggah bukti pembayaran Anda di sini. Setelah disetujui pengurus, pembayaran otomatis tercatat di rincian KAS bulanan.
          </p>

          {payMsg && (
            <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs sm:text-sm text-[#1b4532]">
              <CheckCircle2 className="w-4 h-4 text-[#176b4b] shrink-0" />
              <span>{payMsg}</span>
            </div>
          )}
          {payErr && (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-3.5 text-xs sm:text-sm text-red-700">
              {payErr}
            </div>
          )}

          <form onSubmit={handlePaySubmit} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#42564a] mb-1">
                  Jenis KAS
                </label>
                <select
                  value={payForm.fund_type}
                  onChange={(e) =>
                    setPayForm({ ...payForm, fund_type: e.target.value as KasTab })
                  }
                  className="w-full rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3.5 py-2.5 text-sm font-semibold"
                >
                  <option value="KAS_WARGA">KAS Warga</option>
                  <option value="KAS_MESJID">KAS Mesjid Algulfrah</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#42564a] mb-1">
                  Tanggal Pembayaran
                </label>
                <input
                  type="date"
                  required
                  value={payForm.payment_date}
                  onChange={(e) => setPayForm({ ...payForm, payment_date: e.target.value })}
                  className="w-full rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3.5 py-2.5 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#42564a] mb-1">
                  Nama Pembayar
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nama lengkap"
                  value={payForm.payer_name}
                  onChange={(e) => setPayForm({ ...payForm, payer_name: e.target.value })}
                  className="w-full rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#42564a] mb-1">
                  Blok / No. Rumah
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: U16"
                  value={payForm.house_code}
                  onChange={(e) => setPayForm({ ...payForm, house_code: e.target.value })}
                  className="w-full rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3.5 py-2.5 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#42564a] mb-1">
                  Nominal Transfer (Rp)
                </label>
                <input
                  type="number"
                  required
                  min={1000}
                  placeholder="Contoh: 100000"
                  value={payForm.amount}
                  onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                  className="w-full rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#42564a] mb-1">
                  Keterangan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Mis. Kas rutin / Infaq"
                  value={payForm.note}
                  onChange={(e) => setPayForm({ ...payForm, note: e.target.value })}
                  className="w-full rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3.5 py-2.5 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#42564a] mb-1">
                Bukti Transfer (JPG / PNG / WEBP)
              </label>
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#dce5df] bg-[#f7f9f7] p-2.5">
                <label className="inline-flex items-center gap-2 rounded-full bg-[#1b4532] px-4 py-2 text-xs font-bold text-white hover:bg-[#133325] transition cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? 'Mengunggah...' : 'Upload Bukti Bayar'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProofUpload}
                    className="hidden"
                  />
                </label>
                <span className="text-xs text-[#506457] truncate max-w-xs">
                  {proofName || 'Belum ada file dipilih'}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || uploading}
              className="w-full rounded-full bg-[#ee4129] py-3 text-sm font-bold text-white shadow-sm hover:bg-[#d8351e] disabled:opacity-60 transition cursor-pointer"
            >
              {submitting ? 'Mengirim Konfirmasi...' : 'Kirim Konfirmasi Pembayaran KAS'}
            </button>
          </form>
        </section>

        <section className="lg:col-span-2 rounded-3xl bg-white border border-[#dce5df] p-6 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-[#17251f]">
            Riwayat Konfirmasi Pembayaran ({submissions.length})
          </h3>
          {submissions.length === 0 ? (
            <p className="text-xs sm:text-sm text-[#506457]">
              Belum ada konfirmasi pembayaran KAS yang dikirim.
            </p>
          ) : (
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {submissions.map((s) => (
                <div
                  key={s.id}
                  className="rounded-2xl bg-[#f7f9f7] border border-[#edf1ee] p-3.5 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#1b4532]">
                      {s.fund_type === 'KAS_MESJID' ? 'KAS Mesjid' : 'KAS Warga'} · {s.payment_date}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        s.status === 'Disetujui'
                          ? 'bg-[#dff0e4] text-[#176b4b]'
                          : s.status === 'Ditolak'
                          ? 'bg-red-100 text-[#ee4129]'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                  <div className="font-bold text-sm text-[#17251f]">{formatRupiah(s.amount)}</div>
                  <div className="text-[#506457]">
                    {s.payer_name} ({s.house_code}){s.note ? ` · ${s.note}` : ''}
                  </div>
                  {s.admin_note && (
                    <div className="rounded-xl bg-white border border-[#dce5df] px-2.5 py-1.5 text-[11px] text-[#1b4532]">
                      Catatan pengurus: {s.admin_note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
