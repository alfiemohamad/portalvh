import { useState } from 'react';
import { AlertTriangle, PhoneCall, ShieldAlert, X, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client';

interface PanicModalProps {
  open: boolean;
  onClose: () => void;
}

export function PanicModal({ open, onClose }: PanicModalProps) {
  const [reporterName, setReporterName] = useState('');
  const [houseCode, setHouseCode] = useState('');
  const [category, setCategory] = useState('Keamanan');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.triggerPanic({
        reporter_name: reporterName || 'Warga Victoria Hill',
        house_code: houseCode || 'Tidak disebutkan',
        category,
        note,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim sinyal darurat');
    } finally {
      setSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setSent(false);
    setReporterName('');
    setHouseCode('');
    setNote('');
    setError('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="panic-modal-title"
    >
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden border border-red-100">
        <div className="flex items-center justify-between bg-[#ee4129] px-6 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6" />
            <h2 id="panic-modal-title" className="text-lg font-bold">
              Panic Button — Darurat
            </h2>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            className="rounded-full p-1 hover:bg-white/20 transition cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {sent ? (
            <div className="text-center space-y-4 py-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-[#176b4b]">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-[#17251f]">Sinyal Darurat Terkirim!</h3>
              <p className="text-sm text-[#506457]">
                Laporan darurat Anda telah dicatat di dashboard Pengurus & Pos Security Gerbang Utama. Petugas akan segera menghubungi atau menuju lokasi Anda.
              </p>
              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <a
                  href="https://wa.me/6281190002424?text=DARURAT%20Victoria%20Hill%20mohon%20bantuan%20segera!"
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#1b4532] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#133325]"
                >
                  <PhoneCall className="w-4 h-4" />
                  WhatsApp Security
                </a>
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="flex-1 rounded-full border border-[#dce5df] px-4 py-2.5 text-sm font-semibold text-[#17251f] hover:bg-[#f4f7f5] cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-start gap-3 rounded-2xl bg-[#fff7ed] border border-[#e8c6aa] p-3.5 text-xs text-[#873e13]">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Gunakan fitur ini untuk keadaan mendesak (keamanan, medis, kebakaran). Sinyal akan langsung masuk ke Pos Security & Pengurus.
                </span>
              </div>

              {error && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#42564a] mb-1.5">
                  Jenis Darurat
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['Keamanan', 'Medis', 'Kebakaran', 'Lainnya'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition cursor-pointer ${
                        category === cat
                          ? 'border-[#ee4129] bg-[#ee4129]/10 text-[#ee4129]'
                          : 'border-[#dce5df] bg-[#f7f9f7] text-[#42564a] hover:bg-[#eef4ef]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#42564a] mb-1">
                    Nama Warga
                  </label>
                  <input
                    type="text"
                    required
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                    placeholder="Nama Anda"
                    className="w-full rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3.5 py-2.5 text-sm outline-none focus:border-[#1b4532] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#42564a] mb-1">
                    Blok / No Rumah
                  </label>
                  <input
                    type="text"
                    required
                    value={houseCode}
                    onChange={(e) => setHouseCode(e.target.value)}
                    placeholder="Contoh: U16"
                    className="w-full rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3.5 py-2.5 text-sm outline-none focus:border-[#1b4532] focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#42564a] mb-1">
                  Keterangan Singkat (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Jelaskan situasi darurat secara singkat..."
                  className="w-full rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3.5 py-2 text-sm outline-none focus:border-[#1b4532] focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-[#ee4129] px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-[#d8351e] disabled:opacity-60 transition cursor-pointer"
              >
                {submitting ? 'Mengirim Sinyal Darurat...' : 'KIRIM SINYAL DARURAT SEKARANG'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
