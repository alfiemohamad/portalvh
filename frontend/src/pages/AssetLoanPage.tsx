import { useEffect, useState } from 'react';
import { Box, CheckCircle2, X } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { AssetLoan, BorrowableAsset } from '../types';
import { PageHeader } from '../components/PageHeader';

export function AssetLoanPage() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<BorrowableAsset[]>([]);
  const [loans, setLoans] = useState<AssetLoan[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<BorrowableAsset | null>(null);
  const [form, setForm] = useState({
    borrower_name: user?.name || '',
    house_code: user?.house_code && user.house_code !== 'Admin' ? user.house_code : '',
    phone: '',
    quantity: 1,
    borrow_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    return_date: new Date(Date.now() + 172800000).toISOString().split('T')[0],
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');

  const load = () => {
    api
      .getAssets()
      .then((res) => {
        setAssets(res.assets);
        setLoans(res.loans);
      })
      .catch(console.error);
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    setSubmitting(true);
    try {
      await api.createAssetLoan({ asset_id: selectedAsset.id, ...form });
      setSuccess(`Pengajuan peminjaman ${selectedAsset.name} berhasil dikirim!`);
      load();
      setTimeout(() => {
        setSelectedAsset(null);
        setSuccess('');
      }, 1400);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal mengajukan peminjaman');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Pinjam Barang"
        subtitle="Daftar inventaris paguyuban Victoria Hill dan status peminjaman"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {assets.map((asset) => (
          <div
            key={asset.id}
            className="flex flex-col justify-between rounded-3xl bg-white border border-[#dce5df] p-5 shadow-xs"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e8f0eb] text-[#176b4b]">
                  <Box className="w-5 h-5" />
                </div>
                <span className="rounded-full bg-[#dff0e4] px-3 py-1 text-xs font-bold text-[#176b4b]">
                  Tersedia {asset.available}/{asset.total_qty}
                </span>
              </div>
              <h3 className="mt-4 text-base font-bold text-[#17251f]">{asset.name}</h3>
              <p className="mt-1 text-xs text-[#506457] leading-relaxed">{asset.description}</p>
            </div>

            <button
              type="button"
              disabled={asset.available === 0}
              onClick={() => setSelectedAsset(asset)}
              className="mt-5 w-full rounded-full border border-[#ee4129] bg-white py-2.5 text-sm font-bold text-[#ee4129] hover:bg-[#ee4129] hover:text-white disabled:opacity-40 transition cursor-pointer"
            >
              {asset.available > 0 ? 'Ajukan Pinjam' : 'Sedang Dipinjam Semua'}
            </button>
          </div>
        ))}
      </div>

      {/* Loan History */}
      <div className="rounded-3xl bg-white border border-[#dce5df] p-6 shadow-xs">
        <h2 className="text-lg font-bold text-[#17251f] mb-4">Status Peminjaman Terbaru</h2>
        <div className="space-y-3">
          {loans.length === 0 ? (
            <p className="text-sm text-[#506457]">Belum ada riwayat peminjaman.</p>
          ) : (
            loans.map((l) => (
              <div
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f7f9f7] border border-[#edf1ee] p-4 text-sm"
              >
                <div>
                  <div className="font-bold text-[#17251f]">
                    {l.asset_name} ({l.quantity} unit)
                  </div>
                  <div className="text-xs text-[#506457] mt-0.5">
                    Peminjam: {l.borrower_name} ({l.house_code}) · {l.borrow_date} s/d {l.return_date}
                  </div>
                </div>
                <span className="rounded-full bg-[#dff0e4] px-3 py-1 text-xs font-bold text-[#176b4b]">
                  {l.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Loan Modal */}
      {selectedAsset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => setSelectedAsset(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-[#dce5df]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#17251f]">Pinjam {selectedAsset.name}</h3>
              <button
                type="button"
                onClick={() => setSelectedAsset(null)}
                className="rounded-full p-1.5 text-[#506457] hover:bg-[#f4f7f5] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {success ? (
              <div className="py-6 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-[#176b4b] mx-auto" />
                <p className="text-sm font-bold text-[#17251f]">{success}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <input
                  type="text"
                  required
                  placeholder="Nama Peminjam"
                  value={form.borrower_name}
                  onChange={(e) => setForm({ ...form, borrower_name: e.target.value })}
                  className="w-full rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3.5 py-2.5 text-sm outline-none focus:border-[#1b4532] focus:bg-white"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Blok / No (mis. U16)"
                    value={form.house_code}
                    onChange={(e) => setForm({ ...form, house_code: e.target.value })}
                    className="w-full rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3.5 py-2.5 text-sm outline-none focus:border-[#1b4532] focus:bg-white"
                  />
                  <input
                    type="number"
                    min={1}
                    max={selectedAsset.available}
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                    className="w-full rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3.5 py-2.5 text-sm outline-none focus:border-[#1b4532] focus:bg-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#506457] mb-1">Tanggal Pinjam</label>
                    <input
                      type="date"
                      required
                      value={form.borrow_date}
                      onChange={(e) => setForm({ ...form, borrow_date: e.target.value })}
                      className="w-full rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#506457] mb-1">Tanggal Kembali</label>
                    <input
                      type="date"
                      required
                      value={form.return_date}
                      onChange={(e) => setForm({ ...form, return_date: e.target.value })}
                      className="w-full rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full bg-[#ee4129] py-3 text-sm font-bold text-white hover:bg-[#d8351e] transition cursor-pointer"
                >
                  {submitting ? 'Mengirim...' : 'Ajukan Peminjaman'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
