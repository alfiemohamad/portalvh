import { useState } from 'react';
import { Lock, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

export function LoginModal({ open, onClose }: LoginModalProps) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(username, password);
      onClose();
      navigate('/pengurus');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
    >
      <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden border border-[#dce5df]">
        <div className="flex items-center justify-between bg-[#1b4532] px-6 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-[#82e4b0]" />
            <h2 id="login-modal-title" className="text-base font-bold">
              Masuk Pengurus
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 hover:bg-white/15 transition cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-[#506457]">
            Masuk menggunakan akun pengurus untuk mengelola pengumuman warga, tiket laporan, pengajuan kartu akses, dan pemesanan fasilitas.
          </p>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#42564a] mb-1">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3.5 py-2.5 text-sm outline-none focus:border-[#1b4532] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#42564a] mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[#dce5df] bg-[#f7f9f7] px-3.5 py-2.5 text-sm outline-none focus:border-[#1b4532] focus:bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-[#1b4532] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#133325] disabled:opacity-60 transition cursor-pointer"
          >
            {loading ? 'Memverifikasi...' : 'Masuk ke Dashboard Pengurus'}
          </button>
        </form>
      </div>
    </div>
  );
}
