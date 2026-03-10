'use client';

import { useEffect, useState } from 'react';
import { Activity, Database, Shield, AlertCircle } from 'lucide-react';

interface SystemHealth {
  sse_connected: boolean;
  db_connected: boolean;
  data_integrity: boolean;
  api_rate_limit: number;
  last_updated: string;
}

export const SystemHealthIndicators = () => {
  const [health, setHealth] = useState<SystemHealth>({
    sse_connected: true,
    db_connected: true,
    data_integrity: true,
    api_rate_limit: 45,
    last_updated: new Date().toISOString(),
  });

  useEffect(() => {
    // Poll system health
    const checkHealth = async () => {
      try {
        const response = await fetch('/api/health');
        if (response.ok) {
          const data = await response.json();
          setHealth(prev => ({
            ...prev,
            ...data,
            last_updated: new Date().toISOString()
          }));
        }
      } catch (error) {
        console.error('Error checking health:', error);
        setHealth(prev => ({
          ...prev,
          sse_connected: false
        }));
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (isHealthy: boolean) => 
    isHealthy ? 'bg-green-500' : 'bg-red-500';

  const getStatusText = (isHealthy: boolean) => 
    isHealthy ? 'Connected' : 'Disconnected';

  return (
    <div className="flex items-center gap-4 px-4">
      {/* SSE Status */}
      <div className="flex items-center gap-2 text-xs" title="Server-Sent Events">
        <Activity 
          size={14} 
          className={getStatusColor(health.sse_connected)}
        />
        <span className="text-gray-400 hidden sm:inline">
          {getStatusText(health.sse_connected)}
        </span>
      </div>

      {/* Database Status */}
      <div className="flex items-center gap-2 text-xs" title="Database Connection">
        <Database 
          size={14} 
          className={getStatusColor(health.db_connected)}
        />
        <span className="text-gray-400 hidden sm:inline">
          {getStatusText(health.db_connected)}
        </span>
      </div>

      {/* Data Integrity */}
      <div className="flex items-center gap-2 text-xs" title="Data Integrity Shield">
        <Shield 
          size={14} 
          className={getStatusColor(health.data_integrity)}
        />
        <span className="text-gray-400 hidden sm:inline">
          {health.data_integrity ? 'Safe' : 'Alert'}
        </span>
      </div>

      {/* API Rate Limit Progress */}
      <div className="flex items-center gap-2 text-xs" title="API Rate Limit">
        {health.api_rate_limit < 20 && (
          <AlertCircle size={14} className="text-red-500" />
        )}
        <div className="w-24 h-2 bg-gray-700 rounded-full">
          <div
            className={`h-2 rounded-full transition-all ${
              health.api_rate_limit > 70 ? 'bg-green-500' :
              health.api_rate_limit > 40 ? 'bg-yellow-500' :
              'bg-red-500'
            }`}
            style={{ width: `${health.api_rate_limit}%` }}
          ></div>
        </div>
        <span className="text-gray-400 hidden sm:inline">
          {health.api_rate_limit}%
        </span>
      </div>
    </div>
  );
};
