import { useEffect, useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { api, formatRupiah } from '../api/client';
import type { FinanceReport } from '../types';
import { PageHeader } from '../components/PageHeader';
import { QrisCanvas } from '../components/QrisCanvas';

export function KasReportPage() {
  const [reports, setReports] = useState<FinanceReport[]>([]);
  const [copiedKey, setCopiedKey] = useState('');

  useEffect(() => {
    api.getFinance('KAS').then(setReports).catch(console.error);
  }, []);

  const current = reports[0];

  const copyAccount = (key: string) => {
    navigator.clipboard?.writeText('7790080086');
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 1800);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan KAS"
        subtitle="Kas warga & kas mesjid untuk kegiatan bersama Victoria Hill"
      />

      {/* Intro — matches Frame 4 */}
      <div className="rounded-3xl bg-white border border-[#dce5df] p-6 shadow-xs">
        <h2 className="text-xl font-bold text-[#17251f]">
          Kas warga mendukung kegiatan bersama warga
        </h2>
        <ul className="mt-3 list-disc list-inside space-y-1 text-sm text-[#506457]">
          <li>Kegiatan keagamaan/kerohanian</li>
          <li>Perayaan HUT RI</li>
          <li>Kegiatan sosial dan kemasyarakatan lainnya.</li>
        </ul>
      </div>

      {/* KAS Warga & KAS Mesjid side-by-side on Web — matches Frame 4 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          {
            key: 'warga',
            title: 'KAS warga',
            seed: 42,
            filename: 'QRIS_KAS_Warga_VictoriaHill.png',
          },
          {
            key: 'mesjid',
            title: 'KAS mesjid',
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
                  {copiedKey === card.key ? 'Tersalin' : 'Salin BNI'}
                </button>
              </div>
              <div className="mt-2.5 space-y-0.5 text-sm text-[#506457]">
                <p className="font-semibold text-[#17251f]">BNI 7790080086</p>
                <p>a/n Perkumpulan forum warga victoria hill</p>
                <p className="text-xs">Format : Nama Blok rumah nomor rumah</p>
              </div>
            </div>

            <QrisCanvas
              title={card.title}
              accountInfo="BNI 7790080086"
              seed={card.seed}
              filename={card.filename}
            />
          </div>
        ))}
      </div>

      {/* Download Laporan KAS Card — matches Frame 4 bottom */}
      <div className="rounded-3xl bg-white border border-[#dce5df] p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-[#17251f]">Download laporan KAS</h3>
            <p className="mt-1 text-sm text-[#506457]">
              Cek laporan KAS setiap bulannya untuk mengetahui untuk apa saja KAS warga digunakan.
            </p>
          </div>
          {current && (
            <div className="flex flex-wrap gap-2.5 shrink-0">
              <a
                href={api.getFinanceDownloadUrl(current.id, 'csv')}
                download
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ee4129] px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#d8351e] transition"
              >
                <Download className="w-4 h-4" />
                Download CSV
              </a>
              <a
                href={api.getFinanceDownloadUrl(current.id, 'xlsx')}
                download
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1b4532] px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#133325] transition"
              >
                <Download className="w-4 h-4" />
                Download Excel
              </a>
            </div>
          )}
        </div>

        {current && (
          <div className="mt-6 pt-5 border-t border-[#edf1ee] space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl bg-[#f7f9f7] p-4">
                <div className="text-xs text-[#506457]">Pemasukan ({current.month_label})</div>
                <div className="mt-1 text-lg font-bold text-[#176b4b]">
                  {formatRupiah(current.total_income)}
                </div>
              </div>
              <div className="rounded-2xl bg-[#f7f9f7] p-4">
                <div className="text-xs text-[#506457]">Pengeluaran</div>
                <div className="mt-1 text-lg font-bold text-[#ee4129]">
                  {formatRupiah(current.total_spend)}
                </div>
              </div>
              <div className="rounded-2xl bg-[#f7f9f7] p-4">
                <div className="text-xs text-[#506457]">Total Saldo KAS</div>
                <div className="mt-1 text-lg font-bold text-[#1b4532]">
                  {formatRupiah(current.balance)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
