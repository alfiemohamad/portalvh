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
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
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

	// Auth
	mux.HandleFunc("POST /api/auth/login", srv.handleLogin)

	// Public & Resident Endpoints
	mux.HandleFunc("GET /api/dashboard", srv.handleDashboard)
	mux.HandleFunc("GET /api/announcements", srv.handleAnnouncements)
	mux.HandleFunc("POST /api/announcements", srv.handleAnnouncements)
	mux.HandleFunc("DELETE /api/announcements/{id}", srv.requireAdmin(srv.handleDeleteAnnouncement))

	mux.HandleFunc("GET /api/directory", srv.handleDirectory)
	mux.HandleFunc("POST /api/directory/import", srv.requireAdmin(srv.handleImportDirectory))

	mux.HandleFunc("GET /api/facilities", srv.handleFacilities)
	mux.HandleFunc("POST /api/bookings", srv.handleCreateBooking)
	mux.HandleFunc("PATCH /api/bookings/{id}", srv.requireAdmin(srv.handleUpdateBooking))

	mux.HandleFunc("GET /api/tickets", srv.handleTickets)
	mux.HandleFunc("POST /api/tickets", srv.handleTickets)
	mux.HandleFunc("PATCH /api/tickets/{id}", srv.requireAdmin(srv.handleUpdateTicket))

	mux.HandleFunc("GET /api/access-cards", srv.handleAccessCards)
	mux.HandleFunc("POST /api/access-cards", srv.handleAccessCards)
	mux.HandleFunc("PATCH /api/access-cards/{id}", srv.requireAdmin(srv.handleUpdateAccessCard))

	mux.HandleFunc("GET /api/assets", srv.handleAssets)
	mux.HandleFunc("POST /api/asset-loans", srv.handleCreateAssetLoan)
	mux.HandleFunc("PATCH /api/asset-loans/{id}", srv.requireAdmin(srv.handleUpdateAssetLoan))

	mux.HandleFunc("GET /api/cctv", srv.handleCctv)
	mux.HandleFunc("GET /api/finance", srv.handleFinance)
	mux.HandleFunc("GET /api/finance/{id}/download", srv.handleDownloadFinance)
	mux.HandleFunc("POST /api/finance/import", srv.requireAdmin(srv.handleImportFinance))
	mux.HandleFunc("GET /api/templates/{kind}", srv.handleDownloadTemplate)

	mux.HandleFunc("GET /api/umkm", srv.handleUmkm)
	mux.HandleFunc("POST /api/umkm", srv.handleUmkm)

	mux.HandleFunc("GET /api/panic", srv.handlePanic)
	mux.HandleFunc("POST /api/panic", srv.handlePanic)
	mux.HandleFunc("PATCH /api/panic/{id}", srv.requireAdmin(srv.handleResolvePanic))

	mux.HandleFunc("POST /api/upload", srv.handleUpload)

	// Serve uploaded files
	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(uploadDir))))

	log.Printf("Victoria Hill API running on http://localhost:%s", port)
	if err := http.ListenAndServe(":"+port, corsMiddleware(mux)); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
