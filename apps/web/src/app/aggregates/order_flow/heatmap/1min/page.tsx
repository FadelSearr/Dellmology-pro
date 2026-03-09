"use client"

import { useState } from 'react'

export default function Heatmap1minPage() {
  const [loading, setLoading] = useState(false)
  const [buckets, setBuckets] = useState<Record<string, unknown>[]>([])
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/aggregates/order_flow/heatmap/1min')
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      setBuckets((json && typeof json === 'object' && 'buckets' in json && Array.isArray((json as Record<string, unknown>).buckets)) ? (json as Record<string, unknown>).buckets as Record<string, unknown>[] : [])
    } catch (err: unknown) {
      const msg = typeof err === 'object' && err !== null && 'message' in err ? String((err as Record<string, unknown>).message) : String(err)
      setError(msg || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Order Flow Heatmap (1m)</h2>
      <div style={{ marginBottom: 12 }}>
        <button onClick={load} disabled={loading} style={{ marginRight: 8 }}>Load</button>
      </div>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <div>
        {loading && <div>Loading...</div>}
        {!loading && buckets.length === 0 && <div>No buckets</div>}
        {buckets.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>bucket</th>
                <th>symbol</th>
                <th>avg_bid_vol</th>
                <th>avg_ask_vol</th>
                <th>avg_net_vol</th>
                <th>avg_ratio</th>
                <th>avg_intensity</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b: Record<string, unknown>, i: number) => (
                <tr key={i}>
                  <td>{String(b.bucket ?? '')}</td>
                  <td>{String(b.symbol ?? '')}</td>
                  <td>{String(b.avg_bid_vol ?? '')}</td>
                  <td>{String(b.avg_ask_vol ?? '')}</td>
                  <td>{String(b.avg_net_vol ?? '')}</td>
                  <td>{String(b.avg_ratio ?? '')}</td>
                  <td>{String(b.avg_intensity ?? '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
