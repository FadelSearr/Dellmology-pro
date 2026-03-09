// Data Storage and Retrieval
package data

import (
	"database/sql"
	"log"

	_ "github.com/lib/pq"
)

var db *sql.DB

// InitDB initializes database connection
func InitDB(databaseURL string) error {
	var err error
	db, err = sql.Open("postgres", databaseURL)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
		return err
	}

	if err = db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
		return err
	}

	log.Println("Database connected successfully")
	return nil
}

// StoreRawTrade stores raw trade data
func StoreRawTrade(symbol string, price float64, volume int64, tradeType string) error {
	query := `
		INSERT INTO trades (symbol, price, volume, trade_type, timestamp)
		VALUES ($1, $2, $3, $4, NOW())
	`
	_, err := db.Exec(query, symbol, price, volume, tradeType)
	if err != nil {
		log.Printf("Error storing trade: %v", err)
	}
	return err
}

// StoreQuoteData stores order book snapshots
func StoreQuoteData(symbol string, bid, offer float64, lastPrice float64) error {
	query := `
		INSERT INTO order_book_updates (symbol, bid, offer, last_price, timestamp)
		VALUES ($1, $2, $3, $4, NOW())
	`
	_, err := db.Exec(query, symbol, bid, offer, lastPrice)
	if err != nil {
		log.Printf("Error storing quote: %v", err)
	}
	return err
}

// GetRecentTrades retrieves recent trades for analysis
func GetRecentTrades(symbol string, limit int) ([]map[string]interface{}, error) {
	query := `
		SELECT symbol, price, volume, trade_type, timestamp
		FROM trades
		WHERE symbol = $1
		ORDER BY timestamp DESC
		LIMIT $2
	`
	rows, err := db.Query(query, symbol, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var trades []map[string]interface{}
	for rows.Next() {
		var symbol string
		var price float64
		var volume int64
		var tradeType string
		var timestamp string

		if err = rows.Scan(&symbol, &price, &volume, &tradeType, &timestamp); err != nil {
			return nil, err
		}

		trade := map[string]interface{}{
			"symbol":     symbol,
			"price":      price,
			"volume":     volume,
			"trade_type": tradeType,
			"timestamp":  timestamp,
		}
		trades = append(trades, trade)
	}

	return trades, nil
}

// CloseDB closes database connection
func CloseDB() error {
	if db != nil {
		return db.Close()
	}
	return nil
}
