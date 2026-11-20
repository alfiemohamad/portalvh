import { useEffect, useState } from 'react';
import { Copy, Check, Download, Landmark } from 'lucide-react';
import { api, formatRupiah } from '../api/client';
import type { FinanceReport } from '../types';
import { PageHeader } from '../components/PageHeader';

export function IplReportPage() {
  const [reports, setReports] = useState<FinanceReport[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .getFinance('IPL')
      .then((res) => {
        setReports(res);
        if (res.length > 0) setSelectedId(res[0].id);
      })
      .catch(console.error);
  }, []);

  const current = reports.find((r) => r.id === selectedId) ?? reports[0];

  const copyVA = () => {
    navigator.clipboard?.writeText('7790080086');
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan IPL"
        subtitle="Transparansi iuran pengelolaan lingkungan Victoria Hill"
      />

      {/* Heading & Main Download Card — matches Frame 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <h2 className="text-xl sm:text-2xl font-bold text-[#17251f] leading-snug">
            Pembayaran IPL dapat dilakukan melalui transfer bank, Virtual Account
          </h2>

          {/* Download Laporan IPL Card */}
          <div className="rounded-3xl bg-white border border-[#dce5df] p-6 sm:p-7 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-[#17251f]">Download laporan IPL</h3>
              {reports.length > 1 && (
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="rounded-full border border-[#dce5df] bg-[#f4f7f5] px-4 py-1.5 text-xs font-semibold text-[#17251f]"
                >
                  {reports.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.month_label}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <p className="mt-2 text-sm text-[#506457] leading-relaxed">
              Cek laporan IPL setiap bulannya untuk mengetahui untuk apa saja IPL warga digunakan.
            </p>
            {current && (
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href={api.getFinanceDownloadUrl(current.id, 'csv')}
                  download
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ee4129] px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#d8351e] transition"
                >
                  <Download className="w-4 h-4" />
                  Download CSV ({current.month_label})
                </a>
                <a
                  href={api.getFinanceDownloadUrl(current.id, 'xlsx')}
                  download
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1b4532] px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#133325] transition"
                >
                  <Download className="w-4 h-4" />
                  Download Excel (.xlsx)
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Payment Info Card */}
        <div className="rounded-3xl bg-[#eef4ef] border border-[#dce5df] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#176b4b] font-bold text-sm">
              <Landmark className="w-4 h-4" />
              Rekening Pembayaran IPL
            </div>
            <div className="mt-3 text-lg font-black text-[#17251f]">BNI 7790080086</div>
            <p className="text-xs text-[#506457] mt-1">
              a/n Perkumpulan Forum Warga Victoria Hill
            </p>
            <p className="text-xs text-[#506457] mt-2">
              Berita transfer: <span className="font-semibold text-[#17251f]">IPL [Blok & No Rumah]</span>
            </p>
          </div>
          <button
            type="button"
            onClick={copyVA}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-white border border-[#dce5df] px-4 py-2.5 text-xs font-bold text-[#1b4532] hover:bg-[#1b4532] hover:text-white transition cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Nomor Rekening Disalin!' : 'Salin Nomor Rekening'}
          </button>
        </div>
      </div>

      {/* Monthly Summary & Breakdown Table */}
      {current && (
        <div className="rounded-3xl bg-white border border-[#dce5df] p-6 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-[#17251f]">
              Ringkasan IPL — {current.month_label}
            </h3>
            {current.paid_houses !== undefined && current.total_houses !== undefined && (
              <span className="rounded-full bg-[#dff0e4] px-3 py-1 text-xs font-bold text-[#176b4b]">
                {current.paid_houses} / {current.total_houses} rumah lunas
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-[#f7f9f7] border border-[#edf1ee] p-4">
              <div className="text-xs text-[#506457]">Total Pemasukan</div>
              <div className="mt-1 text-xl font-bold text-[#176b4b]">
                {formatRupiah(current.total_income)}
              </div>
            </div>
            <div className="rounded-2xl bg-[#f7f9f7] border border-[#edf1ee] p-4">
              <div className="text-xs text-[#506457]">Total Pengeluaran</div>
              <div className="mt-1 text-xl font-bold text-[#ee4129]">
                {formatRupiah(current.total_spend)}
              </div>
            </div>
            <div className="rounded-2xl bg-[#f7f9f7] border border-[#edf1ee] p-4">
              <div className="text-xs text-[#506457]">Surplus / Saldo Periode</div>
              <div className="mt-1 text-xl font-bold text-[#1b4532]">
                {formatRupiah(current.balance)}
              </div>
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
                {current.items.map((item, idx) => (
                  <tr key={idx}>
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
