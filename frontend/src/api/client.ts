import type {
  AccessCardRequest,
  ActivityReport,
  Announcement,
  AssetLoan,
  AuditLog,
  BorrowableAsset,
  CctvCamera,
  DashboardData,
  EnvSettings,
  Facility,
  FacilityBooking,
  FinanceFundType,
  FinanceItem,
  FinanceReport,
  KasPaymentSubmission,
  PanicAlert,
  ResidentHouse,
  SessionUser,
  Ticket,
  UmkmItem,
} from '../types';

const API_BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('vh_token');
}

function getAuthHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(getAuthHeaders() as Record<string, string>),
    ...(options.headers as Record<string, string>),
  };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && path !== '/auth/login') {
    localStorage.removeItem('vh_token');
    localStorage.removeItem('vh_user');
    window.dispatchEvent(new Event('vh:unauthorized'));
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: 'Terjadi kesalahan pada server' }));
    throw new Error(errBody.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Unduh file secara aman menggunakan Authorization header (tanpa menaruh token di URL)
async function downloadBlob(path: string, fallbackFilename: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: getAuthHeaders(),
  });
  if (res.status === 401) {
    localStorage.removeItem('vh_token');
    localStorage.removeItem('vh_user');
    window.dispatchEvent(new Event('vh:unauthorized'));
    throw new Error('Sesi telah berakhir. Silakan login kembali.');
  }
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: 'Gagal mengunduh file' }));
    throw new Error(errBody.error || `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || fallbackFilename;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  // Auth
  getAuthHouses: () =>
    request<{ code: string; block: string; status: string }[]>('/auth/houses'),
  loginResident: (block: string, house_no: string, password: string) =>
    request<{ token: string; user: SessionUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ mode: 'resident', block, house_no, password }),
    }),
  loginAdmin: (username: string, password: string) =>
    request<{ token: string; user: SessionUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ mode: 'admin', username, password }),
    }),
  getMe: () => request<{ user: SessionUser }>('/auth/me'),
  logout: () => request<{ status: string }>('/auth/logout', { method: 'POST' }),
  getSettings: () => request<EnvSettings>('/settings'),

  // Audit Trail (Admin)
  getAuditLogs: (q = '', action = 'ALL') => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (action && action !== 'ALL') params.set('action', action);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<AuditLog[]>(`/audit-logs${qs}`);
  },
  downloadAuditLogs: (format: 'csv' | 'xlsx' = 'csv') =>
    downloadBlob(`/audit-logs?download=${format}`, `Audit_Trail_VictoriaHill.${format}`),

  // Dashboard
  getDashboard: () => request<DashboardData>('/dashboard'),

  // Announcements
  getAnnouncements: () => request<Announcement[]>('/announcements'),
  createAnnouncement: (payload: { title: string; content: string; category: string; pinned: boolean }) =>
    request<Announcement>('/announcements', { method: 'POST', body: JSON.stringify(payload) }),
  deleteAnnouncement: (id: string) =>
    request<{ status: string }>(`/announcements/${id}`, { method: 'DELETE' }),

  // Activity Reports (Laporan Kegiatan Warga)
  getActivities: (category = '') => {
    const qs = category && category !== 'Semua' ? `?category=${encodeURIComponent(category)}` : '';
    return request<ActivityReport[]>(`/activities${qs}`);
  },
  createActivity: (payload: {
    title: string;
    category: string;
    activity_date: string;
    location: string;
    summary: string;
    budget_used: number;
    image_url?: string;
  }) => request<ActivityReport>('/activities', { method: 'POST', body: JSON.stringify(payload) }),
  updateActivity: (
    id: string,
    payload: Partial<{
      title: string;
      category: string;
      activity_date: string;
      location: string;
      summary: string;
      budget_used: number;
      image_url: string;
    }>
  ) => request<ActivityReport>(`/activities/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteActivity: (id: string) =>
    request<{ status: string }>(`/activities/${id}`, { method: 'DELETE' }),

  // Directory
  getDirectory: (block = '', q = '') => {
    const params = new URLSearchParams();
    if (block) params.set('block', block);
    if (q) params.set('q', q);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<{
      summary: { total: number; occupied: number; vacant: number };
      blocks: string[];
      houses: ResidentHouse[];
    }>(`/directory${qs}`);
  },

  // Facilities & Bookings
  getFacilities: () =>
    request<{
      facilities: Facility[];
      bookings: FacilityBooking[];
      summary: {
        total_assets: number;
        env_assets: number;
        facilities: number;
        maintenance: number;
        tickets_open: number;
        tickets_done: number;
      };
      monthly_usage: { month: string; count: number }[];
    }>('/facilities'),
  createBooking: (payload: {
    facility_id: string;
    resident_name: string;
    house_code: string;
    phone: string;
    date: string;
    time_slot: string;
    purpose: string;
  }) => request<FacilityBooking>('/bookings', { method: 'POST', body: JSON.stringify(payload) }),
  updateBooking: (id: string, status: string) =>
    request<FacilityBooking>(`/bookings/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Tickets
  getTickets: () => request<Ticket[]>('/tickets'),
  createTicket: (payload: {
    category: string;
    location: string;
    reporter_name: string;
    house_code?: string;
    description: string;
    photo_url?: string;
  }) => request<Ticket>('/tickets', { method: 'POST', body: JSON.stringify(payload) }),
  updateTicket: (id: string, status: string, admin_note: string) =>
    request<Ticket>(`/tickets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, admin_note }),
    }),

  // Access Cards
  getAccessCards: () => request<AccessCardRequest[]>('/access-cards'),
  createAccessCard: (payload: {
    full_name: string;
    block: string;
    house_no: string;
    stnk_photo_url?: string;
  }) => request<AccessCardRequest>('/access-cards', { method: 'POST', body: JSON.stringify(payload) }),
  updateAccessCard: (id: string, status: string) =>
    request<AccessCardRequest>(`/access-cards/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Assets & Loans
  getAssets: () => request<{ assets: BorrowableAsset[]; loans: AssetLoan[] }>('/assets'),
  createAssetLoan: (payload: {
    asset_id: string;
    borrower_name: string;
    house_code: string;
    phone: string;
    quantity: number;
    borrow_date: string;
    return_date: string;
  }) => request<AssetLoan>('/asset-loans', { method: 'POST', body: JSON.stringify(payload) }),
  updateAssetLoan: (id: string, status: string) =>
    request<AssetLoan>(`/asset-loans/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // CCTV
  getCctv: (area = '') => {
    const qs = area && area !== 'Semua' ? `?area=${encodeURIComponent(area)}` : '';
    return request<CctvCamera[]>(`/cctv${qs}`);
  },

  // Finance (IPL, KAS_WARGA, KAS_MESJID)
  getFinance: (type: FinanceFundType | 'ALL' = 'ALL') =>
    request<FinanceReport[]>(`/finance?type=${type}`),
  createFinanceReport: (payload: {
    type: 'IPL' | 'KAS_WARGA' | 'KAS_MESJID';
    period: string;
    month_label: string;
    opening_balance: number;
    paid_houses?: number;
    total_houses?: number;
    notes?: string;
  }) => request<FinanceReport>('/finance/reports', { method: 'POST', body: JSON.stringify(payload) }),
  updateFinanceReport: (
    id: string,
    payload: Partial<{
      month_label: string;
      opening_balance: number;
      paid_houses: number;
      total_houses: number;
      notes: string;
    }>
  ) => request<FinanceReport>(`/finance/reports/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteFinanceReport: (id: string) =>
    request<{ status: string }>(`/finance/reports/${id}`, { method: 'DELETE' }),
  addFinanceItem: (
    reportId: string,
    payload: {
      date: string;
      description: string;
      category: string;
      kind: 'Masuk' | 'Keluar';
      amount: number;
    }
  ) =>
    request<{ item: FinanceItem; report: FinanceReport }>(`/finance/reports/${reportId}/items`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateFinanceItem: (
    reportId: string,
    itemId: string,
    payload: {
      date: string;
      description: string;
      category: string;
      kind: 'Masuk' | 'Keluar';
      amount: number;
    }
  ) =>
    request<FinanceReport>(`/finance/reports/${reportId}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteFinanceItem: (reportId: string, itemId: string) =>
    request<FinanceReport>(`/finance/reports/${reportId}/items/${itemId}`, {
      method: 'DELETE',
    }),
  downloadFinance: (id: string, format: 'csv' | 'xlsx' = 'csv') =>
    downloadBlob(`/finance/${id}/download?format=${format}`, `Laporan_Keuangan.${format}`),
  downloadTemplate: (kind: 'finance' | 'directory', format: 'csv' | 'xlsx' = 'csv') =>
    downloadBlob(`/templates/${kind}?format=${format}`, `Template_${kind}.${format}`),
  importFinance: async (
    file: File,
    type: 'IPL' | 'KAS_WARGA' | 'KAS_MESJID',
    period: string,
    monthLabel: string
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    formData.append('period', period);
    formData.append('month_label', monthLabel);
    return request<{ message: string; report: FinanceReport }>('/finance/import', {
      method: 'POST',
      body: formData,
    });
  },
  importDirectory: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ message: string; imported: number }>('/directory/import', {
      method: 'POST',
      body: formData,
    });
  },

  // Kas Payments (Upload Bukti & Approval)
  getKasPayments: () => request<KasPaymentSubmission[]>('/kas-payments'),
  createKasPayment: (payload: {
    fund_type: 'KAS_WARGA' | 'KAS_MESJID';
    period?: string;
    payer_name: string;
    house_code: string;
    amount: number;
    payment_date: string;
    note: string;
    proof_url: string;
  }) => request<KasPaymentSubmission>('/kas-payments', { method: 'POST', body: JSON.stringify(payload) }),
  reviewKasPayment: (id: string, status: 'Disetujui' | 'Ditolak', admin_note = '') =>
    request<KasPaymentSubmission>(`/kas-payments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, admin_note }),
    }),

  // UMKM
  getUmkm: () => request<UmkmItem[]>('/umkm'),
  createUmkm: (payload: Omit<UmkmItem, 'id'>) =>
    request<UmkmItem>('/umkm', { method: 'POST', body: JSON.stringify(payload) }),

  // Panic
  getPanics: () => request<PanicAlert[]>('/panic'),
  triggerPanic: (payload: {
    reporter_name: string;
    house_code: string;
    category: string;
    note: string;
  }) => request<PanicAlert>('/panic', { method: 'POST', body: JSON.stringify(payload) }),
  resolvePanic: (id: string) =>
    request<PanicAlert>(`/panic/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'Ditangani' }) }),

  // Upload
  uploadFile: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ url: string; filename: string }>('/upload', {
      method: 'POST',
      body: formData,
    });
  },
};

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}
