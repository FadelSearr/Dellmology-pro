// Streamer Configuration
package config

import (
	"log"
	"os"
	"strconv"
	"time"
)

// Config holds application configuration
type Config struct {
	TokenAPIURL         string
	WebSocketURL        string
	DatabaseURL         string
	RedisHost           string
	RedisPort           int
	HTTPListenAddr      string
	ReconnectWait       time.Duration
	
	// Risk Mitigation
	RoCInterval         time.Duration
	RoCPriceDrop        float64
	RoCCooldownDuration time.Duration
}

// LoadConfig loads configuration from environment
func LoadConfig() *Config {
	return &Config{
		TokenAPIURL:         getEnv("TOKEN_API_URL", "http://localhost:3000/api/session"),
		WebSocketURL:        getEnv("WEBSOCKET_URL", "wss://stream.stockbit.com/stream"),
		DatabaseURL:         getEnv("DATABASE_URL", "postgresql://admin:password@localhost:5433/dellmology?sslmode=disable"),
		RedisHost:           getEnv("REDIS_HOST", "localhost"),
		RedisPort:           getEnvInt("REDIS_PORT", 6379),
		HTTPListenAddr:      getEnv("HTTP_LISTEN_ADDR", ":8080"),
		ReconnectWait:       5 * time.Second,
		RoCInterval:         5 * time.Minute,
		RoCPriceDrop:        -0.10,
		RoCCooldownDuration: 15 * time.Minute,
	}
}

// Helper functions
func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

func getEnvInt(key string, defaultValue int) int {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}

	// attempt conversion using strconv
	n, err := strconv.Atoi(value)
	if err != nil {
		return defaultValue
	}
	return n
}

// PrintConfig prints configuration (with sanitization)
func (c *Config) PrintConfig() {
	log.Println("=== Streamer Configuration ===")
	log.Printf("Token API: %s", c.TokenAPIURL)
	log.Printf("WebSocket: %s", c.WebSocketURL)
	log.Printf("Database: %s", maskSensitiveData(c.DatabaseURL))
	log.Printf("Redis: %s:%d", c.RedisHost, c.RedisPort)
	log.Printf("HTTP Listen: %s", c.HTTPListenAddr)
	log.Println("===============================")
}

func maskSensitiveData(data string) string {
	if len(data) > 20 {
		return data[:10] + "..." + data[len(data)-5:]
	}
	return "***"
}
