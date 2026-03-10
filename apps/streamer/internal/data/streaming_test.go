package data

import (
    "encoding/json"
    "testing"
)

func TestProcessTradeMessage_Aggression(t *testing.T) {
    // craft a trade JSON where price equals ask -> aggressive buy
    m := map[string]interface{}{"symbol":"BBCA","price":1000.0,"volume":100,"bid":999.0,"ask":1000.0}
    b, _ := json.Marshal(m)
    out, err := ProcessTradeMessage(b)
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if ag, ok := out["aggression"]; !ok {
        t.Fatalf("expected aggression field")
    } else {
        if ag != "HAKA" {
            t.Fatalf("expected HAKA, got %v", ag)
        }
    }
}
