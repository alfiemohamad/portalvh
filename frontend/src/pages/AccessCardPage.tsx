import { useEffect, useState } from 'react';
import { CheckCircle2, CreditCard, Upload } from 'lucide-react';
import { api, formatRupiah } from '../api/client';
import type { AccessCardRequest } from '../types';
import { PageHeader } from '../components/PageHeader';

export function AccessCardPage() {
  const [requests, setRequests] = useState<AccessCardRequest[]>([]);
  const [fullName, setFullName] = useState('');
  const [block, setBlock] = useState('');
  const [houseNo, setHouseNo] = useState('');
  const [stnkPhotoUrl, setStnkPhotoUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadRequests = () => {
    api.getAccessCards().then(setRequests).catch(console.error);
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErrorMsg('');
    try {
      const res = await api.uploadFile(file);
      setStnkPhotoUrl(res.url);
      setFileName(res.filename);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengunggah gambar STNK');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const created = await api.createAccessCard({
        full_name: fullName,
        block,
        house_no: houseNo,
        stnk_photo_url: stnkPhotoUrl,
      });
      setSuccessMsg(`Pengajuan kartu akses berhasil dikirim (${created.request_no}).`);
      setFullName('');
      setBlock('');
      setHouseNo('');
      setStnkPhotoUrl('');
      setFileName('');
      loadRequests();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengirim pengajuan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Pengajuan kartu akses"
        subtitle="Tambah kartu akses gerbang utama Victoria Hill"
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form — matches Frame 5 */}
        <div className="lg:col-span-3 rounded-3xl bg-white border border-[#dce5df] p-6 sm:p-8 shadow-xs">
          <h2 className="text-xl font-bold text-[#17251f]">Tambah kartu akses</h2>
          <p className="mt-1.5 text-sm text-[#506457]">
            Tambah kartu dikenakan biaya sebesar{' '}
            <span className="font-bold text-[#17251f]">Rp 50.000</span>
          </p>

          {successMsg && (
            <div className="mt-5 flex items-center gap-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-[#1b4532]">
              <CheckCircle2 className="w-5 h-5 text-[#176b4b] shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="mt-5 rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#42564a] mb-1.5">
                Nama lengkap
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nama lengkap"
                className="w-full rounded-full border border-[#dce5df] bg-[#f4f7f5] px-5 py-3 text-sm outline-none focus:border-[#1b4532] focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#42564a] mb-1.5">
                  Blok Rumah
                </label>
                <input
                  type="text"
                  required
                  value={block}
                  onChange={(e) => setBlock(e.target.value)}
                  placeholder="Blok X"
                  className="w-full rounded-full border border-[#dce5df] bg-[#f4f7f5] px-5 py-3 text-sm outline-none focus:border-[#1b4532] focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#42564a] mb-1.5">
                  Nomor Rumah
                </label>
                <input
                  type="text"
                  required
                  value={houseNo}
                  onChange={(e) => setHouseNo(e.target.value)}
                  placeholder="Nomor 00"
                  className="w-full rounded-full border border-[#dce5df] bg-[#f4f7f5] px-5 py-3 text-sm outline-none focus:border-[#1b4532] focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#42564a] mb-1.5">Foto STNK</label>
              <div className="flex flex-wrap items-center gap-3 rounded-full border border-[#dce5df] bg-[#f4f7f5] p-2">
                <label className="inline-flex items-center gap-2 rounded-full bg-[#1b4532] px-5 py-2 text-sm font-semibold text-white hover:bg-[#133325] transition cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>{uploading ? 'Mengunggah...' : 'Upload Gambar'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUpload}
                    className="hidden"
                  />
                </label>
                <span className="text-xs text-[#506457] truncate max-w-xs">
                  {fileName || 'Unggah foto STNK kendaraan (JPG/PNG)'}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || uploading}
              className="w-full rounded-full bg-[#ee4129] py-3.5 text-sm font-bold text-white shadow-sm hover:bg-[#d8351e] disabled:opacity-60 transition cursor-pointer"
            >
              {submitting ? 'Mengirim Pengajuan...' : 'Submit'}
            </button>
          </form>
        </div>

        {/* Status Riwayat Pengajuan */}
        <div className="lg:col-span-2 rounded-3xl bg-white border border-[#dce5df] p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-[#176b4b]" />
            <h3 className="text-base font-bold text-[#17251f]">Status Pengajuan Terbaru</h3>
          </div>
          <div className="space-y-3">
            {requests.length === 0 ? (
              <p className="text-sm text-[#506457]">Belum ada pengajuan kartu akses.</p>
            ) : (
              requests.map((req) => (
                <div
                  key={req.id}
                  className="rounded-2xl bg-[#f7f9f7] border border-[#edf1ee] p-4 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#17251f]">{req.request_no}</span>
                    <span className="rounded-full bg-[#dff0e4] px-2.5 py-0.5 text-[11px] font-bold text-[#176b4b]">
                      {req.status}
                    </span>
                  </div>
                  <div className="mt-1 font-medium text-[#17251f]">{req.full_name}</div>
                  <div className="text-xs text-[#506457] mt-0.5">
                    {req.block} No. {req.house_no} · Biaya {formatRupiah(req.fee)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
