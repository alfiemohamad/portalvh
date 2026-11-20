package main

import (
	"crypto/rand"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/xuri/excelize/v2"
)

type SessionUser struct {
	Username  string `json:"username"`
	Name      string `json:"name"`
	Role      string `json:"role"` // "Warga" | "Pengurus"
	HouseCode string `json:"house_code"`
}

type Server struct {
	store     *Store
	uploadDir string
	tokensMu  sync.RWMutex
	tokens    map[string]SessionUser
}

func NewServer(store *Store, uploadDir string) *Server {
	_ = os.MkdirAll(uploadDir, 0o755)
	return &Server{
		store:     store,
		uploadDir: uploadDir,
		tokens:    make(map[string]SessionUser),
	}
}

func generateID(prefix string) string {
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%s-%s", prefix, hex.EncodeToString(b))
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func (s *Server) currentUser(r *http.Request) (SessionUser, bool) {
	token := ""
	auth := r.Header.Get("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		token = strings.TrimPrefix(auth, "Bearer ")
	} else if qToken := strings.TrimSpace(r.URL.Query().Get("token")); qToken != "" {
		token = qToken
	}
	if token == "" {
		return SessionUser{}, false
	}
	s.tokensMu.RLock()
	defer s.tokensMu.RUnlock()
	u, ok := s.tokens[token]
	return u, ok
}

func (s *Server) isAdmin(r *http.Request) bool {
	u, ok := s.currentUser(r)
	return ok && u.Role == "Pengurus"
}

func clientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		return strings.TrimSpace(strings.Split(fwd, ",")[0])
	}
	return r.RemoteAddr
}

func (s *Server) recordAudit(r *http.Request, action, target, details string) {
	actorName := "Tamu / Publik"
	actorRole := "Publik"
	houseCode := "-"
	if u, ok := s.currentUser(r); ok {
		actorName = u.Name
		actorRole = u.Role
		if u.HouseCode != "" {
			houseCode = u.HouseCode
		}
	}
	entry := AuditLog{
		ID:        generateID("aud"),
		ActorName: actorName,
		ActorRole: actorRole,
		HouseCode: houseCode,
		Action:    action,
		Target:    target,
		Details:   details,
		IPAddress: clientIP(r),
		CreatedAt: time.Now(),
	}
	s.store.mu.Lock()
	s.store.db.AuditLogs = append([]AuditLog{entry}, s.store.db.AuditLogs...)
	if len(s.store.db.AuditLogs) > 500 {
		s.store.db.AuditLogs = s.store.db.AuditLogs[:500]
	}
	_ = s.store.saveLocked()
	s.store.mu.Unlock()
}

func (s *Server) recordAuditUser(u SessionUser, r *http.Request, action, target, details string) {
	houseCode := u.HouseCode
	if houseCode == "" {
		houseCode = "-"
	}
	entry := AuditLog{
		ID:        generateID("aud"),
		ActorName: u.Name,
		ActorRole: u.Role,
		HouseCode: houseCode,
		Action:    action,
		Target:    target,
		Details:   details,
		IPAddress: clientIP(r),
		CreatedAt: time.Now(),
	}
	s.store.mu.Lock()
	s.store.db.AuditLogs = append([]AuditLog{entry}, s.store.db.AuditLogs...)
	if len(s.store.db.AuditLogs) > 500 {
		s.store.db.AuditLogs = s.store.db.AuditLogs[:500]
	}
	_ = s.store.saveLocked()
	s.store.mu.Unlock()
}

func (s *Server) requireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.isAdmin(r) {
			writeError(w, http.StatusUnauthorized, "Akses khusus pengurus. Silakan login terlebih dahulu.")
			return
		}
		next(w, r)
	}
}

// GET /api/auth/houses -> daftar kode blok & rumah untuk dropdown login warga
func (s *Server) handleAuthHouses(w http.ResponseWriter, r *http.Request) {
	s.store.mu.RLock()
	defer s.store.mu.RUnlock()
	out := make([]map[string]string, 0, len(s.store.db.Houses))
	for _, h := range s.store.db.Houses {
		out = append(out, map[string]string{
			"code":   h.Code,
			"block":  h.Block,
			"status": h.Status,
		})
	}
	writeJSON(w, http.StatusOK, out)
}

// POST /api/auth/login -> mendukung mode "resident" (blok rumah + password warga) dan "admin" (username + password pengurus)
func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Mode      string `json:"mode"` // "resident" or "admin"
		HouseCode string `json:"house_code"`
		Username  string `json:"username"`
		Password  string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Format request tidak valid")
		return
	}

	mode := strings.ToLower(strings.TrimSpace(body.Mode))
	if mode == "" {
		if strings.TrimSpace(body.HouseCode) != "" {
			mode = "resident"
		} else {
			mode = "admin"
		}
	}

	if mode == "resident" {
		resPass := os.Getenv("RESIDENT_PASSWORD")
		if resPass == "" {
			writeError(w, http.StatusServiceUnavailable, "Password warga belum dikonfigurasi di environment (.env)")
			return
		}
		code := strings.ToUpper(strings.TrimSpace(body.HouseCode))
		if code == "" {
			writeError(w, http.StatusBadRequest, "Blok / nomor rumah wajib dipilih")
			return
		}
		if body.Password != resPass {
			writeError(w, http.StatusUnauthorized, "Password warga salah")
			return
		}

		// Lookup resident name if registered
		displayName := "Warga " + code
		found := false
		s.store.mu.RLock()
		for _, h := range s.store.db.Houses {
			if strings.EqualFold(h.Code, code) {
				found = true
				if h.HeadOfHome != "" {
					displayName = h.HeadOfHome + " (" + h.Code + ")"
				}
				code = h.Code
				break
			}
		}
		s.store.mu.RUnlock()
		if !found {
			writeError(w, http.StatusNotFound, "Kode rumah tidak ditemukan di direktori Victoria Hill")
			return
		}

		b := make([]byte, 16)
		_, _ = rand.Read(b)
		token := hex.EncodeToString(b)
		user := SessionUser{
			Username:  code,
			Name:      displayName,
			Role:      "Warga",
			HouseCode: code,
		}
		s.tokensMu.Lock()
		s.tokens[token] = user
		s.tokensMu.Unlock()

		s.recordAuditUser(user, r, "LOGIN_WARGA", "Portal Warga", "Login menggunakan blok rumah "+code)
		writeJSON(w, http.StatusOK, map[string]any{
			"token": token,
			"user":  user,
		})
		return
	}

	adminUser := strings.TrimSpace(strings.ToLower(os.Getenv("ADMIN_USERNAME")))
	adminPass := os.Getenv("ADMIN_PASSWORD")
	if adminUser == "" || adminPass == "" {
		writeError(w, http.StatusServiceUnavailable, "Kredensial pengurus belum dikonfigurasi di environment (.env)")
		return
	}
	u := strings.TrimSpace(strings.ToLower(body.Username))
	if u == adminUser && body.Password == adminPass {
		b := make([]byte, 16)
		_, _ = rand.Read(b)
		token := hex.EncodeToString(b)
		user := SessionUser{
			Username:  u,
			Name:      "Pengurus Victoria Hill",
			Role:      "Pengurus",
			HouseCode: "Admin",
		}
		s.tokensMu.Lock()
		s.tokens[token] = user
		s.tokensMu.Unlock()

		s.recordAuditUser(user, r, "LOGIN_PENGURUS", "Dashboard Pengurus", "Login sebagai pengurus ("+u+")")
		writeJSON(w, http.StatusOK, map[string]any{
			"token": token,
			"user":  user,
		})
		return
	}
	writeError(w, http.StatusUnauthorized, "Username atau password pengurus salah")
}

// GET /api/dashboard
func (s *Server) handleDashboard(w http.ResponseWriter, r *http.Request) {
	s.store.mu.RLock()
	defer s.store.mu.RUnlock()

	openTickets := 0
	doneTickets := 0
	for _, t := range s.store.db.Tickets {
		if t.Status == "Selesai" {
			doneTickets++
		} else {
			openTickets++
		}
	}

	occupied := 0
	vacant := 0
	for _, h := range s.store.db.Houses {
		if h.Status == "Dihuni" {
			occupied++
		} else {
			vacant++
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"announcements": s.store.db.Announcements,
		"gallery":       s.store.db.Gallery,
		"umkm":          s.store.db.UmkmItems,
		"contacts":      s.store.db.Contacts,
		"stats": map[string]int{
			"total_houses":    len(s.store.db.Houses),
			"occupied_houses": occupied,
			"vacant_houses":   vacant,
			"facilities":      len(s.store.db.Facilities),
			"open_tickets":    openTickets,
			"done_tickets":    doneTickets,
			"active_panics":   countActivePanics(s.store.db.PanicAlerts),
		},
	})
}

func countActivePanics(alerts []PanicAlert) int {
	n := 0
	for _, a := range alerts {
		if a.Status == "Aktif" {
			n++
		}
	}
	return n
}

// GET /api/announcements, POST /api/announcements (admin), DELETE /api/announcements/{id} (admin)
func (s *Server) handleAnnouncements(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.store.mu.RLock()
		defer s.store.mu.RUnlock()
		writeJSON(w, http.StatusOK, s.store.db.Announcements)
	case http.MethodPost:
		if !s.isAdmin(r) {
			writeError(w, http.StatusUnauthorized, "Akses khusus pengurus")
			return
		}
		var body struct {
			Title    string `json:"title"`
			Content  string `json:"content"`
			Category string `json:"category"`
			Pinned   bool   `json:"pinned"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeError(w, http.StatusBadRequest, "Data pengumuman tidak valid")
			return
		}
		if strings.TrimSpace(body.Title) == "" || strings.TrimSpace(body.Content) == "" {
			writeError(w, http.StatusBadRequest, "Judul dan isi pengumuman wajib diisi")
			return
		}
		if body.Category == "" {
			body.Category = "Umum"
		}
		item := Announcement{
			ID:        generateID("ann"),
			Title:     strings.TrimSpace(body.Title),
			Content:   strings.TrimSpace(body.Content),
			Category:  body.Category,
			Author:    "Pengurus Victoria Hill",
			Pinned:    body.Pinned,
			CreatedAt: time.Now(),
		}
		s.store.mu.Lock()
		s.store.db.Announcements = append([]Announcement{item}, s.store.db.Announcements...)
		_ = s.store.saveLocked()
		s.store.mu.Unlock()
		s.recordAudit(r, "CREATE_ANNOUNCEMENT", item.Title, "Kategori: "+item.Category)
		writeJSON(w, http.StatusCreated, item)
	default:
		writeError(w, http.StatusMethodNotAllowed, "Method tidak didukung")
	}
}

func (s *Server) handleDeleteAnnouncement(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	s.store.mu.Lock()
	defer s.store.mu.Unlock()
	filtered := make([]Announcement, 0, len(s.store.db.Announcements))
	found := false
	for _, a := range s.store.db.Announcements {
		if a.ID == id {
			found = true
			continue
		}
		filtered = append(filtered, a)
	}
	if !found {
		writeError(w, http.StatusNotFound, "Pengumuman tidak ditemukan")
		return
	}
	s.store.db.Announcements = filtered
	_ = s.store.saveLocked()
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// GET /api/directory?block=...&q=...
func (s *Server) handleDirectory(w http.ResponseWriter, r *http.Request) {
	block := strings.TrimSpace(r.URL.Query().Get("block"))
	query := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))

	s.store.mu.RLock()
	defer s.store.mu.RUnlock()

	blocksSet := map[string]bool{}
	occupied := 0
	vacant := 0
	result := []ResidentHouse{}

	for _, h := range s.store.db.Houses {
		blocksSet[h.Block] = true
		if h.Status == "Dihuni" {
			occupied++
		} else {
			vacant++
		}
		if block != "" && block != "Semua Blok" && h.Block != block {
			continue
		}
		if query != "" && !strings.Contains(strings.ToLower(h.Code), query) && !strings.Contains(strings.ToLower(h.HeadOfHome), query) {
			continue
		}
		result = append(result, h)
	}

	blocks := []string{}
	for b := range blocksSet {
		blocks = append(blocks, b)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"summary": map[string]int{
			"total":    len(s.store.db.Houses),
			"occupied": occupied,
			"vacant":   vacant,
		},
		"blocks": blocks,
		"houses": result,
	})
}

// GET /api/facilities
func (s *Server) handleFacilities(w http.ResponseWriter, r *http.Request) {
	s.store.mu.RLock()
	defer s.store.mu.RUnlock()

	maintenance := 0
	for _, f := range s.store.db.Facilities {
		if f.Status == "Pemeliharaan" {
			maintenance++
		}
	}
	openTickets := 0
	doneTickets := 0
	for _, t := range s.store.db.Tickets {
		if t.Status == "Selesai" {
			doneTickets++
		} else {
			openTickets++
		}
	}

	monthlyUsage := []map[string]any{
		{"month": "Jun", "count": 4},
		{"month": "Jul", "count": 6},
		{"month": "Agu", "count": 9},
		{"month": "Sep", "count": 5},
		{"month": "Okt", "count": 7},
		{"month": "Nov", "count": len(s.store.db.Bookings) + 3},
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"facilities": s.store.db.Facilities,
		"bookings":   s.store.db.Bookings,
		"summary": map[string]int{
			"total_assets":  len(s.store.db.Facilities),
			"env_assets":    len(s.store.db.Assets) + len(s.store.db.Cameras) + len(s.store.db.Facilities),
			"facilities":    len(s.store.db.Facilities),
			"maintenance":   maintenance,
			"tickets_open":  openTickets,
			"tickets_done":  doneTickets,
		},
		"monthly_usage": monthlyUsage,
	})
}

// POST /api/bookings, PATCH /api/bookings/{id}
func (s *Server) handleCreateBooking(w http.ResponseWriter, r *http.Request) {
	var body struct {
		FacilityID   string `json:"facility_id"`
		ResidentName string `json:"resident_name"`
		HouseCode    string `json:"house_code"`
		Phone        string `json:"phone"`
		Date         string `json:"date"`
		TimeSlot     string `json:"time_slot"`
		Purpose      string `json:"purpose"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Format booking tidak valid")
		return
	}
	if strings.TrimSpace(body.FacilityID) == "" || strings.TrimSpace(body.ResidentName) == "" || strings.TrimSpace(body.Date) == "" {
		writeError(w, http.StatusBadRequest, "Fasilitas, nama warga, dan tanggal wajib diisi")
		return
	}

	s.store.mu.Lock()
	defer s.store.mu.Unlock()
	facName := ""
	for _, f := range s.store.db.Facilities {
		if f.ID == body.FacilityID {
			facName = f.Name
			break
		}
	}
	if facName == "" {
		writeError(w, http.StatusNotFound, "Fasilitas tidak ditemukan")
		return
	}

	booking := FacilityBooking{
		ID:           generateID("book"),
		FacilityID:   body.FacilityID,
		FacilityName: facName,
		ResidentName: strings.TrimSpace(body.ResidentName),
		HouseCode:    strings.TrimSpace(body.HouseCode),
		Phone:        strings.TrimSpace(body.Phone),
		Date:         body.Date,
		TimeSlot:     body.TimeSlot,
		Purpose:      strings.TrimSpace(body.Purpose),
		Status:       "Menunggu",
		CreatedAt:    time.Now(),
	}
	s.store.db.Bookings = append([]FacilityBooking{booking}, s.store.db.Bookings...)
	_ = s.store.saveLocked()
	s.recordAudit(r, "CREATE_BOOKING", booking.FacilityName, booking.Date+" "+booking.TimeSlot)
	writeJSON(w, http.StatusCreated, booking)
}

func (s *Server) handleUpdateBooking(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Format tidak valid")
		return
	}
	s.store.mu.Lock()
	defer s.store.mu.Unlock()
	for i := range s.store.db.Bookings {
		if s.store.db.Bookings[i].ID == id {
			s.store.db.Bookings[i].Status = body.Status
			_ = s.store.saveLocked()
			writeJSON(w, http.StatusOK, s.store.db.Bookings[i])
			return
		}
	}
	writeError(w, http.StatusNotFound, "Booking tidak ditemukan")
}

// GET /api/tickets, POST /api/tickets
func (s *Server) handleTickets(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.store.mu.RLock()
		defer s.store.mu.RUnlock()
		writeJSON(w, http.StatusOK, s.store.db.Tickets)
	case http.MethodPost:
		var body struct {
			Category     string `json:"category"`
			Location     string `json:"location"`
			ReporterName string `json:"reporter_name"`
			HouseCode    string `json:"house_code"`
			Description  string `json:"description"`
			PhotoURL     string `json:"photo_url"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeError(w, http.StatusBadRequest, "Format laporan tidak valid")
			return
		}
		if strings.TrimSpace(body.Category) == "" || strings.TrimSpace(body.Location) == "" || strings.TrimSpace(body.ReporterName) == "" || strings.TrimSpace(body.Description) == "" {
			writeError(w, http.StatusBadRequest, "Kategori, lokasi, nama lengkap, dan deskripsi wajib diisi")
			return
		}
		s.store.mu.Lock()
		now := time.Now()
		ticket := Ticket{
			ID:           generateID("tkt"),
			TicketNo:     fmt.Sprintf("VH-%d-%03d", now.Year(), len(s.store.db.Tickets)+1),
			Category:     body.Category,
			Location:     body.Location,
			ReporterName: strings.TrimSpace(body.ReporterName),
			HouseCode:    strings.TrimSpace(body.HouseCode),
			Description:  strings.TrimSpace(body.Description),
			PhotoURL:     body.PhotoURL,
			Status:       "Open",
			CreatedAt:    now,
			UpdatedAt:    now,
		}
		s.store.db.Tickets = append([]Ticket{ticket}, s.store.db.Tickets...)
		_ = s.store.saveLocked()
		s.store.mu.Unlock()
		s.recordAudit(r, "CREATE_TICKET", ticket.TicketNo, ticket.Category+" - "+ticket.Location)
		writeJSON(w, http.StatusCreated, ticket)
	default:
		writeError(w, http.StatusMethodNotAllowed, "Method tidak didukung")
	}
}

func (s *Server) handleUpdateTicket(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body struct {
		Status    string `json:"status"`
		AdminNote string `json:"admin_note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Format tidak valid")
		return
	}
	s.store.mu.Lock()
	defer s.store.mu.Unlock()
	for i := range s.store.db.Tickets {
		if s.store.db.Tickets[i].ID == id {
			if body.Status != "" {
				s.store.db.Tickets[i].Status = body.Status
			}
			s.store.db.Tickets[i].AdminNote = body.AdminNote
			s.store.db.Tickets[i].UpdatedAt = time.Now()
			_ = s.store.saveLocked()
			writeJSON(w, http.StatusOK, s.store.db.Tickets[i])
			return
		}
	}
	writeError(w, http.StatusNotFound, "Tiket tidak ditemukan")
}

// GET /api/access-cards, POST /api/access-cards
func (s *Server) handleAccessCards(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.store.mu.RLock()
		defer s.store.mu.RUnlock()
		writeJSON(w, http.StatusOK, s.store.db.AccessCardRequests)
	case http.MethodPost:
		var body struct {
			FullName     string `json:"full_name"`
			Block        string `json:"block"`
			HouseNo      string `json:"house_no"`
			StnkPhotoURL string `json:"stnk_photo_url"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeError(w, http.StatusBadRequest, "Format pengajuan tidak valid")
			return
		}
		if strings.TrimSpace(body.FullName) == "" || strings.TrimSpace(body.Block) == "" || strings.TrimSpace(body.HouseNo) == "" {
			writeError(w, http.StatusBadRequest, "Nama lengkap, blok rumah, dan nomor rumah wajib diisi")
			return
		}
		s.store.mu.Lock()
		now := time.Now()
		req := AccessCardRequest{
			ID:           generateID("ac"),
			RequestNo:    fmt.Sprintf("KA-%d-%03d", now.Year(), len(s.store.db.AccessCardRequests)+1),
			FullName:     strings.TrimSpace(body.FullName),
			Block:        strings.TrimSpace(body.Block),
			HouseNo:      strings.TrimSpace(body.HouseNo),
			StnkPhotoURL: body.StnkPhotoURL,
			Fee:          50000,
			Status:       "Menunggu Verifikasi",
			CreatedAt:    now,
		}
		s.store.db.AccessCardRequests = append([]AccessCardRequest{req}, s.store.db.AccessCardRequests...)
		_ = s.store.saveLocked()
		s.store.mu.Unlock()
		s.recordAudit(r, "CREATE_ACCESS_CARD", req.RequestNo, req.FullName+" ("+req.Block+" No. "+req.HouseNo+")")
		writeJSON(w, http.StatusCreated, req)
	default:
		writeError(w, http.StatusMethodNotAllowed, "Method tidak didukung")
	}
}

func (s *Server) handleUpdateAccessCard(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Format tidak valid")
		return
	}
	s.store.mu.Lock()
	defer s.store.mu.Unlock()
	for i := range s.store.db.AccessCardRequests {
		if s.store.db.AccessCardRequests[i].ID == id {
			s.store.db.AccessCardRequests[i].Status = body.Status
			_ = s.store.saveLocked()
			writeJSON(w, http.StatusOK, s.store.db.AccessCardRequests[i])
			return
		}
	}
	writeError(w, http.StatusNotFound, "Pengajuan kartu akses tidak ditemukan")
}

// GET /api/assets & POST /api/asset-loans
func (s *Server) handleAssets(w http.ResponseWriter, r *http.Request) {
	s.store.mu.RLock()
	defer s.store.mu.RUnlock()
	writeJSON(w, http.StatusOK, map[string]any{
		"assets": s.store.db.Assets,
		"loans":  s.store.db.AssetLoans,
	})
}

func (s *Server) handleCreateAssetLoan(w http.ResponseWriter, r *http.Request) {
	var body struct {
		AssetID      string `json:"asset_id"`
		BorrowerName string `json:"borrower_name"`
		HouseCode    string `json:"house_code"`
		Phone        string `json:"phone"`
		Quantity     int    `json:"quantity"`
		BorrowDate   string `json:"borrow_date"`
		ReturnDate   string `json:"return_date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Format peminjaman tidak valid")
		return
	}
	if body.Quantity <= 0 {
		body.Quantity = 1
	}
	if strings.TrimSpace(body.BorrowerName) == "" || strings.TrimSpace(body.HouseCode) == "" || body.BorrowDate == "" {
		writeError(w, http.StatusBadRequest, "Nama peminjam, blok/nomor rumah, dan tanggal wajib diisi")
		return
	}

	s.store.mu.Lock()
	defer s.store.mu.Unlock()
	assetIdx := -1
	for i, a := range s.store.db.Assets {
		if a.ID == body.AssetID {
			assetIdx = i
			break
		}
	}
	if assetIdx == -1 {
		writeError(w, http.StatusNotFound, "Barang tidak ditemukan")
		return
	}
	if s.store.db.Assets[assetIdx].Available < body.Quantity {
		writeError(w, http.StatusBadRequest, "Stok barang tersedia tidak mencukupi")
		return
	}

	s.store.db.Assets[assetIdx].Available -= body.Quantity
	loan := AssetLoan{
		ID:           generateID("loan"),
		AssetID:      body.AssetID,
		AssetName:    s.store.db.Assets[assetIdx].Name,
		BorrowerName: strings.TrimSpace(body.BorrowerName),
		HouseCode:    strings.TrimSpace(body.HouseCode),
		Phone:        strings.TrimSpace(body.Phone),
		Quantity:     body.Quantity,
		BorrowDate:   body.BorrowDate,
		ReturnDate:   body.ReturnDate,
		Status:       "Menunggu",
		CreatedAt:    time.Now(),
	}
	s.store.db.AssetLoans = append([]AssetLoan{loan}, s.store.db.AssetLoans...)
	_ = s.store.saveLocked()
	s.recordAudit(r, "CREATE_ASSET_LOAN", loan.AssetName, fmt.Sprintf("%d unit (%s)", loan.Quantity, loan.HouseCode))
	writeJSON(w, http.StatusCreated, loan)
}

func (s *Server) handleUpdateAssetLoan(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Format tidak valid")
		return
	}
	s.store.mu.Lock()
	defer s.store.mu.Unlock()
	for i := range s.store.db.AssetLoans {
		if s.store.db.AssetLoans[i].ID == id {
			prev := s.store.db.AssetLoans[i].Status
			s.store.db.AssetLoans[i].Status = body.Status
			if (body.Status == "Dikembalikan" || body.Status == "Ditolak") && prev != "Dikembalikan" && prev != "Ditolak" {
				for j := range s.store.db.Assets {
					if s.store.db.Assets[j].ID == s.store.db.AssetLoans[i].AssetID {
						s.store.db.Assets[j].Available += s.store.db.AssetLoans[i].Quantity
						if s.store.db.Assets[j].Available > s.store.db.Assets[j].TotalQty {
							s.store.db.Assets[j].Available = s.store.db.Assets[j].TotalQty
						}
					}
				}
			}
			_ = s.store.saveLocked()
			writeJSON(w, http.StatusOK, s.store.db.AssetLoans[i])
			return
		}
	}
	writeError(w, http.StatusNotFound, "Data peminjaman tidak ditemukan")
}

// GET /api/cctv
func (s *Server) handleCctv(w http.ResponseWriter, r *http.Request) {
	area := strings.TrimSpace(r.URL.Query().Get("area"))
	s.store.mu.RLock()
	defer s.store.mu.RUnlock()
	cams := []CctvCamera{}
	for _, c := range s.store.db.Cameras {
		if area != "" && area != "Semua" && c.Area != area {
			continue
		}
		cams = append(cams, c)
	}
	writeJSON(w, http.StatusOK, cams)
}

// GET /api/finance?type=IPL|KAS
func (s *Server) handleFinance(w http.ResponseWriter, r *http.Request) {
	kind := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("type")))
	s.store.mu.RLock()
	defer s.store.mu.RUnlock()
	out := []FinanceReport{}
	for _, rep := range s.store.db.FinanceReports {
		if kind == "" || rep.Type == kind {
			out = append(out, rep)
		}
	}
	writeJSON(w, http.StatusOK, out)
}

// GET /api/finance/{id}/download?format=csv|xlsx -> real CSV or Excel report download
func (s *Server) handleDownloadFinance(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	format := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("format")))
	if format != "xlsx" {
		format = "csv"
	}

	s.store.mu.RLock()
	var target FinanceReport
	found := false
	for i := range s.store.db.FinanceReports {
		if s.store.db.FinanceReports[i].ID == id {
			target = s.store.db.FinanceReports[i]
			found = true
			break
		}
	}
	s.store.mu.RUnlock()

	if !found {
		writeError(w, http.StatusNotFound, "Laporan tidak ditemukan")
		return
	}

	if format == "xlsx" {
		s.recordAudit(r, "DOWNLOAD_"+target.Type+"_XLSX", target.MonthLabel, fmt.Sprintf("Unduh laporan %s (%s) format Excel", target.Type, target.MonthLabel))
		f := excelize.NewFile()
		sheet := "Laporan"
		_ = f.SetSheetName("Sheet1", sheet)
		_ = f.SetSheetRow(sheet, "A1", &[]any{"Laporan", target.Type + " Victoria Hill", "Periode", target.MonthLabel})
		_ = f.SetSheetRow(sheet, "A2", &[]any{"Total Pemasukan", target.TotalIncome, "Total Pengeluaran", target.TotalSpend})
		_ = f.SetSheetRow(sheet, "A3", &[]any{"Saldo Akhir", target.Balance})
		_ = f.SetSheetRow(sheet, "A5", &[]any{"Tanggal", "Keterangan", "Kategori", "Jenis", "Nominal (IDR)"})
		for idx, item := range target.Items {
			cell := fmt.Sprintf("A%d", idx+6)
			_ = f.SetSheetRow(sheet, cell, &[]any{item.Date, item.Description, item.Category, item.Kind, item.Amount})
		}
		filename := fmt.Sprintf("Laporan_%s_VictoriaHill_%s.xlsx", target.Type, target.Period)
		w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
		_ = f.Write(w)
		return
	}

	s.recordAudit(r, "DOWNLOAD_"+target.Type+"_CSV", target.MonthLabel, fmt.Sprintf("Unduh laporan %s (%s) format CSV", target.Type, target.MonthLabel))
	filename := fmt.Sprintf("Laporan_%s_VictoriaHill_%s.csv", target.Type, target.Period)
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))

	writer := csv.NewWriter(w)
	_ = writer.Write([]string{"Laporan", target.Type + " Victoria Hill", "Periode", target.MonthLabel})
	_ = writer.Write([]string{"Total Pemasukan", fmt.Sprintf("Rp %d", target.TotalIncome), "Total Pengeluaran", fmt.Sprintf("Rp %d", target.TotalSpend)})
	_ = writer.Write([]string{"Saldo Akhir", fmt.Sprintf("Rp %d", target.Balance)})
	_ = writer.Write([]string{})
	_ = writer.Write([]string{"Tanggal", "Keterangan", "Kategori", "Jenis", "Nominal (IDR)"})
	for _, item := range target.Items {
		_ = writer.Write([]string{item.Date, item.Description, item.Category, item.Kind, fmt.Sprintf("%d", item.Amount)})
	}
	writer.Flush()
}

// GET /api/umkm, POST /api/umkm
func (s *Server) handleUmkm(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.store.mu.RLock()
		defer s.store.mu.RUnlock()
		writeJSON(w, http.StatusOK, s.store.db.UmkmItems)
	case http.MethodPost:
		var body UmkmItem
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeError(w, http.StatusBadRequest, "Format UMKM tidak valid")
			return
		}
		if strings.TrimSpace(body.Name) == "" || strings.TrimSpace(body.SellerName) == "" {
			writeError(w, http.StatusBadRequest, "Nama produk dan nama penjual wajib diisi")
			return
		}
		body.ID = generateID("umkm")
		if body.ImageURL == "" {
			body.ImageURL = "/images/umkm-brownies.png"
		}
		if body.Category == "" {
			body.Category = "Kuliner"
		}
		s.store.mu.Lock()
		s.store.db.UmkmItems = append([]UmkmItem{body}, s.store.db.UmkmItems...)
		_ = s.store.saveLocked()
		s.store.mu.Unlock()
		writeJSON(w, http.StatusCreated, body)
	default:
		writeError(w, http.StatusMethodNotAllowed, "Method tidak didukung")
	}
}

// GET /api/panic, POST /api/panic, PATCH /api/panic/{id}
func (s *Server) handlePanic(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.store.mu.RLock()
		defer s.store.mu.RUnlock()
		writeJSON(w, http.StatusOK, s.store.db.PanicAlerts)
	case http.MethodPost:
		var body struct {
			ReporterName string `json:"reporter_name"`
			HouseCode    string `json:"house_code"`
			Category     string `json:"category"`
			Note         string `json:"note"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeError(w, http.StatusBadRequest, "Format darurat tidak valid")
			return
		}
		if strings.TrimSpace(body.HouseCode) == "" {
			body.HouseCode = "Tidak disebutkan"
		}
		if strings.TrimSpace(body.ReporterName) == "" {
			body.ReporterName = "Warga Victoria Hill"
		}
		if strings.TrimSpace(body.Category) == "" {
			body.Category = "Keamanan"
		}
		alert := PanicAlert{
			ID:           generateID("panic"),
			ReporterName: strings.TrimSpace(body.ReporterName),
			HouseCode:    strings.TrimSpace(body.HouseCode),
			Category:     body.Category,
			Note:         strings.TrimSpace(body.Note),
			Status:       "Aktif",
			CreatedAt:    time.Now(),
		}
		s.store.mu.Lock()
		s.store.db.PanicAlerts = append([]PanicAlert{alert}, s.store.db.PanicAlerts...)
		_ = s.store.saveLocked()
		s.store.mu.Unlock()
		s.recordAudit(r, "TRIGGER_PANIC", alert.Category, alert.ReporterName+" ("+alert.HouseCode+")")
		writeJSON(w, http.StatusCreated, alert)
	default:
		writeError(w, http.StatusMethodNotAllowed, "Method tidak didukung")
	}
}

func (s *Server) handleResolvePanic(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	s.store.mu.Lock()
	defer s.store.mu.Unlock()
	for i := range s.store.db.PanicAlerts {
		if s.store.db.PanicAlerts[i].ID == id {
			s.store.db.PanicAlerts[i].Status = "Ditangani"
			_ = s.store.saveLocked()
			writeJSON(w, http.StatusOK, s.store.db.PanicAlerts[i])
			return
		}
	}
	writeError(w, http.StatusNotFound, "Alert tidak ditemukan")
}

// POST /api/upload
func (s *Server) handleUpload(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(10 << 20); err != nil { // 10MB max
		writeError(w, http.StatusBadRequest, "Gagal memproses file upload (maks 10MB)")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Field 'file' wajib disertakan")
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp", ".gif", ".csv", ".xlsx", ".xls":
	default:
		writeError(w, http.StatusBadRequest, "Format file harus JPG, PNG, WEBP, CSV, atau Excel (.xlsx)")
		return
	}

	filename := generateID("img") + ext
	dstPath := filepath.Join(s.uploadDir, filename)
	dst, err := os.Create(dstPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Gagal menyimpan file")
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		writeError(w, http.StatusInternalServerError, "Gagal menulis file")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{
		"url":      "/uploads/" + filename,
		"filename": header.Filename,
	})
}

// GET /api/audit-logs?q=...&action=...&download=csv|xlsx (admin only)
func (s *Server) handleAuditLogs(w http.ResponseWriter, r *http.Request) {
	q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))
	actionFilter := strings.TrimSpace(r.URL.Query().Get("action"))
	download := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("download")))

	s.store.mu.RLock()
	filtered := make([]AuditLog, 0, len(s.store.db.AuditLogs))
	for _, l := range s.store.db.AuditLogs {
		if actionFilter != "" && actionFilter != "ALL" && l.Action != actionFilter {
			continue
		}
		if q != "" &&
			!strings.Contains(strings.ToLower(l.ActorName), q) &&
			!strings.Contains(strings.ToLower(l.HouseCode), q) &&
			!strings.Contains(strings.ToLower(l.Action), q) &&
			!strings.Contains(strings.ToLower(l.Target), q) &&
			!strings.Contains(strings.ToLower(l.Details), q) {
			continue
		}
		filtered = append(filtered, l)
	}
	s.store.mu.RUnlock()

	if download == "xlsx" {
		f := excelize.NewFile()
		sheet := "AuditTrail"
		_ = f.SetSheetName("Sheet1", sheet)
		_ = f.SetSheetRow(sheet, "A1", &[]string{"Waktu", "Aktor", "Role", "Blok", "Aksi", "Target", "Detail", "IP Address"})
		for idx, l := range filtered {
			cell := fmt.Sprintf("A%d", idx+2)
			_ = f.SetSheetRow(sheet, cell, &[]string{
				l.CreatedAt.Format("2006-01-02 15:04:05"),
				l.ActorName,
				l.ActorRole,
				l.HouseCode,
				l.Action,
				l.Target,
				l.Details,
				l.IPAddress,
			})
		}
		w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		w.Header().Set("Content-Disposition", `attachment; filename="Audit_Trail_VictoriaHill.xlsx"`)
		_ = f.Write(w)
		return
	}

	if download == "csv" {
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", `attachment; filename="Audit_Trail_VictoriaHill.csv"`)
		cw := csv.NewWriter(w)
		_ = cw.Write([]string{"Waktu", "Aktor", "Role", "Blok", "Aksi", "Target", "Detail", "IP Address"})
		for _, l := range filtered {
			_ = cw.Write([]string{
				l.CreatedAt.Format("2006-01-02 15:04:05"),
				l.ActorName,
				l.ActorRole,
				l.HouseCode,
				l.Action,
				l.Target,
				l.Details,
				l.IPAddress,
			})
		}
		cw.Flush()
		return
	}

	writeJSON(w, http.StatusOK, filtered)
}
