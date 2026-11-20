import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Home, Lock, ShieldCheck, Users } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface HouseOption {
  code: string;
  block: string;
  status: string;
}

const FALLBACK_HOUSES: HouseOption[] = [
  ...Array.from({ length: 18 }, (_, i) => {
    const n = i + 1;
    const code = n < 10 ? `U0${n}` : `U${n}`;
    return { code, block: 'Blok U', status: n <= 16 ? 'Dihuni' : 'Kosong' };
  }),
  ...Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    const code = n < 10 ? `A0${n}` : `A${n}`;
    return { code, block: 'Blok A', status: n <= 10 ? 'Dihuni' : 'Kosong' };
  }),
  ...Array.from({ length: 10 }, (_, i) => {
    const n = i + 1;
    const code = n < 10 ? `B0${n}` : `B${n}`;
    return { code, block: 'Blok B', status: n <= 8 ? 'Dihuni' : 'Kosong' };
  }),
];

export function LoginPage() {
  const { loginResident, loginAdmin } = useAuth();
  const [mode, setMode] = useState<'resident' | 'admin'>('resident');
  const [houses, setHouses] = useState<HouseOption[]>(FALLBACK_HOUSES);
  const [backendOffline, setBackendOffline] = useState(false);

  const [selectedBlock, setSelectedBlock] = useState('Blok U');
  const [houseCode, setHouseCode] = useState('U01');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getAuthHouses()
      .then((list) => {
        if (list.length > 0) {
          setHouses(list);
          setBackendOffline(false);
          const first = list[0];
          setSelectedBlock(first.block);
          setHouseCode(first.code);
        }
      })
      .catch(() => {
        setBackendOffline(true);
      });
  }, []);

  const blocks = useMemo(
    () => Array.from(new Set(houses.map((h) => h.block))).sort(),
    [houses]
  );

  const housesInBlock = useMemo(
    () => houses.filter((h) => h.block === selectedBlock),
    [houses, selectedBlock]
  );

  const handleBlockChange = (blk: string) => {
    setSelectedBlock(blk);
    const firstInBlk = houses.find((h) => h.block === blk);
    if (firstInBlk) setHouseCode(firstInBlk.code);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'resident') {
        await loginResident(houseCode, password);
      } else {
        await loginAdmin(username, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk ke portal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen vh-hero-gradient flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* Official Victoria Hill Logo */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="rounded-3xl bg-white px-6 py-4 shadow-sm border border-[#dce5df]">
            <img
              src="/images/logo-vh.png"
              alt="Forum Warga Victoria Hill"
              className="h-14 w-auto object-contain"
            />
          </div>
          <p className="mt-3 text-sm font-medium text-[#42564a]">
            Portal Layanan Lingkungan, Transparansi IPL & KAS Warga
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-3xl bg-white border border-[#dce5df] shadow-xl overflow-hidden">
          {/* Role Switcher */}
          <div className="grid grid-cols-2 bg-[#eef4ef] p-1.5 gap-1">
            <button
              type="button"
              onClick={() => {
                setMode('resident');
                setPassword('');
                setError('');
              }}
              className={`flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-bold transition cursor-pointer ${
                mode === 'resident'
                  ? 'bg-[#1b4532] text-white shadow-xs'
                  : 'text-[#42564a] hover:bg-white/60'
              }`}
            >
              <Users className="w-4 h-4" />
              Masuk Warga
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('admin');
                setPassword('');
                setError('');
              }}
              className={`flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-bold transition cursor-pointer ${
                mode === 'admin'
                  ? 'bg-[#ee4129] text-white shadow-xs'
                  : 'text-[#42564a] hover:bg-white/60'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Masuk Pengurus
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-4">
            <div>
              <h1 className="text-xl font-bold text-[#17251f]">
                {mode === 'resident' ? 'Portal Warga Victoria Hill' : 'Login Pengurus (Admin)'}
              </h1>
              <p className="mt-1 text-xs text-[#506457]">
                {mode === 'resident'
                  ? 'Pilih blok & nomor rumah Anda lalu masukkan password bersama warga.'
                  : 'Masuk dengan akun pengurus untuk mengelola layanan warga, import laporan, dan memantau audit trail.'}
              </p>
            </div>

            {backendOffline && (
              <div className="flex items-start gap-2 rounded-2xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Backend API (<code>localhost:8080</code>) belum aktif. Jalankan <code>cd backend && go run .</code> agar bisa login.
                </span>
              </div>
            )}

            {error && (
              <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-medium text-red-700">
                {error}
              </div>
            )}

            {mode === 'resident' ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#42564a] mb-1.5">
                      Blok Rumah
                    </label>
                    <div className="relative">
                      <Home className="w-4 h-4 text-[#176b4b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <select
                        required
                        value={selectedBlock}
                        onChange={(e) => handleBlockChange(e.target.value)}
                        className="w-full rounded-full border border-[#dce5df] bg-[#f4f7f5] pl-10 pr-4 py-3 text-sm font-semibold text-[#17251f] outline-none focus:border-[#1b4532] focus:bg-white"
                      >
                        {blocks.map((blk) => (
                          <option key={blk} value={blk}>
                            {blk}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#42564a] mb-1.5">
                      Nomor Rumah
                    </label>
                    <select
                      required
                      value={houseCode}
                      onChange={(e) => setHouseCode(e.target.value)}
                      className="w-full rounded-full border border-[#dce5df] bg-[#f4f7f5] px-4 py-3 text-sm font-semibold text-[#17251f] outline-none focus:border-[#1b4532] focus:bg-white"
                    >
                      {housesInBlock.map((h) => (
                        <option key={h.code} value={h.code}>
                          {h.code} ({h.status})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Dummy Example Helper */}
                <div className="flex items-center justify-between gap-2 rounded-2xl bg-[#eef4ef] border border-[#dce5df] px-3.5 py-2.5 text-xs text-[#1b4532]">
                  <div>
                    <span className="font-bold">Contoh Dummy:</span>{' '}
                    <span>Blok U · Nomor U01 (bukan warga asli)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBlock('Blok U');
                      setHouseCode('U01');
                    }}
                    className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#176b4b] border border-[#cde3d4] hover:bg-[#176b4b] hover:text-white transition cursor-pointer"
                  >
                    Pakai Dummy
                  </button>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-[#42564a] mb-1.5">
                  Username Pengurus
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username pengurus"
                  className="w-full rounded-full border border-[#dce5df] bg-[#f4f7f5] px-5 py-3 text-sm outline-none focus:border-[#1b4532] focus:bg-white"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#42564a] mb-1.5">
                {mode === 'resident' ? 'Password Warga' : 'Password Pengurus'}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#506457] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  className="w-full rounded-full border border-[#dce5df] bg-[#f4f7f5] pl-11 pr-5 py-3 text-sm outline-none focus:border-[#1b4532] focus:bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full rounded-full py-3.5 text-sm font-bold text-white shadow-sm transition cursor-pointer disabled:opacity-60 ${
                mode === 'resident'
                  ? 'bg-[#1b4532] hover:bg-[#133325]'
                  : 'bg-[#ee4129] hover:bg-[#d8351e]'
              }`}
            >
              {loading
                ? 'Memverifikasi...'
                : mode === 'resident'
                ? 'Masuk ke Portal Warga'
                : 'Masuk ke Dashboard Pengurus'}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-[#506457]">
          © {new Date().getFullYear()} Forum Warga Victoria Hill · Data nama penghuni terenkripsi & dimasking.
        </p>
      </div>
    </div>
  );
}
