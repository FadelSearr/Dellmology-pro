package validator

import (
    "testing"
    "time"
)

func TestDetectAggressive(t *testing.T) {
    tr := TradeRecord{Symbol: "BBCA", Price: 1000.0, Volume: 100, Timestamp: time.Now()}
    // if ask is 1000, trade at 1000 is aggressive buy
    got := DetectAggressive(tr, 999.0, 1000.0)
    if got != HAKA {
        t.Fatalf("expected HAKA, got %v", got)
    }
    // if price at bid, then HAKI
    tr.Price = 998.0
    got = DetectAggressive(tr, 998.0, 1000.0)
    if got != HAKI {
        t.Fatalf("expected HAKI, got %v", got)
    }
}
