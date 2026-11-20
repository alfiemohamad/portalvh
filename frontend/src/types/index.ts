export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: string;
  author: string;
  pinned: boolean;
  created_at: string;
}

export interface ResidentHouse {
  id: string;
  block: string;
  code: string;
  house_no: string;
  status: 'Dihuni' | 'Kosong';
  head_of_home: string;
  phone: string;
  members: number;
  is_pengurus: boolean;
  role?: string;
}

export interface Facility {
  id: string;
  name: string;
  category: string;
  description: string;
  capacity: number;
  status: string;
  image_url: string;
  open_hours: string;
}

export interface FacilityBooking {
  id: string;
  facility_id: string;
  facility_name: string;
  resident_name: string;
  house_code: string;
  phone: string;
  date: string;
  time_slot: string;
  purpose: string;
  status: string;
  created_at: string;
}

export interface Ticket {
  id: string;
  ticket_no: string;
  category: string;
  location: string;
  reporter_name: string;
  house_code?: string;
  description: string;
  photo_url?: string;
  status: 'Open' | 'Diproses' | 'Selesai';
  admin_note?: string;
  created_at: string;
  updated_at: string;
}

export interface AccessCardRequest {
  id: string;
  request_no: string;
  full_name: string;
  block: string;
  house_no: string;
  stnk_photo_url?: string;
  fee: number;
  status: string;
  created_at: string;
}

export interface BorrowableAsset {
  id: string;
  name: string;
  category: string;
  total_qty: number;
  available: number;
  condition: string;
  description: string;
}

export interface AssetLoan {
  id: string;
  asset_id: string;
  asset_name: string;
  borrower_name: string;
  house_code: string;
  phone: string;
  quantity: number;
  borrow_date: string;
  return_date: string;
  status: string;
  created_at: string;
}

export interface CctvCamera {
  id: string;
  name: string;
  area: string;
  status: string;
  image_url: string;
  resolution: string;
}

export interface UmkmItem {
  id: string;
  name: string;
  seller_name: string;
  house_code: string;
  category: string;
  price: number;
  description: string;
  whatsapp: string;
  image_url: string;
}

export interface GalleryPhoto {
  id: string;
  title: string;
  date: string;
  category: string;
  image_url: string;
}

export interface ActivityReport {
  id: string;
  title: string;
  category: string;
  activity_date: string;
  location: string;
  summary: string;
  budget_used: number;
  image_url: string;
  author: string;
  created_at: string;
  updated_at: string;
}

export interface FinanceItem {
  id: string;
  date: string;
  description: string;
  category: string;
  kind: 'Masuk' | 'Keluar';
  amount: number;
}

export type FinanceFundType = 'IPL' | 'KAS' | 'KAS_WARGA' | 'KAS_MESJID';

export interface FinanceReport {
  id: string;
  type: FinanceFundType;
  period: string;
  month_label: string;
  opening_balance: number;
  total_income: number;
  total_spend: number;
  balance: number;
  paid_houses?: number;
  total_houses?: number;
  notes?: string;
  items: FinanceItem[];
}

export interface EnvSettings {
  bank_name: string;
  account_number: string;
  account_holder: string;
  access_card_fee: number;
  security_whatsapp: string;
}

export interface KasPaymentSubmission {
  id: string;
  fund_type: 'KAS_WARGA' | 'KAS_MESJID';
  period: string;
  payer_name: string;
  house_code: string;
  amount: number;
  payment_date: string;
  note: string;
  proof_url: string;
  status: 'Menunggu Verifikasi' | 'Disetujui' | 'Ditolak';
  admin_note?: string;
  finance_ref_id?: string;
  created_at: string;
  updated_at: string;
}

export interface PanicAlert {
  id: string;
  reporter_name: string;
  house_code: string;
  category: string;
  note: string;
  status: string;
  created_at: string;
}

export interface PengurusContact {
  id: string;
  name: string;
  position: string;
  house: string;
  phone: string;
  whatsapp: string;
}

export interface SessionUser {
  username: string;
  name: string;
  role: 'Warga' | 'Pengurus' | 'Bendahara' | 'Keamanan' | 'Admin';
  house_code: string;
  permissions?: string[];
}

export interface AuditLog {
  id: string;
  actor_name: string;
  actor_role: string;
  house_code: string;
  action: string;
  target: string;
  details: string;
  ip_address: string;
  created_at: string;
}

export interface DashboardData {
  announcements: Announcement[];
  gallery: GalleryPhoto[];
  activities?: ActivityReport[];
  umkm: UmkmItem[];
  contacts: PengurusContact[];
  finance_summary?: {
    ipl?: FinanceReport | null;
    kas_warga?: FinanceReport | null;
    kas_mesjid?: FinanceReport | null;
  };
  stats: {
    total_houses: number;
    occupied_houses: number;
    vacant_houses: number;
    facilities: number;
    open_tickets: number;
    done_tickets: number;
    active_panics: number;
  };
}
