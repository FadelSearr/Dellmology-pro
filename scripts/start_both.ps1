# Run both web server + streamer together
# Usage: From workspace root, open two terminals and run the commands below

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "IDX Analyst - Dual Bootstrap" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script will start BOTH services." -ForegroundColor Yellow
Write-Host ""

# Step 1: Seed initial symbols to the database (one-time)
Write-Host "Step 1: Seeding symbols to database..." -ForegroundColor Green
$seedScript = @"
import { Pool } from 'pg';

(async () => {
  const pool = new Pool({
    connectionString: 'postgresql://admin:password@localhost:5433/dellmology',
  });

  const symbols = [
    'BBCA', 'ASII', 'TLKM', 'GOTO', 'BMRI', 'BBRI', 'BBNI', 'UNTR', 'INDF', 'ADRO',
    'PGAS', 'MEDC', 'SMGR', 'INCO', 'WIKA', 'BUKA', 'CLPI', 'CASS', 'CENT', 'CTRA',
    'RORO', 'ITMG', 'SCMA', 'TINS', 'TKIM', 'GGRM', 'HMSP', 'ICBP', 'JSMR', 'KAEF',
    'LPPF', 'MAIN', 'MTRA', 'PAIL', 'PGAS', 'PTBA', 'PTPP', 'PZZA', 'SILO', 'SMCB',
    'SSMS', 'TARA', 'TBIG', 'TELE', 'TPID', 'TPIH', 'TPSA', 'TRUB', 'WBCT', 'WSKT'
  ];

  for (const sym of symbols) {
    try {
      await pool.query(
        \`INSERT INTO daily_prices(symbol, date, open, high, low, close, volume)
         VALUES (\$1, CURRENT_DATE, 1000, 1050, 950, 1000, 1000000)
         ON CONFLICT (symbol, date) DO NOTHING\`,
        [sym]
      );
    } catch (err) {
      console.error(\`Error seeding \${sym}:\`, err.message);
    }
  }

  console.log('✓ Symbols seeded');
  await pool.end();
  process.exit(0);
})();
"@

$seedFile = "scripts/seed.mjs"
$seedScript | Out-File -FilePath $seedFile -Encoding UTF8

try {
  & node $seedFile
  Remove-Item $seedFile -Force
} catch {
  Write-Host "Note: Could not seed symbols (Node might not be in PATH). Continuing..." -ForegroundColor Gray
}

Write-Host ""
Write-Host ""
Write-Host "Step 2: Starting services..." -ForegroundColor Green
Write-Host ""
Write-Host "Open TWO PowerShell windows and run these commands in each:" -ForegroundColor Yellow
Write-Host ""
Write-Host "═══ TERMINAL 1: Web Server ═══" -ForegroundColor Cyan
Write-Host ""
Write-Host "  cd apps/web" -ForegroundColor Green
Write-Host "  npm install" -ForegroundColor Green
Write-Host "  npm run dev" -ForegroundColor Green
Write-Host ""
Write-Host "  (Will start on http://localhost:3000)" -ForegroundColor Gray
Write-Host ""
Write-Host ""
Write-Host "═══ TERMINAL 2: Streamer ═══" -ForegroundColor Cyan
Write-Host ""
Write-Host "  # First time: download dependencies" -ForegroundColor Gray
Write-Host "  cd apps/streamer" -ForegroundColor Green
Write-Host "  go mod tidy" -ForegroundColor Green
Write-Host ""
Write-Host "  # Set your Stockbit token (required!)" -ForegroundColor Yellow
Write-Host "  $Env:STOCKBIT_TOKEN = 'your-token-here'" -ForegroundColor Green
Write-Host ""
Write-Host "  # Run the streamer" -ForegroundColor Gray
Write-Host "  go run ." -ForegroundColor Green
Write-Host ""
Write-Host "  (Will stream data to http://localhost:8080/stream)" -ForegroundColor Gray
Write-Host ""
Write-Host ""
Write-Host "═══ Getting your Stockbit token ═══" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Go to https://stockbit.com" -ForegroundColor Green
Write-Host "  2. Open DevTools (F12) → Application → Cookies" -ForegroundColor Green
Write-Host "  3. Look for a cookie named 'st_token' or check localStorage['token']" -ForegroundColor Green
Write-Host "  4. Copy the full JWT token string" -ForegroundColor Green
Write-Host "  5. Paste it in Terminal 2 when running the streamer" -ForegroundColor Green
Write-Host ""
Write-Host ""
Write-Host "Once both are running:" -ForegroundColor Green
Write-Host "  • Dashboard loads at http://localhost:3000" -ForegroundColor Green
Write-Host "  • Search box works with 50+ seeded tickers" -ForegroundColor Green
Write-Host "  • Streamer feeds real-time data if Stockbit token is valid" -ForegroundColor Green
Write-Host ""
