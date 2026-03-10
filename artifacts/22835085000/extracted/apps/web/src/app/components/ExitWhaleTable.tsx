import React, { useEffect, useState } from 'react';

interface Event {
  time: string;
  broker_id: string;
  net_value: number;
  note?: string;
}

interface Props {
  symbol: string;
}

export const ExitWhaleTable: React.FC<Props> = ({ symbol }) => {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/exit-whale?symbol=${symbol}`);
        const json = await res.json();
        setEvents(json.events || []);
      } catch (e) {
        console.error('failed to fetch exit whale events', e);
      }
    }
    if (symbol) load();
  }, [symbol]);

  if (events.length === 0) {
    return <div>No exit whale events for {symbol}</div>;
  }

  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold">🐋 Exit Whale Alerts</h2>
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-700">
            <th className="px-2 py-1">Time</th>
            <th className="px-2 py-1">Broker</th>
            <th className="px-2 py-1">Net Sell</th>
            <th className="px-2 py-1">Note</th>
          </tr>
        </thead>
        <tbody>
          {events.map((ev, idx) => (
            <tr key={idx} className="border-b border-gray-600">
              <td className="px-2 py-1">{new Date(ev.time).toLocaleString()}</td>
              <td className="px-2 py-1">{ev.broker_id}</td>
              <td className="px-2 py-1 text-red-400">{ev.net_value.toLocaleString()}</td>
              <td className="px-2 py-1">{ev.note || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};
