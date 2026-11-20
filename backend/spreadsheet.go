package main

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/xuri/excelize/v2"
)

func parseSpreadsheetRows(filename string, r io.Reader) ([][]string, error) {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".csv":
		reader := csv.NewReader(r)
		reader.FieldsPerRecord = -1
		return reader.ReadAll()
	case ".xlsx":
		data, err := io.ReadAll(r)
		if err != nil {
			return nil, err
		}
		f, err := excelize.OpenReader(bytes.NewReader(data))
		if err != nil {
			return nil, fmt.Errorf("gagal membaca file Excel (.xlsx): %w", err)
		}
		defer f.Close()
		sheets := f.GetSheetList()
		if len(sheets) == 0 {
			return nil, fmt.Errorf("file Excel tidak memiliki sheet")
		}
		return f.GetRows(sheets[0])
	default:
		return nil, fmt.Errorf("format file harus .csv atau .xlsx")
	}
}

func parseAmountInt(raw string) int {
	cleaned := strings.ReplaceAll(raw, "Rp", "")
	cleaned = strings.ReplaceAll(cleaned, "rp", "")
	cleaned = strings.ReplaceAll(cleaned, ".", "")
	cleaned = strings.ReplaceAll(cleaned, ",", "")
	cleaned = strings.TrimSpace(cleaned)
	v, _ := strconv.Atoi(cleaned)
	return v
}

// POST /api/finance/import (multipart: file (.csv/.xlsx), type (IPL|KAS), period, month_label)
func (s *Server) handleImportFinance(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "Gagal membaca form upload")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "File CSV atau Excel (.xlsx) wajib disertakan")
		return
	}
	defer file.Close()

	rows, err := parseSpreadsheetRows(header.Filename, file)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if len(rows) < 2 {
		writeError(w, http.StatusBadRequest, "File kosong atau tidak memiliki baris data")
		return
	}

	reportType := strings.ToUpper(strings.TrimSpace(r.FormValue("type")))
	if reportType != "IPL" && reportType != "KAS" {
		reportType = "IPL"
	}
	period := strings.TrimSpace(r.FormValue("period"))
	if period == "" {
		period = "2026-11"
	}
	monthLabel := strings.TrimSpace(r.FormValue("month_label"))
	if monthLabel == "" {
		monthLabel = period
	}

	items := []FinanceItem{}
	totalIncome := 0
	totalSpend := 0

	for idx, row := range rows {
		if idx == 0 {
			// Skip header row if it looks like a header
			first := strings.ToLower(strings.Join(row, " "))
			if strings.Contains(first, "tanggal") || strings.Contains(first, "date") || strings.Contains(first, "keterangan") {
				continue
			}
		}
		if len(row) < 5 {
			continue
		}
		date := strings.TrimSpace(row[0])
		desc := strings.TrimSpace(row[1])
		cat := strings.TrimSpace(row[2])
		kindRaw := strings.ToLower(strings.TrimSpace(row[3]))
		amount := parseAmountInt(row[4])
		if desc == "" || amount <= 0 {
			continue
		}
		kind := "Masuk"
		if strings.Contains(kindRaw, "keluar") || strings.Contains(kindRaw, "out") || strings.Contains(kindRaw, "spend") {
			kind = "Keluar"
			totalSpend += amount
		} else {
			totalIncome += amount
		}
		items = append(items, FinanceItem{
			Date:        date,
			Description: desc,
			Category:    cat,
			Kind:        kind,
			Amount:      amount,
		})
	}

	if len(items) == 0 {
		writeError(w, http.StatusBadRequest, "Tidak ada baris transaksi valid. Pastikan kolom: Tanggal, Keterangan, Kategori, Jenis (Masuk/Keluar), Nominal")
		return
	}

	reportID := fmt.Sprintf("rep-%s-%s", strings.ToLower(reportType), period)
	newReport := FinanceReport{
		ID:          reportID,
		Type:        reportType,
		Period:      period,
		MonthLabel:  monthLabel,
		TotalIncome: totalIncome,
		TotalSpend:  totalSpend,
		Balance:     totalIncome - totalSpend,
		Items:       items,
	}

	s.store.mu.Lock()
	replaced := false
	for i := range s.store.db.FinanceReports {
		if s.store.db.FinanceReports[i].ID == reportID {
			s.store.db.FinanceReports[i] = newReport
			replaced = true
			break
		}
	}
	if !replaced {
		s.store.db.FinanceReports = append([]FinanceReport{newReport}, s.store.db.FinanceReports...)
	}
	_ = s.store.saveLocked()
	s.store.mu.Unlock()

	s.recordAudit(r, "IMPORT_FINANCE", reportType+" "+monthLabel, fmt.Sprintf("Impor %d transaksi dari %s", len(items), header.Filename))
	writeJSON(w, http.StatusCreated, map[string]any{
		"message": fmt.Sprintf("Berhasil mengimpor %d transaksi dari %s", len(items), header.Filename),
		"report":  newReport,
	})
}

// POST /api/directory/import (multipart: file (.csv/.xlsx))
func (s *Server) handleImportDirectory(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "Gagal membaca form upload")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "File CSV atau Excel (.xlsx) wajib disertakan")
		return
	}
	defer file.Close()

	rows, err := parseSpreadsheetRows(header.Filename, file)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	imported := 0
	s.store.mu.Lock()
	for idx, row := range rows {
		if idx == 0 {
			first := strings.ToLower(strings.Join(row, " "))
			if strings.Contains(first, "blok") || strings.Contains(first, "kode") {
				continue
			}
		}
		if len(row) < 4 {
			continue
		}
		block := strings.TrimSpace(row[0])
		code := strings.TrimSpace(row[1])
		houseNo := strings.TrimSpace(row[2])
		status := strings.TrimSpace(row[3])
		head := ""
		phone := ""
		members := 0
		if len(row) > 4 {
			head = strings.TrimSpace(row[4])
		}
		if len(row) > 5 {
			phone = strings.TrimSpace(row[5])
		}
		if len(row) > 6 {
			members, _ = strconv.Atoi(strings.TrimSpace(row[6]))
		}
		if code == "" {
			continue
		}
		if status != "Dihuni" && status != "Kosong" {
			status = "Dihuni"
		}
		house := ResidentHouse{
			ID:         "house-" + code,
			Block:      block,
			Code:       code,
			HouseNo:    houseNo,
			Status:     status,
			HeadOfHome: EncryptText(head),
			Phone:      EncryptText(phone),
			Members:    members,
		}
		updated := false
		for i := range s.store.db.Houses {
			if s.store.db.Houses[i].Code == code {
				house.IsPengurus = s.store.db.Houses[i].IsPengurus
				house.Role = s.store.db.Houses[i].Role
				s.store.db.Houses[i] = house
				updated = true
				break
			}
		}
		if !updated {
			s.store.db.Houses = append(s.store.db.Houses, house)
		}
		imported++
	}
	_ = s.store.saveLocked()
	s.store.mu.Unlock()

	if imported == 0 {
		writeError(w, http.StatusBadRequest, "Tidak ada data rumah valid yang ditemukan")
		return
	}

	s.recordAudit(r, "IMPORT_DIRECTORY", "Direktori Warga", fmt.Sprintf("Impor %d data rumah dari %s", imported, header.Filename))
	writeJSON(w, http.StatusCreated, map[string]any{
		"message":  fmt.Sprintf("Berhasil mengimpor %d data rumah dari %s", imported, header.Filename),
		"imported": imported,
	})
}

// GET /api/templates/{kind}?format=csv|xlsx
func (s *Server) handleDownloadTemplate(w http.ResponseWriter, r *http.Request) {
	kind := r.PathValue("kind")
	format := strings.ToLower(r.URL.Query().Get("format"))
	if format != "xlsx" {
		format = "csv"
	}

	var headers []string
	var sampleRows [][]string
	var baseName string

	if kind == "directory" {
		baseName = "Template_Data_Warga_VictoriaHill"
		headers = []string{"Blok", "Kode", "No Rumah", "Status", "Kepala Keluarga", "Telepon", "Jumlah Penghuni"}
		sampleRows = [][]string{
			{"Blok U", "U16", "16", "Dihuni", "Andi Pratama", "0812-8800-9911", "4"},
			{"Blok A", "A12", "12", "Kosong", "", "", "0"},
		}
	} else {
		baseName = "Template_Laporan_Keuangan_VictoriaHill"
		headers = []string{"Tanggal", "Keterangan", "Kategori", "Jenis", "Nominal"}
		sampleRows = [][]string{
			{"2026-11-05", "Penerimaan IPL Warga", "Iuran IPL", "Masuk", "18500000"},
			{"2026-11-10", "Gaji Security", "Keamanan", "Keluar", "9600000"},
		}
	}

	if format == "xlsx" {
		f := excelize.NewFile()
		sheet := "Sheet1"
		_ = f.SetSheetRow(sheet, "A1", &headers)
		for i, row := range sampleRows {
			cell := fmt.Sprintf("A%d", i+2)
			_ = f.SetSheetRow(sheet, cell, &row)
		}
		w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", baseName+".xlsx"))
		_ = f.Write(w)
		return
	}

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", baseName+".csv"))
	cw := csv.NewWriter(w)
	_ = cw.Write(headers)
	for _, row := range sampleRows {
		_ = cw.Write(row)
	}
	cw.Flush()
}
