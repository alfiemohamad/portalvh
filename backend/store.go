package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type Store struct {
	mu       sync.RWMutex
	filePath string
	pg       *sql.DB
	db       Database
}

func NewStore(filePath string) (*Store, error) {
	s := &Store{filePath: filePath}
	if err := os.MkdirAll(filepath.Dir(filePath), 0o755); err != nil {
		return nil, err
	}
	if data, err := os.ReadFile(filePath); err == nil {
		if err := json.Unmarshal(data, &s.db); err == nil && len(s.db.Facilities) > 0 {
			return s, nil
		}
	}
	s.db = seedDatabase()
	if err := s.saveLocked(); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) saveLocked() error {
	if s.pg != nil {
		return s.savePostgresLocked()
	}
	data, err := json.MarshalIndent(s.db, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, data, 0o644)
}

func seedDatabase() Database {
	now := time.Now()

	// Generate dummy Victoria Hill houses (encrypted PII, never real names)
	houses := []ResidentHouse{}
	pengurusMap := map[string]string{
		"U01": "Ketua Paguyuban",
		"U05": "Sekretaris",
		"A02": "Bendahara",
		"B03": "Koordinator Keamanan",
		"U12": "Koordinator Fasilitas",
	}
	blocks := []struct {
		prefix string
		count  int
		start  int
	}{
		{"U", 18, 1},
		{"A", 12, 1},
		{"B", 10, 1},
		{"I", 10, 1},
		{"L", 8, 1},
		{"O", 6, 1},
	}
	idx := 0
	for _, b := range blocks {
		for i := 0; i < b.count; i++ {
			num := b.start + i
			code := fmt.Sprintf("%s%02d", b.prefix, num)
			if num >= 10 {
				code = fmt.Sprintf("%s%d", b.prefix, num)
			}
			occupied := i < b.count-2
			head := ""
			phone := ""
			members := 0
			status := "Kosong"
			if occupied {
				status = "Dihuni"
				head = EncryptText(fmt.Sprintf("Penghuni Dummy %s", code))
				phone = EncryptText(fmt.Sprintf("0812-8800-%04d", 1000+idx*17))
				members = 2 + (idx % 4)
				idx++
			}
			role := pengurusMap[code]
			houses = append(houses, ResidentHouse{
				ID:         "house-" + code,
				Block:      "Blok " + b.prefix,
				Code:       code,
				HouseNo:    fmt.Sprintf("%02d", num),
				Status:     status,
				HeadOfHome: head,
				Phone:      phone,
				Members:    members,
				IsPengurus: role != "",
				Role:       role,
			})
		}
	}

	return Database{
		Announcements: []Announcement{
			{
				ID:        "ann-1",
				Title:     "Kerja Bakti & Fogging Lingkungan Victoria Hill",
				Content:   "Diberitahukan kepada seluruh warga Victoria Hill bahwa akan diadakan kerja bakti dan fogging rutin pada hari Minggu pukul 07.30 WIB. Mohon kerja sama warga untuk menjaga kebersihan selokan depan rumah.",
				Category:  "Kegiatan",
				Author:    "Pengurus Paguyuban",
				Pinned:    true,
				CreatedAt: now.Add(-18 * time.Hour),
			},
			{
				ID:        "ann-2",
				Title:     "Pembaruan Sistem Kartu Akses Gerbang Utama",
				Content:   "Pengajuan tambahan kartu akses gerbang kini dapat dilakukan langsung melalui Portal Warga Victoria Hill dengan biaya administrasi Rp 50.000 per kartu.",
				Category:  "Keamanan",
				Author:    "Koordinator Keamanan",
				Pinned:    false,
				CreatedAt: now.Add(-72 * time.Hour),
			},
		},
		Houses: houses,
		Facilities: []Facility{
			{
				ID:          "fac-basket",
				Name:        "Lapangan Basket VH",
				Category:    "Olahraga",
				Description: "Lapangan basket outdoor full-court dengan penerangan malam untuk kegiatan olahraga warga.",
				Capacity:    20,
				Status:      "Tersedia",
				ImageURL:    "/images/facility-basket.png",
				OpenHours:   "06:00 - 21:00",
			},
			{
				ID:          "fac-pool",
				Name:        "Kolam renang",
				Category:    "Olahraga",
				Description: "Kolam renang utama Victoria Hill lengkap dengan area santai dan kamar bilas.",
				Capacity:    30,
				Status:      "Tersedia",
				ImageURL:    "/images/facility-pool.png",
				OpenHours:   "06:30 - 19:00",
			},
			{
				ID:          "fac-mosque",
				Name:        "Mesjid Algulfrah",
				Category:    "Ibadah",
				Description: "Masjid lingkungan untuk kegiatan ibadah harian, pengajian rutin, dan acara keagamaan warga.",
				Capacity:    150,
				Status:      "Tersedia",
				ImageURL:    "/images/facility-mosque.png",
				OpenHours:   "04:00 - 22:00",
			},
			{
				ID:          "fac-cabanna",
				Name:        "Cabanna",
				Category:    "Sosial",
				Description: "Area kumpul dan BBQ keluarga yang nyaman untuk arisan, ulang tahun, dan pertemuan warga.",
				Capacity:    35,
				Status:      "Tersedia",
				ImageURL:    "/images/facility-cabanna.png",
				OpenHours:   "08:00 - 22:00",
			},
			{
				ID:          "fac-playground",
				Name:        "Playground",
				Category:    "Rekreasi",
				Description: "Taman bermain anak dengan area teduh dan wahana permainan ramah anak.",
				Capacity:    25,
				Status:      "Tersedia",
				ImageURL:    "/images/facility-playground.png",
				OpenHours:   "06:00 - 18:30",
			},
		},
		Bookings: []FacilityBooking{
			{
				ID:           "book-1",
				FacilityID:   "fac-cabanna",
				FacilityName: "Cabanna",
				ResidentName: "Dewi Lestari",
				HouseCode:    "U05",
				Phone:        "0812-8800-1068",
				Date:         now.AddDate(0, 0, 2).Format("2006-01-02"),
				TimeSlot:     "16:00 - 19:00",
				Purpose:      "Arisan Ibu-Ibu Blok U",
				Status:       "Disetujui",
				CreatedAt:    now.Add(-24 * time.Hour),
			},
			{
				ID:           "book-2",
				FacilityID:   "fac-basket",
				FacilityName: "Lapangan Basket VH",
				ResidentName: "Rizky Kurniawan",
				HouseCode:    "A04",
				Phone:        "0812-8800-1085",
				Date:         now.AddDate(0, 0, 3).Format("2006-01-02"),
				TimeSlot:     "07:00 - 09:00",
				Purpose:      "Sparring Basket Warga",
				Status:       "Disetujui",
				CreatedAt:    now.Add(-12 * time.Hour),
			},
		},
		Tickets: []Ticket{
			{
				ID:           "tkt-1",
				TicketNo:     "VH-2026-001",
				Category:     "Penerangan Jalan",
				Location:     "Blok U",
				ReporterName: "Budi Santoso",
				HouseCode:    "U01",
				Description:  "Lampu PJU di depan taman Blok U redup dan berkedip sejak semalam.",
				Status:       "Selesai",
				AdminNote:    "Lampu LED 40W telah diganti oleh teknisi lingkungan.",
				CreatedAt:    now.Add(-96 * time.Hour),
				UpdatedAt:    now.Add(-48 * time.Hour),
			},
			{
				ID:           "tkt-2",
				TicketNo:     "VH-2026-002",
				Category:     "Fasilitas Umum",
				Location:     "Kolam Renang",
				ReporterName: "Siti Rahmawati",
				HouseCode:    "U03",
				Description:  "Keran bilas di sisi kanan kolam renang bocor halus.",
				Status:       "Diproses",
				AdminNote:    "Teknisi dijadwalkan perbaikan besok pagi.",
				CreatedAt:    now.Add(-20 * time.Hour),
				UpdatedAt:    now.Add(-10 * time.Hour),
			},
		},
		AccessCardRequests: []AccessCardRequest{
			{
				ID:        "ac-1",
				RequestNo: "KA-2026-001",
				FullName:  "Hendra Wijaya",
				Block:     "Blok U",
				HouseNo:   "02",
				Fee:       50000,
				Status:    "Siap Diambil",
				CreatedAt: now.Add(-48 * time.Hour),
			},
		},
		Assets: []BorrowableAsset{
			{
				ID:          "ast-1",
				Name:        "Tenda Lipat 3x3m",
				Category:    "Acara",
				TotalQty:    4,
				Available:   3,
				Condition:   "Baik",
				Description: "Tenda lipat portable untuk keperluan acara keluarga atau kegiatan blok.",
			},
			{
				ID:          "ast-2",
				Name:        "Kursi Lipat Warga (Set 20 pcs)",
				Category:    "Acara",
				TotalQty:    5,
				Available:   4,
				Condition:   "Baik",
				Description: "Paket 20 kursi lipat besi untuk hajatan, pengajian, atau rapat.",
			},
			{
				ID:          "ast-3",
				Name:        "Sound System Portable + 2 Mic",
				Category:    "Elektronik",
				TotalQty:    2,
				Available:   2,
				Condition:   "Baik",
				Description: "Speaker aktif Bluetooth lengkap dengan 2 mikrofon wireless.",
			},
			{
				ID:          "ast-4",
				Name:        "Tangga Aluminium Lipat 3m",
				Category:    "Perkakas",
				TotalQty:    2,
				Available:   2,
				Condition:   "Baik",
				Description: "Tangga lipat serbaguna untuk perbaikan ringan di rumah.",
			},
		},
		AssetLoans: []AssetLoan{
			{
				ID:           "loan-1",
				AssetID:      "ast-1",
				AssetName:    "Tenda Lipat 3x3m",
				BorrowerName: "Agus Pratama",
				HouseCode:    "U04",
				Phone:        "0812-8800-1051",
				Quantity:     1,
				BorrowDate:   now.AddDate(0, 0, 1).Format("2006-01-02"),
				ReturnDate:   now.AddDate(0, 0, 2).Format("2006-01-02"),
				Status:       "Dipinjam",
				CreatedAt:    now.Add(-15 * time.Hour),
			},
		},
		Cameras: []CctvCamera{
			{ID: "cam-1", Name: "Gerbang Utama - Masuk", Area: "Gerbang Utama", Status: "Live", ImageURL: "/images/cctv-gate.png", Resolution: "1080p HD"},
			{ID: "cam-2", Name: "Kolam Renang - Sisi Utama", Area: "Kolam Renang", Status: "Live", ImageURL: "/images/cctv-pool.png", Resolution: "1080p HD"},
			{ID: "cam-3", Name: "Gerbang Utama - Keluar", Area: "Gerbang Utama", Status: "Live", ImageURL: "/images/cctv-gate.png", Resolution: "1080p HD"},
			{ID: "cam-4", Name: "Kolam Renang - Area Bilas", Area: "Kolam Renang", Status: "Live", ImageURL: "/images/cctv-pool.png", Resolution: "1080p HD"},
			{ID: "cam-5", Name: "Pos Security Gerbang", Area: "Gerbang Utama", Status: "Live", ImageURL: "/images/cctv-gate.png", Resolution: "1080p HD"},
			{ID: "cam-6", Name: "Taman & Cabanna", Area: "Kolam Renang", Status: "Live", ImageURL: "/images/cctv-pool.png", Resolution: "1080p HD"},
		},
		UmkmItems: []UmkmItem{
			{
				ID:          "umkm-1",
				Name:        "Fudgie Brownies",
				SellerName:  "Dapur Mba Nadia",
				HouseCode:   "U07",
				Category:    "Kuliner",
				Price:       65000,
				Description: "Open PO minimal 2 hari sebelum pemesanan. Menggunakan cokelat couverture premium dengan tekstur fudgy lumer.",
				WhatsApp:    "6281288001102",
				ImageURL:    "/images/umkm-brownies.png",
			},
			{
				ID:          "umkm-2",
				Name:        "Nasi Liwet & Catering Rumahan",
				SellerName:  "Warung Bu Dewi",
				HouseCode:   "U05",
				Category:    "Kuliner",
				Price:       35000,
				Description: "Terima pesanan nasi box & tumpeng mini untuk pengajian, arisan, dan acara keluarga Victoria Hill.",
				WhatsApp:    "6281288001068",
				ImageURL:    "/images/umkm-brownies.png",
			},
			{
				ID:          "umkm-3",
				Name:        "Laundry Express Antar-Jemput",
				SellerName:  "VH Clean Laundry",
				HouseCode:   "A03",
				Category:    "Jasa",
				Price:       8000,
				Description: "Cuci lipat & setrika uap khusus warga Victoria Hill, gratis antar-jemput dalam cluster.",
				WhatsApp:    "6281288001120",
				ImageURL:    "/images/gallery-2.png",
			},
		},
		Gallery: []GalleryPhoto{
			{ID: "gal-1", Title: "Jalan Santai & Hiking Pagi Warga", Date: "15 Nov 2026", Category: "Olahraga", ImageURL: "/images/gallery-1.png"},
			{ID: "gal-2", Title: "Senam & Yoga Bersama Minggu Pagi", Date: "08 Nov 2026", Category: "Kesehatan", ImageURL: "/images/gallery-2.png"},
			{ID: "gal-3", Title: "BBQ & Silaturahmi di Cabanna", Date: "25 Okt 2026", Category: "Sosial", ImageURL: "/images/facility-cabanna.png"},
			{ID: "gal-4", Title: "Turnamen Basket Persahabatan VH", Date: "12 Okt 2026", Category: "Olahraga", ImageURL: "/images/facility-basket.png"},
		},
		FinanceReports: []FinanceReport{
			{
				ID:          "rep-ipl-2026-11",
				Type:        "IPL",
				Period:      "2026-11",
				MonthLabel:  "November 2026",
				TotalIncome: 18500000,
				TotalSpend:  15200000,
				Balance:     3300000,
				PaidHouses:  28,
				TotalHouses: 30,
				Items: []FinanceItem{
					{Date: "2026-11-05", Description: "Penerimaan IPL Warga (28 Rumah)", Category: "Iuran IPL", Kind: "Masuk", Amount: 18500000},
					{Date: "2026-11-10", Description: "Gaji Tenaga Keamanan & Security (4 Personel)", Category: "Keamanan", Kind: "Keluar", Amount: 9600000},
					{Date: "2026-11-12", Description: "Pengangkutan Sampah & Kebersihan Lingkungan", Category: "Kebersihan", Kind: "Keluar", Amount: 3100000},
					{Date: "2026-11-15", Description: "Listrik PJU, Gerbang Otomatis & Pompa Kolam", Category: "Utilitas", Kind: "Keluar", Amount: 2500000},
				},
			},
			{
				ID:          "rep-ipl-2026-10",
				Type:        "IPL",
				Period:      "2026-10",
				MonthLabel:  "Oktober 2026",
				TotalIncome: 19200000,
				TotalSpend:  16100000,
				Balance:     3100000,
				PaidHouses:  30,
				TotalHouses: 30,
				Items: []FinanceItem{
					{Date: "2026-10-06", Description: "Penerimaan IPL Warga (30 Rumah)", Category: "Iuran IPL", Kind: "Masuk", Amount: 19200000},
					{Date: "2026-10-10", Description: "Gaji Tenaga Keamanan & Security", Category: "Keamanan", Kind: "Keluar", Amount: 9600000},
					{Date: "2026-10-14", Description: "Kebersihan, Taman & Fogging", Category: "Kebersihan", Kind: "Keluar", Amount: 3800000},
					{Date: "2026-10-18", Description: "Listrik & Perawatan Fasum", Category: "Utilitas", Kind: "Keluar", Amount: 2700000},
				},
			},
			{
				ID:          "rep-kas-2026-11",
				Type:        "KAS",
				Period:      "2026-11",
				MonthLabel:  "November 2026",
				TotalIncome: 6450000,
				TotalSpend:  2850000,
				Balance:     24600000,
				Items: []FinanceItem{
					{Date: "2026-11-04", Description: "Iuran KAS Warga & Donasi QRIS", Category: "KAS Warga", Kind: "Masuk", Amount: 4200000},
					{Date: "2026-11-07", Description: "Infaq KAS Mesjid Algulfrah", Category: "KAS Mesjid", Kind: "Masuk", Amount: 2250000},
					{Date: "2026-11-11", Description: "Konsumsi Pengajian & Kerja Bakti", Category: "Kegiatan Sosial", Kind: "Keluar", Amount: 1450000},
					{Date: "2026-11-16", Description: "Santunan & Dana Sosial Warga", Category: "Sosial", Kind: "Keluar", Amount: 1400000},
				},
			},
		},
		PanicAlerts: []PanicAlert{},
		Contacts: []PengurusContact{
			{ID: "ct-1", Name: "Budi Santoso", Position: "Ketua Paguyuban Victoria Hill", House: "Blok U01", Phone: "0812-8800-1000", WhatsApp: "6281288001000"},
			{ID: "ct-2", Name: "Hendra Wijaya", Position: "Sekretaris Paguyuban", House: "Blok U05", Phone: "0812-8800-1017", WhatsApp: "6281288001017"},
			{ID: "ct-3", Name: "Dewi Lestari", Position: "Bendahara IPL & KAS", House: "Blok A02", Phone: "0812-8800-1034", WhatsApp: "6281288001034"},
			{ID: "ct-4", Name: "Pos Security Gerbang Utama", Position: "Keamanan 24 Jam (Darurat)", House: "Gerbang Utama", Phone: "0811-9000-2424", WhatsApp: "6281190002424"},
		},
	}
}
