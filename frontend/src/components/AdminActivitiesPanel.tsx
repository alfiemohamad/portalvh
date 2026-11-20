import { useEffect, useState } from 'react';
import { CalendarDays, Image as ImageIcon, Plus, Trash2, Upload } from 'lucide-react';
import { api, formatRupiah } from '../api/client';
import type { ActivityReport } from '../types';

export function AdminActivitiesPanel() {
  const [activities, setActivities] = useState<ActivityReport[]>([]);
  const [form, setForm] = useState({
    title: '',
    category: 'Sosial',
    activity_date: new Date().toISOString().slice(0, 10),
    location: '',
    summary: '',
    budget_used: '',
    image_url: '',
  });
  const [photoName, setPhotoName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => {
    api
      .getActivities()
      .then(setActivities)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Gagal memuat laporan kegiatan'));
  };

  useEffect(() => {
    load();
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErr('');
    try {
      const res = await api.uploadFile(file);
      setForm((prev) => ({ ...prev, image_url: res.url }));
      setPhotoName(res.filename);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Gagal mengunggah foto dokumentasi');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    setErr('');
    try {
      await api.createActivity({
        title: form.title,
        category: form.category,
        activity_date: form.activity_date,
        location: form.location,
        summary: form.summary,
        budget_used: Number(form.budget_used) || 0,
        image_url: form.image_url || undefined,
      });
      setForm({
        title: '',
        category: 'Sosial',
        activity_date: new Date().toISOString().slice(0, 10),
        location: '',
        summary: '',
        budget_used: '',
        image_url: '',
      });
      setPhotoName('');
      setMsg('Laporan kegiatan warga berhasil dipublikasikan!');
      load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Gagal memposting laporan kegiatan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus laporan kegiatan ini?')) return;
    try {
      await api.deleteActivity(id);
      setMsg('Laporan kegiatan dihapus.');
      load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Gagal menghapus kegiatan');
    }
  };

  return (
    <section className="rounded-3xl bg-white border border-[#dce5df] p-6 shadow-xs space-y-5">
      <div className="flex items-center gap-2 font-bold text-[#17251f]">
        <CalendarDays className="w-5 h-5 text-[#176b4b]" />
        Posting & Kelola Laporan Kegiatan Warga ({activities.length})
      </div>

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

      <form onSubmit={handleSubmit} className="rounded-2xl bg-[#f7f9f7] border border-[#edf1ee] p-5 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            required
            placeholder="Judul kegiatan (mis. Kerja Bakti Blok U)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="md:col-span-2 rounded-xl border border-[#dce5df] bg-white px-4 py-2.5 text-sm"
          />
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="rounded-xl border border-[#dce5df] bg-white px-4 py-2.5 text-sm"
          >
            <option value="Sosial">Sosial</option>
            <option value="Kerja Bakti">Kerja Bakti</option>
            <option value="Keagamaan">Keagamaan</option>
            <option value="Olahraga">Olahraga</option>
            <option value="Kesehatan">Kesehatan</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="date"
            required
            value={form.activity_date}
            onChange={(e) => setForm({ ...form, activity_date: e.target.value })}
            className="rounded-xl border border-[#dce5df] bg-white px-4 py-2.5 text-sm"
          />
          <input
            type="text"
            placeholder="Lokasi kegiatan (mis. Cabanna / Mesjid)"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="rounded-xl border border-[#dce5df] bg-white px-4 py-2.5 text-sm"
          />
          <input
            type="number"
            min={0}
            placeholder="Realisasi anggaran Rp (opsional)"
            value={form.budget_used}
            onChange={(e) => setForm({ ...form, budget_used: e.target.value })}
            className="rounded-xl border border-[#dce5df] bg-white px-4 py-2.5 text-sm"
          />
        </div>

        <textarea
          rows={3}
          required
          placeholder="Ringkasan hasil kegiatan, jumlah partisipan, dan catatan pertanggungjawaban..."
          value={form.summary}
          onChange={(e) => setForm({ ...form, summary: e.target.value })}
          className="w-full rounded-xl border border-[#dce5df] bg-white px-4 py-2.5 text-sm"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 rounded-full bg-white border border-[#dce5df] px-4 py-2 text-xs font-bold text-[#1b4532] hover:bg-[#eef4ef] cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>{uploading ? 'Mengunggah...' : 'Upload Foto Dokumentasi'}</span>
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </label>
            <span className="text-xs text-[#506457]">
              {photoName ? `Terunggah: ${photoName}` : 'Opsional (JPG/PNG/WEBP)'}
            </span>
          </div>

          <button
            type="submit"
            disabled={saving || uploading}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#1b4532] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#133325] disabled:opacity-60 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {saving ? 'Menyimpan...' : 'Publikasikan Kegiatan'}
          </button>
        </div>
      </form>

      <div className="divide-y divide-[#edf1ee]">
        {activities.map((act) => (
          <div key={act.id} className="py-3.5 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-14 w-20 shrink-0 rounded-xl overflow-hidden bg-[#eef4ef] flex items-center justify-center">
                {act.image_url ? (
                  <img src={act.image_url} alt={act.title} className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-[#176b4b]" />
                )}
              </div>
              <div>
                <div className="text-sm font-bold text-[#17251f]">{act.title}</div>
                <div className="text-xs text-[#176b4b] font-medium">
                  {act.category} · {act.activity_date} {act.location ? `· ${act.location}` : ''}
                </div>
                <p className="text-xs text-[#506457] mt-0.5 line-clamp-2">{act.summary}</p>
                {act.budget_used > 0 && (
                  <div className="text-[11px] font-bold text-[#1b4532] mt-1">
                    Anggaran: {formatRupiah(act.budget_used)}
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(act.id)}
              className="rounded-full p-2 text-red-600 hover:bg-red-50 cursor-pointer shrink-0"
              title="Hapus laporan kegiatan"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
