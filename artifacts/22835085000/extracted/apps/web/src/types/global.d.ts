import { Pool } from 'pg';

declare global {
  // This allows the global object to be indexed by a string, used for the DB pool.
  var _pgPool: Pool | undefined;
}

/**
 * Represents a single processed trade event, enriched with HAKA/HAKI type.
 * This type is used both by the backend streamer and the frontend client.
 */
export interface ProcessedTrade {
  symbol: string;
  price: number;
  volume: number;
  trade_type: 'HAKA' | 'HAKI' | 'NORMAL';
  timestamp: string; // ISO 8601 date string
}
