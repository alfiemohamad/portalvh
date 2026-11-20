import { useEffect, useState } from 'react';
import { Home, Lock, ShieldCheck, Users } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const DEFAULT_BLOCKS = ['A', 'B', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L', 'M', 'N', 'O', 'U'];

export function LoginPage() {
  const { loginResident, loginAdmin } = useAuth();
  const [mode, setMode] = useState<'resident' | 'admin'>('resident');
  const [blockList, setBlockList] = useState<string[]>(DEFAULT_BLOCKS);

  const [block, setBlock] = useState('');
  const [houseNo, setHouseNo] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getAuthHouses()
      .then((list) => {
        if (list.length > 0) {
          const unique = Array.from(
            new Set(list.map((h) => h.block.replace(/^Blok\s+/i, '').trim()))
          ).sort();
          if (unique.length > 0) setBlockList(unique);
        }
      })
      .catch(() => {
        // Gunakan daftar blok default jika API belum merespons
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'resident') {
        await loginResident(block, houseNo, password);
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
    <div className="min-h-screen vh-hero-gradient flex flex-col items-center justify-center px-4 py-8 sm:p-6">
      <div className="w-full max-w-md">
        {/* Logo Victoria Hill */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="rounded-3xl bg-white px-5 py-3.5 shadow-sm border border-[#dce5df]">
            <img
              src="/images/logo-vh.png"
              alt="Forum Warga Victoria Hill"
              className="h-12 sm:h-14 w-auto object-contain"
            />
          </div>
          <p className="mt-3 text-xs sm:text-sm font-medium text-[#42564a]">
            Portal Layanan Lingkungan & Informasi Warga
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-3xl bg-white border border-[#dce5df] shadow-xl overflow-hidden">
          <div className="grid grid-cols-2 bg-[#eef4ef] p-1.5 gap-1">
            <button
              type="button"
              onClick={() => {
                setMode('resident');
                setPassword('');
                setError('');
              }}
              className={`flex items-center justify-center gap-2 rounded-2xl py-2.5 text-xs sm:text-sm font-bold transition cursor-pointer ${
                mode === 'resident'
                  ? 'bg-[#1b4532] text-white shadow-xs'
                  : 'text-[#42564a] hover:bg-white/60'
              }`}
            >
              <Users className="w-4 h-4" />
              Warga
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('admin');
                setPassword('');
                setError('');
              }}
              className={`flex items-center justify-center gap-2 rounded-2xl py-2.5 text-xs sm:text-sm font-bold transition cursor-pointer ${
                mode === 'admin'
                  ? 'bg-[#ee4129] text-white shadow-xs'
                  : 'text-[#42564a] hover:bg-white/60'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Pengurus
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 sm:p-8 space-y-4">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-[#17251f]">
                {mode === 'resident' ? 'Masuk Portal Warga' : 'Masuk Pengurus'}
              </h1>
              <p className="mt-1 text-xs text-[#506457]">
                {mode === 'resident'
                  ? 'Isi blok dan nomor rumah Anda beserta password warga.'
                  : 'Masukkan username dan password akun pengurus.'}
              </p>
            </div>

            {error && (
              <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-medium text-red-700">
                {error}
              </div>
            )}

            {mode === 'resident' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="login-block" className="block text-xs font-semibold text-[#42564a] mb-1.5">
                      Blok
                    </label>
                    <div className="relative">
                      <Home className="w-4 h-4 text-[#176b4b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="login-block"
                        type="text"
                        list="vh-block-options"
                        required
                        value={block}
                        onChange={(e) => setBlock(e.target.value)}
                        placeholder="Pilih atau ketik (mis. U)"
                        className="w-full rounded-full border border-[#dce5df] bg-[#f4f7f5] pl-10 pr-4 py-3 text-sm font-medium text-[#17251f] outline-none focus:border-[#1b4532] focus:bg-white"
                      />
                      <datalist id="vh-block-options">
                        {blockList.map((b) => (
                          <option key={b} value={b} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="login-house-no" className="block text-xs font-semibold text-[#42564a] mb-1.5">
                      Nomor Rumah
                    </label>
                    <input
                      id="login-house-no"
                      type="text"
                      required
                      value={houseNo}
                      onChange={(e) => setHouseNo(e.target.value)}
                      placeholder="Contoh: 01 atau 3A"
                      className="w-full rounded-full border border-[#dce5df] bg-[#f4f7f5] px-4 py-3 text-sm font-medium text-[#17251f] outline-none focus:border-[#1b4532] focus:bg-white"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-[#5c6b63] px-1">
                  Contoh pengisian: Blok <span className="font-semibold text-[#17251f]">U</span>, Nomor{' '}
                  <span className="font-semibold text-[#17251f]">01</span>
                </p>
              </div>
            ) : (
              <div>
                <label htmlFor="login-username" className="block text-xs font-semibold text-[#42564a] mb-1.5">
                  Username
                </label>
                <input
                  id="login-username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username pengurus"
                  className="w-full rounded-full border border-[#dce5df] bg-[#f4f7f5] px-5 py-3 text-sm outline-none focus:border-[#1b4532] focus:bg-white"
                />
              </div>
            )}

            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-[#42564a] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#506457] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-password"
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
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-[#506457]">
          © {new Date().getFullYear()} Forum Warga Victoria Hill
        </p>
      </div>
    </div>
  );
}
