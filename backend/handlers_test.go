package main

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/xuri/excelize/v2"
)

func setupTestMux(t *testing.T) http.Handler {
	t.Helper()
	tmp := t.TempDir()
	store, err := NewStore(filepath.Join(tmp, "test.json"))
	if err != nil {
		t.Fatalf("failed to create store: %v", err)
	}
	srv := NewServer(store, filepath.Join(tmp, "uploads"))
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/auth/login", srv.handleLogin)
	mux.HandleFunc("GET /api/auth/houses", srv.handleAuthHouses)
	mux.HandleFunc("GET /api/auth/me", srv.requireAuth(srv.handleMe))
	mux.HandleFunc("POST /api/auth/logout", srv.requireAuth(srv.handleLogout))
	mux.HandleFunc("GET /api/settings", srv.requireAuth(srv.handleSettings))
	mux.HandleFunc("GET /api/audit-logs", srv.requireRole("admin")(srv.handleAuditLogs))
	mux.HandleFunc("GET /api/dashboard", srv.requireAuth(srv.handleDashboard))
	mux.HandleFunc("GET /api/directory", srv.requireAuth(srv.handleDirectory))
	mux.HandleFunc("GET /api/facilities", srv.requireAuth(srv.handleFacilities))
	mux.HandleFunc("POST /api/bookings", srv.requireAuth(srv.handleCreateBooking))
	mux.HandleFunc("GET /api/tickets", srv.requireAuth(srv.handleTickets))
	mux.HandleFunc("POST /api/tickets", srv.requireAuth(srv.handleTickets))
	mux.HandleFunc("GET /api/access-cards", srv.requireAuth(srv.handleAccessCards))
	mux.HandleFunc("POST /api/access-cards", srv.requireAuth(srv.handleAccessCards))
	mux.HandleFunc("GET /api/finance", srv.requireAuth(srv.handleFinance))
	mux.HandleFunc("GET /api/finance/{id}/download", srv.requireAuth(srv.handleDownloadFinance))
	mux.HandleFunc("POST /api/finance/reports", srv.requireRole("admin", "bendahara")(srv.handleCreateFinanceReport))
	mux.HandleFunc("PATCH /api/finance/reports/{id}", srv.requireRole("admin", "bendahara")(srv.handleUpdateFinanceReport))
	mux.HandleFunc("DELETE /api/finance/reports/{id}", srv.requireRole("admin", "bendahara")(srv.handleDeleteFinanceReport))
	mux.HandleFunc("POST /api/finance/reports/{id}/items", srv.requireRole("admin", "bendahara")(srv.handleAddFinanceItem))
	mux.HandleFunc("PATCH /api/finance/reports/{id}/items/{itemId}", srv.requireRole("admin", "bendahara")(srv.handleUpdateFinanceItem))
	mux.HandleFunc("DELETE /api/finance/reports/{id}/items/{itemId}", srv.requireRole("admin", "bendahara")(srv.handleDeleteFinanceItem))
	mux.HandleFunc("POST /api/finance/import", srv.requireRole("admin", "bendahara")(srv.handleImportFinance))
	mux.HandleFunc("POST /api/directory/import", srv.requireRole("admin")(srv.handleImportDirectory))
	mux.HandleFunc("GET /api/templates/{kind}", srv.requireRole("admin", "bendahara")(srv.handleDownloadTemplate))
	mux.HandleFunc("GET /api/kas-payments", srv.requireAuth(srv.handleListKasPayments))
	mux.HandleFunc("POST /api/kas-payments", srv.requireAuth(srv.handleCreateKasPayment))
	mux.HandleFunc("PATCH /api/kas-payments/{id}", srv.requireRole("admin", "bendahara")(srv.handleReviewKasPayment))
	mux.HandleFunc("GET /api/activities", srv.requireAuth(srv.handleListActivities))
	mux.HandleFunc("POST /api/activities", srv.requireRole("admin")(srv.handleCreateActivity))
	mux.HandleFunc("PATCH /api/activities/{id}", srv.requireRole("admin")(srv.handleUpdateActivity))
	mux.HandleFunc("DELETE /api/activities/{id}", srv.requireRole("admin")(srv.handleDeleteActivity))
	mux.HandleFunc("GET /api/cctv", srv.requireAuth(srv.handleCctv))
	mux.HandleFunc("POST /api/panic", srv.requireAuth(srv.handlePanic))
	return mux
}

func authReq(method, target string, body []byte, token string) *http.Request {
	var r *http.Request
	if body != nil {
		r = httptest.NewRequest(method, target, bytes.NewReader(body))
	} else {
		r = httptest.NewRequest(method, target, nil)
	}
	if token != "" {
		r.Header.Set("Authorization", "Bearer "+token)
	}
	return r
}

func TestCoreEndpointsAndSecurity(t *testing.T) {
	t.Setenv("ADMIN_USERNAME", "pengurus")
	t.Setenv("ADMIN_PASSWORD", "test-secret")
	t.Setenv("RESIDENT_PASSWORD", "warga-secret")
	mux := setupTestMux(t)

	// 1. Unauthenticated requests must be rejected with 401
	for _, path := range []string{"/api/dashboard", "/api/directory", "/api/access-cards", "/api/finance", "/api/activities", "/api/audit-logs"} {
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, authReq(http.MethodGet, path, nil, ""))
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("GET %s without token expected 401, got %d", path, rec.Code)
		}
	}

	// 2. Resident Login (MVP shared password)
	resLoginBody := []byte(`{"mode":"resident","house_code":"U01","password":"warga-secret"}`)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, authReq(http.MethodPost, "/api/auth/login", resLoginBody, ""))
	if rec.Code != http.StatusOK {
		t.Fatalf("POST /api/auth/login resident got %d: %s", rec.Code, rec.Body.String())
	}
	var resLogin struct {
		Token string      `json:"token"`
		User  SessionUser `json:"user"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resLogin); err != nil || resLogin.Token == "" {
		t.Fatalf("expected resident token, got %s", rec.Body.String())
	}
	resToken := resLogin.Token

	// 3. Verify /api/auth/me works with Bearer header
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, authReq(http.MethodGet, "/api/auth/me", nil, resToken))
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /api/auth/me got %d", rec.Code)
	}

	// 4. Query-param token (?token=...) must NOT be accepted anymore
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/finance/rep-ipl-2026-11/download?token="+resToken, nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for query-param token, got %d", rec.Code)
	}

	// 5. Resident cannot access admin endpoints (403 Forbidden)
	for _, tc := range []struct {
		method string
		path   string
		body   []byte
	}{
		{http.MethodGet, "/api/audit-logs", nil},
		{http.MethodPost, "/api/finance/reports", []byte(`{"type":"KAS_WARGA","period":"2026-12"}`)},
		{http.MethodPost, "/api/activities", []byte(`{"title":"Test","summary":"Test"}`)},
	} {
		rec = httptest.NewRecorder()
		mux.ServeHTTP(rec, authReq(tc.method, tc.path, tc.body, resToken))
		if rec.Code != http.StatusForbidden {
			t.Fatalf("%s %s as resident expected 403, got %d", tc.method, tc.path, rec.Code)
		}
	}

	// 6. Dashboard & Directory (verify decrypted & masked response)
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, authReq(http.MethodGet, "/api/dashboard", nil, resToken))
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /api/dashboard got %d", rec.Code)
	}

	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, authReq(http.MethodGet, "/api/directory?block=Blok%20U", nil, resToken))
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /api/directory got %d", rec.Code)
	}
	var dirRes struct {
		Houses []ResidentHouse `json:"houses"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &dirRes); err != nil || len(dirRes.Houses) == 0 {
		t.Fatalf("expected directory houses, got %s", rec.Body.String())
	}
	if dirRes.Houses[0].HeadOfHome == "" || dirRes.Houses[0].HeadOfHome[:4] == "enc:" || dirRes.Houses[0].HeadOfHome[1] != '*' {
		t.Fatalf("expected decrypted+masked name, got %q", dirRes.Houses[0].HeadOfHome)
	}

	// 7. Create Ticket & Access Card Request as Resident
	ticketBody := []byte(`{"category":"Fasilitas Umum","location":"Kolam Renang","reporter_name":"Andi","description":"Lampu mati"}`)
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, authReq(http.MethodPost, "/api/tickets", ticketBody, resToken))
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST /api/tickets got %d: %s", rec.Code, rec.Body.String())
	}

	cardBody := []byte(`{"full_name":"Budi","block":"Blok U","house_no":"01"}`)
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, authReq(http.MethodPost, "/api/access-cards", cardBody, resToken))
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST /api/access-cards got %d: %s", rec.Code, rec.Body.String())
	}

	// Resident only sees own house access-card requests (U01), not U02 seed
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, authReq(http.MethodGet, "/api/access-cards", nil, resToken))
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /api/access-cards got %d", rec.Code)
	}
	var ownCards []AccessCardRequest
	_ = json.Unmarshal(rec.Body.Bytes(), &ownCards)
	if len(ownCards) != 1 || ownCards[0].HouseNo != "01" {
		t.Fatalf("expected resident to only see own U01 access card, got %+v", ownCards)
	}

	// 8. Finance CSV & XLSX Download with Bearer header
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, authReq(http.MethodGet, "/api/finance/rep-ipl-2026-11/download", nil, resToken))
	if rec.Code != http.StatusOK || rec.Header().Get("Content-Type") != "text/csv; charset=utf-8" {
		t.Fatalf("GET /api/finance/download csv got %d, ct=%s", rec.Code, rec.Header().Get("Content-Type"))
	}
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, authReq(http.MethodGet, "/api/finance/rep-ipl-2026-11/download?format=xlsx", nil, resToken))
	if rec.Code != http.StatusOK || rec.Header().Get("Content-Type") != "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" {
		t.Fatalf("GET /api/finance/download xlsx got %d, ct=%s", rec.Code, rec.Header().Get("Content-Type"))
	}

	// 9. Admin Login
	loginBody := []byte(`{"username":"pengurus","password":"test-secret"}`)
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, authReq(http.MethodPost, "/api/auth/login", loginBody, ""))
	if rec.Code != http.StatusOK {
		t.Fatalf("POST /api/auth/login admin got %d", rec.Code)
	}
	var adminLogin struct {
		Token string      `json:"token"`
		User  SessionUser `json:"user"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &adminLogin); err != nil || adminLogin.Token == "" {
		t.Fatalf("expected admin auth token, got %s", rec.Body.String())
	}
	adminToken := adminLogin.Token

	// 10. Admin Finance CRUD (Create period + Add cashflow item + Verify balance recalc)
	newRepBody := []byte(`{"type":"KAS_WARGA","period":"2026-12","month_label":"Desember 2026","opening_balance":1000000,"notes":"Kas akhir tahun"}`)
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, authReq(http.MethodPost, "/api/finance/reports", newRepBody, adminToken))
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST /api/finance/reports got %d: %s", rec.Code, rec.Body.String())
	}
	var createdRep FinanceReport
	_ = json.Unmarshal(rec.Body.Bytes(), &createdRep)

	txBody := []byte(`{"date":"2026-12-05","description":"Iuran Kas Desember","category":"KAS Warga","kind":"Masuk","amount":500000}`)
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, authReq(http.MethodPost, "/api/finance/reports/"+createdRep.ID+"/items", txBody, adminToken))
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST /api/finance/reports/{id}/items got %d: %s", rec.Code, rec.Body.String())
	}
	var txRes struct {
		Item   FinanceItem   `json:"item"`
		Report FinanceReport `json:"report"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &txRes)
	if txRes.Report.Balance != 1500000 || txRes.Report.TotalIncome != 500000 {
		t.Fatalf("expected balance 1500000 & income 500000, got %+v", txRes.Report)
	}

	// 11. Admin Activity Report CRUD
	actBody := []byte(`{"title":"Pengajian Akhir Tahun","category":"Keagamaan","activity_date":"2026-12-20","location":"Mesjid Algulfrah","summary":"Pengajian dan doa bersama warga.","budget_used":500000}`)
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, authReq(http.MethodPost, "/api/activities", actBody, adminToken))
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST /api/activities got %d: %s", rec.Code, rec.Body.String())
	}
	var createdAct ActivityReport
	_ = json.Unmarshal(rec.Body.Bytes(), &createdAct)
	if createdAct.ID == "" {
		t.Fatalf("expected created activity ID")
	}

	// 12. Finance Excel (.xlsx) Import as Admin
	xf := excelize.NewFile()
	_ = xf.SetSheetRow("Sheet1", "A1", &[]string{"Tanggal", "Keterangan", "Kategori", "Jenis", "Nominal"})
	_ = xf.SetSheetRow("Sheet1", "A2", &[]string{"2026-12-01", "Iuran IPL Desember", "Iuran IPL", "Masuk", "20000000"})
	var xbuf bytes.Buffer
	_ = xf.Write(&xbuf)
	var mpBuf bytes.Buffer
	mw := multipart.NewWriter(&mpBuf)
	fw, _ := mw.CreateFormFile("file", "laporan_des.xlsx")
	_, _ = fw.Write(xbuf.Bytes())
	_ = mw.WriteField("type", "IPL")
	_ = mw.WriteField("period", "2026-12")
	_ = mw.WriteField("month_label", "Desember 2026")
	mw.Close()
	req := httptest.NewRequest(http.MethodPost, "/api/finance/import", &mpBuf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+adminToken)
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST /api/finance/import xlsx got %d: %s", rec.Code, rec.Body.String())
	}

	// 13. Audit Trail as Admin
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, authReq(http.MethodGet, "/api/audit-logs", nil, adminToken))
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /api/audit-logs got %d: %s", rec.Code, rec.Body.String())
	}
	var logs []AuditLog
	if err := json.Unmarshal(rec.Body.Bytes(), &logs); err != nil || len(logs) == 0 {
		t.Fatalf("expected non-empty audit logs, got %s", rec.Body.String())
	}

	// 14. Resident submits Kas Payment proof -> Admin approves -> automatically added to FinanceReport items
	kpBody := []byte(`{"fund_type":"KAS_WARGA","period":"2026-12","payer_name":"Warga U01","house_code":"U01","amount":250000,"payment_date":"2026-12-10","note":"Kas Desember","proof_url":"/uploads/bukti.png"}`)
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, authReq(http.MethodPost, "/api/kas-payments", kpBody, resToken))
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST /api/kas-payments got %d: %s", rec.Code, rec.Body.String())
	}
	var createdKP KasPaymentSubmission
	_ = json.Unmarshal(rec.Body.Bytes(), &createdKP)

	// Resident cannot approve own payment (403)
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, authReq(http.MethodPatch, "/api/kas-payments/"+createdKP.ID, []byte(`{"status":"Disetujui"}`), resToken))
	if rec.Code != http.StatusForbidden {
		t.Fatalf("resident approve kas payment expected 403, got %d", rec.Code)
	}

	// Admin approves -> check finance_ref_id & updated report balance (1500000 + 250000 = 1750000)
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, authReq(http.MethodPatch, "/api/kas-payments/"+createdKP.ID, []byte(`{"status":"Disetujui","admin_note":"Dana masuk BNI"}`), adminToken))
	if rec.Code != http.StatusOK {
		t.Fatalf("admin approve kas payment got %d: %s", rec.Code, rec.Body.String())
	}
	var approvedKP KasPaymentSubmission
	_ = json.Unmarshal(rec.Body.Bytes(), &approvedKP)
	if approvedKP.FinanceRefID == "" || approvedKP.Status != "Disetujui" {
		t.Fatalf("expected approved kas payment with finance_ref_id, got %+v", approvedKP)
	}

	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, authReq(http.MethodGet, "/api/finance?type=KAS_WARGA", nil, resToken))
	var kasReps []FinanceReport
	_ = json.Unmarshal(rec.Body.Bytes(), &kasReps)
	if len(kasReps) == 0 || kasReps[0].Balance != 1750000 {
		t.Fatalf("expected KAS_WARGA 2026-12 balance 1750000 after approval, got %+v", kasReps)
	}

	// 15. Logout revokes token
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, authReq(http.MethodPost, "/api/auth/logout", nil, resToken))
	if rec.Code != http.StatusOK {
		t.Fatalf("POST /api/auth/logout got %d", rec.Code)
	}
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, authReq(http.MethodGet, "/api/auth/me", nil, resToken))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 after logout, got %d", rec.Code)
	}
}
