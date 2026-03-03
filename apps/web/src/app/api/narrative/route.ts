import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/narrative
 * Generates AI narrative for market analysis using Gemini
 * Body: {
 *   type: 'broker' | 'regime' | 'screener' | 'swot',
 *   data: {...relevant data}
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, data, symbol } = body;

    if (!type || !data) {
      return NextResponse.json(
        { error: 'Missing required fields: type and data' },
        { status: 400 }
      );
    }

    // Call Python narrative generator service
    // This would typically call a dedicated service or run inline
    const narrativeResponse = await generateNarrative(type, data, symbol);

    return NextResponse.json({
      type,
      symbol: symbol || 'N/A',
      narrative: narrativeResponse,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error generating narrative:', error);
    return NextResponse.json(
      { error: 'Failed to generate narrative' },
      { status: 500 }
    );
  }
}

/**
 * Generate narrative based on type and data
 * In production, this would call a Python service via subprocess or API
 */
async function generateNarrative(type: string, data: any, symbol?: string): Promise<string> {
  // Basic defensives: if the payload is missing any useful information,
  // return a generic message rather than letting downstream logic blow up.
  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
    switch (type) {
      case 'broker':
        return `📊 Narasi Aliran Broker: tidak ada data tersedia.`;
      case 'regime':
        return `🔍 Narasi Regime Pasar: tidak ada data tersedia.`;
      case 'screener':
        return `🤖 Narasi Screener: tidak ada data tersedia.`;
      case 'swot':
        return `💼 Narasi SWOT: tidak ada data tersedia.`;
      default:
        return 'Jenis narasi tidak dikenali.';
    }
  }

  // Mock narratives for now - in production, would call Python service
  
  switch (type) {
    case 'broker':
      return generateBrokerNarrative(data, symbol);
    case 'regime':
      return generateRegimeNarrative(data);
    case 'screener':
      return generateScreenerNarrative(data);
    case 'swot':
      return generateSWOTNarrative(data, symbol);
    default:
      return 'Jenis narasi tidak dikenali.';
  }
}

function generateBrokerNarrative(data: any, symbol?: string): string {
  const { whales, consistency, wash_sale_score } = data;
  
  let narrative = `📊 Analisis Aliran Broker - ${symbol || 'EMITEN'}\n\n`;
  
  if (wash_sale_score && wash_sale_score > 60) {
    narrative += `⚠️ PERINGATAN: Skor aktivitas mencurigakan tinggi (${wash_sale_score.toFixed(1)}%). `;
    narrative += `Volume tinggi namun akumulasi rendah menunjukkan potensi transaksi semu.\n\n`;
  }
  
  if (whales && whales.length > 0) {
    narrative += `🐋 Aktivitas Paus Terdeteksi:\n`;
    whales.slice(0, 3).forEach((whale: any) => {
      narrative += `- ${whale.broker}: Net Buy ${(whale.net_value / 1e9).toFixed(2)} M (Z-Score: ${whale.z_score.toFixed(2)})\n`;
    });
    narrative += `\n`;
  }
  
  if (consistency) {
    const signal = consistency > 70 ? '✅ Konsisten' : consistency > 40 ? '⚠️ Fluktuatif' : '❌ Tidak konsisten';
    narrative += `🎯 Konsistensi: ${(consistency * 100).toFixed(0)}% - ${signal}\n`;
  }
  
  narrative += `\n💡 Kesimpulan: Pantau pergerakan broker dominan untuk konfirmasi entry/exit points.`;
  
  return narrative;
}

function generateRegimeNarrative(data: any): string {
  const { regime, volatility, rsi, trend_strength } = data;
  
  let narrative = `🔍 Status Pasar Saat Ini\n\n`;
  narrative += `📈 Trend: ${regime}\n`;
  narrative += `📊 Volatilitas: ${volatility}\n`;
  narrative += `📉 RSI: ${rsi.toFixed(1)}\n`;
  narrative += `💪 Kekuatan Trend: ${(trend_strength || 0).toFixed(1)}%\n\n`;
  
  if (rsi > 70) {
    narrative += `⚠️ Overbought - Risiko pullback tinggi. Hindari akumulasi besar.\n`;
  } else if (rsi < 30) {
    narrative += `⚠️ Oversold - Risiko bounce tinggi. Persiapkan entry jika ada konfirmasi.\n`;
  }
  
  if (volatility === 'HIGH' || volatility === 'EXTREME') {
    narrative += `⚡ Volatilitas tinggi - Gunakan stop loss lebih dekat.\n`;
  }
  
  narrative += `\n🎯 Rekomendasi: `;
  if (regime === 'UPTREND' && rsi < 70) {
    narrative += `Trend naik masih sehat, pertahankan posisi buy.`;
  } else if (regime === 'DOWNTREND') {
    narrative += `Hindari entry buy, fokus pada short term patterns saja.`;
  } else {
    narrative += `Pasar sideways, tunggu breakout sebelum mengambil posisi besar.`;
  }
  
  return narrative;
}

function generateScreenerNarrative(data: any): string {
  const { mode, count, signals } = data;
  
  let narrative = `🤖 AI Screener Report (Mode: ${mode})\n\n`;
  narrative += `📍 Total Emiten yang Cocok: ${count || 0}\n`;
  
  if (signals && signals.length > 0) {
    const avgSignal = signals.reduce((a: number, b: number) => a + b, 0) / signals.length;
    narrative += `⭐ Rata-rata Sinyal: ${avgSignal.toFixed(0)}/100\n\n`;
    
    if (mode === 'DAYTRADE') {
      narrative += `🚀 Mode Daytrade: Mencari volatilitas tinggi dan dominasi HAKA.\n`;
      narrative += `Cocok untuk scalping cepat dalam 1-4 jam.`;
    } else if (mode === 'SWING') {
      narrative += `📋 Mode Swing: Mencari akumulasi broker dan pola teknikal solid.\n`;
      narrative += `Cocok untuk holding 2-5 hari untuk keuntungan lebih besar.`;
    }
  }
  
  return narrative;
}

function generateSWOTNarrative(data: any, symbol?: string): string {
  const { strengths, weaknesses, opportunities, threats } = data;
  
  let narrative = `💼 SWOT Analysis - ${symbol || 'EMITEN'}\n\n`;
  
  if (strengths && strengths.length > 0) {
    narrative += `✅ Kekuatan:\n${strengths.map((s: string) => `• ${s}`).join('\n')}\n\n`;
  }
  
  if (weaknesses && weaknesses.length > 0) {
    narrative += `⚠️ Kelemahan:\n${weaknesses.map((w: string) => `• ${w}`).join('\n')}\n\n`;
  }
  
  if (opportunities && opportunities.length > 0) {
    narrative += `💡 Peluang:\n${opportunities.map((o: string) => `• ${o}`).join('\n')}\n\n`;
  }
  
  if (threats && threats.length > 0) {
    narrative += `🚨 Ancaman:\n${threats.map((t: string) => `• ${t}`).join('\n')}\n\n`;
  }
  
  return narrative;
}

/**
 * GET /api/narrative/template
 * Returns available narrative templates
 */
export async function GET(request: Request) {
  const templates = [
    {
      type: 'broker',
      description: 'Broker flow analysis narrative',
      required_fields: ['whales', 'wash_sale_score', 'consistency']
    },
    {
      type: 'regime',
      description: 'Market regime analysis narrative',
      required_fields: ['regime', 'volatility', 'rsi', 'trend_strength']
    },
    {
      type: 'screener',
      description: 'AI Screener results narrative',
      required_fields: ['mode', 'count', 'signals']
    },
    {
      type: 'swot',
      description: 'SWOT analysis narrative',
      required_fields: ['strengths', 'weaknesses', 'opportunities', 'threats']
    }
  ];
  
  return NextResponse.json({
    templates,
    last_updated: new Date().toISOString()
  });
}
