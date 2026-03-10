// Market Regime Detection
package analysis

import "log"

// MarketRegime represents current market condition
type MarketRegime string

const (
	Uptrend      MarketRegime = "UPTREND"
	Downtrend    MarketRegime = "DOWNTREND"
	Sideways     MarketRegime = "SIDEWAYS"
	HighVol      MarketRegime = "HIGH_VOL"
	LowVol       MarketRegime = "LOW_VOL"
)

// DetectMarketRegime analyzes market conditions
func DetectMarketRegime(prices []float64, volumes []int64) MarketRegime {
	if len(prices) < 2 {
		return Sideways
	}

	// Simple trend detection
	change := prices[len(prices)-1] - prices[0]
	
	if change > 0 {
		log.Println("Market regime: UPTREND")
		return Uptrend
	} else if change < 0 {
		log.Println("Market regime: DOWNTREND")
		return Downtrend
	}
	
	log.Println("Market regime: SIDEWAYS")
	return Sideways
}

// IsVolatileMarket checks if market has high volatility
func IsVolatileMarket(prices []float64, threshold float64) bool {
	if len(prices) < 2 {
		return false
	}

	maxPrice := prices[0]
	minPrice := prices[0]

	for _, p := range prices {
		if p > maxPrice {
			maxPrice = p
		}
		if p < minPrice {
			minPrice = p
		}
	}

	if minPrice == 0 {
		return false
	}

	volRatio := (maxPrice - minPrice) / minPrice
	return volRatio > threshold
}
