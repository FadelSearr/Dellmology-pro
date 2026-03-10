'use client';

import React from 'react';

type StatusType = 'bullish' | 'bearish' | 'neutral' | 'warning' | 'critical' | 'success' | 'info';

interface StatusBadgeProps {
  status: StatusType;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  animated?: boolean;
}

/**
 * Status badge component for displaying market conditions
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
  icon,
  animated = false,
}) => {
  const statusClasses = {
    bullish: 'bg-green-900/30 border-green-700 text-green-300',
    bearish: 'bg-red-900/30 border-red-700 text-red-300',
    neutral: 'bg-gray-700/30 border-gray-600 text-gray-300',
    warning: 'bg-yellow-900/30 border-yellow-700 text-yellow-300',
    critical: 'bg-red-900/50 border-red-600 text-red-200',
    success: 'bg-emerald-900/30 border-emerald-700 text-emerald-300',
    info: 'bg-blue-900/30 border-blue-700 text-blue-300',
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs gap-1',
    md: 'px-3 py-1.5 text-sm gap-1.5',
    lg: 'px-4 py-2 text-base gap-2',
  };

  const animationClass = animated ? 'animate-pulse' : '';

  return (
    <div
      className={`inline-flex items-center border rounded-full ${statusClasses[status]} ${sizeClasses[size]} ${animationClass}`}
    >
      {icon && <span>{icon}</span>}
      <span className="font-medium">{label}</span>
    </div>
  );
};
