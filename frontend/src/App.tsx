import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { ServicesPage } from './pages/ServicesPage';
import { DirectoryPage } from './pages/DirectoryPage';
import { FacilitiesPage } from './pages/FacilitiesPage';
import { AccessCardPage } from './pages/AccessCardPage';
import { IplReportPage } from './pages/IplReportPage';
import { KasReportPage } from './pages/KasReportPage';
import { CctvPage } from './pages/CctvPage';
import { AssetLoanPage } from './pages/AssetLoanPage';
import { InfoPage } from './pages/InfoPage';
import { ContactPage } from './pages/ContactPage';
import { AdminPage } from './pages/AdminPage';

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, checkingSession } = useAuth();

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f9f7] text-sm font-semibold text-[#1b4532]">
        Memuat sesi portal Victoria Hill...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/layanan" element={<ServicesPage />} />
        <Route path="/direktori" element={<DirectoryPage />} />
        <Route path="/fasilitas" element={<FacilitiesPage />} />
        <Route path="/kartu-akses" element={<AccessCardPage />} />
        <Route path="/laporan-ipl" element={<IplReportPage />} />
        <Route path="/laporan-kas" element={<KasReportPage />} />
        <Route path="/cctv" element={<CctvPage />} />
        <Route path="/pinjam-barang" element={<AssetLoanPage />} />
        <Route path="/info" element={<InfoPage />} />
        <Route path="/kontak" element={<ContactPage />} />
        <Route
          path="/pengurus"
          element={
            <AdminGuard>
              <AdminPage />
            </AdminGuard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
