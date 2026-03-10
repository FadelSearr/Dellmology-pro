'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ExitWhaleTableProps {
  symbol: string;
}

interface ExitWhaleEvent {
  symbol: string;
  broker_id: string;
  net_value: number;
  z_score: number;
  note?: string;
  time: string;
}

interface ExitWhaleSummary {
  warning: boolean;
  signal: 'ACCUMULATION' | 'EXIT_DISTRIBUTION' | 'NEUTRAL' | string;
  confidence: number;
  reason: string;
}

/**
 * Exit Whale detection table showing institutional distribution patterns
 */
export const ExitWhaleTable: React.FC<ExitWhaleTableProps> = ({ symbol }) => {
  const [events, setEvents] = useState<ExitWhaleEvent[]>([]);
  const [summary, setSummary] = useState<ExitWhaleSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchExitWhale = async () => {
      try {
        if (mounted) {
          setLoading(true);
          setError(null);
        }

        const response = await fetch(`/api/exit-whale?symbol=${encodeURIComponent(symbol)}&days=7`, {
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error(`Failed to load exit whale data (${response.status})`);
        }

        const json = await response.json();
        if (!mounted) return;

        setEvents(Array.isArray(json.events) ? json.events : []);
        setSummary(json.summary || null);
      } catch (fetchError) {
        if (!mounted) return;
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load exit whale data');
        setEvents([]);
        setSummary(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchExitWhale();
    const intervalId = setInterval(fetchExitWhale, 60_000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [symbol]);

  const topEvents = useMemo(() => {
    return [...events]
      .sort((a, b) => Math.abs(Number(b.net_value || 0)) - Math.abs(Number(a.net_value || 0)))
      .slice(0, 8);
  }, [events]);

  const alertTone = summary?.warning ? 'text-red-200 border-red-700/50 bg-red-900/20' : 'text-cyan-200 border-cyan-700/50 bg-cyan-900/20';

  if (loading) {
    return <div className="text-sm text-gray-400">Loading exit whale activity...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-300">{error}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400">BROKER</th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-400">NET VALUE</th>
            <th className="text-center px-3 py-2 text-xs font-semibold text-gray-400">Z-SCORE</th>
            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400">PATTERN</th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-400">TIME</th>
          </tr>
        </thead>
        <tbody>
          {topEvents.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                No significant exit-whale event detected for {symbol} in the last 7 days.
              </td>
            </tr>
          )}

          {topEvents.map((exit, idx) => (
            <tr key={`${exit.broker_id}-${exit.time}-${idx}`} className="border-b border-gray-700/50 hover:bg-gray-800/30 transition-colors">
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${Number(exit.net_value) < 0 ? 'bg-red-500' : 'bg-cyan-500'}`} />
                  <span className="text-gray-300 font-semibold">{exit.broker_id}</span>
                </div>
              </td>
              <td className="text-right px-3 py-2">
                <span className={`font-mono ${Number(exit.net_value) < 0 ? 'text-red-400' : 'text-cyan-400'}`}>
                  {Number(exit.net_value).toLocaleString('id-ID')}
                </span>
              </td>
              <td className="text-center px-3 py-2 font-mono text-gray-300">{Number(exit.z_score || 0).toFixed(2)}</td>
              <td className="px-3 py-2 text-gray-400 text-xs">{exit.note || 'Distribution pressure'}</td>
              <td className="text-right px-3 py-2 text-xs text-gray-500">{new Date(exit.time).toLocaleTimeString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Alert */}
      <div className={`mt-3 p-3 border rounded text-xs flex items-start gap-2 ${alertTone}`}>
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-1">
            {summary?.warning ? '⚠️ Exit Whale Activity Detected' : '✅ Exit Whale Condition Stable'}
          </p>
          <p>
            {summary?.reason || 'Insufficient events to classify the current exit whale profile.'}
            {typeof summary?.confidence === 'number' ? ` (Confidence ${Math.round(summary.confidence)}%)` : ''}
          </p>
        </div>
      </div>
    </div>
  );
};
