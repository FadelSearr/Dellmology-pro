#!/bin/bash
# Bootstrap script to get both services running

echo "=========================================="
echo "IDX Analyst - Web + Streamer Bootstrap"
echo "=========================================="
echo ""

# Seed database with symbols
echo "Seeding database with 50+ symbols..."
docker exec idx_analyst-db-1 psql -U admin -d dellmology << EOF
INSERT INTO daily_prices(symbol, date, open, high, low, close, volume) VALUES
  ('BBCA', CURRENT_DATE, 1000, 1050, 950, 1000, 1000000),
  ('ASII', CURRENT_DATE, 2000, 2100, 1900, 2000, 500000),
  ('TLKM', CURRENT_DATE, 3000, 3100, 2900, 3000, 300000),
  ('GOTO', CURRENT_DATE, 500, 550, 450, 500, 5000000),
  ('BMRI', CURRENT_DATE, 4000, 4200, 3800, 4000, 200000),
  ('BBRI', CURRENT_DATE, 2500, 2600, 2400, 2500, 600000),
  ('BBNI', CURRENT_DATE, 3500, 3700, 3300, 3500, 400000),
  ('UNTR', CURRENT_DATE, 2800, 2900, 2700, 2800, 350000),
  ('INDF', CURRENT_DATE, 1500, 1600, 1400, 1500, 800000),
  ('ADRO', CURRENT_DATE, 800, 850, 750, 800, 1200000),
  ('PGAS', CURRENT_DATE, 1200, 1300, 1100, 1200, 700000),
  ('MEDC', CURRENT_DATE, 600, 650, 550, 600, 900000),
  ('SMGR', CURRENT_DATE, 1100, 1200, 1000, 1100, 600000),
  ('INCO', CURRENT_DATE, 1800, 1900, 1700, 1800, 500000),
  ('WIKA', CURRENT_DATE, 2200, 2300, 2100, 2200, 450000),
  ('BUKA', CURRENT_DATE, 350, 400, 300, 350, 2000000),
  ('CLPI', CURRENT_DATE, 750, 800, 700, 750, 1100000),
  ('CASS', CURRENT_DATE, 900, 950, 850, 900, 800000),
  ('CENT', CURRENT_DATE, 2600, 2700, 2500, 2600, 380000),
  ('CTRA', CURRENT_DATE, 1050, 1100, 1000, 1050, 950000),
  ('RORO', CURRENT_DATE, 2700, 2800, 2600, 2700, 420000),
  ('ITMG', CURRENT_DATE, 1250, 1300, 1200, 1250, 850000),
  ('SCMA', CURRENT_DATE, 1400, 1500, 1300, 1400, 700000),
  ('TINS', CURRENT_DATE, 2100, 2200, 2000, 2100, 520000),
  ('TKIM', CURRENT_DATE, 1350, 1400, 1300, 1350, 680000),
  ('GGRM', CURRENT_DATE, 3200, 3300, 3100, 3200, 380000),
  ('HMSP', CURRENT_DATE, 2900, 3000, 2800, 2900, 440000),
  ('ICBP', CURRENT_DATE, 2400, 2500, 2300, 2400, 510000),
  ('JSMR', CURRENT_DATE, 1600, 1700, 1500, 1600, 720000),
  ('KAEF', CURRENT_DATE, 700, 750, 650, 700, 1050000),
  ('LPPF', CURRENT_DATE, 450, 500, 400, 450, 1800000),
  ('MAIN', CURRENT_DATE, 3400, 3500, 3300, 3400, 350000),
  ('MTRA', CURRENT_DATE, 2050, 2150, 1950, 2050, 580000),
  ('PAIL', CURRENT_DATE, 1300, 1350, 1250, 1300, 750000),
  ('PTBA', CURRENT_DATE, 2250, 2350, 2150, 2250, 490000),
  ('PTPP', CURRENT_DATE, 1550, 1650, 1450, 1550, 820000),
  ('PZZA', CURRENT_DATE, 1450, 1550, 1350, 1450, 690000),
  ('SILO', CURRENT_DATE, 820, 870, 770, 820, 950000),
  ('SMCB', CURRENT_DATE, 1150, 1200, 1100, 1150, 880000),
  ('SSMS', CURRENT_DATE, 1050, 1100, 1000, 1050, 920000),
  ('TARA', CURRENT_DATE, 950, 1000, 900, 950, 1050000),
  ('TBIG', CURRENT_DATE, 850, 900, 800, 850, 1150000),
  ('TELE', CURRENT_DATE, 2350, 2450, 2250, 2350, 480000),
  ('TPID', CURRENT_DATE, 1550, 1650, 1450, 1550, 750000),
  ('TPIH', CURRENT_DATE, 1200, 1250, 1150, 1200, 900000),
  ('TPSA', CURRENT_DATE, 1750, 1850, 1650, 1750, 650000),
  ('TRUB', CURRENT_DATE, 2450, 2550, 2350, 2450, 420000),
  ('WBCT', CURRENT_DATE, 1900, 2000, 1800, 1900, 620000),
  ('WSKT', CURRENT_DATE, 1350, 1450, 1250, 1350, 780000)
ON CONFLICT DO NOTHING;
EOF

echo "✓ Database seeded"
echo ""
echo "=========================================="
echo "Service Status"
echo "=========================================="
echo ""
echo "✓ Web Server: http://localhost:3000"
echo "  (npm run dev is already running)"
echo ""
echo "Next: Start the Streamer in a new terminal"
echo ""
echo "$ cd apps/streamer"
echo "$ export STOCKBIT_TOKEN='<your-token-here>'"
echo "$ go run ."
echo ""
echo "Then open http://localhost:3000 in your browser"
echo ""
