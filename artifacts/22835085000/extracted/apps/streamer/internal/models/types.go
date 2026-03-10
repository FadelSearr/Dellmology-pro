// Data Models for Streamer
package models

import (
	"encoding/json"
	"time"
)

// WebSocket Message from Stockbit
type WebSocketMessage struct {
	Type string          `json:"t"`
	Data json.RawMessage `json:"d"`
}

// Trade Data Structure
type TradeData struct {
	Symbol    string  `json:"s"`
	Price     float64 `json:"p"`
	Volume    int64   `json:"v"`
	Timestamp int64   `json:"dt"`
}

// Quote Data (Bid/Ask)
type QuoteData struct {
	Symbol string  `json:"s"`
	Bid    float64 `json:"b"`
	Offer  float64 `json:"o"`
}

// Processed Trade for Database
type ProcessedTrade struct {
	Symbol    string    `json:"symbol"`
	Price     float64   `json:"price"`
	Volume    int64     `json:"volume"`
	TradeType string    `json:"trade_type"`
	Timestamp time.Time `json:"timestamp"`
}

// Price History for Rate-of-Change Analysis
type PriceHistory struct {
	Price     float64
	Timestamp time.Time
}

// Token Response from Backend API
type TokenResponse struct {
	Token string `json:"token"`
}

// Cooldown Info for Flagged Symbols
type CooldownInfo struct {
	EndTime time.Time
}

// Broker Summary Data
type BrokerSummaryData struct {
	BrokerCode string `json:"broker_code"`
	BuyValue   int64  `json:"buy_value"`
	SellValue  int64  `json:"sell_value"`
	BuyLot     int64  `json:"buy_lot"`
	SellLot    int64  `json:"sell_lot"`
}

// Validation Statistics
type ValidationStatistics struct {
	Symbol          string
	LastValidatedAt time.Time
	ValidationCount int
	ErrorCount      int
}
