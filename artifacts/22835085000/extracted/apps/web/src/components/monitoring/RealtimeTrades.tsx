'use client';

import { ProcessedTrade } from "@/types/global"; // We'll create this type

// Simple component to render the list of trades
export function RealtimeTrades({ trades }: { trades: ProcessedTrade[] }) {
  return (
    <div className="h-96 overflow-y-auto rounded-lg border border-gray-700 bg-gray-800 p-4">
      <h2 className="text-xl font-semibold text-gray-200 sticky top-0 bg-gray-800 pb-2">
        🔴 Live Trades (HAKA/HAKI)
      </h2>
      <div className="text-sm font-mono">
        {trades.map((trade, index) => (
          <div key={index} className={`flex justify-between p-1.5 ${
            trade.trade_type === 'HAKA' ? 'bg-green-900/50' : trade.trade_type === 'HAKI' ? 'bg-red-900/50' : ''
          }`}>
            <span className="font-bold text-cyan-400">{trade.symbol}</span>
            <span>@{trade.price.toLocaleString()}</span>
            <span className="text-gray-400">{trade.volume.toLocaleString()} lots</span>
            <span className={`font-extrabold ${
              trade.trade_type === 'HAKA' ? 'text-green-400' : trade.trade_type === 'HAKI' ? 'text-red-400' : 'text-gray-500'
            }`}>
              {trade.trade_type}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
