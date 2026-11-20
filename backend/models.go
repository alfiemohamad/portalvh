package main

import "time"

type Announcement struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	Category  string    `json:"category"` // "Umum", "Keamanan", "Kegiatan", "Iuran"
	Author    string    `json:"author"`
	Pinned    bool      `json:"pinned"`
	CreatedAt time.Time `json:"created_at"`
}

type ResidentHouse struct {
	ID           string `json:"id"`
	Block        string `json:"block"`      // e.g. "U", "A", "B", "C"
	Code         string `json:"code"`       // e.g. "U16", "A01"
	HouseNo      string `json:"house_no"`   // e.g. "16"
	Status       string `json:"status"`     // "Dihuni" or "Kosong"
	HeadOfHome   string `json:"head_of_home"`
	Phone        string `json:"phone"`
	Members      int    `json:"members"`
	IsPengurus   bool   `json:"is_pengurus"`
	Role         string `json:"role,omitempty"`
	PasswordHash string `json:"-"` // Future-ready: per-house bcrypt password hash (kosong = pakai RESIDENT_PASSWORD bersama di MVP)
}

// UserAccount disiapkan untuk manajemen akun multi-role (admin, bendahara, keamanan, warga) di fase lanjutan.
type UserAccount struct {
	ID           string    `json:"id"`
	HouseID      string    `json:"house_id,omitempty"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	FullName     string    `json:"full_name"`
	Role         string    `json:"role"` // "Warga" | "Pengurus" | "Bendahara" | "Keamanan"
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
}

// UserSession menyimpan sesi login persisten (token disimpan dalam bentuk SHA-256 hash).
type UserSession struct {
	TokenHash string    `json:"token_hash"`
	Username  string    `json:"username"`
	Name      string    `json:"name"`
	Role      string    `json:"role"`
	HouseCode string    `json:"house_code"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

type Facility struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Category    string `json:"category"`
	Description string `json:"description"`
	Capacity    int    `json:"capacity"`
	Status      string `json:"status"` // "Tersedia", "Pemeliharaan"
	ImageURL    string `json:"image_url"`
	OpenHours   string `json:"open_hours"`
}

type FacilityBooking struct {
	ID           string    `json:"id"`
	FacilityID   string    `json:"facility_id"`
	FacilityName string    `json:"facility_name"`
	ResidentName string    `json:"resident_name"`
	HouseCode    string    `json:"house_code"`
	Phone        string    `json:"phone"`
	Date         string    `json:"date"`       // YYYY-MM-DD
	TimeSlot     string    `json:"time_slot"`  // e.g. "08:00 - 10:00"
	Purpose      string    `json:"purpose"`
	Status       string    `json:"status"` // "Menunggu", "Disetujui", "Ditolak"
	CreatedAt    time.Time `json:"created_at"`
}

type Ticket struct {
	ID           string    `json:"id"`
	TicketNo     string    `json:"ticket_no"`
	Category     string    `json:"category"`
	Location     string    `json:"location"`
	ReporterName string    `json:"reporter_name"`
	HouseCode    string    `json:"house_code,omitempty"`
	Description  string    `json:"description"`
	PhotoURL     string    `json:"photo_url,omitempty"`
	Status       string    `json:"status"` // "Open", "Diproses", "Selesai"
	AdminNote    string    `json:"admin_note,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type AccessCardRequest struct {
	ID           string    `json:"id"`
	RequestNo    string    `json:"request_no"`
	FullName     string    `json:"full_name"`
	Block        string    `json:"block"`
	HouseNo      string    `json:"house_no"`
	StnkPhotoURL string    `json:"stnk_photo_url,omitempty"`
	Fee          int       `json:"fee"`
	Status       string    `json:"status"` // "Menunggu Verifikasi", "Diproses", "Siap Diambil", "Ditolak"
	CreatedAt    time.Time `json:"created_at"`
}

type BorrowableAsset struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Category    string `json:"category"`
	TotalQty    int    `json:"total_qty"`
	Available   int    `json:"available"`
	Condition   string `json:"condition"`
	Description string `json:"description"`
}

type AssetLoan struct {
	ID           string    `json:"id"`
	AssetID      string    `json:"asset_id"`
	AssetName    string    `json:"asset_name"`
	BorrowerName string    `json:"borrower_name"`
	HouseCode    string    `json:"house_code"`
	Phone        string    `json:"phone"`
	Quantity     int       `json:"quantity"`
	BorrowDate   string    `json:"borrow_date"`
	ReturnDate   string    `json:"return_date"`
	Status       string    `json:"status"` // "Menunggu", "Dipinjam", "Dikembalikan", "Ditolak"
	CreatedAt    time.Time `json:"created_at"`
}

type CctvCamera struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Area     string `json:"area"` // "Gerbang Utama", "Kolam Renang", "Taman & Playground", "Jalan Utama"
	Status   string `json:"status"`
	ImageURL string `json:"image_url"`
	Resolution string `json:"resolution"`
}

type UmkmItem struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	SellerName  string `json:"seller_name"`
	HouseCode   string `json:"house_code"`
	Category    string `json:"category"`
	Price       int    `json:"price"`
	Description string `json:"description"`
	WhatsApp    string `json:"whatsapp"`
	ImageURL    string `json:"image_url"`
}

type GalleryPhoto struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Date     string `json:"date"`
	Category string `json:"category"`
	ImageURL string `json:"image_url"`
}

type ActivityReport struct {
	ID           string    `json:"id"`
	Title        string    `json:"title"`
	Category     string    `json:"category"` // "Olahraga", "Kesehatan", "Sosial", "Keagamaan", "Kerja Bakti"
	ActivityDate string    `json:"activity_date"` // YYYY-MM-DD
	Location     string    `json:"location"`
	Summary      string    `json:"summary"`
	BudgetUsed   int       `json:"budget_used"`
	ImageURL     string    `json:"image_url"`
	Author       string    `json:"author"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type FinanceReport struct {
	ID             string        `json:"id"`
	Type           string        `json:"type"` // "IPL", "KAS_WARGA", "KAS_MESJID" (legacy "KAS" tetap didukung)
	Period         string        `json:"period"`
	MonthLabel     string        `json:"month_label"`
	OpeningBalance int           `json:"opening_balance"`
	TotalIncome    int           `json:"total_income"`
	TotalSpend     int           `json:"total_spend"`
	Balance        int           `json:"balance"`
	PaidHouses     int           `json:"paid_houses,omitempty"`
	TotalHouses    int           `json:"total_houses,omitempty"`
	Notes          string        `json:"notes,omitempty"`
	Items          []FinanceItem `json:"items"`
}

type FinanceItem struct {
	ID          string `json:"id"`
	Date        string `json:"date"`
	Description string `json:"description"`
	Category    string `json:"category"`
	Kind        string `json:"kind"` // "Masuk" or "Keluar"
	Amount      int    `json:"amount"`
}

type KasPaymentSubmission struct {
	ID           string    `json:"id"`
	FundType     string    `json:"fund_type"`    // "KAS_WARGA" | "KAS_MESJID"
	Period       string    `json:"period"`       // YYYY-MM
	PayerName    string    `json:"payer_name"`
	HouseCode    string    `json:"house_code"`
	Amount       int       `json:"amount"`
	PaymentDate  string    `json:"payment_date"` // YYYY-MM-DD
	Note         string    `json:"note"`
	ProofURL     string    `json:"proof_url"`
	Status       string    `json:"status"` // "Menunggu Verifikasi" | "Disetujui" | "Ditolak"
	AdminNote    string    `json:"admin_note,omitempty"`
	FinanceRefID string    `json:"finance_ref_id,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type PanicAlert struct {
	ID           string    `json:"id"`
	ReporterName string    `json:"reporter_name"`
	HouseCode    string    `json:"house_code"`
	Category     string    `json:"category"` // "Keamanan", "Medis", "Kebakaran", "Lainnya"
	Note         string    `json:"note"`
	Status       string    `json:"status"` // "Aktif", "Ditangani"
	CreatedAt    time.Time `json:"created_at"`
}

type PengurusContact struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Position string `json:"position"`
	House    string `json:"house"`
	Phone    string `json:"phone"`
	WhatsApp string `json:"whatsapp"`
}

type AuditLog struct {
	ID        string    `json:"id"`
	ActorName string    `json:"actor_name"`
	ActorRole string    `json:"actor_role"` // "Warga" | "Pengurus" | "Sistem"
	HouseCode string    `json:"house_code"`
	Action    string    `json:"action"`
	Target    string    `json:"target"`
	Details   string    `json:"details"`
	IPAddress string    `json:"ip_address"`
	CreatedAt time.Time `json:"created_at"`
}

type Database struct {
	Announcements      []Announcement      `json:"announcements"`
	Houses             []ResidentHouse     `json:"houses"`
	Facilities         []Facility          `json:"facilities"`
	Bookings           []FacilityBooking   `json:"bookings"`
	Tickets            []Ticket            `json:"tickets"`
	AccessCardRequests []AccessCardRequest `json:"access_card_requests"`
	Assets             []BorrowableAsset   `json:"assets"`
	AssetLoans         []AssetLoan         `json:"asset_loans"`
	Cameras            []CctvCamera        `json:"cameras"`
	UmkmItems          []UmkmItem          `json:"umkm_items"`
	Gallery            []GalleryPhoto      `json:"gallery"`
	ActivityReports    []ActivityReport       `json:"activity_reports"`
	FinanceReports     []FinanceReport        `json:"finance_reports"`
	KasPayments        []KasPaymentSubmission `json:"kas_payments"`
	PanicAlerts        []PanicAlert           `json:"panic_alerts"`
	Contacts           []PengurusContact   `json:"contacts"`
	AuditLogs          []AuditLog          `json:"audit_logs"`
	Users              []UserAccount       `json:"users,omitempty"`
	Sessions           []UserSession       `json:"sessions,omitempty"`
}
