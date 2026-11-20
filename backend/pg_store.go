package main

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "github.com/lib/pq"
)

func initPostgresSchema(db *sql.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS announcements (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			content TEXT NOT NULL,
			category TEXT NOT NULL,
			author TEXT NOT NULL,
			pinned BOOLEAN NOT NULL DEFAULT FALSE,
			created_at TIMESTAMPTZ NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS resident_houses (
			id TEXT PRIMARY KEY,
			block TEXT NOT NULL,
			code TEXT NOT NULL,
			house_no TEXT NOT NULL,
			status TEXT NOT NULL,
			head_of_home TEXT NOT NULL DEFAULT '',
			phone TEXT NOT NULL DEFAULT '',
			members INT NOT NULL DEFAULT 0,
			is_pengurus BOOLEAN NOT NULL DEFAULT FALSE,
			role TEXT NOT NULL DEFAULT ''
		);`,
		`CREATE TABLE IF NOT EXISTS facilities (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			category TEXT NOT NULL,
			description TEXT NOT NULL,
			capacity INT NOT NULL,
			status TEXT NOT NULL,
			image_url TEXT NOT NULL,
			open_hours TEXT NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS facility_bookings (
			id TEXT PRIMARY KEY,
			facility_id TEXT NOT NULL,
			facility_name TEXT NOT NULL,
			resident_name TEXT NOT NULL,
			house_code TEXT NOT NULL,
			phone TEXT NOT NULL,
			date TEXT NOT NULL,
			time_slot TEXT NOT NULL,
			purpose TEXT NOT NULL,
			status TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS tickets (
			id TEXT PRIMARY KEY,
			ticket_no TEXT NOT NULL,
			category TEXT NOT NULL,
			location TEXT NOT NULL,
			reporter_name TEXT NOT NULL,
			house_code TEXT NOT NULL DEFAULT '',
			description TEXT NOT NULL,
			photo_url TEXT NOT NULL DEFAULT '',
			status TEXT NOT NULL,
			admin_note TEXT NOT NULL DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS access_card_requests (
			id TEXT PRIMARY KEY,
			request_no TEXT NOT NULL,
			full_name TEXT NOT NULL,
			block TEXT NOT NULL,
			house_no TEXT NOT NULL,
			stnk_photo_url TEXT NOT NULL DEFAULT '',
			fee INT NOT NULL,
			status TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS borrowable_assets (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			category TEXT NOT NULL,
			total_qty INT NOT NULL,
			available INT NOT NULL,
			condition TEXT NOT NULL,
			description TEXT NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS asset_loans (
			id TEXT PRIMARY KEY,
			asset_id TEXT NOT NULL,
			asset_name TEXT NOT NULL,
			borrower_name TEXT NOT NULL,
			house_code TEXT NOT NULL,
			phone TEXT NOT NULL,
			quantity INT NOT NULL,
			borrow_date TEXT NOT NULL,
			return_date TEXT NOT NULL,
			status TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS cctv_cameras (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			area TEXT NOT NULL,
			status TEXT NOT NULL,
			image_url TEXT NOT NULL,
			resolution TEXT NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS umkm_items (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			seller_name TEXT NOT NULL,
			house_code TEXT NOT NULL,
			category TEXT NOT NULL,
			price INT NOT NULL,
			description TEXT NOT NULL,
			whatsapp TEXT NOT NULL,
			image_url TEXT NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS gallery_photos (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			date TEXT NOT NULL,
			category TEXT NOT NULL,
			image_url TEXT NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS finance_reports (
			id TEXT PRIMARY KEY,
			type TEXT NOT NULL,
			period TEXT NOT NULL,
			month_label TEXT NOT NULL,
			total_income INT NOT NULL,
			total_spend INT NOT NULL,
			balance INT NOT NULL,
			paid_houses INT NOT NULL DEFAULT 0,
			total_houses INT NOT NULL DEFAULT 0
		);`,
		`CREATE TABLE IF NOT EXISTS finance_items (
			id SERIAL PRIMARY KEY,
			report_id TEXT NOT NULL REFERENCES finance_reports(id) ON DELETE CASCADE,
			date TEXT NOT NULL,
			description TEXT NOT NULL,
			category TEXT NOT NULL,
			kind TEXT NOT NULL,
			amount INT NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS panic_alerts (
			id TEXT PRIMARY KEY,
			reporter_name TEXT NOT NULL,
			house_code TEXT NOT NULL,
			category TEXT NOT NULL,
			note TEXT NOT NULL,
			status TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS pengurus_contacts (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			position TEXT NOT NULL,
			house TEXT NOT NULL,
			phone TEXT NOT NULL,
			whatsapp TEXT NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS audit_logs (
			id TEXT PRIMARY KEY,
			actor_name TEXT NOT NULL,
			actor_role TEXT NOT NULL,
			house_code TEXT NOT NULL DEFAULT '',
			action TEXT NOT NULL,
			target TEXT NOT NULL,
			details TEXT NOT NULL DEFAULT '',
			ip_address TEXT NOT NULL DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS activity_reports (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			category TEXT NOT NULL,
			activity_date TEXT NOT NULL,
			location TEXT NOT NULL DEFAULT '',
			summary TEXT NOT NULL,
			budget_used INT NOT NULL DEFAULT 0,
			image_url TEXT NOT NULL DEFAULT '',
			author TEXT NOT NULL DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			house_id TEXT NOT NULL DEFAULT '',
			username TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			full_name TEXT NOT NULL,
			role TEXT NOT NULL,
			is_active BOOLEAN NOT NULL DEFAULT TRUE,
			created_at TIMESTAMPTZ NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS user_sessions (
			token_hash TEXT PRIMARY KEY,
			username TEXT NOT NULL,
			name TEXT NOT NULL,
			role TEXT NOT NULL,
			house_code TEXT NOT NULL DEFAULT '',
			expires_at TIMESTAMPTZ NOT NULL,
			created_at TIMESTAMPTZ NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS kas_payments (
			id TEXT PRIMARY KEY,
			fund_type TEXT NOT NULL,
			period TEXT NOT NULL,
			payer_name TEXT NOT NULL,
			house_code TEXT NOT NULL,
			amount INT NOT NULL,
			payment_date TEXT NOT NULL,
			note TEXT NOT NULL DEFAULT '',
			proof_url TEXT NOT NULL DEFAULT '',
			status TEXT NOT NULL,
			admin_note TEXT NOT NULL DEFAULT '',
			finance_ref_id TEXT NOT NULL DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL
		);`,
		// Migrasi aman untuk database existing
		`ALTER TABLE resident_houses ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT '';`,
		`ALTER TABLE finance_reports ADD COLUMN IF NOT EXISTS opening_balance INT NOT NULL DEFAULT 0;`,
		`ALTER TABLE finance_reports ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';`,
		`ALTER TABLE finance_items ADD COLUMN IF NOT EXISTS item_id TEXT NOT NULL DEFAULT '';`,
	}

	for _, stmt := range stmts {
		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("schema exec failed: %w", err)
		}
	}
	return nil
}

func NewPostgresStore(dsn string) (*Store, error) {
	pg, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}
	if err := pg.Ping(); err != nil {
		return nil, fmt.Errorf("gagal koneksi PostgreSQL: %w", err)
	}
	if err := initPostgresSchema(pg); err != nil {
		return nil, err
	}

	s := &Store{pg: pg}

	var count int
	if err := pg.QueryRow(`SELECT COUNT(*) FROM facilities`).Scan(&count); err != nil {
		return nil, err
	}

	if count == 0 {
		log.Println("Database PostgreSQL kosong, melakukan seeding data awal Victoria Hill...")
		s.db = seedDatabase()
		if err := s.savePostgresLocked(); err != nil {
			return nil, err
		}
	} else {
		if err := s.loadFromPostgres(); err != nil {
			return nil, err
		}
	}

	return s, nil
}

func (s *Store) loadFromPostgres() error {
	var db Database

	// Announcements
	rows, err := s.pg.Query(`SELECT id, title, content, category, author, pinned, created_at FROM announcements ORDER BY created_at DESC`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var a Announcement
		if err := rows.Scan(&a.ID, &a.Title, &a.Content, &a.Category, &a.Author, &a.Pinned, &a.CreatedAt); err != nil {
			rows.Close()
			return err
		}
		db.Announcements = append(db.Announcements, a)
	}
	rows.Close()

	// Houses
	rows, err = s.pg.Query(`SELECT id, block, code, house_no, status, head_of_home, phone, members, is_pengurus, role, password_hash FROM resident_houses ORDER BY code ASC`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var h ResidentHouse
		if err := rows.Scan(&h.ID, &h.Block, &h.Code, &h.HouseNo, &h.Status, &h.HeadOfHome, &h.Phone, &h.Members, &h.IsPengurus, &h.Role, &h.PasswordHash); err != nil {
			rows.Close()
			return err
		}
		db.Houses = append(db.Houses, h)
	}
	rows.Close()

	// Facilities
	rows, err = s.pg.Query(`SELECT id, name, category, description, capacity, status, image_url, open_hours FROM facilities`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var f Facility
		if err := rows.Scan(&f.ID, &f.Name, &f.Category, &f.Description, &f.Capacity, &f.Status, &f.ImageURL, &f.OpenHours); err != nil {
			rows.Close()
			return err
		}
		db.Facilities = append(db.Facilities, f)
	}
	rows.Close()

	// Bookings
	rows, err = s.pg.Query(`SELECT id, facility_id, facility_name, resident_name, house_code, phone, date, time_slot, purpose, status, created_at FROM facility_bookings ORDER BY created_at DESC`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var b FacilityBooking
		if err := rows.Scan(&b.ID, &b.FacilityID, &b.FacilityName, &b.ResidentName, &b.HouseCode, &b.Phone, &b.Date, &b.TimeSlot, &b.Purpose, &b.Status, &b.CreatedAt); err != nil {
			rows.Close()
			return err
		}
		db.Bookings = append(db.Bookings, b)
	}
	rows.Close()

	// Tickets
	rows, err = s.pg.Query(`SELECT id, ticket_no, category, location, reporter_name, house_code, description, photo_url, status, admin_note, created_at, updated_at FROM tickets ORDER BY created_at DESC`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var t Ticket
		if err := rows.Scan(&t.ID, &t.TicketNo, &t.Category, &t.Location, &t.ReporterName, &t.HouseCode, &t.Description, &t.PhotoURL, &t.Status, &t.AdminNote, &t.CreatedAt, &t.UpdatedAt); err != nil {
			rows.Close()
			return err
		}
		db.Tickets = append(db.Tickets, t)
	}
	rows.Close()

	// Access cards
	rows, err = s.pg.Query(`SELECT id, request_no, full_name, block, house_no, stnk_photo_url, fee, status, created_at FROM access_card_requests ORDER BY created_at DESC`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var c AccessCardRequest
		if err := rows.Scan(&c.ID, &c.RequestNo, &c.FullName, &c.Block, &c.HouseNo, &c.StnkPhotoURL, &c.Fee, &c.Status, &c.CreatedAt); err != nil {
			rows.Close()
			return err
		}
		db.AccessCardRequests = append(db.AccessCardRequests, c)
	}
	rows.Close()

	// Assets
	rows, err = s.pg.Query(`SELECT id, name, category, total_qty, available, condition, description FROM borrowable_assets`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var a BorrowableAsset
		if err := rows.Scan(&a.ID, &a.Name, &a.Category, &a.TotalQty, &a.Available, &a.Condition, &a.Description); err != nil {
			rows.Close()
			return err
		}
		db.Assets = append(db.Assets, a)
	}
	rows.Close()

	// Asset loans
	rows, err = s.pg.Query(`SELECT id, asset_id, asset_name, borrower_name, house_code, phone, quantity, borrow_date, return_date, status, created_at FROM asset_loans ORDER BY created_at DESC`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var l AssetLoan
		if err := rows.Scan(&l.ID, &l.AssetID, &l.AssetName, &l.BorrowerName, &l.HouseCode, &l.Phone, &l.Quantity, &l.BorrowDate, &l.ReturnDate, &l.Status, &l.CreatedAt); err != nil {
			rows.Close()
			return err
		}
		db.AssetLoans = append(db.AssetLoans, l)
	}
	rows.Close()

	// CCTV
	rows, err = s.pg.Query(`SELECT id, name, area, status, image_url, resolution FROM cctv_cameras`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var c CctvCamera
		if err := rows.Scan(&c.ID, &c.Name, &c.Area, &c.Status, &c.ImageURL, &c.Resolution); err != nil {
			rows.Close()
			return err
		}
		db.Cameras = append(db.Cameras, c)
	}
	rows.Close()

	// UMKM
	rows, err = s.pg.Query(`SELECT id, name, seller_name, house_code, category, price, description, whatsapp, image_url FROM umkm_items`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var u UmkmItem
		if err := rows.Scan(&u.ID, &u.Name, &u.SellerName, &u.HouseCode, &u.Category, &u.Price, &u.Description, &u.WhatsApp, &u.ImageURL); err != nil {
			rows.Close()
			return err
		}
		db.UmkmItems = append(db.UmkmItems, u)
	}
	rows.Close()

	// Gallery
	rows, err = s.pg.Query(`SELECT id, title, date, category, image_url FROM gallery_photos`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var g GalleryPhoto
		if err := rows.Scan(&g.ID, &g.Title, &g.Date, &g.Category, &g.ImageURL); err != nil {
			rows.Close()
			return err
		}
		db.Gallery = append(db.Gallery, g)
	}
	rows.Close()

	// Finance reports + items
	rows, err = s.pg.Query(`SELECT id, type, period, month_label, opening_balance, total_income, total_spend, balance, paid_houses, total_houses, notes FROM finance_reports ORDER BY period DESC`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var r FinanceReport
		if err := rows.Scan(&r.ID, &r.Type, &r.Period, &r.MonthLabel, &r.OpeningBalance, &r.TotalIncome, &r.TotalSpend, &r.Balance, &r.PaidHouses, &r.TotalHouses, &r.Notes); err != nil {
			rows.Close()
			return err
		}
		db.FinanceReports = append(db.FinanceReports, r)
	}
	rows.Close()

	for i := range db.FinanceReports {
		itemRows, err := s.pg.Query(`SELECT item_id, date, description, category, kind, amount FROM finance_items WHERE report_id = $1 ORDER BY id ASC`, db.FinanceReports[i].ID)
		if err != nil {
			return err
		}
		for itemRows.Next() {
			var it FinanceItem
			if err := itemRows.Scan(&it.ID, &it.Date, &it.Description, &it.Category, &it.Kind, &it.Amount); err != nil {
				itemRows.Close()
				return err
			}
			if it.ID == "" {
				it.ID = generateID("tx")
			}
			db.FinanceReports[i].Items = append(db.FinanceReports[i].Items, it)
		}
		itemRows.Close()
	}

	// Activity reports
	rows, err = s.pg.Query(`SELECT id, title, category, activity_date, location, summary, budget_used, image_url, author, created_at, updated_at FROM activity_reports ORDER BY activity_date DESC, created_at DESC`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var ar ActivityReport
		if err := rows.Scan(&ar.ID, &ar.Title, &ar.Category, &ar.ActivityDate, &ar.Location, &ar.Summary, &ar.BudgetUsed, &ar.ImageURL, &ar.Author, &ar.CreatedAt, &ar.UpdatedAt); err != nil {
			rows.Close()
			return err
		}
		db.ActivityReports = append(db.ActivityReports, ar)
	}
	rows.Close()
	if len(db.ActivityReports) == 0 {
		// Migrasi awal jika DB existing belum memiliki activity_reports
		db.ActivityReports = seedDatabase().ActivityReports
	}

	// Users (future-ready multi-role / per-resident accounts)
	rows, err = s.pg.Query(`SELECT id, house_id, username, password_hash, full_name, role, is_active, created_at FROM users`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var u UserAccount
		if err := rows.Scan(&u.ID, &u.HouseID, &u.Username, &u.PasswordHash, &u.FullName, &u.Role, &u.IsActive, &u.CreatedAt); err != nil {
			rows.Close()
			return err
		}
		db.Users = append(db.Users, u)
	}
	rows.Close()

	// Kas payments
	rows, err = s.pg.Query(`SELECT id, fund_type, period, payer_name, house_code, amount, payment_date, note, proof_url, status, admin_note, finance_ref_id, created_at, updated_at FROM kas_payments ORDER BY created_at DESC`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var kp KasPaymentSubmission
		if err := rows.Scan(&kp.ID, &kp.FundType, &kp.Period, &kp.PayerName, &kp.HouseCode, &kp.Amount, &kp.PaymentDate, &kp.Note, &kp.ProofURL, &kp.Status, &kp.AdminNote, &kp.FinanceRefID, &kp.CreatedAt, &kp.UpdatedAt); err != nil {
			rows.Close()
			return err
		}
		db.KasPayments = append(db.KasPayments, kp)
	}
	rows.Close()

	// Sessions (hanya yang belum kedaluwarsa)
	rows, err = s.pg.Query(`SELECT token_hash, username, name, role, house_code, expires_at, created_at FROM user_sessions WHERE expires_at > NOW()`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var sess UserSession
		if err := rows.Scan(&sess.TokenHash, &sess.Username, &sess.Name, &sess.Role, &sess.HouseCode, &sess.ExpiresAt, &sess.CreatedAt); err != nil {
			rows.Close()
			return err
		}
		db.Sessions = append(db.Sessions, sess)
	}
	rows.Close()

	// Panic alerts
	rows, err = s.pg.Query(`SELECT id, reporter_name, house_code, category, note, status, created_at FROM panic_alerts ORDER BY created_at DESC`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var p PanicAlert
		if err := rows.Scan(&p.ID, &p.ReporterName, &p.HouseCode, &p.Category, &p.Note, &p.Status, &p.CreatedAt); err != nil {
			rows.Close()
			return err
		}
		db.PanicAlerts = append(db.PanicAlerts, p)
	}
	rows.Close()

	// Contacts
	rows, err = s.pg.Query(`SELECT id, name, position, house, phone, whatsapp FROM pengurus_contacts`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var c PengurusContact
		if err := rows.Scan(&c.ID, &c.Name, &c.Position, &c.House, &c.Phone, &c.WhatsApp); err != nil {
			rows.Close()
			return err
		}
		db.Contacts = append(db.Contacts, c)
	}
	rows.Close()

	// Audit Logs
	rows, err = s.pg.Query(`SELECT id, actor_name, actor_role, house_code, action, target, details, ip_address, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 500`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var l AuditLog
		if err := rows.Scan(&l.ID, &l.ActorName, &l.ActorRole, &l.HouseCode, &l.Action, &l.Target, &l.Details, &l.IPAddress, &l.CreatedAt); err != nil {
			rows.Close()
			return err
		}
		db.AuditLogs = append(db.AuditLogs, l)
	}
	rows.Close()

	s.db = db
	return nil
}

func (s *Store) savePostgresLocked() error {
	tx, err := s.pg.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	tables := []string{
		"finance_items", "finance_reports", "kas_payments", "announcements", "resident_houses",
		"facilities", "facility_bookings", "tickets", "access_card_requests",
		"borrowable_assets", "asset_loans", "cctv_cameras", "umkm_items",
		"gallery_photos", "activity_reports", "panic_alerts", "pengurus_contacts",
		"audit_logs", "users",
	}
	for _, tbl := range tables {
		if _, err := tx.Exec("DELETE FROM " + tbl); err != nil {
			return err
		}
	}

	for _, a := range s.db.Announcements {
		if _, err := tx.Exec(`INSERT INTO announcements (id, title, content, category, author, pinned, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
			a.ID, a.Title, a.Content, a.Category, a.Author, a.Pinned, a.CreatedAt); err != nil {
			return err
		}
	}
	for _, h := range s.db.Houses {
		encHead := EncryptText(DecryptText(h.HeadOfHome))
		encPhone := EncryptText(DecryptText(h.Phone))
		if _, err := tx.Exec(`INSERT INTO resident_houses (id, block, code, house_no, status, head_of_home, phone, members, is_pengurus, role, password_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
			h.ID, h.Block, h.Code, h.HouseNo, h.Status, encHead, encPhone, h.Members, h.IsPengurus, h.Role, h.PasswordHash); err != nil {
			return err
		}
	}
	for _, f := range s.db.Facilities {
		if _, err := tx.Exec(`INSERT INTO facilities (id, name, category, description, capacity, status, image_url, open_hours) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
			f.ID, f.Name, f.Category, f.Description, f.Capacity, f.Status, f.ImageURL, f.OpenHours); err != nil {
			return err
		}
	}
	for _, b := range s.db.Bookings {
		if _, err := tx.Exec(`INSERT INTO facility_bookings (id, facility_id, facility_name, resident_name, house_code, phone, date, time_slot, purpose, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
			b.ID, b.FacilityID, b.FacilityName, b.ResidentName, b.HouseCode, b.Phone, b.Date, b.TimeSlot, b.Purpose, b.Status, b.CreatedAt); err != nil {
			return err
		}
	}
	for _, t := range s.db.Tickets {
		if _, err := tx.Exec(`INSERT INTO tickets (id, ticket_no, category, location, reporter_name, house_code, description, photo_url, status, admin_note, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
			t.ID, t.TicketNo, t.Category, t.Location, t.ReporterName, t.HouseCode, t.Description, t.PhotoURL, t.Status, t.AdminNote, t.CreatedAt, t.UpdatedAt); err != nil {
			return err
		}
	}
	for _, c := range s.db.AccessCardRequests {
		if _, err := tx.Exec(`INSERT INTO access_card_requests (id, request_no, full_name, block, house_no, stnk_photo_url, fee, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
			c.ID, c.RequestNo, c.FullName, c.Block, c.HouseNo, c.StnkPhotoURL, c.Fee, c.Status, c.CreatedAt); err != nil {
			return err
		}
	}
	for _, a := range s.db.Assets {
		if _, err := tx.Exec(`INSERT INTO borrowable_assets (id, name, category, total_qty, available, condition, description) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
			a.ID, a.Name, a.Category, a.TotalQty, a.Available, a.Condition, a.Description); err != nil {
			return err
		}
	}
	for _, l := range s.db.AssetLoans {
		if _, err := tx.Exec(`INSERT INTO asset_loans (id, asset_id, asset_name, borrower_name, house_code, phone, quantity, borrow_date, return_date, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
			l.ID, l.AssetID, l.AssetName, l.BorrowerName, l.HouseCode, l.Phone, l.Quantity, l.BorrowDate, l.ReturnDate, l.Status, l.CreatedAt); err != nil {
			return err
		}
	}
	for _, c := range s.db.Cameras {
		if _, err := tx.Exec(`INSERT INTO cctv_cameras (id, name, area, status, image_url, resolution) VALUES ($1,$2,$3,$4,$5,$6)`,
			c.ID, c.Name, c.Area, c.Status, c.ImageURL, c.Resolution); err != nil {
			return err
		}
	}
	for _, u := range s.db.UmkmItems {
		if _, err := tx.Exec(`INSERT INTO umkm_items (id, name, seller_name, house_code, category, price, description, whatsapp, image_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
			u.ID, u.Name, u.SellerName, u.HouseCode, u.Category, u.Price, u.Description, u.WhatsApp, u.ImageURL); err != nil {
			return err
		}
	}
	for _, g := range s.db.Gallery {
		if _, err := tx.Exec(`INSERT INTO gallery_photos (id, title, date, category, image_url) VALUES ($1,$2,$3,$4,$5)`,
			g.ID, g.Title, g.Date, g.Category, g.ImageURL); err != nil {
			return err
		}
	}
	for _, ar := range s.db.ActivityReports {
		if _, err := tx.Exec(`INSERT INTO activity_reports (id, title, category, activity_date, location, summary, budget_used, image_url, author, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
			ar.ID, ar.Title, ar.Category, ar.ActivityDate, ar.Location, ar.Summary, ar.BudgetUsed, ar.ImageURL, ar.Author, ar.CreatedAt, ar.UpdatedAt); err != nil {
			return err
		}
	}
	for _, r := range s.db.FinanceReports {
		if _, err := tx.Exec(`INSERT INTO finance_reports (id, type, period, month_label, opening_balance, total_income, total_spend, balance, paid_houses, total_houses, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
			r.ID, r.Type, r.Period, r.MonthLabel, r.OpeningBalance, r.TotalIncome, r.TotalSpend, r.Balance, r.PaidHouses, r.TotalHouses, r.Notes); err != nil {
			return err
		}
		for _, it := range r.Items {
			itemID := it.ID
			if itemID == "" {
				itemID = generateID("tx")
			}
			if _, err := tx.Exec(`INSERT INTO finance_items (report_id, item_id, date, description, category, kind, amount) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
				r.ID, itemID, it.Date, it.Description, it.Category, it.Kind, it.Amount); err != nil {
				return err
			}
		}
	}
	for _, kp := range s.db.KasPayments {
		if _, err := tx.Exec(`INSERT INTO kas_payments (id, fund_type, period, payer_name, house_code, amount, payment_date, note, proof_url, status, admin_note, finance_ref_id, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
			kp.ID, kp.FundType, kp.Period, kp.PayerName, kp.HouseCode, kp.Amount, kp.PaymentDate, kp.Note, kp.ProofURL, kp.Status, kp.AdminNote, kp.FinanceRefID, kp.CreatedAt, kp.UpdatedAt); err != nil {
			return err
		}
	}
	for _, u := range s.db.Users {
		if _, err := tx.Exec(`INSERT INTO users (id, house_id, username, password_hash, full_name, role, is_active, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
			u.ID, u.HouseID, u.Username, u.PasswordHash, u.FullName, u.Role, u.IsActive, u.CreatedAt); err != nil {
			return err
		}
	}
	for _, p := range s.db.PanicAlerts {
		if _, err := tx.Exec(`INSERT INTO panic_alerts (id, reporter_name, house_code, category, note, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
			p.ID, p.ReporterName, p.HouseCode, p.Category, p.Note, p.Status, p.CreatedAt); err != nil {
			return err
		}
	}
	for _, c := range s.db.Contacts {
		if _, err := tx.Exec(`INSERT INTO pengurus_contacts (id, name, position, house, phone, whatsapp) VALUES ($1,$2,$3,$4,$5,$6)`,
			c.ID, c.Name, c.Position, c.House, c.Phone, c.WhatsApp); err != nil {
			return err
		}
	}
	for _, l := range s.db.AuditLogs {
		if _, err := tx.Exec(`INSERT INTO audit_logs (id, actor_name, actor_role, house_code, action, target, details, ip_address, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
			l.ID, l.ActorName, l.ActorRole, l.HouseCode, l.Action, l.Target, l.Details, l.IPAddress, l.CreatedAt); err != nil {
			return err
		}
	}

	return tx.Commit()
}

// SaveSession menyimpan 1 sesi login langsung ke PostgreSQL (tanpa full-table rewrite).
func (s *Store) SaveSession(sess UserSession) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	// Hapus sesi lama dengan hash sama atau yang kedaluwarsa dari cache memori
	now := time.Now()
	filtered := make([]UserSession, 0, len(s.db.Sessions)+1)
	for _, existing := range s.db.Sessions {
		if existing.TokenHash != sess.TokenHash && existing.ExpiresAt.After(now) {
			filtered = append(filtered, existing)
		}
	}
	filtered = append(filtered, sess)
	s.db.Sessions = filtered

	if s.pg != nil {
		_, _ = s.pg.Exec(`DELETE FROM user_sessions WHERE expires_at <= NOW()`)
		_, err := s.pg.Exec(
			`INSERT INTO user_sessions (token_hash, username, name, role, house_code, expires_at, created_at)
			 VALUES ($1,$2,$3,$4,$5,$6,$7)
			 ON CONFLICT (token_hash) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
			sess.TokenHash, sess.Username, sess.Name, sess.Role, sess.HouseCode, sess.ExpiresAt, sess.CreatedAt,
		)
		return err
	}
	return s.saveLocked()
}

// DeleteSession mencabut 1 sesi login langsung di PostgreSQL.
func (s *Store) DeleteSession(tokenHash string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	filtered := make([]UserSession, 0, len(s.db.Sessions))
	for _, existing := range s.db.Sessions {
		if existing.TokenHash != tokenHash {
			filtered = append(filtered, existing)
		}
	}
	s.db.Sessions = filtered

	if s.pg != nil {
		_, err := s.pg.Exec(`DELETE FROM user_sessions WHERE token_hash = $1`, tokenHash)
		return err
	}
	return s.saveLocked()
}

// AppendAuditLog menulis 1 baris audit log langsung ke PostgreSQL (tanpa full-table rewrite).
func (s *Store) AppendAuditLog(entry AuditLog) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.db.AuditLogs = append([]AuditLog{entry}, s.db.AuditLogs...)
	if len(s.db.AuditLogs) > 500 {
		s.db.AuditLogs = s.db.AuditLogs[:500]
	}
	if s.pg != nil {
		_, err := s.pg.Exec(
			`INSERT INTO audit_logs (id, actor_name, actor_role, house_code, action, target, details, ip_address, created_at)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
			entry.ID, entry.ActorName, entry.ActorRole, entry.HouseCode, entry.Action, entry.Target, entry.Details, entry.IPAddress, entry.CreatedAt,
		)
		return err
	}
	return s.saveLocked()
}
