'use client';

import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  fullScreen?: boolean;
}

/**
 * Animated loading spinner component
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  label = 'Loading...',
  fullScreen = false,
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  const containerClasses = fullScreen
    ? 'fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm'
    : 'flex items-center justify-center';

  return (
    <div className={containerClasses}>
      <div className="flex flex-col items-center gap-4">
        <div
          className={`${sizeClasses[size]} border-gray-600 border-t-cyan-400 rounded-full animate-spin`}
        />
        {label && <p className="text-sm text-gray-400">{label}</p>}
      </div>
    </div>
  );
};
