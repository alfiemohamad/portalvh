import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Home,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Facility, FacilityBooking } from '../types';
import { PageHeader } from '../components/PageHeader';

type TabKey = 'ringkasan' | 'pemanfaatan' | 'tiket';

export function FacilitiesPage() {
  const { user } = useAuth();
  const defaultHouseCode = user?.house_code && user.house_code !== 'Admin' ? user.house_code : '';
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabKey) || 'ringkasan';
  const [activeTab, setActiveTab] = useState<TabKey>(
    ['ringkasan', 'pemanfaatan', 'tiket'].includes(initialTab) ? initialTab : 'ringkasan'
  );

  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [bookings, setBookings] = useState<FacilityBooking[]>([]);
  const [summary, setSummary] = useState({
    total_assets: 5,
    env_assets: 15,
    facilities: 5,
    maintenance: 0,
    tickets_open: 0,
    tickets_done: 0,
  });
  const [monthlyUsage, setMonthlyUsage] = useState<{ month: string; count: number }[]>([]);

  // Booking Modal state
  const [bookingFacility, setBookingFacility] = useState<Facility | null>(null);
  const [scheduleFacility, setScheduleFacility] = useState<Facility | null>(null);
  const [bookForm, setBookForm] = useState({
    resident_name: user?.name || '',
    house_code: defaultHouseCode,
    phone: '',
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    time_slot: '08:00 - 10:00',
    purpose: '',
  });
  const [bookSubmitting, setBookSubmitting] = useState(false);
  const [bookSuccess, setBookSuccess] = useState('');

  // Ticket Form state (Frame 10)
  const [ticketForm, setTicketForm] = useState({
    category: '',
    location: '',
    reporter_name: user?.name || '',
    house_code: defaultHouseCode,
    description: '',
    photo_url: '',
  });
  const [photoName, setPhotoName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState('');
  const [ticketError, setTicketError] = useState('');

  const loadData = () => {
    api
      .getFacilities()
      .then((res) => {
        setFacilities(res.facilities);
        setBookings(res.bookings);
        setSummary(res.summary);
        setMonthlyUsage(res.monthly_usage);
      })
      .catch(console.error);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const t = searchParams.get('tab') as TabKey;
    if (t && ['ringkasan', 'pemanfaatan', 'tiket'].includes(t)) {
      setActiveTab(t);
    }
  }, [searchParams]);

  const switchTab = (tab: TabKey) => {
    setActiveTab(tab);
    setSearchParams(tab === 'ringkasan' ? {} : { tab });
  };

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingFacility) return;
    setBookSubmitting(true);
    try {
      await api.createBooking({
        facility_id: bookingFacility.id,
        ...bookForm,
      });
      setBookSuccess(`Pengajuan pemakaian ${bookingFacility.name} berhasil dikirim!`);
      loadData();
      setTimeout(() => {
        setBookingFacility(null);
        setBookSuccess('');
        setBookForm({
          resident_name: '',
          house_code: '',
          phone: '',
          date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          time_slot: '08:00 - 10:00',
          purpose: '',
        });
      }, 1500);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal membuat booking');
    } finally {
      setBookSubmitting(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.uploadFile(file);
      setTicketForm((prev) => ({ ...prev, photo_url: res.url }));
      setPhotoName(res.filename);
    } catch (err) {
      setTicketError(err instanceof Error ? err.message : 'Gagal upload gambar');
    } finally {
      setUploading(false);
    }
  };

  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTicketError('');
    setTicketSuccess('');
    setTicketSubmitting(true);
    try {
      const created = await api.createTicket(ticketForm);
      setTicketSuccess(`Laporan berhasil dikirim dengan nomor tiket ${created.ticket_no}.`);
      setTicketForm({
        category: '',
        location: '',
        reporter_name: '',
        house_code: '',
        description: '',
        photo_url: '',
      });
      setPhotoName('');
      loadData();
    } catch (err) {
      setTicketError(err instanceof Error ? err.message : 'Gagal mengirim laporan');
    } finally {
      setTicketSubmitting(false);
    }
  };

  const maxUsage = Math.max(...monthlyUsage.map((m) => m.count), 1);

  return (
    <div>
      <PageHeader
        title="Fasilitas"
        subtitle="Pantau ringkasan aset, pesan fasilitas, atau laporkan kendala fasilitas umum"
      />

      {/* Segmented Pill Tabs — matches Frames 8, 9, 10 */}
      <div className="mx-auto max-w-xl rounded-full bg-[#dce5df] p-1.5 grid grid-cols-3 gap-1 mb-8">
        {(
          [
            { key: 'ringkasan', label: 'Ringkasan' },
            { key: 'pemanfaatan', label: 'Pemanfaatan' },
            { key: 'tiket', label: 'Tiket' },
          ] as { key: TabKey; label: string }[]
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => switchTab(tab.key)}
            className={`rounded-full py-2.5 text-sm font-bold transition cursor-pointer ${
              activeTab === tab.key
                ? 'bg-[#ee4129] text-white shadow-sm'
                : 'text-[#17251f] hover:bg-white/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: RINGKASAN (Frame 8) */}
      {activeTab === 'ringkasan' && (
        <div className="space-y-6">
          {/* Dark Forest Green Total Aset Hero Card */}
          <div className="vh-asset-banner rounded-3xl p-6 sm:p-8 text-white shadow-md flex flex-col sm:flex-row items-center gap-6">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-white/10 border border-white/15">
              <Home className="w-12 h-12 text-[#82e4b0]" />
            </div>
            <div className="hidden sm:block h-20 w-px bg-white/15" />
            <div className="text-center sm:text-left">
              <div className="text-sm text-white/75 font-medium">Total aset</div>
              <div className="mt-1 text-4xl font-black tracking-tight">{summary.total_assets}</div>
              <div className="mt-2 inline-flex items-center rounded-full bg-white/15 px-3.5 py-1 text-xs font-medium text-[#d8e8dd]">
                Aset di lingkungan Anda · {summary.env_assets}
              </div>
            </div>
          </div>

          {/* Ringkasan Fasilitas 4 Cards */}
          <div>
            <h2 className="text-lg font-bold text-[#17251f] mb-4">Ringkasan Fasilitas</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Fasilitas', value: summary.facilities },
                { label: 'Pemeliharaan', value: summary.maintenance },
                { label: 'Tiket open', value: summary.tickets_open },
                { label: 'Tiket selesai', value: summary.tickets_done },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="relative rounded-2xl bg-[#dff0e4] border border-[#cde3d4] p-5"
                >
                  <div className="text-4xl font-bold text-[#8fb39c]">{stat.value}</div>
                  <div className="mt-1 text-sm font-medium text-[#17251f]">{stat.label}</div>
                  <span className="absolute bottom-4 right-4 h-3.5 w-3.5 border-r-2 border-b-2 border-[#9ec1aa] rounded-br-xs" />
                </div>
              ))}
            </div>
          </div>

          {/* Pemanfaatan per bulan */}
          <div className="rounded-3xl bg-white border border-[#dce5df] p-6 shadow-xs">
            <div className="flex items-center justify-between gap-4 mb-6">
              <h2 className="text-base sm:text-lg font-bold text-[#17251f]">
                Pemanfaatan per bulan
              </h2>
              <button
                type="button"
                onClick={() => switchTab('pemanfaatan')}
                className="inline-flex items-center gap-1 rounded-full bg-[#1b4532] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#133325] transition cursor-pointer"
              >
                Lihat detail
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-6 gap-3 sm:gap-5 items-end pt-4">
              {monthlyUsage.map((m) => (
                <div key={m.month} className="flex flex-col items-center gap-2">
                  <span className="text-xs font-bold text-[#42564a]">{m.count}</span>
                  <div className="w-full h-24 flex items-end justify-center">
                    <div
                      className="w-full max-w-[48px] rounded-full bg-[#14b885] transition-all"
                      style={{ height: `${Math.max((m.count / maxUsage) * 100, 14)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-[#5c6b63]">{m.month}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PEMANFAATAN (Frame 9) */}
      {activeTab === 'pemanfaatan' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {facilities.map((fac) => {
            const facBookings = bookings.filter((b) => b.facility_id === fac.id);
            return (
              <div
                key={fac.id}
                className="overflow-hidden rounded-3xl bg-white border border-[#dce5df] shadow-xs flex flex-col"
              >
                <div className="relative aspect-[16/10] bg-[#eef4ef] overflow-hidden">
                  <img
                    src={fac.image_url}
                    alt={fac.name}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute top-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[#1b4532] backdrop-blur-xs">
                    {fac.category}
                  </span>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="text-lg font-bold text-[#17251f]">{fac.name}</h3>
                  <p className="mt-1 text-xs text-[#506457] leading-relaxed flex-1">
                    {fac.description}
                  </p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-[#5c6b63]">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#176b4b]" /> {fac.open_hours}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-[#176b4b]" /> Maks {fac.capacity}
                    </span>
                  </div>

                  {/* Book + Calendar Row matching Frame 9 */}
                  <div className="mt-4 flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setBookingFacility(fac)}
                      className="flex-1 rounded-full border border-[#ee4129] bg-white py-2.5 px-5 text-sm font-bold text-[#ee4129] hover:bg-[#ee4129] hover:text-white transition cursor-pointer"
                    >
                      Book
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleFacility(fac)}
                      className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#dce5df] text-[#17251f] hover:bg-[#eef4ef] transition cursor-pointer"
                      title="Lihat jadwal pemakaian"
                    >
                      <Calendar className="w-5 h-5" />
                      {facBookings.length > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#176b4b] text-[10px] font-bold text-white">
                          {facBookings.length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: TIKET / LAPOR MASALAH (Frame 10) */}
      {activeTab === 'tiket' && (
        <div className="mx-auto max-w-2xl rounded-3xl bg-white border border-[#dce5df] p-6 sm:p-8 shadow-xs">
          <h2 className="text-lg font-bold text-[#17251f] mb-1">Buat Tiket Laporan Masalah</h2>
          <p className="text-sm text-[#506457] mb-6">
            Laporkan kerusakan fasilitas umum, lampu jalan, kebersihan, atau kendala lingkungan lainnya.
          </p>

          {ticketSuccess && (
            <div className="mb-5 flex items-center gap-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-[#1b4532]">
              <CheckCircle2 className="w-5 h-5 text-[#176b4b] shrink-0" />
              <span>{ticketSuccess}</span>
            </div>
          )}
          {ticketError && (
            <div className="mb-5 rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {ticketError}
            </div>
          )}

          <form onSubmit={handleTicketSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#42564a] mb-1.5">Kategori</label>
                <select
                  required
                  value={ticketForm.category}
                  onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
                  className="w-full rounded-full border border-[#dce5df] bg-[#e8efea] px-4 py-3 text-sm text-[#17251f] outline-none focus:border-[#1b4532]"
                >
                  <option value="">Pilih</option>
                  <option value="Fasilitas Umum">Fasilitas Umum</option>
                  <option value="Penerangan Jalan">Penerangan Jalan</option>
                  <option value="Kebersihan & Taman">Kebersihan & Taman</option>
                  <option value="Keamanan & Gerbang">Keamanan & Gerbang</option>
                  <option value="Saluran Air / Drainase">Saluran Air / Drainase</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#42564a] mb-1.5">Lokasi</label>
                <select
                  required
                  value={ticketForm.location}
                  onChange={(e) => setTicketForm({ ...ticketForm, location: e.target.value })}
                  className="w-full rounded-full border border-[#dce5df] bg-[#e8efea] px-4 py-3 text-sm text-[#17251f] outline-none focus:border-[#1b4532]"
                >
                  <option value="">Pilih</option>
                  <option value="Gerbang Utama">Gerbang Utama</option>
                  <option value="Kolam Renang">Kolam Renang</option>
                  <option value="Lapangan Basket VH">Lapangan Basket VH</option>
                  <option value="Mesjid Algulfrah">Mesjid Algulfrah</option>
                  <option value="Cabanna & Playground">Cabanna & Playground</option>
                  <option value="Blok U">Blok U</option>
                  <option value="Blok A">Blok A</option>
                  <option value="Blok B">Blok B</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-[#42564a] mb-1.5">
                  Nama lengkap
                </label>
                <input
                  type="text"
                  required
                  value={ticketForm.reporter_name}
                  onChange={(e) => setTicketForm({ ...ticketForm, reporter_name: e.target.value })}
                  placeholder="Nama lengkap"
                  className="w-full rounded-full border border-[#dce5df] bg-[#f4f7f5] px-5 py-3 text-sm outline-none focus:border-[#1b4532] focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#42564a] mb-1.5">
                  Blok / No Rumah
                </label>
                <input
                  type="text"
                  value={ticketForm.house_code}
                  onChange={(e) => setTicketForm({ ...ticketForm, house_code: e.target.value })}
                  placeholder="Mis. U16"
                  className="w-full rounded-full border border-[#dce5df] bg-[#f4f7f5] px-5 py-3 text-sm outline-none focus:border-[#1b4532] focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#42564a] mb-1.5">Deskripsi</label>
              <textarea
                rows={4}
                required
                value={ticketForm.description}
                onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                placeholder="Jelaskan kendala atau kerusakan yang ditemukan..."
                className="w-full rounded-3xl border border-[#dce5df] bg-[#f4f7f5] px-5 py-3.5 text-sm outline-none focus:border-[#1b4532] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#42564a] mb-1.5">Foto</label>
              <div className="flex flex-wrap items-center gap-3 rounded-full border border-[#dce5df] bg-[#f4f7f5] p-2">
                <label className="inline-flex items-center gap-2 rounded-full bg-[#1b4532] px-5 py-2 text-sm font-semibold text-white hover:bg-[#133325] transition cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>{uploading ? 'Mengunggah...' : 'Upload Gambar'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
                <span className="text-xs text-[#506457] truncate max-w-xs">
                  {photoName || 'Belum ada foto dipilih (opsional)'}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={ticketSubmitting || uploading}
              className="w-full rounded-full bg-[#ee4129] py-3.5 text-sm font-bold text-white shadow-sm hover:bg-[#d8351e] disabled:opacity-60 transition cursor-pointer"
            >
              {ticketSubmitting ? 'Mengirim Laporan...' : 'Submit'}
            </button>
          </form>
        </div>
      )}

      {/* Booking Modal */}
      {bookingFacility && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => setBookingFacility(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-[#dce5df]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#17251f]">Book {bookingFacility.name}</h3>
                <p className="text-xs text-[#506457]">Jam operasional: {bookingFacility.open_hours}</p>
              </div>
              <button
                type="button"
                onClick={() => setBookingFacility(null)}
                className="rounded-full p-1.5 text-[#506457] hover:bg-[#f4f7f5] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {bookSuccess ? (
              <div className="py-6 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-[#176b4b] mx-auto" />
                <p className="text-sm font-bold text-[#17251f]">{bookSuccess}</p>
              </div>
            ) : (
              <form onSubmit={handleBookSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#42564a] mb-1">Nama Warga</label>
                  <input
                    type="text"
                    required
                    value={bookForm.resident_name}
                    onChange={(e) => setBookForm({ ...bookForm, resident_name: e.target.value })}
                    placeholder="Nama lengkap"
                    className="w-full rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3.5 py-2.5 text-sm outline-none focus:border-[#1b4532] focus:bg-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#42564a] mb-1">Blok / No</label>
                    <input
                      type="text"
                      required
                      value={bookForm.house_code}
                      onChange={(e) => setBookForm({ ...bookForm, house_code: e.target.value })}
                      placeholder="U16"
                      className="w-full rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3.5 py-2.5 text-sm outline-none focus:border-[#1b4532] focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#42564a] mb-1">WhatsApp</label>
                    <input
                      type="text"
                      required
                      value={bookForm.phone}
                      onChange={(e) => setBookForm({ ...bookForm, phone: e.target.value })}
                      placeholder="0812-xxxx"
                      className="w-full rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3.5 py-2.5 text-sm outline-none focus:border-[#1b4532] focus:bg-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#42564a] mb-1">Tanggal</label>
                    <input
                      type="date"
                      required
                      value={bookForm.date}
                      onChange={(e) => setBookForm({ ...bookForm, date: e.target.value })}
                      className="w-full rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3.5 py-2.5 text-sm outline-none focus:border-[#1b4532] focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#42564a] mb-1">Sesi Waktu</label>
                    <select
                      value={bookForm.time_slot}
                      onChange={(e) => setBookForm({ ...bookForm, time_slot: e.target.value })}
                      className="w-full rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3 py-2.5 text-sm outline-none focus:border-[#1b4532] focus:bg-white"
                    >
                      <option value="07:00 - 09:00">07:00 - 09:00</option>
                      <option value="09:00 - 12:00">09:00 - 12:00</option>
                      <option value="14:00 - 16:00">14:00 - 16:00</option>
                      <option value="16:00 - 19:00">16:00 - 19:00</option>
                      <option value="19:00 - 21:00">19:00 - 21:00</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#42564a] mb-1">Keperluan</label>
                  <input
                    type="text"
                    required
                    value={bookForm.purpose}
                    onChange={(e) => setBookForm({ ...bookForm, purpose: e.target.value })}
                    placeholder="Contoh: Arisan keluarga / Olahraga rutin"
                    className="w-full rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3.5 py-2.5 text-sm outline-none focus:border-[#1b4532] focus:bg-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={bookSubmitting}
                  className="w-full rounded-full bg-[#ee4129] py-3 text-sm font-bold text-white hover:bg-[#d8351e] transition cursor-pointer"
                >
                  {bookSubmitting ? 'Mengajukan...' : 'Ajukan Pemakaian'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Schedule Viewer Modal */}
      {scheduleFacility && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => setScheduleFacility(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-[#dce5df]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#17251f]">
                Jadwal {scheduleFacility.name}
              </h3>
              <button
                type="button"
                onClick={() => setScheduleFacility(null)}
                className="rounded-full p-1.5 text-[#506457] hover:bg-[#f4f7f5] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2.5 max-h-72 overflow-y-auto">
              {bookings.filter((b) => b.facility_id === scheduleFacility.id).length === 0 ? (
                <p className="text-sm text-[#506457] py-4 text-center">
                  Belum ada jadwal pemakaian terdaftar. Fasilitas tersedia untuk dipesan.
                </p>
              ) : (
                bookings
                  .filter((b) => b.facility_id === scheduleFacility.id)
                  .map((b) => (
                    <div
                      key={b.id}
                      className="rounded-2xl bg-[#f7f9f7] border border-[#edf1ee] p-3.5 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#17251f]">
                          {b.date} · {b.time_slot}
                        </span>
                        <span className="rounded-full bg-[#dff0e4] px-2.5 py-0.5 text-[11px] font-bold text-[#176b4b]">
                          {b.status}
                        </span>
                      </div>
                      <p className="text-xs text-[#506457] mt-1">
                        {b.resident_name} ({b.house_code}) — {b.purpose}
                      </p>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
