import { useEffect, useState } from 'react';
import { Maximize2, Radio, X } from 'lucide-react';
import { api } from '../api/client';
import type { CctvCamera } from '../types';
import { PageHeader } from '../components/PageHeader';

const AREAS = ['Semua', 'Gerbang Utama', 'Kolam Renang'];

export function CctvPage() {
  const [cameras, setCameras] = useState<CctvCamera[]>([]);
  const [selectedArea, setSelectedArea] = useState('Semua');
  const [activeCam, setActiveCam] = useState<CctvCamera | null>(null);
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString('id-ID'));

  useEffect(() => {
    const timer = setInterval(() => {
      setClock(new Date().toLocaleTimeString('id-ID'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    api.getCctv(selectedArea).then(setCameras).catch(console.error);
  }, [selectedArea]);

  return (
    <div>
      <PageHeader
        title="Pantau CCTV"
        subtitle="Pantauan kamera keamanan lingkungan Victoria Hill secara realtime"
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold text-[#17251f]">Cek CCTV realtime</h2>
        <div className="inline-flex items-center gap-2 rounded-full bg-white border border-[#dce5df] px-4 py-1.5 text-xs font-semibold text-[#176b4b]">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          LIVE · {clock} WIB
        </div>
      </div>

      {/* Filter Pills — matches Frame 6 */}
      <div className="flex flex-wrap gap-2.5 mb-6">
        {AREAS.map((area) => (
          <button
            key={area}
            type="button"
            onClick={() => setSelectedArea(area)}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition cursor-pointer ${
              selectedArea === area
                ? 'bg-[#2a734a] text-white shadow-xs'
                : 'bg-[#f1f4f2] border border-[#dce5df] text-[#5c6b63] hover:bg-[#e5ede8]'
            }`}
          >
            {area}
          </button>
        ))}
      </div>

      {/* CCTV Feed Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {cameras.map((cam) => (
          <div
            key={cam.id}
            onClick={() => setActiveCam(cam)}
            className="group cursor-pointer overflow-hidden rounded-2xl bg-white border border-[#dce5df] shadow-xs hover:shadow-md transition"
          >
            <div className="relative aspect-[16/10] bg-black overflow-hidden">
              <img
                src={cam.image_url}
                alt={cam.name}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
              <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-xs">
                <Radio className="w-3 h-3 text-red-400 animate-pulse" />
                {cam.status}
              </div>
              <div className="absolute bottom-2.5 left-3 rounded bg-black/60 px-2 py-0.5 font-mono text-[11px] text-white">
                {clock}
              </div>
              <div className="absolute bottom-2.5 right-3 rounded-full bg-black/60 p-1.5 text-white opacity-0 group-hover:opacity-100 transition">
                <Maximize2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="p-3.5 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-[#17251f]">{cam.name}</div>
                <div className="text-xs text-[#506457]">{cam.area}</div>
              </div>
              <span className="rounded-full bg-[#eef4ef] px-2.5 py-0.5 text-[11px] font-semibold text-[#176b4b]">
                {cam.resolution}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Enlarged CCTV Modal */}
      {activeCam && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
          onClick={() => setActiveCam(null)}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-3xl bg-[#111915] text-white shadow-2xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="font-bold text-sm">{activeCam.name}</span>
                <span className="text-xs text-white/60">· {activeCam.resolution}</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveCam(null)}
                className="rounded-full p-1.5 hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative aspect-video bg-black">
              <img
                src={activeCam.image_url}
                alt={activeCam.name}
                className="h-full w-full object-cover"
              />
              <div className="absolute bottom-4 left-4 rounded-lg bg-black/70 px-3 py-1 font-mono text-xs text-white">
                CAM-{activeCam.id.toUpperCase()} · {new Date().toLocaleDateString('id-ID')} {clock} WIB
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
