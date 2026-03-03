'use client';

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  headerDensity?: 'default' | 'compact';
  noPadding?: boolean;
  clickable?: boolean;
  onClick?: () => void;
}

/**
 * Reusable Card component for dashboard sections
 */
export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  subtitle,
  headerDensity = 'default',
  noPadding = false,
  clickable = false,
  onClick,
}) => {
  const baseClasses =
    'bg-gray-800/50 border border-gray-700 rounded-lg backdrop-blur-sm transition-all';
  const hoverClasses = clickable ? 'hover:bg-gray-700/50 hover:border-gray-600 cursor-pointer' : '';
  const paddingClasses = noPadding ? '' : 'p-6';
  const headerClasses =
    headerDensity === 'compact'
      ? {
          wrapper: 'mb-2 border-b border-gray-700 pb-2',
          title: 'text-sm font-semibold text-white tracking-wide',
          subtitle: 'text-xs text-gray-400 mt-0.5',
        }
      : {
          wrapper: 'mb-4 border-b border-gray-700 pb-4',
          title: 'text-lg font-semibold text-white',
          subtitle: 'text-sm text-gray-400 mt-1',
        };

  return (
    <div
      className={`${baseClasses} ${hoverClasses} ${paddingClasses} ${className}`}
      onClick={onClick}
    >
      {(title || subtitle) && (
        <div className={headerClasses.wrapper}>
          {title && <h3 className={headerClasses.title}>{title}</h3>}
          {subtitle && <p className={headerClasses.subtitle}>{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
};
