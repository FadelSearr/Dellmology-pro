package main

import (
	"fmt"
	"log"
	"math"
	"sort"
	"time"
)

// BrokerAnalysis contains Z-Score and whale detection metrics
type BrokerAnalysis struct {
	BrokerID         string  `json:"broker_id"`
	NetBuyValue      int64   `json:"net_buy_value"`
	NetBuyLot        int64   `json:"net_buy_lot"`
	AvgBuyPrice      float64 `json:"avg_buy_price"`
	AvgSellPrice     float64 `json:"avg_sell_price"`
	ConsistencyScore float64 `json:"consistency_score"` // 0-100
	ZScore           float64 `json:"z_score"`
	IsWhale          bool    `json:"is_whale"`
	IsRetail         bool    `json:"is_retail"`
	IsAnomalous      bool    `json:"is_anomalous"`
	WhaleCluster     string  `json:"whale_cluster"`
	ClusterConfidence float64 `json:"cluster_confidence"`
	Timestamp        time.Time
}

// SymbolBrokerStats holds aggregated stats for a symbol
type SymbolBrokerStats struct {
	Symbol        string
	Date          time.Time
	BrokerStats   []BrokerAnalysis
	AvgNetValue   float64
	StdDeviation  float64
	TotalVolume   int64
	WashSaleScore float64 // 0-100, higher = more suspicious
}

// BrokerAnalyzer provides broker-level analysis
type BrokerAnalyzer struct {
	historicalData map[string][]int64 // broker_id -> net_values over time
	maxHistory     int
}

// NewBrokerAnalyzer creates analyzer
func NewBrokerAnalyzer(maxHistory int) *BrokerAnalyzer {
	return &BrokerAnalyzer{
		historicalData: make(map[string][]int64),
		maxHistory:     maxHistory,
	}
}

// AddBrokerData adds historical data point for a broker
func (ba *BrokerAnalyzer) AddBrokerData(brokerID string, netValue int64) {
	if _, exists := ba.historicalData[brokerID]; !exists {
		ba.historicalData[brokerID] = make([]int64, 0, ba.maxHistory)
	}

	history := ba.historicalData[brokerID]
	if len(history) >= ba.maxHistory {
		history = history[1:]
	}

	history = append(history, netValue)
	ba.historicalData[brokerID] = history
}

// CalculateZScore computes Z-Score for whale detection
func (ba *BrokerAnalyzer) CalculateZScore(brokerID string, currentValue int64) float64 {
	history, exists := ba.historicalData[brokerID]
	if !exists || len(history) < 2 {
		return 0
	}

	mean := ba.calculateMeanInt64(history)
	stdDev := ba.calculateStdDevInt64(history)

	if stdDev == 0 {
		return 0
	}

	zScore := (float64(currentValue) - mean) / stdDev
	return zScore
}

// AnalyzeBrokerFlow analyzes broker behavior
func (ba *BrokerAnalyzer) AnalyzeBrokerFlow(brokerData []BrokerAnalysis) SymbolBrokerStats {
	stats := SymbolBrokerStats{
		Date:         time.Now(),
		BrokerStats:  brokerData,
		TotalVolume:  0,
		WashSaleScore: 0,
	}

	// Calculate total volume and net values
	netValues := make([]float64, 0)
	for i, broker := range brokerData {
		stats.TotalVolume += broker.NetBuyLot

		// Add Z-Score
		zScore := ba.CalculateZScore(broker.BrokerID, broker.NetBuyValue)
		broker.ZScore = zScore

		// Classify: Whale (Z-Score > 2.5), Retail (Z < -1), Normal (-1 to 2.5)
		if zScore > 2.5 {
			broker.IsWhale = true
			broker.IsAnomalous = true
		} else if zScore < -1 {
			broker.IsRetail = true
		}

		cluster, confidence := ba.classifyWhaleCluster(broker)
		broker.WhaleCluster = cluster
		broker.ClusterConfidence = confidence

		brokerData[i] = broker

		netValues = append(netValues, float64(broker.NetBuyValue))
	}

	// Calculate stats
	stats.AvgNetValue = ba.calculateMean(netValues)
	stats.StdDeviation = ba.calculateStdDev(netValues)

	// Detect wash sales (high turnover, low accumulation)
	stats.WashSaleScore = ba.detectWashSales(brokerData, stats.TotalVolume)

	return stats
}

func (ba *BrokerAnalyzer) classifyWhaleCluster(broker BrokerAnalysis) (string, float64) {
	absNet := math.Abs(float64(broker.NetBuyValue))
	consistency := broker.ConsistencyScore
	z := math.Abs(broker.ZScore)

	if broker.NetBuyValue > 0 && consistency >= 65 && z >= 1.5 {
		return "MOMENTUM_ACCUMULATOR", math.Min(100, 55+consistency*0.3+z*8)
	}
	if broker.NetBuyValue < 0 && consistency >= 55 && z >= 1.2 {
		return "DISTRIBUTION_PRESSURE", math.Min(100, 50+consistency*0.25+z*10)
	}
	if absNet > 0 && consistency <= 30 && z >= 1.0 {
		return "ONE_DAY_OPERATOR", math.Min(95, 45+z*12)
	}
	return "NEUTRAL_FLOW", math.Min(80, 25+z*5)
}

// detectWashSales uses heuristics to flag suspicious trading patterns
func (ba *BrokerAnalyzer) detectWashSales(brokers []BrokerAnalysis, totalVolume int64) float64 {
	if totalVolume == 0 {
		return 0
	}

	suspiciousScore := 0.0

	// Pattern 1: High volume but low accumulation
	totalAccumulation := 0
	for _, broker := range brokers {
		totalAccumulation += int(broker.NetBuyLot)
	}

	if totalVolume > 0 {
		accumulationRatio := float64(totalAccumulation) / float64(totalVolume)
		if accumulationRatio < 0.1 {
			suspiciousScore += 30 // High suspicion: 30% churn
		} else if accumulationRatio < 0.25 {
			suspiciousScore += 15
		}
	}

	// Pattern 2: Many small brokers with equal buy/sell
	equilibriumCount := 0
	for _, broker := range brokers {
		if broker.NetBuyValue < 100000 && broker.NetBuyValue > -100000 {
			equilibriumCount++
		}
	}

	if equilibriumCount > len(brokers)*60/100 {
		suspiciousScore += 20 // 60%+ brokers near equilibrium
	}

	// Pattern 3: Extreme Z-Score variance (sign of manipulation)
	zScores := make([]float64, 0)
	for _, broker := range brokers {
		zScores = append(zScores, broker.ZScore)
	}

	if len(zScores) > 1 {
		zsStdDev := ba.calculateStdDev(zScores)
		if zsStdDev > 3 {
			suspiciousScore += 20 // High variance
		}
	}

	// Normalize to 0-100
	if suspiciousScore > 100 {
		suspiciousScore = 100
	}

	return suspiciousScore
}

// CalculateConsistencyScore measures broker activity consistency over time
func (ba *BrokerAnalyzer) CalculateConsistencyScore(brokerID string, activeCount int, totalDays int) float64 {
	if totalDays == 0 {
		return 0
	}
	return (float64(activeCount) / float64(totalDays)) * 100
}

// GetWhaleProfiles identifies major institutional players
func (ba *BrokerAnalyzer) GetWhaleProfiles(brokers []BrokerAnalysis) []BrokerAnalysis {
	whales := make([]BrokerAnalysis, 0)

	for _, broker := range brokers {
		if broker.IsWhale {
			whales = append(whales, broker)
		}
	}

	// Sort by net value descending
	sort.Slice(whales, func(i, j int) bool {
		return math.Abs(float64(whales[i].NetBuyValue)) > math.Abs(float64(whales[j].NetBuyValue))
	})

	return whales
}

// --- Helper Functions ---

func (ba *BrokerAnalyzer) calculateMean(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}

	sum := 0.0
	for _, v := range values {
		sum += v
	}

	return sum / float64(len(values))
}

func (ba *BrokerAnalyzer) calculateStdDev(values []float64) float64 {
	if len(values) < 2 {
		return 0
	}

	mean := ba.calculateMean(values)
	sumSquares := 0.0

	for _, v := range values {
		diff := v - mean
		sumSquares += diff * diff
	}

	return math.Sqrt(sumSquares / float64(len(values)-1))
}

func (ba *BrokerAnalyzer) calculateMeanInt64(values []int64) float64 {
	if len(values) == 0 {
		return 0
	}

	sum := 0.0
	for _, v := range values {
		sum += float64(v)
	}

	return sum / float64(len(values))
}

func (ba *BrokerAnalyzer) calculateStdDevInt64(values []int64) float64 {
	if len(values) < 2 {
		return 0
	}

	mean := ba.calculateMeanInt64(values)
	sumSquares := 0.0

	for _, v := range values {
		diff := float64(v) - mean
		sumSquares += diff * diff
	}

	return math.Sqrt(sumSquares / float64(len(values)-1))
}

// LogBrokerAnalysis logs analysis results
func LogBrokerAnalysis(analysis SymbolBrokerStats) {
	log.Printf("[BROKER ANALYSIS] Symbol: %s | Date: %s", analysis.Symbol, analysis.Date.Format("2006-01-02"))
	log.Printf("  Total Volume: %d lots | Avg Net: %.0f | StdDev: %.0f", analysis.TotalVolume, analysis.AvgNetValue, analysis.StdDeviation)
	log.Printf("  Wash Sale Score: %.1f%% | Brokers Analyzed: %d", analysis.WashSaleScore, len(analysis.BrokerStats))

	whales := make([]BrokerAnalysis, 0)
	for _, broker := range analysis.BrokerStats {
		if broker.IsWhale {
			whales = append(whales, broker)
		}
	}

	if len(whales) > 0 {
		log.Printf("  🐋 WHALES DETECTED: %d brokers", len(whales))
		for _, whale := range whales {
			fmt.Printf("     - %s: %+.1f (Z-Score: %.2f)\n", whale.BrokerID, float64(whale.NetBuyValue), whale.ZScore)
		}
	}
}
