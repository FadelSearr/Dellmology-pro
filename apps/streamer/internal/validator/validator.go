package validator

import (
    "time"
)

// HakaHakiType represents aggressive trade direction
type HakaHakiType int

const (
    HAKA HakaHakiType = iota
    HAKI
)

// TradeRecord is a simplified trade payload used by the validator
type TradeRecord struct {
    Symbol    string
    Price     float64
    Volume    int64
    Timestamp time.Time
}

// DetectAggressive returns HAKA for aggressive buy, HAKI for aggressive sell, or nil-like zero if unknown.
// This is a very small scaffold — replace with richer logic (compare to best bid/ask, tick direction, etc.).
func DetectAggressive(tr TradeRecord, bid, ask float64) HakaHakiType {
    if tr.Price >= ask {
        return HAKA
    }
    if tr.Price <= bid {
        return HAKI
    }
    return HAKI // conservative default
}
