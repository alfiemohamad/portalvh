import { useEffect, useState } from 'react';
import { Search, ShieldCheck, User, X, Phone, Home } from 'lucide-react';
import { api } from '../api/client';
import type { ResidentHouse } from '../types';
import { PageHeader } from '../components/PageHeader';

export function DirectoryPage() {
  const [summary, setSummary] = useState({ total: 0, occupied: 0, vacant: 0 });
  const [blocks, setBlocks] = useState<string[]>([]);
  const [houses, setHouses] = useState<ResidentHouse[]>([]);
  const [selectedBlock, setSelectedBlock] = useState('Semua Blok');
  const [query, setQuery] = useState('');
  const [selectedHouse, setSelectedHouse] = useState<ResidentHouse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .getDirectory(selectedBlock, query)
      .then((res) => {
        setSummary(res.summary);
        setBlocks(res.blocks.sort());
        setHouses(res.houses);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedBlock, query]);

  return (
    <div>
      <PageHeader
        title="Direktori warga"
        subtitle="Data rumah, blok, dan informasi pengurus Victoria Hill"
      />

      <h2 className="text-lg font-bold text-[#17251f] mb-4">Data warga</h2>

      {/* 3 Stat Cards — matches Frame 7 */}
      <div className="grid grid-cols-3 gap-3 sm:gap-5 mb-6">
        <div className="rounded-2xl bg-[#dff0e4] border border-[#cde3d4] p-4 sm:p-5">
          <div className="text-xs sm:text-sm font-medium text-[#17251f]">Rumah Terdata</div>
          <div className="mt-2 text-3xl sm:text-4xl font-bold text-[#42564a]">{summary.total}</div>
        </div>
        <div className="rounded-2xl bg-[#dff0e4] border border-[#cde3d4] p-4 sm:p-5">
          <div className="text-xs sm:text-sm font-medium text-[#17251f]">Dihuni</div>
          <div className="mt-2 text-3xl sm:text-4xl font-bold text-[#176b4b]">{summary.occupied}</div>
        </div>
        <div className="rounded-2xl bg-[#dff0e4] border border-[#cde3d4] p-4 sm:p-5">
          <div className="text-xs sm:text-sm font-medium text-[#17251f]">Kosong</div>
          <div className="mt-2 text-3xl sm:text-4xl font-bold text-[#5c6b63]">{summary.vacant}</div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <select
          value={selectedBlock}
          onChange={(e) => setSelectedBlock(e.target.value)}
          className="rounded-full border border-[#dce5df] bg-[#e8efea] px-5 py-3 text-sm font-medium text-[#17251f] outline-none focus:border-[#1b4532] sm:w-56"
          aria-label="Filter Blok"
        >
          <option value="Semua Blok">Semua Blok</option>
          {blocks.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#5c6b63] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari kode rumah (mis. U16) atau nama warga..."
            className="w-full rounded-full border border-[#dce5df] bg-white pl-11 pr-5 py-3 text-sm outline-none focus:border-[#1b4532]"
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-[#506457] mb-4">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#1b4532]" /> Dihuni
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#c7d6cc]" /> Kosong
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full ring-2 ring-[#ee4129] bg-[#1b4532]" /> Pengurus
        </span>
      </div>

      {/* House Pill Grid — matches Frame 7 dark green pills */}
      {loading ? (
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="h-10 rounded-full bg-[#e8f0eb] animate-pulse" />
          ))}
        </div>
      ) : houses.length === 0 ? (
        <div className="rounded-3xl bg-white border border-[#dce5df] p-10 text-center text-sm text-[#506457]">
          Tidak ada data rumah yang sesuai dengan filter pencarian.
        </div>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
          {houses.map((house) => {
            const occupied = house.status === 'Dihuni';
            return (
              <button
                key={house.id}
                type="button"
                onClick={() => setSelectedHouse(house)}
                className={`relative rounded-full py-2.5 px-3 text-sm font-semibold transition cursor-pointer ${
                  occupied
                    ? 'bg-[#1b4532] text-white hover:bg-[#133325] shadow-xs'
                    : 'bg-[#d8e3dc] text-[#42564a] hover:bg-[#c8d8ce]'
                } ${house.is_pengurus ? 'ring-2 ring-offset-2 ring-[#ee4129]' : ''}`}
              >
                {house.code}
              </button>
            );
          })}
        </div>
      )}

      {/* House Detail Modal */}
      {selectedHouse && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => setSelectedHouse(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-[#dce5df]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1b4532] text-white font-bold">
                  {selectedHouse.code}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#17251f]">
                    {selectedHouse.block} No. {selectedHouse.house_no}
                  </h3>
                  <span
                    className={`inline-block mt-0.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      selectedHouse.status === 'Dihuni'
                        ? 'bg-[#dff0e4] text-[#176b4b]'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {selectedHouse.status}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHouse(null)}
                className="rounded-full p-1.5 text-[#506457] hover:bg-[#f4f7f5] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              {selectedHouse.is_pengurus && (
                <div className="flex items-center gap-2 rounded-2xl bg-[#fff7ed] border border-[#e8c6aa] px-4 py-2.5 text-[#873e13] font-semibold">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Pengurus: {selectedHouse.role}</span>
                </div>
              )}

              {selectedHouse.status === 'Dihuni' ? (
                <div className="rounded-2xl bg-[#f7f9f7] border border-[#edf1ee] p-4 space-y-2.5">
                  <div className="flex items-center gap-2.5 text-[#17251f]">
                    <User className="w-4 h-4 text-[#176b4b]" />
                    <span className="text-[#506457]">Kepala Keluarga:</span>
                    <span className="font-semibold">{selectedHouse.head_of_home}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[#17251f]">
                    <Home className="w-4 h-4 text-[#176b4b]" />
                    <span className="text-[#506457]">Jumlah Penghuni:</span>
                    <span className="font-semibold">{selectedHouse.members} orang</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[#17251f]">
                    <Phone className="w-4 h-4 text-[#176b4b]" />
                    <span className="text-[#506457]">Kontak:</span>
                    <span className="font-semibold">{selectedHouse.phone}</span>
                  </div>
                </div>
              ) : (
                <p className="rounded-2xl bg-[#f7f9f7] p-4 text-[#506457]">
                  Unit rumah ini saat ini tercatat dalam status kosong / belum dihuni.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
