// Broker Importer - Data Models
package importer

// BrokerSummaryData represents EOD broker flow
type BrokerSummaryData struct {
	BrokerCode string `json:"broker_code"`
	BuyValue   int64  `json:"buy_value"`
	SellValue  int64  `json:"sell_value"`
	BuyLot     int64  `json:"buy_lot"`
	SellLot    int64  `json:"sell_lot"`
}

// BrokerFlowAnalysis represents analyzed broker data
type BrokerFlowAnalysis struct {
	Symbol        string
	BrokerCode    string
	NetValue      int64
	NetLot        int64
	Timestamp     string
	Consistency   float64
}
