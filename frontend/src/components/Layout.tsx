import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Bell,
  Home,
  LayoutGrid,
  LogOut,
  Phone,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PanicModal } from './PanicModal';
import { LoginModal } from './LoginModal';

export function Layout() {
  const { isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [panicOpen, setPanicOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const navItems = [
    { to: '/', label: 'Beranda', icon: Home, end: true },
    { to: '/layanan', label: 'Layanan', icon: LayoutGrid },
    { to: '/info', label: 'Info', icon: Bell },
    { to: '/kontak', label: 'Kontak', icon: Phone },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f9f7] text-[#17251f] pb-24 md:pb-0">
      {/* Persistent Victoria Hill Forest Green Top Bar */}
      <header className="sticky top-0 z-40 bg-[#1b4532] text-white shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 h-16 md:h-[72px]">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ee4129] text-white shadow-sm transition group-hover:scale-105">
              <Home className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="leading-tight">
              <div className="text-base font-bold tracking-tight text-white">Victoria Hill</div>
              <div className="text-xs font-medium text-[#82e4b0]">Portal warga</div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Navigasi utama">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-white/15 text-white'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setPanicOpen(true)}
              className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-[#ee4129] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#d8351e] transition cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4" />
              Panic Button
            </button>

            {isAdmin ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/pengurus')}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs sm:text-sm font-bold text-[#17251f] shadow-xs hover:bg-[#eef4ef] transition cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-[#176b4b]" />
                  <span>Pengurus</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    navigate('/');
                  }}
                  className="rounded-full p-2 text-white/80 hover:bg-white/15 hover:text-white transition cursor-pointer"
                  title="Keluar Pengurus"
                  aria-label="Keluar Pengurus"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="rounded-full bg-white px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold text-[#17251f] shadow-xs hover:bg-[#eef4ef] transition cursor-pointer"
              >
                Masuk pengurus
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 md:py-8">
        <Outlet />
      </main>

      {/* Desktop Footer */}
      <footer className="hidden md:block border-t border-[#dce5df] bg-white mt-12">
        <div className="mx-auto max-w-6xl px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#506457]">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#176b4b]" />
            <span className="font-semibold text-[#17251f]">Portal Warga Victoria Hill</span>
            <span>· Layanan Lingkungan Digital</span>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/layanan" className="hover:text-[#176b4b]">Layanan</Link>
            <Link to="/fasilitas" className="hover:text-[#176b4b]">Fasilitas</Link>
            <Link to="/laporan-ipl" className="hover:text-[#176b4b]">Laporan IPL</Link>
            <Link to="/laporan-kas" className="hover:text-[#176b4b]">Laporan KAS</Link>
            <Link to="/kontak" className="hover:text-[#176b4b]">Kontak Pengurus</Link>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation (matches Figma Frame 1-10) */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[#dce5df] bg-white/95 backdrop-blur-md"
        aria-label="Navigasi cepat"
      >
        <div className="grid grid-cols-5 items-end h-[72px] px-2 pb-2">
          {navItems.slice(0, 2).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                  isActive ? 'text-[#176b4b] font-bold' : 'text-[#5c6b63]'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}

          {/* Center Floating Red Panic Button */}
          <div className="flex flex-col items-center justify-end">
            <button
              type="button"
              onClick={() => setPanicOpen(true)}
              className="flex h-12 w-12 -mt-5 items-center justify-center rounded-full bg-[#c92a17] text-white shadow-lg ring-4 ring-white active:scale-95 transition cursor-pointer"
              aria-label="Panic Button"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/80 text-xl font-black leading-none">
                !
              </span>
            </button>
            <span className="mt-1 text-[10px] font-semibold text-[#506457]">Panic Button</span>
          </div>

          {navItems.slice(2).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                  isActive ? 'text-[#176b4b] font-bold' : 'text-[#5c6b63]'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <PanicModal open={panicOpen} onClose={() => setPanicOpen(false)} />
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
