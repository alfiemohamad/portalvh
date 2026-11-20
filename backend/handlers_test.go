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
	mux.HandleFunc("GET /api/audit-logs", srv.requireAdmin(srv.handleAuditLogs))
	mux.HandleFunc("GET /api/dashboard", srv.handleDashboard)
	mux.HandleFunc("GET /api/directory", srv.handleDirectory)
	mux.HandleFunc("GET /api/facilities", srv.handleFacilities)
	mux.HandleFunc("POST /api/bookings", srv.handleCreateBooking)
	mux.HandleFunc("GET /api/tickets", srv.handleTickets)
	mux.HandleFunc("POST /api/tickets", srv.handleTickets)
	mux.HandleFunc("POST /api/access-cards", srv.handleAccessCards)
	mux.HandleFunc("GET /api/finance", srv.handleFinance)
	mux.HandleFunc("GET /api/finance/{id}/download", srv.handleDownloadFinance)
	mux.HandleFunc("POST /api/finance/import", srv.handleImportFinance)
	mux.HandleFunc("POST /api/directory/import", srv.handleImportDirectory)
	mux.HandleFunc("GET /api/templates/{kind}", srv.handleDownloadTemplate)
	mux.HandleFunc("GET /api/cctv", srv.handleCctv)
	mux.HandleFunc("POST /api/panic", srv.handlePanic)
	return mux
}

func TestCoreEndpoints(t *testing.T) {
	t.Setenv("ADMIN_USERNAME", "pengurus")
	t.Setenv("ADMIN_PASSWORD", "test-secret")
	t.Setenv("RESIDENT_PASSWORD", "warga-secret")
	mux := setupTestMux(t)

	// 1. Dashboard
	req := httptest.NewRequest(http.MethodGet, "/api/dashboard", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /api/dashboard got %d", rec.Code)
	}

	// 2. Directory
	req = httptest.NewRequest(http.MethodGet, "/api/directory?block=Blok%20U", nil)
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /api/directory got %d", rec.Code)
	}

	// 3. Create Ticket
	ticketBody := []byte(`{"category":"Fasilitas Umum","location":"Kolam Renang","reporter_name":"Andi","description":"Lampu mati"}`)
	req = httptest.NewRequest(http.MethodPost, "/api/tickets", bytes.NewReader(ticketBody))
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST /api/tickets got %d: %s", rec.Code, rec.Body.String())
	}

	// 4. Create Access Card Request
	cardBody := []byte(`{"full_name":"Budi","block":"Blok U","house_no":"16"}`)
	req = httptest.NewRequest(http.MethodPost, "/api/access-cards", bytes.NewReader(cardBody))
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST /api/access-cards got %d: %s", rec.Code, rec.Body.String())
	}

	// 5. Finance CSV Download
	req = httptest.NewRequest(http.MethodGet, "/api/finance/rep-ipl-2026-11/download", nil)
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || rec.Header().Get("Content-Type") != "text/csv; charset=utf-8" {
		t.Fatalf("GET /api/finance/download got %d, ct=%s", rec.Code, rec.Header().Get("Content-Type"))
	}

	// 6. Admin Login
	loginBody := []byte(`{"username":"pengurus","password":"test-secret"}`)
	req = httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(loginBody))
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("POST /api/auth/login got %d", rec.Code)
	}
	var loginRes map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &loginRes); err != nil || loginRes["token"] == "" {
		t.Fatalf("expected auth token, got %s", rec.Body.String())
	}

	// 7. Finance Excel (.xlsx) Download
	req = httptest.NewRequest(http.MethodGet, "/api/finance/rep-ipl-2026-11/download?format=xlsx", nil)
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || rec.Header().Get("Content-Type") != "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" {
		t.Fatalf("GET /api/finance/download?format=xlsx got %d, ct=%s", rec.Code, rec.Header().Get("Content-Type"))
	}

	// 8. Finance Excel (.xlsx) Import
	xf := excelize.NewFile()
	_ = xf.SetSheetRow("Sheet1", "A1", &[]string{"Tanggal", "Keterangan", "Kategori", "Jenis", "Nominal"})
	_ = xf.SetSheetRow("Sheet1", "A2", &[]string{"2026-12-01", "Iuran IPL Desember", "Iuran IPL", "Masuk", "20000000"})
	var xbuf bytes.Buffer
	if err := xf.Write(&xbuf); err != nil {
		t.Fatalf("failed to write test xlsx: %v", err)
	}
	var mpBuf bytes.Buffer
	mw := multipart.NewWriter(&mpBuf)
	fw, _ := mw.CreateFormFile("file", "laporan_des.xlsx")
	_, _ = fw.Write(xbuf.Bytes())
	_ = mw.WriteField("type", "IPL")
	_ = mw.WriteField("period", "2026-12")
	_ = mw.WriteField("month_label", "Desember 2026")
	mw.Close()
	req = httptest.NewRequest(http.MethodPost, "/api/finance/import", &mpBuf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST /api/finance/import xlsx got %d: %s", rec.Code, rec.Body.String())
	}

	// 9. Directory CSV Import
	var csvMp bytes.Buffer
	cmw := multipart.NewWriter(&csvMp)
	cfw, _ := cmw.CreateFormFile("file", "warga.csv")
	_, _ = cfw.Write([]byte("Blok,Kode,No Rumah,Status,Kepala Keluarga,Telepon,Jumlah Penghuni\nBlok C,C01,01,Dihuni,Rudi Hartono,081299990000,3\n"))
	cmw.Close()
	req = httptest.NewRequest(http.MethodPost, "/api/directory/import", &csvMp)
	req.Header.Set("Content-Type", cmw.FormDataContentType())
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST /api/directory/import csv got %d: %s", rec.Code, rec.Body.String())
	}

	// 10. Resident Login + Download Audit Trail
	resLoginBody := []byte(`{"mode":"resident","house_code":"U01","password":"warga-secret"}`)
	req = httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(resLoginBody))
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("POST /api/auth/login resident got %d: %s", rec.Code, rec.Body.String())
	}

	adminToken, _ := loginRes["token"].(string)
	req = httptest.NewRequest(http.MethodGet, "/api/audit-logs", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /api/audit-logs got %d: %s", rec.Code, rec.Body.String())
	}
	var logs []AuditLog
	if err := json.Unmarshal(rec.Body.Bytes(), &logs); err != nil || len(logs) == 0 {
		t.Fatalf("expected non-empty audit logs, got %s", rec.Body.String())
	}
}
