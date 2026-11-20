package main

import (
	"bufio"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func loadDotEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		k, v, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key := strings.TrimSpace(k)
		val := strings.TrimSpace(v)
		if os.Getenv(key) == "" {
			_ = os.Setenv(key, val)
		}
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	allowedOrigin := strings.TrimSpace(os.Getenv("CORS_ORIGIN"))
	if allowedOrigin == "" {
		allowedOrigin = "*"
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	loadDotEnv(".env")
	loadDotEnv("../.env")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dataDir := os.Getenv("DATA_DIR")
	if dataDir == "" {
		dataDir = "data"
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL belum diset. Salin .env.example ke .env dan isi konfigurasi PostgreSQL Anda.")
	}

	store, err := NewPostgresStore(dsn)
	if err != nil {
		log.Fatalf("gagal koneksi ke PostgreSQL (%s): %v", dsn, err)
	}
	log.Println("Terhubung ke PostgreSQL database: victoria_hill")

	uploadDir := filepath.Join(dataDir, "uploads")
	srv := NewServer(store, uploadDir)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{
			"status":   "ok",
			"service":  "victoria-hill-api",
			"database": "postgresql (victoria_hill)",
		})
	})

	// Auth (Publik & Session Management)
	mux.HandleFunc("POST /api/auth/login", srv.handleLogin)
	mux.HandleFunc("GET /api/auth/houses", srv.handleAuthHouses)
	mux.HandleFunc("GET /api/auth/me", srv.requireAuth(srv.handleMe))
	mux.HandleFunc("POST /api/auth/logout", srv.requireAuth(srv.handleLogout))
	mux.HandleFunc("GET /api/settings", srv.requireAuth(srv.handleSettings))
	mux.HandleFunc("GET /api/audit-logs", srv.requireRole("admin")(srv.handleAuditLogs))

	// Resident & Admin Authenticated Endpoints
	mux.HandleFunc("GET /api/dashboard", srv.requireAuth(srv.handleDashboard))
	mux.HandleFunc("GET /api/announcements", srv.requireAuth(srv.handleAnnouncements))
	mux.HandleFunc("POST /api/announcements", srv.requireRole("admin")(srv.handleAnnouncements))
	mux.HandleFunc("DELETE /api/announcements/{id}", srv.requireRole("admin")(srv.handleDeleteAnnouncement))

	// Laporan Kegiatan Warga
	mux.HandleFunc("GET /api/activities", srv.requireAuth(srv.handleListActivities))
	mux.HandleFunc("POST /api/activities", srv.requireRole("admin")(srv.handleCreateActivity))
	mux.HandleFunc("PATCH /api/activities/{id}", srv.requireRole("admin")(srv.handleUpdateActivity))
	mux.HandleFunc("DELETE /api/activities/{id}", srv.requireRole("admin")(srv.handleDeleteActivity))

	mux.HandleFunc("GET /api/directory", srv.requireAuth(srv.handleDirectory))
	mux.HandleFunc("POST /api/directory/import", srv.requireRole("admin")(srv.handleImportDirectory))

	mux.HandleFunc("GET /api/facilities", srv.requireAuth(srv.handleFacilities))
	mux.HandleFunc("POST /api/bookings", srv.requireAuth(srv.handleCreateBooking))
	mux.HandleFunc("PATCH /api/bookings/{id}", srv.requireRole("admin")(srv.handleUpdateBooking))

	mux.HandleFunc("GET /api/tickets", srv.requireAuth(srv.handleTickets))
	mux.HandleFunc("POST /api/tickets", srv.requireAuth(srv.handleTickets))
	mux.HandleFunc("PATCH /api/tickets/{id}", srv.requireRole("admin", "keamanan")(srv.handleUpdateTicket))

	mux.HandleFunc("GET /api/access-cards", srv.requireAuth(srv.handleAccessCards))
	mux.HandleFunc("POST /api/access-cards", srv.requireAuth(srv.handleAccessCards))
	mux.HandleFunc("PATCH /api/access-cards/{id}", srv.requireRole("admin", "keamanan")(srv.handleUpdateAccessCard))

	mux.HandleFunc("GET /api/assets", srv.requireAuth(srv.handleAssets))
	mux.HandleFunc("POST /api/asset-loans", srv.requireAuth(srv.handleCreateAssetLoan))
	mux.HandleFunc("PATCH /api/asset-loans/{id}", srv.requireRole("admin")(srv.handleUpdateAssetLoan))

	mux.HandleFunc("GET /api/cctv", srv.requireAuth(srv.handleCctv))

	// Keuangan (IPL, KAS_WARGA, KAS_MESJID) — siap RBAC bendahara di fase lanjutan
	mux.HandleFunc("GET /api/finance", srv.requireAuth(srv.handleFinance))
	mux.HandleFunc("GET /api/finance/{id}/download", srv.requireAuth(srv.handleDownloadFinance))
	mux.HandleFunc("POST /api/finance/reports", srv.requireRole("admin", "bendahara")(srv.handleCreateFinanceReport))
	mux.HandleFunc("PATCH /api/finance/reports/{id}", srv.requireRole("admin", "bendahara")(srv.handleUpdateFinanceReport))
	mux.HandleFunc("DELETE /api/finance/reports/{id}", srv.requireRole("admin", "bendahara")(srv.handleDeleteFinanceReport))
	mux.HandleFunc("POST /api/finance/reports/{id}/items", srv.requireRole("admin", "bendahara")(srv.handleAddFinanceItem))
	mux.HandleFunc("PATCH /api/finance/reports/{id}/items/{itemId}", srv.requireRole("admin", "bendahara")(srv.handleUpdateFinanceItem))
	mux.HandleFunc("DELETE /api/finance/reports/{id}/items/{itemId}", srv.requireRole("admin", "bendahara")(srv.handleDeleteFinanceItem))
	mux.HandleFunc("POST /api/finance/import", srv.requireRole("admin", "bendahara")(srv.handleImportFinance))
	mux.HandleFunc("GET /api/templates/{kind}", srv.requireRole("admin", "bendahara")(srv.handleDownloadTemplate))

	// Konfirmasi & Approval Pembayaran KAS Warga / Mesjid
	mux.HandleFunc("GET /api/kas-payments", srv.requireAuth(srv.handleListKasPayments))
	mux.HandleFunc("POST /api/kas-payments", srv.requireAuth(srv.handleCreateKasPayment))
	mux.HandleFunc("PATCH /api/kas-payments/{id}", srv.requireRole("admin", "bendahara")(srv.handleReviewKasPayment))

	mux.HandleFunc("GET /api/umkm", srv.requireAuth(srv.handleUmkm))
	mux.HandleFunc("POST /api/umkm", srv.requireAuth(srv.handleUmkm))

	mux.HandleFunc("GET /api/panic", srv.requireAuth(srv.handlePanic))
	mux.HandleFunc("POST /api/panic", srv.requireAuth(srv.handlePanic))
	mux.HandleFunc("PATCH /api/panic/{id}", srv.requireRole("admin", "keamanan")(srv.handleResolvePanic))

	mux.HandleFunc("POST /api/upload", srv.requireAuth(srv.handleUpload))

	// Serve uploaded files (wajib terautentikasi untuk melindungi dokumen warga seperti foto STNK)
	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(uploadDir))))
	mux.HandleFunc("GET /api/uploads/{filename}", srv.requireAuth(srv.handleServeUpload))

	log.Printf("Victoria Hill API running on http://localhost:%s", port)
	if err := http.ListenAndServe(":"+port, corsMiddleware(mux)); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
