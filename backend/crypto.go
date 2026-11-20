package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"io"
	"log"
	"os"
	"strings"
	"sync"

	"golang.org/x/crypto/bcrypt"
)

const encPrefix = "enc:"

var warnDefaultKeyOnce sync.Once

func getEncryptionKey() []byte {
	secret := os.Getenv("DATA_ENCRYPTION_KEY")
	if secret == "" {
		if strings.EqualFold(os.Getenv("APP_ENV"), "production") {
			log.Fatal("DATA_ENCRYPTION_KEY wajib diset pada mode production")
		}
		warnDefaultKeyOnce.Do(func() {
			log.Println("[PERINGATAN] DATA_ENCRYPTION_KEY belum diset, menggunakan fallback key development.")
		})
		secret = "victoria-hill-default-dev-key"
	}
	sum := sha256.Sum256([]byte(secret))
	return sum[:]
}

// HashPassword menghasilkan hash bcrypt untuk penyimpanan password yang aman (siap untuk password per-warga & multi-admin).
func HashPassword(plain string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// CheckPassword memverifikasi password plaintext terhadap hash bcrypt.
func CheckPassword(hash, plain string) bool {
	if hash == "" || plain == "" {
		return false
	}
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain)) == nil
}

// ConstantTimeEqual membandingkan dua string secara aman dari timing attack.
func ConstantTimeEqual(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

// HashToken mengubah bearer token menjadi SHA-256 hex untuk disimpan di database sesi.
func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// EncryptText encrypts sensitive text with AES-256-GCM before storing in PostgreSQL.
func EncryptText(plain string) string {
	plain = strings.TrimSpace(plain)
	if plain == "" {
		return ""
	}
	if strings.HasPrefix(plain, encPrefix) {
		return plain
	}
	block, err := aes.NewCipher(getEncryptionKey())
	if err != nil {
		return plain
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return plain
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return plain
	}
	sealed := gcm.Seal(nonce, nonce, []byte(plain), nil)
	return encPrefix + base64.StdEncoding.EncodeToString(sealed)
}

// DecryptText decrypts an "enc:..." value stored in PostgreSQL.
func DecryptText(stored string) string {
	if stored == "" {
		return ""
	}
	if !strings.HasPrefix(stored, encPrefix) {
		return stored
	}
	raw, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(stored, encPrefix))
	if err != nil {
		return stored
	}
	block, err := aes.NewCipher(getEncryptionKey())
	if err != nil {
		return stored
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return stored
	}
	ns := gcm.NonceSize()
	if len(raw) < ns {
		return stored
	}
	plain, err := gcm.Open(nil, raw[:ns], raw[ns:], nil)
	if err != nil {
		return stored
	}
	return string(plain)
}

// MaskName masks a decrypted resident name for safe display on the portal (e.g., "Warga Dummy" -> "W**** D****").
func MaskName(plain string) string {
	plain = strings.TrimSpace(plain)
	if plain == "" {
		return ""
	}
	words := strings.Fields(plain)
	masked := make([]string, 0, len(words))
	for _, w := range words {
		runes := []rune(w)
		if len(runes) <= 1 {
			masked = append(masked, "*")
			continue
		}
		stars := strings.Repeat("*", len(runes)-1)
		masked = append(masked, string(runes[0])+stars)
	}
	return strings.Join(masked, " ")
}

// MaskPhone masks middle digits of a phone number (e.g., "0812-8800-1000" -> "0812-****-1000").
func MaskPhone(plain string) string {
	plain = strings.TrimSpace(plain)
	if len(plain) < 7 {
		return plain
	}
	return plain[:4] + "-****-" + plain[len(plain)-4:]
}
