import React from 'react';

interface BrokerEntry {
  broker_id: string;
  net_buy_value: number;
  active_days: number;
  consistency_score: number;
  avg_buy_price: number;
  z_score: number;
  is_whale: boolean;
  is_retail: boolean;
  is_anomalous: boolean;
}

interface Props {
  data: BrokerEntry[];
  symbol: string;
}

export const BrokerFlowTable: React.FC<Props> = ({ data, symbol }) => {
  return (
    <div className="broker-flow-table">
      <h3>Broker Flow & Z‑Score ({symbol})</h3>
      <table>
        <thead>
          <tr>
            <th>Broker</th>
            <th>Net Value</th>
            <th>Days</th>
            <th>Consistency</th>
            <th>Avg Price</th>
            <th>Z</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          {data.map((b) => (
            <tr key={b.broker_id} className={b.is_whale ? 'whale' : b.is_retail ? 'retail' : ''}>
              <td>{b.broker_id}</td>
              <td>{b.net_buy_value.toLocaleString()}</td>
              <td>{b.active_days}</td>
              <td>{(b.consistency_score).toFixed(2)}</td>
              <td>{b.avg_buy_price.toFixed(2)}</td>
              <td>{b.z_score.toFixed(2)}</td>
              <td>{b.is_whale ? 'Whale' : b.is_retail ? 'Retail' : b.is_anomalous ? 'Smart' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <style jsx>{`
        .broker-flow-table table {
          width: 100%;
          border-collapse: collapse;
        }
        .broker-flow-table th,
        .broker-flow-table td {
          border: 1px solid #444;
          padding: 6px 8px;
          text-align: center;
          font-size: 0.9rem;
        }
        .whale {
          background-color: rgba(255,0,0,0.1);
        }
        .retail {
          background-color: rgba(0,0,255,0.1);
        }
      `}</style>
    </div>
  );
};
