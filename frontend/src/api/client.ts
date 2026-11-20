import type {
  AccessCardRequest,
  Announcement,
  AssetLoan,
  AuditLog,
  BorrowableAsset,
  CctvCamera,
  DashboardData,
  Facility,
  FacilityBooking,
  FinanceReport,
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

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: 'Terjadi kesalahan pada server' }));
    throw new Error(errBody.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Auth
  getAuthHouses: () =>
    request<{ code: string; block: string; status: string }[]>('/auth/houses'),
  loginResident: (house_code: string, password: string) =>
    request<{ token: string; user: SessionUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ mode: 'resident', house_code, password }),
    }),
  loginAdmin: (username: string, password: string) =>
    request<{ token: string; user: SessionUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ mode: 'admin', username, password }),
    }),

  // Audit Trail (Admin)
  getAuditLogs: (q = '', action = 'ALL') => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (action && action !== 'ALL') params.set('action', action);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<AuditLog[]>(`/audit-logs${qs}`);
  },
  getAuditExportUrl: (format: 'csv' | 'xlsx' = 'csv') => {
    const token = getToken() || '';
    return `${API_BASE}/audit-logs?download=${format}&token=${encodeURIComponent(token)}`;
  },

  // Dashboard
  getDashboard: () => request<DashboardData>('/dashboard'),

  // Announcements
  getAnnouncements: () => request<Announcement[]>('/announcements'),
  createAnnouncement: (payload: { title: string; content: string; category: string; pinned: boolean }) =>
    request<Announcement>('/announcements', { method: 'POST', body: JSON.stringify(payload) }),
  deleteAnnouncement: (id: string) =>
    request<{ status: string }>(`/announcements/${id}`, { method: 'DELETE' }),

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

  // Finance
  getFinance: (type: 'IPL' | 'KAS') => request<FinanceReport[]>(`/finance?type=${type}`),
  getFinanceDownloadUrl: (id: string, format: 'csv' | 'xlsx' = 'csv') => {
    const token = getToken() || '';
    return `${API_BASE}/finance/${id}/download?format=${format}&token=${encodeURIComponent(token)}`;
  },
  getTemplateUrl: (kind: 'finance' | 'directory', format: 'csv' | 'xlsx' = 'csv') => {
    const token = getToken() || '';
    return `${API_BASE}/templates/${kind}?format=${format}&token=${encodeURIComponent(token)}`;
  },
  importFinance: async (file: File, type: 'IPL' | 'KAS', period: string, monthLabel: string) => {
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
