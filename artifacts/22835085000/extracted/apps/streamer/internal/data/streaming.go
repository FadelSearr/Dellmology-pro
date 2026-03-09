// WebSocket and Real-time Data Handling
package data

import (
	"encoding/json"
	"log"

	"github.com/gorilla/websocket"
)

// StreamHandler manages WebSocket connections
type StreamHandler struct {
	conn *websocket.Conn
}

// NewStreamHandler creates a new stream handler
func NewStreamHandler(conn *websocket.Conn) *StreamHandler {
	return &StreamHandler{conn: conn}
}

// ReadMessage reads and parses incoming WebSocket messages
func (sh *StreamHandler) ReadMessage(v interface{}) error {
	return sh.conn.ReadJSON(v)
}

// Close closes the WebSocket connection
func (sh *StreamHandler) Close() error {
	return sh.conn.Close()
}

// ProcessTradeMessage processes incoming trade messages
func ProcessTradeMessage(data json.RawMessage) (map[string]interface{}, error) {
	var trade map[string]interface{}
	if err := json.Unmarshal(data, &trade); err != nil {
		log.Printf("Error parsing trade message: %v", err)
		return nil, err
	}
	return trade, nil
}

// ProcessQuoteMessage processes incoming quote messages
func ProcessQuoteMessage(data json.RawMessage) (map[string]interface{}, error) {
	var quote map[string]interface{}
	if err := json.Unmarshal(data, &quote); err != nil {
		log.Printf("Error parsing quote message: %v", err)
		return nil, err
	}
	return quote, nil
}
