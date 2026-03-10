// Order Flow Analysis and Heatmap
package order

import "log"

// OrderFlowLevel represents order book depth level
type OrderFlowLevel struct {
	Price  float64
	Volume int64
}

// OrderBook represents current order book state
type OrderBook struct {
	Symbol string
	Bids   []OrderFlowLevel
	Asks   []OrderFlowLevel
}

// AnalyzeOrderFlow analyzes bid/ask order flow
func AnalyzeOrderFlow(ob *OrderBook) map[string]interface{} {
	log.Printf("Analyzing order flow for %s", ob.Symbol)

	totalBidVolume := int64(0)
	totalAskVolume := int64(0)

	for _, bid := range ob.Bids {
		totalBidVolume += bid.Volume
	}

	for _, ask := range ob.Asks {
		totalAskVolume += ask.Volume
	}

	return map[string]interface{}{
		"symbol":              ob.Symbol,
		"total_bid_volume":    totalBidVolume,
		"total_ask_volume":    totalAskVolume,
		"imbalance_ratio":     float64(totalBidVolume) / float64(totalAskVolume),
		"bid_ask_spread":      calculateSpread(ob),
		"order_book_strength": calculateStrength(totalBidVolume, totalAskVolume),
	}
}

// DetectBigWalls detects large orders that might be support/resistance
func DetectBigWalls(ob *OrderBook, threshold int64) []OrderFlowLevel {
	var walls []OrderFlowLevel

	for _, level := range ob.Bids {
		if level.Volume > threshold {
			walls = append(walls, level)
		}
	}

	for _, level := range ob.Asks {
		if level.Volume > threshold {
			walls = append(walls, level)
		}
	}

	return walls
}

func calculateSpread(ob *OrderBook) float64 {
	if len(ob.Bids) == 0 || len(ob.Asks) == 0 {
		return 0
	}
	bestBid := ob.Bids[0].Price
	bestAsk := ob.Asks[0].Price
	return bestAsk - bestBid
}

func calculateStrength(bidVol, askVol int64) string {
	if bidVol > askVol*2 {
		return "STRONG_BID"
	} else if askVol > bidVol*2 {
		return "STRONG_ASK"
	}
	return "BALANCED"
}
