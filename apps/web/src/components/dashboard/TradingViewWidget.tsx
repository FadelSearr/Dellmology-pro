'use client';

import { useEffect, useRef } from 'react';

interface TradingViewWidgetProps {
  symbol: string;
  width?: string | number;
  height?: string | number;
  interval?: string;
}

const TradingViewWidget = ({ symbol, width = '100%', height = 400, interval = '60' }: TradingViewWidgetProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if (window && (window as any).TradingView) {
        new (window as any).TradingView.widget({
          width,
          height,
          // TradingView uses EXCHANGE:SYMBOL format
          symbol: `IDX:${symbol}`,
          interval,
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: '1',
          locale: 'en',
          toolbar_bg: '#f1f3f6',
          hide_side_toolbar: false,
          allow_symbol_change: true,
          container_id: containerRef.current!.id,
        });
      }
    };
    containerRef.current.appendChild(script);
  }, [symbol, width, height, interval]);

  return <div id={`tradingview_${symbol}`} ref={containerRef}></div>;
};

export default TradingViewWidget;
