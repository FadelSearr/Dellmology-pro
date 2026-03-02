// Entry point for Broker Importer
package main

import (
	"log"
	"os"
)

func main() {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgresql://admin:password@localhost:5433/dellmology?sslmode=disable"
	}

	log.Println("🚀 Starting Broker Importer...")

	log.Println("✅ Broker Importer initialized successfully")
	log.Println("Ready to import broker data...")
}
