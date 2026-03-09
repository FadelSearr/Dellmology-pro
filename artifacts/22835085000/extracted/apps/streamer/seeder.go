//go:build ignore
// +build ignore

package main

import (
	"database/sql"
	"fmt"
	"log"
	"math/rand"
	"time"

	_ "github.com/lib/pq"
)

// Quick seeder to populate daily_prices with IDX symbols
func main() {
	db, err := sql.Open("postgres", "postgresql://admin:password@localhost:5433/dellmology?sslmode=disable")
	if err != nil {
		log.Fatalf("DB connection failed: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("DB ping failed: %v", err)
	}

	symbols := []string{
		"BBCA", "ASII", "TLKM", "GOTO", "BMRI", "BBRI", "BBNI", "UNTR", "INDF", "ADRO",
		"PGAS", "MEDC", "SMGR", "INCO", "WIKA", "BUKA", "CLPI", "CASS", "CENT", "CTRA",
		"RORO", "ITMG", "SCMA", "TINS", "TKIM", "GGRM", "HMSP", "ICBP", "JSMR", "KAEF",
		"LPPF", "MAIN", "MTRA", "PAIL", "PTBA", "PTPP", "PZZA", "SILO", "SMCB", "SSMS",
		"TARA", "TBIG", "TELE", "TPID", "TPIH", "TPSA", "TRUB", "WBCT", "WSKT", "BSDE",
	}

	for _, sym := range symbols {
		_, err := db.Exec(`
			INSERT INTO daily_prices(symbol, date, open, high, low, close, volume)
			VALUES ($1, CURRENT_DATE, 1000, 1050, 950, 1000, 1000000)
			ON CONFLICT (symbol, date) DO NOTHING
		`, sym)
		if err != nil {
			log.Printf("✗ %s: %v", sym, err)
		} else {
			fmt.Printf("✓ %s\n", sym)
		}
	}

	// also seed a few days of dummy broker_flow data for development
	brokers := []string{"PD", "RHB", "CIT", "IB", "PAN"}
	days := 7
	for _, sym := range symbols {
		for d := 0; d < days; d++ {
			date := time.Now().AddDate(0, 0, -d)
			for _, br := range brokers {
				net := int64((rand.Float64() - 0.5) * 2e7) // ±20m
				_, err := db.Exec(`
					INSERT INTO broker_flow(symbol, broker_code, buy_volume, sell_volume, net_value, time)
					VALUES ($1,$2,$3,$4,$5,$6)
					ON CONFLICT DO NOTHING
				`, sym, br, abs(net), abs(net), net, date)
				if err != nil {
					log.Printf("broker flow insert error %s %s: %v", sym, br, err)
				}
			}
		}
	}

	fmt.Println("\n✓ Seeding complete")
}

func abs(n int64) int64 {
	if n < 0 {
		return -n
	}
	return n
}

