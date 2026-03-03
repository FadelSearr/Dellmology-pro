// simple one-off script to seed `daily_prices` table with a list of symbols
// run with `ts-node` or compile to javascript

import { Pool } from 'pg';

(async function main() {
  const pool = new Pool({
    connectionString: 'postgresql://admin:password@localhost:5433/dellmology',
  });

  const symbols = [
    'BBCA', 'ASII', 'TLKM', 'GOTO', 'BMRI', 'BBRI', 'BBNI', 'UNTR', 'INDF', 'ADRO',
    // add more tickers manually or paste a full IDX list here
  ];

  for (const sym of symbols) {
    try {
      await pool.query(
        `INSERT INTO daily_prices(symbol, date, open, high, low, close, volume)
         VALUES ($1, CURRENT_DATE, 0, 0, 0, 0, 0)
         ON CONFLICT (symbol, date) DO NOTHING`,
        [sym]
      );
    } catch (err) {
      console.error('insert error', sym, err);
    }
  }

  // For local development make some sample broker_flow entries so UI isn't empty
  const brokers = ['PD', 'RHB', 'CIT', 'IB','PAN'];
  const days = 7;
  for (const sym of symbols) {
    for (let d = 0; d < days; d++) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      for (const br of brokers) {
        const net = Math.floor((Math.random() - 0.5) * 2e7); // -20m .. +20m
        await pool.query(
          `INSERT INTO broker_flow(symbol, broker_code, buy_volume, sell_volume, net_value, time)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT DO NOTHING`,
          [sym, br, Math.abs(net), Math.abs(net), net, date]
        );
      }
    }
  }
  console.log('seed complete');

  console.log('seed complete');
  await pool.end();
})();
