package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"
)

func normalizeFundType(raw string) string {
	t := strings.ToUpper(strings.TrimSpace(raw))
	switch t {
	case "IPL":
		return "IPL"
	case "KAS_MESJID", "MESJID", "KAS MESJID":
		return "KAS_MESJID"
	case "KAS_WARGA", "KAS", "KAS WARGA":
		return "KAS_WARGA"
	default:
		return ""
	}
}

func sortFinanceReports(reports []FinanceReport) {
	sort.SliceStable(reports, func(i, j int) bool {
		if reports[i].Period != reports[j].Period {
			return reports[i].Period > reports[j].Period
		}
		return reports[i].Type < reports[j].Type
	})
}

// POST /api/finance/reports -> buat atau buka periode laporan baru (IPL / KAS_WARGA / KAS_MESJID)
func (s *Server) handleCreateFinanceReport(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Type           string `json:"type"`
		Period         string `json:"period"`
		MonthLabel     string `json:"month_label"`
		OpeningBalance int    `json:"opening_balance"`
		PaidHouses     int    `json:"paid_houses"`
		TotalHouses    int    `json:"total_houses"`
		Notes          string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Format laporan keuangan tidak valid")
		return
	}
	fundType := normalizeFundType(body.Type)
	if fundType == "" {
		writeError(w, http.StatusBadRequest, "Jenis dana harus IPL, KAS_WARGA, atau KAS_MESJID")
		return
	}
	period := strings.TrimSpace(body.Period)
	if len(period) != 7 || period[4] != '-' {
		writeError(w, http.StatusBadRequest, "Format periode harus YYYY-MM (contoh: 2026-12)")
		return
	}
	monthLabel := strings.TrimSpace(body.MonthLabel)
	if monthLabel == "" {
		monthLabel = period
	}

	reportID := fmt.Sprintf("rep-%s-%s", strings.ToLower(fundType), period)

	s.store.mu.Lock()
	for _, existing := range s.store.db.FinanceReports {
		if existing.ID == reportID {
			s.store.mu.Unlock()
			writeError(w, http.StatusConflict, "Laporan untuk jenis dana dan periode tersebut sudah ada")
			return
		}
	}

	// Jika opening_balance tidak diisi (0), otomatis ambil saldo akhir dari periode sebelumnya untuk jenis dana sama
	opening := body.OpeningBalance
	if opening == 0 {
		var latestPrev *FinanceReport
		for i := range s.store.db.FinanceReports {
			rep := &s.store.db.FinanceReports[i]
			if rep.Type == fundType && rep.Period < period {
				if latestPrev == nil || rep.Period > latestPrev.Period {
					latestPrev = rep
				}
			}
		}
		if latestPrev != nil {
			opening = latestPrev.Balance
		}
	}

	rep := FinanceReport{
		ID:             reportID,
		Type:           fundType,
		Period:         period,
		MonthLabel:     monthLabel,
		OpeningBalance: opening,
		Balance:        opening,
		PaidHouses:     body.PaidHouses,
		TotalHouses:    body.TotalHouses,
		Notes:          strings.TrimSpace(body.Notes),
		Items:          []FinanceItem{},
	}
	s.store.db.FinanceReports = append([]FinanceReport{rep}, s.store.db.FinanceReports...)
	sortFinanceReports(s.store.db.FinanceReports)
	if err := s.store.saveLocked(); err != nil {
		s.store.mu.Unlock()
		writeError(w, http.StatusInternalServerError, "Gagal menyimpan laporan keuangan")
		return
	}
	s.store.mu.Unlock()

	s.recordAudit(r, "CREATE_FINANCE_REPORT", fundType+" "+monthLabel, fmt.Sprintf("Saldo awal Rp %d", opening))
	writeJSON(w, http.StatusCreated, rep)
}

// PATCH /api/finance/reports/{id} -> ubah metadata laporan (saldo awal, paid_houses, notes, label)
func (s *Server) handleUpdateFinanceReport(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body struct {
		MonthLabel     *string `json:"month_label"`
		OpeningBalance *int    `json:"opening_balance"`
		PaidHouses     *int    `json:"paid_houses"`
		TotalHouses    *int    `json:"total_houses"`
		Notes          *string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Format update laporan tidak valid")
		return
	}

	s.store.mu.Lock()
	for i := range s.store.db.FinanceReports {
		if s.store.db.FinanceReports[i].ID == id {
			rep := &s.store.db.FinanceReports[i]
			if body.MonthLabel != nil && strings.TrimSpace(*body.MonthLabel) != "" {
				rep.MonthLabel = strings.TrimSpace(*body.MonthLabel)
			}
			if body.OpeningBalance != nil {
				rep.OpeningBalance = *body.OpeningBalance
			}
			if body.PaidHouses != nil && *body.PaidHouses >= 0 {
				rep.PaidHouses = *body.PaidHouses
			}
			if body.TotalHouses != nil && *body.TotalHouses >= 0 {
				rep.TotalHouses = *body.TotalHouses
			}
			if body.Notes != nil {
				rep.Notes = strings.TrimSpace(*body.Notes)
			}
			recalculateFinanceReport(rep)
			updated := *rep
			if err := s.store.saveLocked(); err != nil {
				s.store.mu.Unlock()
				writeError(w, http.StatusInternalServerError, "Gagal menyimpan perubahan laporan")
				return
			}
			s.store.mu.Unlock()
			s.recordAudit(r, "UPDATE_FINANCE_REPORT", updated.Type+" "+updated.MonthLabel, fmt.Sprintf("Saldo akhir Rp %d", updated.Balance))
			writeJSON(w, http.StatusOK, updated)
			return
		}
	}
	s.store.mu.Unlock()
	writeError(w, http.StatusNotFound, "Laporan keuangan tidak ditemukan")
}

// DELETE /api/finance/reports/{id}
func (s *Server) handleDeleteFinanceReport(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	s.store.mu.Lock()
	var deleted FinanceReport
	found := false
	filtered := make([]FinanceReport, 0, len(s.store.db.FinanceReports))
	for _, rep := range s.store.db.FinanceReports {
		if rep.ID == id {
			deleted = rep
			found = true
			continue
		}
		filtered = append(filtered, rep)
	}
	if !found {
		s.store.mu.Unlock()
		writeError(w, http.StatusNotFound, "Laporan keuangan tidak ditemukan")
		return
	}
	s.store.db.FinanceReports = filtered
	if err := s.store.saveLocked(); err != nil {
		s.store.mu.Unlock()
		writeError(w, http.StatusInternalServerError, "Gagal menghapus laporan keuangan")
		return
	}
	s.store.mu.Unlock()

	s.recordAudit(r, "DELETE_FINANCE_REPORT", deleted.Type+" "+deleted.MonthLabel, "Hapus periode "+deleted.Period)
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// POST /api/finance/reports/{id}/items -> tambah 1 transaksi cashflow langsung dari dashboard admin
func (s *Server) handleAddFinanceItem(w http.ResponseWriter, r *http.Request) {
	reportID := r.PathValue("id")
	var body struct {
		Date        string `json:"date"`
		Description string `json:"description"`
		Category    string `json:"category"`
		Kind        string `json:"kind"` // "Masuk" | "Keluar"
		Amount      int    `json:"amount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Format transaksi tidak valid")
		return
	}
	if strings.TrimSpace(body.Description) == "" || body.Amount <= 0 {
		writeError(w, http.StatusBadRequest, "Keterangan dan nominal (> 0) wajib diisi")
		return
	}
	date := strings.TrimSpace(body.Date)
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}
	kind := "Masuk"
	if strings.EqualFold(strings.TrimSpace(body.Kind), "keluar") {
		kind = "Keluar"
	}
	category := strings.TrimSpace(body.Category)
	if category == "" {
		category = "Umum"
	}

	item := FinanceItem{
		ID:          generateID("tx"),
		Date:        date,
		Description: strings.TrimSpace(body.Description),
		Category:    category,
		Kind:        kind,
		Amount:      body.Amount,
	}

	s.store.mu.Lock()
	for i := range s.store.db.FinanceReports {
		if s.store.db.FinanceReports[i].ID == reportID {
			rep := &s.store.db.FinanceReports[i]
			rep.Items = append(rep.Items, item)
			recalculateFinanceReport(rep)
			updated := *rep
			if err := s.store.saveLocked(); err != nil {
				s.store.mu.Unlock()
				writeError(w, http.StatusInternalServerError, "Gagal menyimpan transaksi")
				return
			}
			s.store.mu.Unlock()
			s.recordAudit(r, "ADD_FINANCE_ITEM", updated.Type+" "+updated.MonthLabel, fmt.Sprintf("%s Rp %d: %s", item.Kind, item.Amount, item.Description))
			writeJSON(w, http.StatusCreated, map[string]any{
				"item":   item,
				"report": updated,
			})
			return
		}
	}
	s.store.mu.Unlock()
	writeError(w, http.StatusNotFound, "Laporan keuangan tidak ditemukan")
}

// PATCH /api/finance/reports/{id}/items/{itemId}
func (s *Server) handleUpdateFinanceItem(w http.ResponseWriter, r *http.Request) {
	reportID := r.PathValue("id")
	itemID := r.PathValue("itemId")
	var body struct {
		Date        string `json:"date"`
		Description string `json:"description"`
		Category    string `json:"category"`
		Kind        string `json:"kind"`
		Amount      int    `json:"amount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Format transaksi tidak valid")
		return
	}
	if strings.TrimSpace(body.Description) == "" || body.Amount <= 0 {
		writeError(w, http.StatusBadRequest, "Keterangan dan nominal (> 0) wajib diisi")
		return
	}
	kind := "Masuk"
	if strings.EqualFold(strings.TrimSpace(body.Kind), "keluar") {
		kind = "Keluar"
	}

	s.store.mu.Lock()
	for i := range s.store.db.FinanceReports {
		if s.store.db.FinanceReports[i].ID == reportID {
			rep := &s.store.db.FinanceReports[i]
			for j := range rep.Items {
				if rep.Items[j].ID == itemID {
					if strings.TrimSpace(body.Date) != "" {
						rep.Items[j].Date = strings.TrimSpace(body.Date)
					}
					rep.Items[j].Description = strings.TrimSpace(body.Description)
					if strings.TrimSpace(body.Category) != "" {
						rep.Items[j].Category = strings.TrimSpace(body.Category)
					}
					rep.Items[j].Kind = kind
					rep.Items[j].Amount = body.Amount
					recalculateFinanceReport(rep)
					updated := *rep
					if err := s.store.saveLocked(); err != nil {
						s.store.mu.Unlock()
						writeError(w, http.StatusInternalServerError, "Gagal memperbarui transaksi")
						return
					}
					s.store.mu.Unlock()
					s.recordAudit(r, "UPDATE_FINANCE_ITEM", updated.Type+" "+updated.MonthLabel, fmt.Sprintf("%s Rp %d: %s", kind, body.Amount, body.Description))
					writeJSON(w, http.StatusOK, updated)
					return
				}
			}
			s.store.mu.Unlock()
			writeError(w, http.StatusNotFound, "Item transaksi tidak ditemukan")
			return
		}
	}
	s.store.mu.Unlock()
	writeError(w, http.StatusNotFound, "Laporan keuangan tidak ditemukan")
}

// DELETE /api/finance/reports/{id}/items/{itemId}
func (s *Server) handleDeleteFinanceItem(w http.ResponseWriter, r *http.Request) {
	reportID := r.PathValue("id")
	itemID := r.PathValue("itemId")

	s.store.mu.Lock()
	for i := range s.store.db.FinanceReports {
		if s.store.db.FinanceReports[i].ID == reportID {
			rep := &s.store.db.FinanceReports[i]
			filtered := make([]FinanceItem, 0, len(rep.Items))
			var removed FinanceItem
			found := false
			for _, it := range rep.Items {
				if it.ID == itemID {
					removed = it
					found = true
					continue
				}
				filtered = append(filtered, it)
			}
			if !found {
				s.store.mu.Unlock()
				writeError(w, http.StatusNotFound, "Item transaksi tidak ditemukan")
				return
			}
			rep.Items = filtered
			recalculateFinanceReport(rep)
			updated := *rep
			if err := s.store.saveLocked(); err != nil {
				s.store.mu.Unlock()
				writeError(w, http.StatusInternalServerError, "Gagal menghapus transaksi")
				return
			}
			s.store.mu.Unlock()
			s.recordAudit(r, "DELETE_FINANCE_ITEM", updated.Type+" "+updated.MonthLabel, fmt.Sprintf("Hapus %s Rp %d", removed.Description, removed.Amount))
			writeJSON(w, http.StatusOK, updated)
			return
		}
	}
	s.store.mu.Unlock()
	writeError(w, http.StatusNotFound, "Laporan keuangan tidak ditemukan")
}

// GET /api/activities -> daftar laporan kegiatan warga
func (s *Server) handleListActivities(w http.ResponseWriter, r *http.Request) {
	category := strings.TrimSpace(r.URL.Query().Get("category"))
	s.store.mu.RLock()
	defer s.store.mu.RUnlock()

	out := make([]ActivityReport, 0, len(s.store.db.ActivityReports))
	for _, a := range s.store.db.ActivityReports {
		if category != "" && category != "Semua" && !strings.EqualFold(a.Category, category) {
			continue
		}
		out = append(out, a)
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].ActivityDate != out[j].ActivityDate {
			return out[i].ActivityDate > out[j].ActivityDate
		}
		return out[i].CreatedAt.After(out[j].CreatedAt)
	})
	writeJSON(w, http.StatusOK, out)
}

// POST /api/activities -> posting laporan kegiatan warga (Admin)
func (s *Server) handleCreateActivity(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Title        string `json:"title"`
		Category     string `json:"category"`
		ActivityDate string `json:"activity_date"`
		Location     string `json:"location"`
		Summary      string `json:"summary"`
		BudgetUsed   int    `json:"budget_used"`
		ImageURL     string `json:"image_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Format laporan kegiatan tidak valid")
		return
	}
	if strings.TrimSpace(body.Title) == "" || strings.TrimSpace(body.Summary) == "" {
		writeError(w, http.StatusBadRequest, "Judul dan ringkasan kegiatan wajib diisi")
		return
	}
	if body.BudgetUsed < 0 {
		writeError(w, http.StatusBadRequest, "Anggaran terpakai tidak boleh negatif")
		return
	}
	actDate := strings.TrimSpace(body.ActivityDate)
	if actDate == "" {
		actDate = time.Now().Format("2006-01-02")
	}
	cat := strings.TrimSpace(body.Category)
	if cat == "" {
		cat = "Sosial"
	}
	img := strings.TrimSpace(body.ImageURL)
	if img == "" {
		img = "/images/gallery-1.png"
	}

	author := "Pengurus Victoria Hill"
	if u, ok := s.currentUser(r); ok && u.Name != "" {
		author = u.Name
	}

	now := time.Now()
	item := ActivityReport{
		ID:           generateID("act"),
		Title:        strings.TrimSpace(body.Title),
		Category:     cat,
		ActivityDate: actDate,
		Location:     strings.TrimSpace(body.Location),
		Summary:      strings.TrimSpace(body.Summary),
		BudgetUsed:   body.BudgetUsed,
		ImageURL:     img,
		Author:       author,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	s.store.mu.Lock()
	s.store.db.ActivityReports = append([]ActivityReport{item}, s.store.db.ActivityReports...)
	if err := s.store.saveLocked(); err != nil {
		s.store.mu.Unlock()
		writeError(w, http.StatusInternalServerError, "Gagal menyimpan laporan kegiatan")
		return
	}
	s.store.mu.Unlock()

	s.recordAudit(r, "CREATE_ACTIVITY", item.Title, fmt.Sprintf("%s · %s", item.Category, item.ActivityDate))
	writeJSON(w, http.StatusCreated, item)
}

// PATCH /api/activities/{id}
func (s *Server) handleUpdateActivity(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body struct {
		Title        string `json:"title"`
		Category     string `json:"category"`
		ActivityDate string `json:"activity_date"`
		Location     string `json:"location"`
		Summary      string `json:"summary"`
		BudgetUsed   *int   `json:"budget_used"`
		ImageURL     string `json:"image_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Format update kegiatan tidak valid")
		return
	}

	s.store.mu.Lock()
	for i := range s.store.db.ActivityReports {
		if s.store.db.ActivityReports[i].ID == id {
			act := &s.store.db.ActivityReports[i]
			if strings.TrimSpace(body.Title) != "" {
				act.Title = strings.TrimSpace(body.Title)
			}
			if strings.TrimSpace(body.Category) != "" {
				act.Category = strings.TrimSpace(body.Category)
			}
			if strings.TrimSpace(body.ActivityDate) != "" {
				act.ActivityDate = strings.TrimSpace(body.ActivityDate)
			}
			if strings.TrimSpace(body.Location) != "" {
				act.Location = strings.TrimSpace(body.Location)
			}
			if strings.TrimSpace(body.Summary) != "" {
				act.Summary = strings.TrimSpace(body.Summary)
			}
			if body.BudgetUsed != nil && *body.BudgetUsed >= 0 {
				act.BudgetUsed = *body.BudgetUsed
			}
			if strings.TrimSpace(body.ImageURL) != "" {
				act.ImageURL = strings.TrimSpace(body.ImageURL)
			}
			act.UpdatedAt = time.Now()
			updated := *act
			if err := s.store.saveLocked(); err != nil {
				s.store.mu.Unlock()
				writeError(w, http.StatusInternalServerError, "Gagal memperbarui laporan kegiatan")
				return
			}
			s.store.mu.Unlock()
			s.recordAudit(r, "UPDATE_ACTIVITY", updated.Title, updated.ActivityDate)
			writeJSON(w, http.StatusOK, updated)
			return
		}
	}
	s.store.mu.Unlock()
	writeError(w, http.StatusNotFound, "Laporan kegiatan tidak ditemukan")
}

// DELETE /api/activities/{id}
func (s *Server) handleDeleteActivity(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	s.store.mu.Lock()
	var deleted ActivityReport
	found := false
	filtered := make([]ActivityReport, 0, len(s.store.db.ActivityReports))
	for _, a := range s.store.db.ActivityReports {
		if a.ID == id {
			deleted = a
			found = true
			continue
		}
		filtered = append(filtered, a)
	}
	if !found {
		s.store.mu.Unlock()
		writeError(w, http.StatusNotFound, "Laporan kegiatan tidak ditemukan")
		return
	}
	s.store.db.ActivityReports = filtered
	if err := s.store.saveLocked(); err != nil {
		s.store.mu.Unlock()
		writeError(w, http.StatusInternalServerError, "Gagal menghapus laporan kegiatan")
		return
	}
	s.store.mu.Unlock()

	s.recordAudit(r, "DELETE_ACTIVITY", deleted.Title, deleted.ActivityDate)
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// GET /api/settings -> konfigurasi pembayaran & kontak darurat (menghindari hardcode di frontend)
func (s *Server) handleSettings(w http.ResponseWriter, r *http.Request) {
	bankName := os.Getenv("PAYMENT_BANK_NAME")
	if bankName == "" {
		bankName = "BNI"
	}
	accountNo := os.Getenv("PAYMENT_ACCOUNT_NUMBER")
	if accountNo == "" {
		accountNo = "7790080086"
	}
	accountHolder := os.Getenv("PAYMENT_ACCOUNT_HOLDER")
	if accountHolder == "" {
		accountHolder = "Perkumpulan Forum Warga Victoria Hill"
	}
	securityWA := os.Getenv("SECURITY_WHATSAPP")
	if securityWA == "" {
		securityWA = "6281190002424"
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"bank_name":         bankName,
		"account_number":    accountNo,
		"account_holder":    accountHolder,
		"access_card_fee":   50000,
		"security_whatsapp": securityWA,
	})
}

func formatMonthLabelID(period string) string {
	months := map[string]string{
		"01": "Januari", "02": "Februari", "03": "Maret", "04": "April",
		"05": "Mei", "06": "Juni", "07": "Juli", "08": "Agustus",
		"09": "September", "10": "Oktober", "11": "November", "12": "Desember",
	}
	parts := strings.Split(period, "-")
	if len(parts) == 2 {
		if m, ok := months[parts[1]]; ok {
			return m + " " + parts[0]
		}
	}
	return period
}

// GET /api/kas-payments -> admin/bendahara melihat semua, warga melihat milik rumahnya sendiri
func (s *Server) handleListKasPayments(w http.ResponseWriter, r *http.Request) {
	user, _ := s.currentUser(r)
	isStaff := s.hasAnyRole(user, "admin", "bendahara")
	s.store.mu.RLock()
	out := make([]KasPaymentSubmission, 0, len(s.store.db.KasPayments))
	for _, kp := range s.store.db.KasPayments {
		if isStaff || strings.EqualFold(kp.HouseCode, user.HouseCode) {
			out = append(out, kp)
		}
	}
	s.store.mu.RUnlock()
	writeJSON(w, http.StatusOK, out)
}

// POST /api/kas-payments -> warga mengirim form + bukti transfer pembayaran KAS
func (s *Server) handleCreateKasPayment(w http.ResponseWriter, r *http.Request) {
	var body struct {
		FundType    string `json:"fund_type"` // "KAS_WARGA" | "KAS_MESJID"
		Period      string `json:"period"`
		PayerName   string `json:"payer_name"`
		HouseCode   string `json:"house_code"`
		Amount      int    `json:"amount"`
		PaymentDate string `json:"payment_date"`
		Note        string `json:"note"`
		ProofURL    string `json:"proof_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Format konfirmasi pembayaran tidak valid")
		return
	}
	fundType := normalizeFundType(body.FundType)
	if fundType != "KAS_WARGA" && fundType != "KAS_MESJID" {
		fundType = "KAS_WARGA"
	}
	if strings.TrimSpace(body.PayerName) == "" || body.Amount <= 0 {
		writeError(w, http.StatusBadRequest, "Nama pembayar dan nominal (> 0) wajib diisi")
		return
	}
	if strings.TrimSpace(body.ProofURL) == "" {
		writeError(w, http.StatusBadRequest, "Bukti pembayaran wajib diunggah")
		return
	}
	payDate := strings.TrimSpace(body.PaymentDate)
	if payDate == "" {
		payDate = time.Now().Format("2006-01-02")
	}
	period := strings.TrimSpace(body.Period)
	if period == "" && len(payDate) >= 7 {
		period = payDate[:7]
	}
	houseCode := strings.TrimSpace(body.HouseCode)
	if u, ok := s.currentUser(r); ok && !s.hasAnyRole(u, "admin", "bendahara") && u.HouseCode != "" {
		houseCode = u.HouseCode
	}
	if houseCode == "" {
		writeError(w, http.StatusBadRequest, "Blok / kode rumah wajib diisi")
		return
	}

	now := time.Now()
	sub := KasPaymentSubmission{
		ID:          generateID("kp"),
		FundType:    fundType,
		Period:      period,
		PayerName:   strings.TrimSpace(body.PayerName),
		HouseCode:   houseCode,
		Amount:      body.Amount,
		PaymentDate: payDate,
		Note:        strings.TrimSpace(body.Note),
		ProofURL:    strings.TrimSpace(body.ProofURL),
		Status:      "Menunggu Verifikasi",
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	s.store.mu.Lock()
	s.store.db.KasPayments = append([]KasPaymentSubmission{sub}, s.store.db.KasPayments...)
	if err := s.store.saveLocked(); err != nil {
		s.store.mu.Unlock()
		writeError(w, http.StatusInternalServerError, "Gagal menyimpan konfirmasi pembayaran kas")
		return
	}
	s.store.mu.Unlock()

	s.recordAudit(r, "CREATE_KAS_PAYMENT", fundType+" "+houseCode, fmt.Sprintf("Rp %d (%s)", sub.Amount, sub.Period))
	writeJSON(w, http.StatusCreated, sub)
}

// PATCH /api/kas-payments/{id} -> Admin/Bendahara approve atau tolak bukti pembayaran; jika Disetujui otomatis masuk ke rincian kas
func (s *Server) handleReviewKasPayment(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body struct {
		Status    string `json:"status"` // "Disetujui" | "Ditolak"
		AdminNote string `json:"admin_note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Format verifikasi tidak valid")
		return
	}
	if body.Status != "Disetujui" && body.Status != "Ditolak" {
		writeError(w, http.StatusBadRequest, "Status harus Disetujui atau Ditolak")
		return
	}

	s.store.mu.Lock()
	targetIdx := -1
	for i := range s.store.db.KasPayments {
		if s.store.db.KasPayments[i].ID == id {
			targetIdx = i
			break
		}
	}
	if targetIdx == -1 {
		s.store.mu.Unlock()
		writeError(w, http.StatusNotFound, "Data konfirmasi pembayaran kas tidak ditemukan")
		return
	}

	sub := &s.store.db.KasPayments[targetIdx]
	prevStatus := sub.Status
	sub.Status = body.Status
	sub.AdminNote = strings.TrimSpace(body.AdminNote)
	sub.UpdatedAt = time.Now()

	// Jika baru disetujui, otomatis catat ke rincian FinanceReport periode terkait
	if body.Status == "Disetujui" && prevStatus != "Disetujui" {
		repIdx := -1
		for i := range s.store.db.FinanceReports {
			rep := &s.store.db.FinanceReports[i]
			if rep.Period == sub.Period && (rep.Type == sub.FundType || (sub.FundType == "KAS_WARGA" && rep.Type == "KAS")) {
				repIdx = i
				break
			}
		}
		if repIdx == -1 {
			// Buat laporan periode baru secara otomatis jika belum ada
			opening := 0
			var latestPrev *FinanceReport
			for i := range s.store.db.FinanceReports {
				rep := &s.store.db.FinanceReports[i]
				if rep.Type == sub.FundType && rep.Period < sub.Period {
					if latestPrev == nil || rep.Period > latestPrev.Period {
						latestPrev = rep
					}
				}
			}
			if latestPrev != nil {
				opening = latestPrev.Balance
			}
			newRep := FinanceReport{
				ID:             fmt.Sprintf("rep-%s-%s", strings.ToLower(sub.FundType), sub.Period),
				Type:           sub.FundType,
				Period:         sub.Period,
				MonthLabel:     formatMonthLabelID(sub.Period),
				OpeningBalance: opening,
				Items:          []FinanceItem{},
			}
			s.store.db.FinanceReports = append([]FinanceReport{newRep}, s.store.db.FinanceReports...)
			repIdx = 0
		}

		catLabel := "KAS Warga"
		if sub.FundType == "KAS_MESJID" {
			catLabel = "Infaq Mesjid"
		}
		desc := fmt.Sprintf("Pembayaran %s — %s (%s)", catLabel, sub.PayerName, sub.HouseCode)
		if sub.Note != "" {
			desc += " · " + sub.Note
		}
		txItem := FinanceItem{
			ID:          generateID("tx"),
			Date:        sub.PaymentDate,
			Description: desc,
			Category:    catLabel,
			Kind:        "Masuk",
			Amount:      sub.Amount,
		}
		rep := &s.store.db.FinanceReports[repIdx]
		rep.Items = append(rep.Items, txItem)
		recalculateFinanceReport(rep)
		sortFinanceReports(s.store.db.FinanceReports)
		sub.FinanceRefID = txItem.ID
	}

	updated := *sub
	if err := s.store.saveLocked(); err != nil {
		s.store.mu.Unlock()
		writeError(w, http.StatusInternalServerError, "Gagal menyimpan hasil verifikasi pembayaran kas")
		return
	}
	s.store.mu.Unlock()

	auditAction := "APPROVE_KAS_PAYMENT"
	if body.Status == "Ditolak" {
		auditAction = "REJECT_KAS_PAYMENT"
	}
	s.recordAudit(r, auditAction, updated.FundType+" "+updated.HouseCode, fmt.Sprintf("Rp %d -> %s", updated.Amount, updated.Status))
	writeJSON(w, http.StatusOK, updated)
}
